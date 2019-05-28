/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { ClientRequestContext, StopWatch, BeTimePoint, BeDuration, using, DbResult } from "@bentley/bentleyjs-core";
import { IModelDb } from "../imodeljs-backend";
import { TileTreeProps, TileProps } from "@bentley/imodeljs-common";
import { Range3d } from "@bentley/geometry-core";
import { IModelJsFs } from "../IModelJsFs";
import { GeometricModel3d } from "../Model";
import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";
import * as os from "os";
import { IModelHost } from "../IModelHost";
import { ECDb, ECDbOpenMode } from "../ECDb";
// tslint:disable:no-console
interface ContentIdSpec {
  depth: number;
  i: number;
  j: number;
  k: number;
  multiplier: number;
}

interface Tile extends TileProps {
  depth: number;
  root: TileTreeProps;
}

interface TileContentId {
  treeId: string;
  contentId: string;
}

interface TileStats {
  treeId: string;
  contentId: string;
  sizeInBytes: number;
  elapsedTime: number;
}

interface TileResult {
  iModelPath: string;
  maxTileDepth: number;
  useConcurrentTask: boolean;
  useTileCache: boolean;
  deleteTileCache: boolean;
  nModels: number;
  nRootTiles: number;
  tileTreePropsElapsedSeconds: number;
  nTiles: number;
  nEmptyTiles: number;
  totalTileSizeInKb: number;
  tileGenElapsedSeconds: number;
  tileGenSpeedKbs: number;
  avgTileGenSpeedKbs: number;
  tileStats: TileStats[] | undefined;
}

interface TileGenParams {
  useTileCache: boolean;
  deleteTileCache: boolean;
  useConcurrentTask: boolean;
  maxTileDepth: number;
  reportTileStats: boolean;
  sqlitePageSizeInKb?: number;
  datasetFolder: string;
  reportFolder?: string;
}

const kEmptyTileSize = 332; // bytes
const kIdV2Seperator = "_";
const kIdV1Seperator = "/";
const kInstancingFlag = 1;
const kTileIOMajorVersion = 2;
const contentIdPrefix = kIdV2Seperator + kTileIOMajorVersion.toString(16) + kIdV2Seperator + kInstancingFlag.toString(16) + kIdV2Seperator;
function idFromSpec(spec: ContentIdSpec): string {
  return computeId(spec.depth, spec.i, spec.j, spec.k, spec.multiplier);
}
function computeId(depth: number, i: number, j: number, k: number, mult: number): string {
  return contentIdPrefix + join(depth, i, j, k, mult);
}
function join(depth: number, i: number, j: number, k: number, mult: number): string {
  const sep = kIdV2Seperator;
  return depth.toString(16) + sep + i.toString(16) + sep + j.toString(16) + sep + k.toString(16) + sep + mult.toString(16);
}
function specFromId(id: string): ContentIdSpec {
  const sep = id.search(kIdV2Seperator) < 0 ? kIdV1Seperator : kIdV2Seperator; // a quick fix around root tile spec vs child contentid
  const parts = id.split(sep);
  const len = parts.length;
  return {
    depth: parseInt(parts[len - 5], 16),
    i: parseInt(parts[len - 4], 16),
    j: parseInt(parts[len - 3], 16),
    k: parseInt(parts[len - 2], 16),
    multiplier: parseInt(parts[len - 1], 16),
  };
}

function bisectRange3d(range: Range3d, takeUpper: boolean): void {
  const diag = range.diagonal();
  const pt = takeUpper ? range.high : range.low;
  if (diag.x > diag.y && diag.x > diag.z)
    pt.x = (range.low.x + range.high.x) / 2.0;
  else if (diag.y > diag.z)
    pt.y = (range.low.y + range.high.y) / 2.0;
  else
    pt.z = (range.low.z + range.high.z) / 2.0;
}

