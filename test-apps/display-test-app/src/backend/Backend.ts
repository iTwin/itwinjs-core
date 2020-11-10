/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as fs from "fs";
import * as path from "path";
import { UrlFileHandler } from "@bentley/backend-itwin-client";
import { Config, Logger, LogLevel } from "@bentley/bentleyjs-core";
import { IModelJsConfig } from "@bentley/config-loader/lib/IModelJsConfig";
import { IModelBankClient } from "@bentley/imodelhub-client";
import { IModelHost, IModelHostConfiguration, NativeAppBackend } from "@bentley/imodeljs-backend";
import {
  Editor3dRpcInterface, IModelReadRpcInterface, IModelTileRpcInterface, IModelWriteRpcInterface, MobileRpcConfiguration, NativeAppRpcInterface, RpcInterfaceDefinition,
  RpcManager, SnapshotIModelRpcInterface, StandaloneIModelRpcInterface,
} from "@bentley/imodeljs-common";
import { DtaConfiguration } from "../common/DtaConfiguration";
import { DtaRpcInterface } from "../common/DtaRpcInterface";
import { FakeTileCacheService } from "./FakeTileCacheService";

class DisplayTestAppRpc extends DtaRpcInterface {

  public async readExternalSavedViews(bimFileName: string): Promise<string> {
    if (MobileRpcConfiguration.isMobileBackend && process.env.DOCS) {
      const docPath = process.env.DOCS;
      bimFileName = path.join(docPath, bimFileName);
    }

    const esvFileName = this.createEsvFilename(bimFileName);
    if (!fs.existsSync(esvFileName))
      return "";

    const jsonStr = fs.readFileSync(esvFileName).toString();
    return jsonStr ?? "";
  }

  public async writeExternalSavedViews(bimFileName: string, namedViews: string): Promise<void> {
    if (MobileRpcConfiguration.isMobileBackend && process.env.DOCS) {
      const docPath = process.env.DOCS;
      bimFileName = path.join(docPath, bimFileName);
    }

    const esvFileName = this.createEsvFilename(bimFileName);
    return this.writeExternalFile(esvFileName, namedViews);
  }

  public async writeExternalFile(fileName: string, content: string): Promise<void> {
    const filePath = this.getFilePath(fileName);
    if (!fs.existsSync(filePath))
      this.createFilePath(filePath);

    if (fs.existsSync(fileName))
      fs.unlinkSync(fileName);

    fs.writeFileSync(fileName, content);
  }

  private createFilePath(filePath: string) {
    const files = filePath.split(/\/|\\/); // /\.[^/.]+$/ // /\/[^\/]+$/
    let curFile = "";
    for (const file of files) {
      if (file === "")
        break;

      curFile += `${file}\\`;
      if (!fs.existsSync(curFile))
        fs.mkdirSync(curFile);
    }
  }

  private getFilePath(fileName: string): string {
    const slashIndex = fileName.lastIndexOf("/");
    const backSlashIndex = fileName.lastIndexOf("\\");
    if (slashIndex > backSlashIndex)
      return fileName.substring(0, slashIndex);
    else
      return fileName.substring(0, backSlashIndex);
  }

  private createEsvFilename(fileName: string): string {
    const dotIndex = fileName.lastIndexOf(".");
    if (-1 !== dotIndex)
      return `${fileName.substring(0, dotIndex)}_ESV.json`;
    return `${fileName}.sv`;
  }
}

export const getRpcInterfaces = (appType: "native" | "browser"): RpcInterfaceDefinition[] => {
  const rpcs: RpcInterfaceDefinition[] = [
    DtaRpcInterface,
    Editor3dRpcInterface,
    IModelReadRpcInterface,
    IModelTileRpcInterface,
    IModelWriteRpcInterface,
    SnapshotIModelRpcInterface,
    StandaloneIModelRpcInterface,
  ];

  if ("native" === appType)
    rpcs.push(NativeAppRpcInterface);

  return rpcs;
}

