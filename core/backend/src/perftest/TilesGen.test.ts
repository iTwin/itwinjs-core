/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import * as fs from "fs-extra";
import * as os from "os";
import * as path from "path";
import { Config, Logger, LogLevel, OpenMode } from "@bentley/bentleyjs-core";
import { IModelVersion } from "@bentley/imodeljs-common";
import { AuthorizedClientRequestContext } from "@bentley/itwin-client";
import { TestUsers, TestUtility } from "@bentley/oidc-signin-tool";
import { Reporter } from "@bentley/perf-tools/lib/Reporter";
import { StandaloneDb } from "../IModelDb";
import { IModelJsFs } from "../IModelJsFs";
import { IModelTestUtils } from "../test/IModelTestUtils";
import { HubUtility } from "../test/integration/HubUtility";
import { BackendTileGenerator, TileGenParams, TileStats } from "./TilesGenUtils";

interface TileResult {
  nModels: number;
  nRootTiles: number;
  tileTreePropsElapsedSeconds: number;
  nTiles: number;
  nEmptyTiles: number;
  totalTileSizeInKb: number;
  tileGenElapsedSeconds: number;
  totalElapsedSeconds: number;
  tileStats: TileStats[] | undefined;
  OSStats: OSStats; // eslint-disable-line @typescript-eslint/naming-convention
  peakMemUsage: number;
  peakCPUUsage: number;
}

interface ConfigData {
  contextId: string;
  iModelName: string;
  changesetId: string;
  genParams: TileGenParams;
  localPath: string;
}

interface OSStats {
  totalmem: number;
  freemem: number;
  memoryUsage: NodeJS.MemoryUsage;
}

function bytesToMegaBytes(bytes: number): number {
  const megaBytes = bytes / Math.pow(1024, 2);
  return Math.round(megaBytes * 100) / 100;
}

async function writeTileStats(outputDir: string, fileName: string, tileStats: TileStats[]) {
  const tileStatFile = path.join(outputDir, `${fileName}.csv`);

  if (fs.existsSync(tileStatFile))
    fs.removeSync(tileStatFile);

  const out = fs.createWriteStream(tileStatFile, { encoding: "utf8", flags: "wx+" });
  let tileIndex = 1;
  out.write("index,treeId,contentId,size (bytes),elapsedTime (ms)\r\n");
  for (const stat of tileStats) {
    out.write(`${tileIndex++},${stat.treeId},${stat.contentId},${stat.sizeInBytes},${stat.elapsedTime}\r\n`);
  }
  out.close();
}

async function writeTileMetadata(outputDir: string, fileName: string, tileStats: TileStats[]) {
  const tileMetadataPath = path.join(outputDir, `${fileName}_Tiles`);
  if (fs.existsSync(tileMetadataPath))
    fs.removeSync(tileMetadataPath);

  fs.mkdirSync(tileMetadataPath);
  for (const stat of tileStats) {
    const treePath = path.join(tileMetadataPath, stat.treeId.replace(":", "_"));
    if (!fs.existsSync(treePath))
      fs.mkdirSync(treePath);
    const tilePath = path.join(treePath, `${stat.contentId}.json`);
    fs.writeFileSync(tilePath, stat.metadata!, { flag: "w" });
  }
}

async function writeOverallStats(result: TileResult, config: ConfigData, outputFilePath: string) {
  const reporter = new Reporter();
  const testSuite = "TilePerformance";
  const testName = "TileGeneration";

  const info = {
    config,
    modelCount: result.nModels,
    rootTileCount: result.nRootTiles,
    tileCount: result.nTiles,
    emptyTileCount: result.nEmptyTiles,
    tileSizeInKb: result.totalTileSizeInKb,
  };

  reporter.addEntry(testSuite, testName, "Execution time(s)", result.totalElapsedSeconds, info);
  reporter.addEntry(testSuite, testName, "Tile generation time(s)", result.tileGenElapsedSeconds, info);
  reporter.addEntry(testSuite, testName, "Tile Tree Props request time(s)", result.tileTreePropsElapsedSeconds, info);

  reporter.addEntry(testSuite, testName, "Peak memory usage(MB)", result.peakMemUsage, { config, OSStats: result.OSStats }); // eslint-disable-line @typescript-eslint/naming-convention
  reporter.addEntry(testSuite, testName, "Peak CPU usage(%)", result.peakCPUUsage, { config });

  reporter.exportCSV(outputFilePath);
}

async function generateResultFiles(result: TileResult, configData: ConfigData, resultFilePath: string) {
  const outputDir = path.dirname(resultFilePath);
  if (configData.genParams.reportTileStats) {
    await writeTileStats(outputDir, configData.iModelName, result.tileStats!);
  }
  if (configData.genParams.reportTileMetadata) {
    await writeTileMetadata(outputDir, configData.iModelName, result.tileStats!);
  }
  await writeOverallStats(result, configData, resultFilePath);
}