async function getChildrenProps(parent: Tile): Promise<Tile[]> {
  const kids: Tile[] = [];

  // Leaf nodes have no children.
  if (parent.isLeaf)
    return kids;

  // Sub-divide parent's range into 4 (for 2d trees) or 8 (for 3d trees) child tiles.
  const parentSpec = specFromId(parent.contentId);
  const childSpec: ContentIdSpec = { ...parentSpec };
  childSpec.depth = Number((parent as any).depth) + 1;

  const bisectRange = bisectRange3d;
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 2; j++) {
      for (let k = 0; k < (2); k++) {
        const range: Range3d = Range3d.fromJSON(parent.range);
        bisectRange(range, 0 === i);
        bisectRange(range, 0 === j);
        bisectRange(range, 0 === k);

        childSpec.i = parentSpec.i * 2 + i;
        childSpec.j = parentSpec.j * 2 + j;
        childSpec.k = parentSpec.k * 2 + k;

        const childId = idFromSpec(childSpec);
        kids.push({ contentId: childId, range: range.toJSON(), maximumSize: 512, depth: childSpec.depth, root: parent.root });
      }
    }
  }

  return kids;
}

async function getGeometric3dModels(conn: IModelDb): Promise<GeometricModel3d[]> {
  const models: GeometricModel3d[] = [];
  for await (const row of conn.query("SELECT ECInstanceId from bis.GeometricModel3d")) {
    models.push(conn.models.getModel<GeometricModel3d>(row.id));
  }
  return models;
}

async function getTileTreeProps(conn: IModelDb, clientReqCtx: ClientRequestContext, models: GeometricModel3d[], skipEmptyRootTiles: boolean): Promise<Tile[]> {
  const tiles: Tile[] = [];
  for (const model of models) {
    const props: TileTreeProps = await conn.tiles.requestTileTreeProps(clientReqCtx, model.id);
    if (props.rootTile.isLeaf && skipEmptyRootTiles)
      continue;
    tiles.push({ depth: 0, root: props, ...props.rootTile });
  }
  return tiles;
}

async function getBreathFirstChildrenProps(rootTile: Tile, maxDepth: number): Promise<Tile[]> {
  const todo = [rootTile];
  const tiles = [];
  while (todo.length > 0) {
    const current = todo.pop()!;
    if (current.contentId !== rootTile.contentId)
      tiles.push(current);
    if (current.depth <= maxDepth) {
      const children: Tile[] = await getChildrenProps(current);
      todo.push(...children);
    }
  }
  return tiles;
}

async function generateContentIds(rootTiles: Tile[], maxDepth: number): Promise<TileContentId[]> {
  const ids: TileContentId[] = [];
  for (const rootTile of rootTiles) {
    const tiles = await getBreathFirstChildrenProps(rootTile, maxDepth);
    for (const tile of tiles) {
      ids.push({ treeId: tile.root.id, contentId: tile.contentId });
    }
  }
  return ids;
}

function changePageSize(iModelPath: string, pageSizeInKb: number) {
  using(new ECDb(), (ecdb: ECDb) => {
    ecdb.openDb(iModelPath, ECDbOpenMode.Readwrite);
    if (!ecdb.isOpen)
      throw new Error(`changePageSize() fail to open file ${iModelPath}`);
    const currentPageSize = ecdb.withPreparedSqliteStatement(`PRAGMA page_size`, (stmt) => {
      if (DbResult.BE_SQLITE_ROW !== stmt.step())
        throw new Error(`changePageSize() fail to change page size to ${pageSizeInKb} Kb for ${iModelPath}`);
      return stmt.getValue(0).getInteger();
    });
    if (currentPageSize !== (pageSizeInKb * 1024)) {
      ecdb.withPreparedSqliteStatement(`PRAGMA page_size=${pageSizeInKb * 1024}`, (stmt) => {
        if (DbResult.BE_SQLITE_DONE !== stmt.step())
          throw new Error(`changePageSize() fail to change page size to ${pageSizeInKb} Kb for ${iModelPath}`);
      });
      ecdb.withPreparedSqliteStatement(`VACUUM`, (stmt) => {
        if (DbResult.BE_SQLITE_DONE !== stmt.step())
          throw new Error(`changePageSize() fail to vacuum ${iModelPath}`);
      });
    }
  });
}

