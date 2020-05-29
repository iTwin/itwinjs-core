/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import "./SVTRpcImpl"; // just to get the RPC implementation registered
import * as fs from "fs";
import * as path from "path";
import { UrlFileHandler } from "@bentley/backend-itwin-client";
import { Config, Logger, LogLevel } from "@bentley/bentleyjs-core";
import { IModelJsConfig } from "@bentley/config-loader/lib/IModelJsConfig";
import { IModelBankClient } from "@bentley/imodelhub-client";
import { IModelHost, IModelHostConfiguration } from "@bentley/imodeljs-backend";
import {
  IModelReadRpcInterface, IModelTileRpcInterface, MobileRpcConfiguration, NativeAppRpcInterface, RpcInterfaceDefinition, SnapshotIModelRpcInterface,
} from "@bentley/imodeljs-common";
import { SVTConfiguration } from "../common/SVTConfiguration";
import SVTRpcInterface from "../common/SVTRpcInterface";
import { FakeTileCacheService } from "./FakeTileCacheService";

IModelJsConfig.init(true /* suppress exception */, true /* suppress error message */, Config.App);
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"; // (needed temporarily to use self-signed cert to communicate with iModelBank via https)

export function getRpcInterfaces(appType: "native" | "browser"): RpcInterfaceDefinition[] {
  const intfcs: RpcInterfaceDefinition[] = [IModelTileRpcInterface, SnapshotIModelRpcInterface, IModelReadRpcInterface, SVTRpcInterface];
  if ("native" === appType)
    intfcs.push(NativeAppRpcInterface);

  return intfcs;
}

function setupStandaloneConfiguration(): SVTConfiguration {
  const configuration: SVTConfiguration = {};
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

  if (undefined !== process.env.SVT_NO_CANCEL_TILE_REQUESTS)
    configuration.cancelBackendTileRequests = false;

  const useWebGL2Var = process.env.SVT_USE_WEBGL2;
  if (undefined !== useWebGL2Var && ("0" === useWebGL2Var || "false" === useWebGL2Var.toLowerCase()))
    configuration.useWebGL2 = false;

  const extensions = process.env.SVT_DISABLED_EXTENSIONS;
  if (undefined !== extensions)
    configuration.disabledExtensions = extensions.split(";");

  configuration.useFakeCloudStorageTileCache = undefined !== process.env.SVT_FAKE_CLOUD_STORAGE;

  configuration.disableEdges = undefined !== process.env.SVT_DISABLE_EDGE_DISPLAY;

  const configPathname = path.normalize(path.join(__dirname, "..", "..", "build", "configuration.json"));
  fs.writeFileSync(configPathname, JSON.stringify(configuration), "utf8");

  return configuration;
}

export async function initializeBackend(): Promise<void> {
  const svtConfig = setupStandaloneConfiguration();

  const hostConfig = new IModelHostConfiguration();
  hostConfig.logTileLoadTimeThreshold = 3;
  hostConfig.logTileSizeThreshold = 500000;

  let logLevel = LogLevel.None;
  if (MobileRpcConfiguration.isMobileBackend) {
    // Does not seem SVTConfiguraiton is used anymore.
  } else {
    if (svtConfig.customOrchestratorUri)
      hostConfig.imodelClient = new IModelBankClient(svtConfig.customOrchestratorUri, new UrlFileHandler());

    if (svtConfig.useFakeCloudStorageTileCache)
      hostConfig.tileCacheCredentials = { service: "external", account: "", accessKey: "" };

    const logLevelEnv = process.env.SVT_LOG_LEVEL as string;
    if (undefined !== logLevelEnv)
      logLevel = Logger.parseLogLevel(logLevelEnv);
  }

  await IModelHost.startup(hostConfig);

  // Set up logging (by default, no logging is enabled)
  Logger.initializeToConsole();
  Logger.setLevelDefault(logLevel);
  Logger.setLevel("SVT", LogLevel.Trace);

  if (svtConfig.useFakeCloudStorageTileCache)
    IModelHost.tileCacheService = new FakeTileCacheService(path.normalize(path.join(__dirname, "..", "..", "build", "tiles")));
}