async function generateIModelDbTiles(requestContext: AuthorizedClientRequestContext, config: ConfigData): Promise<TileResult | undefined> {
  let peakMemUsage: number = 0;
  let peakCPUUsage: number = 0;

  console.log(`Started generating tiles for iModel ${config.iModelName}`); // eslint-disable-line no-console

  let iModelDb;
  if (config.localPath) {
    iModelDb = StandaloneDb.openFile(config.localPath, OpenMode.Readonly);
  } else {
    const iModelId = await HubUtility.queryIModelIdByName(requestContext, config.contextId, config.iModelName);
    const version: IModelVersion = config.changesetId ? IModelVersion.asOfChangeSet(config.changesetId) : IModelVersion.latest();

    iModelDb = await IModelTestUtils.downloadAndOpenCheckpoint({ requestContext, contextId: config.contextId, iModelId, asOf: version.toJSON() });
  }
  assert.exists(iModelDb.isOpen, `iModel "${config.iModelName}" not opened`);

  const generator = new BackendTileGenerator(iModelDb, config.genParams);
  // take the initial snapshot of memory usage
  const osStats = {
    totalmem: bytesToMegaBytes(os.totalmem()),
    freemem: bytesToMegaBytes(os.freemem()),
    memoryUsage: process.memoryUsage(),
  };

  let startHRtime = process.hrtime();
  let startCPUUsage = process.cpuUsage();

  const interval = setInterval(() => {
    const elapHRtime = process.hrtime(startHRtime);
    startHRtime = process.hrtime();
    const elapCPUUsage = process.cpuUsage(startCPUUsage);
    startCPUUsage = process.cpuUsage();

    const elapTime = elapHRtime[0] * 1000 + elapHRtime[1] / 1000000;
    const elapUserUsage = elapCPUUsage.user / 1000;
    const elapSysUsage = elapCPUUsage.system / 1000;
    const elapCPUPercent = Math.round((100 * (elapUserUsage + elapSysUsage) / elapTime / os.cpus().length));

    if (elapCPUPercent > peakCPUUsage) {
      peakCPUUsage = elapCPUPercent;
    }
    const elapMemUsage = process.memoryUsage();
    if (elapMemUsage.rss > peakMemUsage) {
      peakMemUsage = elapMemUsage.rss;
    }
  }, 500);

  const stats = await generator.generateTilesForAllModels();
  clearInterval(interval);

  iModelDb.close();
  console.log(`Finished generating tiles for iModel ${config.iModelName}`); // eslint-disable-line no-console

  return {
    nModels: stats.modelCount,
    nRootTiles: stats.rootTileCount,
    tileTreePropsElapsedSeconds: stats.tileTreePropsTime,
    nTiles: stats.tileCount,
    nEmptyTiles: stats.emptyTileCount,
    totalTileSizeInKb: Math.round(stats.totalTileSize / 1024.0),
    tileGenElapsedSeconds: Math.round((stats.totalTileTime / 1000.0) * 100) / 100,
    totalElapsedSeconds: stats.totalTime,
    tileStats: config.genParams.reportTileStats || config.genParams.reportTileMetadata ? stats.tileStats : [],
    OSStats: osStats, // eslint-disable-line @typescript-eslint/naming-convention
    peakMemUsage: bytesToMegaBytes(peakMemUsage),
    peakCPUUsage,
  };
}

describe("TilesGenerationPerformance", () => {
  const config = require(Config.App.getString("imjs_tile_perf_config")); // eslint-disable-line @typescript-eslint/no-var-requires
  const imodels: ConfigData[] = config.iModels;

  let requestContext: AuthorizedClientRequestContext;
  let csvResultPath: string;

  before(async () => {
    assert.isDefined(config.regionId, "No Region defined");
    assert.isDefined(config.contextId, "No ContextId defined");
    imodels.forEach((element) => element.contextId = config.contextId);

    IModelTestUtils.setupLogging();
    Logger.setLevel("TileGenerationPerformance", LogLevel.Error);

    csvResultPath = IModelTestUtils.prepareOutputFile("TilesGen", "TilesGen.results.csv");

    Config.App.merge({ imjs_buddi_resolve_url_using_region: config.regionId }); // eslint-disable-line @typescript-eslint/naming-convention
    if (IModelJsFs.existsSync(config.iModelLocation)) {
      imodels.forEach((element) => element.localPath = path.join(config.iModelLocation, `${element.iModelName}.bim`));
      // delete the .tile file
      const tileFiles = IModelJsFs.readdirSync(config.iModelLocation).filter((fileName: string) => fileName.endsWith(".Tiles"));
      for (const tileFile of tileFiles)
        IModelJsFs.removeSync(path.join(config.iModelLocation, tileFile));
    } else {
      requestContext = await TestUtility.getAuthorizedClientRequestContext(TestUsers.super);
    }
  });

  imodels.forEach(async (configData: ConfigData) =>
    it(`Tile generation ${configData.iModelName}`, async () => {
      const result = await generateIModelDbTiles(requestContext, configData);
      if (result)
        await generateResultFiles(result, configData, csvResultPath);
    }));
});