async function reportProgress(c: number, m: number) {
  readline.moveCursor(process.stdout, -20, 0);
  process.stdout.write(`Progress ... ${((c / m) * 100).toFixed(2)}%`);
  if (c === m) {
    process.stdout.write(os.EOL);
  }
}

async function generateTileFromSnapshot(iModelPath: string, useTileCache: boolean, deleteTileCache: boolean, useConcurrentTask: boolean, maxTileDepth: number, returnTileStats: boolean): Promise<TileResult> {
  IModelHost.platform.setUseTileCache(useTileCache);
  if (deleteTileCache) {
    const tileCacheFile = iModelPath + ".Tiles";
    if (IModelJsFs.existsSync(tileCacheFile))
      IModelJsFs.removeSync(tileCacheFile);

    const tileCacheJournalFile = iModelPath + ".Tiles-journal";
    if (IModelJsFs.existsSync(tileCacheJournalFile))
      IModelJsFs.removeSync(tileCacheJournalFile);
  }
  const sp = new StopWatch();
  const conn = IModelDb.openSnapshot(iModelPath);
  const clientReqCtx = new ClientRequestContext();
  const tileStats: TileStats[] = [];
  const models = await getGeometric3dModels(conn);
  sp.start();
  const rootTiles = await getTileTreeProps(conn, clientReqCtx, models, true);
  sp.stop();
  const contentIds = await generateContentIds(rootTiles, maxTileDepth);
  const totalTime = new StopWatch(undefined, true);
  let totalTileSize = 0;
  let emptyTileCount = 0;
  let totalTileTimeInSeconds = 0;
  let nTiles = 0;
  readline.clearLine(process.stdout, 0);
  readline.moveCursor(process.stdout, -20, 0);
  await reportProgress(nTiles, contentIds.length);
  if (useConcurrentTask) {
    const tileReqs = [];
    for (const id of contentIds) {
      tileReqs.push(new Promise(async (resolve) => {
        const tileTime = new StopWatch(undefined, true);
        // console.log(`${id.treeId} ${id.contentId} `);
        const tile = await conn.tiles.requestTileContent(clientReqCtx, id.treeId, id.contentId);
        tileTime.stop();
        totalTileTimeInSeconds += tileTime.elapsed.seconds;
        totalTileSize += tile.length;
        nTiles++;
        if (tile.length <= kEmptyTileSize)
          emptyTileCount++;
        if (returnTileStats)
          tileStats.push({ treeId: id.treeId, contentId: id.contentId, sizeInBytes: tile.length, elapsedTime: tileTime.elapsed.milliseconds });
        await reportProgress(nTiles, contentIds.length);
        resolve();
      }));
    }
    await Promise.all(tileReqs);
  } else {
    for (const id of contentIds) {
      const tileTime = new StopWatch(undefined, true);
      // console.log(`Requesting ${id.treeId} ${id.contentId} `);
      const tile = await conn.tiles.requestTileContent(clientReqCtx, id.treeId, id.contentId);
      tileTime.stop();
      totalTileTimeInSeconds += tileTime.elapsed.seconds;
      totalTileSize += tile.length;
      nTiles++;
      // console.log(`Got it! ${id.treeId} ${id.contentId} ${tile.length} ${tileTime.elapsedSeconds}`);
      if (tile.length <= kEmptyTileSize)
        emptyTileCount++;
      if (returnTileStats)
        tileStats.push({ treeId: id.treeId, contentId: id.contentId, sizeInBytes: tile.length, elapsedTime: tileTime.elapsed.milliseconds });
      await reportProgress(nTiles, contentIds.length);
    }
  }
  totalTime.stop();
  return {
    iModelPath,
    maxTileDepth,
    useConcurrentTask,
    useTileCache,
    deleteTileCache,
    nModels: models.length,
    nRootTiles: rootTiles.length,
    tileTreePropsElapsedSeconds: sp.elapsedSeconds,
    nTiles,
    nEmptyTiles: emptyTileCount,
    totalTileSizeInKb: Math.round(totalTileSize / 1024),
    tileGenElapsedSeconds: Math.round(totalTime.elapsedSeconds),
    tileGenSpeedKbs: Math.round((totalTileSize / 1024.0) / totalTime.elapsedSeconds),
    avgTileGenSpeedKbs: Math.round((totalTileSize / 1024.0) / totalTileTimeInSeconds),
    tileStats: returnTileStats ? tileStats : undefined,
  };
}