const setupStandaloneConfiguration = () => {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"; // (needed temporarily to use self-signed cert to communicate with iModelBank via https)
  IModelJsConfig.init(true /* suppress exception */, true /* suppress error message */, Config.App);

  const configuration: DtaConfiguration = {};
  if (MobileRpcConfiguration.isMobileBackend)
    return configuration;

  // Currently display-test-app ONLY supports opening files from local disk - i.e., "standalone" mode.
  // At some point we will reinstate ability to open from hub.
  configuration.standalone = true;
  configuration.iModelName = process.env.SVT_STANDALONE_FILENAME;
  configuration.standalonePath = process.env.SVT_STANDALONE_FILEPATH; // optional (browser-use only)
  configuration.viewName = process.env.SVT_STANDALONE_VIEWNAME; // optional

  if (undefined !== process.env.SVT_DISABLE_DIAGNOSTICS)
    configuration.enableDiagnostics = false;

  if (undefined !== process.env.SVT_STANDALONE_SIGNIN)
    configuration.signInForStandalone = true;

  if (undefined !== process.env.SVT_READ_WRITE)
    configuration.openReadWrite = true;

  if (undefined !== process.env.SVT_DISABLE_INSTANCING)
    configuration.disableInstancing = true;

  if (undefined !== process.env.SVT_NO_IMPROVED_ELISION)
    configuration.enableImprovedElision = false;

  if (undefined !== process.env.SVT_IGNORE_AREA_PATTERNS)
    configuration.ignoreAreaPatterns = true;

  if (undefined !== process.env.SVT_DISABLE_MAGNIFICATION)
    configuration.disableMagnification = true;

  if (undefined !== process.env.SVT_DISABLE_IDLE_WORK)
    configuration.doIdleWork = false;

  if (undefined !== process.env.SVT_DEBUG_SHADERS)
    configuration.debugShaders = true;

  configuration.useProjectExtents = undefined === process.env.SVT_NO_USE_PROJECT_EXTENTS;

  const parseSeconds = (key: string) => {
    const env = process.env[key];
    if (!env)
      return undefined;

    const val = Number.parseInt(env, 10);
    return Number.isNaN(val) ? undefined : val;
  };

  configuration.tileTreeExpirationSeconds = parseSeconds("SVT_TILETREE_EXPIRATION_SECONDS");
  configuration.tileExpirationSeconds = parseSeconds("SVT_TILE_EXPIRATION_SECONDS");

  const maxToSkipVar = process.env.SVT_MAX_TILES_TO_SKIP;
  if (undefined !== maxToSkipVar) {
    const maxToSkip = Number.parseInt(maxToSkipVar, 10);
    if (!Number.isNaN(maxToSkip))
      configuration.maxTilesToSkip = maxToSkip;
  }

  const minSpatialTolEnv = process.env.SVT_MIN_SPATIAL_TOLERANCE;
  if (undefined !== minSpatialTolEnv) {
    const minSpatialTol = Number.parseFloat(minSpatialTolEnv);
    if (!Number.isNaN(minSpatialTol))
      configuration.minimumSpatialTolerance = minSpatialTol;
  }

  if (undefined !== process.env.SVT_DISABLE_LOG_Z)
    configuration.logarithmicZBuffer = false;

  if (undefined !== process.env.SVT_ENABLE_MAP_TEXTURE_FILTER)
    configuration.filterMapTextures = true;

  if (undefined !== process.env.SVT_DISABLE_MAP_DRAPE_TEXTURE_FILTER)
    configuration.filterMapDrapeTextures = false;

  if (undefined !== process.env.SVT_PRESERVE_SHADER_SOURCE_CODE)
    configuration.preserveShaderSourceCode = true;

  if (undefined !== process.env.SVT_DISABLE_DPI_AWARE_VIEWPORTS)
    configuration.dpiAwareViewports = false;

  const devicePixelRatioOverrideVar = process.env.SVT_DEVICE_PIXEL_RATIO_OVERRIDE;
  if (undefined !== devicePixelRatioOverrideVar) {
    const devicePixelRatioOverride = Number.parseFloat(devicePixelRatioOverrideVar);
    if (!Number.isNaN(devicePixelRatioOverride))
      configuration.devicePixelRatioOverride = devicePixelRatioOverride;
  }

  if (undefined !== process.env.SVT_DPI_LOD)
    configuration.dpiAwareLOD = true;

  if (undefined !== process.env.SVT_NO_CANCEL_TILE_REQUESTS)
    configuration.cancelBackendTileRequests = false;

  const aaSamplesVar = process.env.SVT_AASAMPLES;
  if (undefined !== aaSamplesVar && "0" !== aaSamplesVar && "false" !== aaSamplesVar.toLowerCase()) {
    const aaSamples = Number.parseInt(aaSamplesVar, 10);
    if (!Number.isNaN(aaSamples))
      configuration.antialiasSamples = aaSamples;
  }

  const useWebGL2Var = process.env.SVT_USE_WEBGL2;
  if (undefined !== useWebGL2Var && ("0" === useWebGL2Var || "false" === useWebGL2Var.toLowerCase()))
    configuration.useWebGL2 = false;

  const extensions = process.env.SVT_DISABLED_EXTENSIONS;
  if (undefined !== extensions)
    configuration.disabledExtensions = extensions.split(";");

  configuration.useFakeCloudStorageTileCache = undefined !== process.env.SVT_FAKE_CLOUD_STORAGE;

  configuration.disableEdges = undefined !== process.env.SVT_DISABLE_EDGE_DISPLAY;
  configuration.alwaysLoadEdges = undefined !== process.env.SVT_ALWAYS_LOAD_EDGES;
  configuration.alwaysSubdivideIncompleteTiles = undefined !== process.env.SVT_SUBDIVIDE_INCOMPLETE;

  const configPathname = path.normalize(path.join(__dirname, "..", "..", "build", "configuration.json"));
  try { fs.writeFileSync(configPathname, JSON.stringify(configuration), "utf8"); } catch { }

  return configuration;
}

export const initializeDtaBackend = async () => {
  const dtaConfig = setupStandaloneConfiguration();

  const hostConfig = new IModelHostConfiguration();
  hostConfig.logTileLoadTimeThreshold = 3;
  hostConfig.logTileSizeThreshold = 500000;

  let logLevel = LogLevel.None;
  if (MobileRpcConfiguration.isMobileBackend) {
    // Does not seem DtaConfiguration is used anymore.
  } else {
    if (dtaConfig.customOrchestratorUri)
      hostConfig.imodelClient = new IModelBankClient(dtaConfig.customOrchestratorUri, new UrlFileHandler());

    if (dtaConfig.useFakeCloudStorageTileCache)
      hostConfig.tileCacheCredentials = { service: "external", account: "", accessKey: "" };

    const logLevelEnv = process.env.SVT_LOG_LEVEL as string;
    if (undefined !== logLevelEnv)
      logLevel = Logger.parseLogLevel(logLevelEnv);
  }

  /** register the implementation of our RPCs. */
  RpcManager.registerImpl(DtaRpcInterface, DisplayTestAppRpc);
  if (MobileRpcConfiguration.isMobileBackend)
    await NativeAppBackend.startup(hostConfig);
  else
    await IModelHost.startup(hostConfig);

  // Set up logging (by default, no logging is enabled)
  Logger.initializeToConsole();
  Logger.setLevelDefault(logLevel);
  Logger.setLevel("SVT", LogLevel.Trace);

  if (dtaConfig.useFakeCloudStorageTileCache)
    IModelHost.tileCacheService = new FakeTileCacheService(path.normalize(path.join(__dirname, "tiles")), "http://localhost:3001"); // puts the cache in "./lib/backend/tiles" and serves them from "http://localhost:3001/tiles"
}