async function writeTileStates(reportFolder: string, run: BeTimePoint, bimFile: string, tileStats: TileStats[]) {
  const tileStatFile = path.join(reportFolder, `${run.milliseconds}-${bimFile}.csv`);
  const out = fs.createWriteStream(tileStatFile, { encoding: "utf8", flags: "wx+" });
  let tileIndex = 1;
  out.write("index,treeId,contentId,size (bytes),elapsedTime (ms)\r\n");
  for (const tileStat of tileStats) {
    out.write(`${tileIndex},${tileStat.treeId},${tileStat.contentId},${tileStat.sizeInBytes},${tileStat.elapsedTime}\r\n`);
    ++tileIndex;
  }
  out.close();
}

async function generateResultForDataset(params: TileGenParams) {
  if (!params.reportFolder)
    params.reportFolder = params.datasetFolder;

  const bimFiles = fs.readdirSync(params.datasetFolder).filter((fileName) => fileName.endsWith(".bim"));
  const run = BeTimePoint.now().minus(BeDuration.fromMilliseconds(1554830762265));
  const csvPath = path.join(params.reportFolder, `${run.milliseconds}-result.csv`);
  let fileIndex = 1;
  let reportText: string | undefined;
  if (IModelJsFs.existsSync(csvPath))
    IModelJsFs.removeSync(csvPath);

  for (const bimFile of bimFiles) {
    const bimFilePath = path.join(params.datasetFolder, bimFile);
    const sizeOfFileInGb = (IModelJsFs.lstatSync(bimFilePath)!.size / (1024 * 1024 * 1024)).toFixed(4);
    console.log(`Generating Tiles for (${fileIndex}/${bimFiles.length}) [size=${sizeOfFileInGb} GB] [file=${bimFilePath}]`);
    if (params.sqlitePageSizeInKb) {
      changePageSize(bimFilePath, params.sqlitePageSizeInKb);
    }
    const result = await generateTileFromSnapshot(bimFilePath, params.useTileCache, params.deleteTileCache, params.useConcurrentTask, params.maxTileDepth, params.reportTileStats);
    if (params.reportTileStats) {
      await writeTileStates(params.reportFolder, run, bimFile, result.tileStats!);
      result.tileStats = undefined;
    }
    if (!reportText) {
      reportText = Object.keys(result).slice(0, -1).join(",") + os.EOL;
    }
    reportText += Object.values(result).slice(0, -1).join(",") + os.EOL;
    fs.writeFileSync(csvPath, reportText); // regularly write so we do not loose all result because of error.
    fileIndex++;
  }
}
/* This test suite require configuring dataset path
**/
describe.skip("Tiles Generation Performance", () => {
  it("Tile generation with CONFIG-1", async () => {
    await generateResultForDataset({
      useTileCache: false,
      deleteTileCache: true,
      useConcurrentTask: false,
      maxTileDepth: 1,
      reportTileStats: true,
      datasetFolder: process.env.TILE_PERF_TEST_DATASET_PATH || "E:/dataset",
      reportFolder: process.env.TILE_PERF_TEST_REPORT_PATH,
    });
  });
});
