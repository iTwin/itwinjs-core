/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { GuidString, ProcessDetector } from "@itwin/core-bentley";

export interface DtaBooleanConfiguration {
  // standalone-specific config:
  standalone?: boolean;
  signInForStandalone?: boolean; // If true, and standalone is true, then sign in. Required when opening local files containing reality models.
  enableDiagnostics?: boolean; // If true, all RenderDiagnostics will be enabled (assertions, debug output, GL state checks).
  disableInstancing?: boolean; // default false
  disableIndexedEdges?: boolean; // default false
  enableImprovedElision?: boolean; // default true
  ignoreAreaPatterns?: boolean; // default false
  enableExternalTextures?: boolean; // default true
  enableFrontendScheduleScripts?: boolean; // default true
  disableMagnification?: boolean;
  disableBRepCache?: boolean; // default true
  preserveShaderSourceCode?: boolean;
  useProjectExtents?: boolean; // default ON
  logarithmicZBuffer?: boolean; // default ON (if extension supported)
  dpiAwareViewports?: boolean; // default ON
  dpiAwareLOD?: boolean; // default OFF
  disableEdges?: boolean; // default OFF
  useWebGL2?: boolean; // default ON
  errorOnMissingUniform?: boolean; // default true
  debugShaders?: boolean; // default OFF
  alwaysLoadEdges?: boolean; // default OFF
  alwaysSubdivideIncompleteTiles?: boolean; // default OFF
  openReadWrite?: boolean; // default false
  devTools?: boolean; // default true
  cacheTileMetadata?: boolean; // default false
  ignoreCache?: boolean; // default is undefined, set to true to delete a cached version of a remote imodel before opening it.
  noElectronAuth?: boolean; // if true, don't initialize auth client. It currently has a bug that produces an exception on every attempt to obtain access token, i.e., every RPC call.
  noImdlWorker?: boolean; // if true, parse iMdl content on main thread instead of web worker (easier to debug).
}

export interface DtaStringConfiguration {
  customOrchestratorUri?: string;
  viewName?: string;
  iModelName?: string;
  filename?: string;
  standalonePath?: string;    // Used when run in the browser - a common base path for all standalone imodels
  startupMacro?: string;    // Used when running a macro at startup, specifies file path
  iTwinId?: GuidString; // default is undefined, used by spatial classification to query reality data from context share, and by iModel download
  mapBoxKey?: string; // default undefined
  bingMapsKey?: string; // default undefined
  cesiumIonKey?: string; // default undefined
  logLevel?: string; // default undefined
  windowSize?: string; // default undefined
  iModelId?: GuidString; // default is undefined, the ID of the iModel to download and open from the hub
  urlPrefix?: string; // default is undefined, used to override the default URL prefix for iModel Hub access
  oidcClientId?: string; // default is undefined, used for auth setup
  oidcScope?: string; // default is undefined, used for auth setup
  oidcRedirectUri?: string; // default is undefined, used for auth setup
  frontendTilesUrlTemplate?: string; // if set, specifies url for @itwin/frontend-tiles to obtain tile trees for spatial views.  See README.md
}

export interface DtaNumberConfiguration {
  maxTilesToSkip?: number;
  tileTreeExpirationSeconds?: number;
  tileExpirationSeconds?: number;
  devicePixelRatioOverride?: number; // default undefined
  minimumSpatialTolerance?: number; // default undefined (no minimum)
  antialiasSamples?: number; // default 1 (No antialiasing)
}

export interface DtaOtherConfiguration {
  disabledExtensions?: string[]; // An array of names of WebGL extensions to be disabled
  gpuMemoryLimit?: string | number; // see GpuMemoryLimit in core-frontend for supported string values
}

/** Parameters for starting display-test-app with a specified initial configuration */
export type DtaConfiguration = DtaBooleanConfiguration & DtaStringConfiguration & DtaNumberConfiguration & DtaOtherConfiguration;

let configuration: DtaConfiguration | undefined;

/** Parses a DtaConfiguration out of the environment (i.e. `process.env`)
 * Note: This method can be run on both the backend and the frontend.
 *
 * Note: The environment vars are only parsed the first time this method is called in each process (once in backend and once in frontend).
 *      All subsequent calls will return the initial config.
 */
export const getConfig = (): DtaConfiguration => {
  if (undefined !== configuration)
    return configuration;

  configuration = {};
  if (ProcessDetector.isMobileAppBackend)
    return configuration;

  // Currently display-test-app ONLY supports opening files from local disk - i.e., "standalone" mode.
  // At some point we will reinstate ability to open from hub.
  configuration.standalone = true;
  configuration.iModelName = process.env.IMJS_STANDALONE_FILENAME;
  configuration.standalonePath = process.env.IMJS_STANDALONE_FILEPATH; // optional (browser-use only)
  configuration.viewName = process.env.IMJS_STANDALONE_VIEWNAME; // optional
  configuration.startupMacro = process.env.IMJS_STARTUP_MACRO;
  configuration.frontendTilesUrlTemplate = process.env.IMJS_FRONTEND_TILES_URL_TEMPLATE;

  if (undefined !== process.env.IMJS_DISABLE_DIAGNOSTICS)
    configuration.enableDiagnostics = false;

  if (undefined !== process.env.IMJS_STANDALONE_SIGNIN)
    configuration.signInForStandalone = true;

  if (undefined !== process.env.IMJS_READ_WRITE)
    configuration.openReadWrite = true;

  if (undefined !== process.env.IMJS_DISABLE_INSTANCING)
    configuration.disableInstancing = true;

  if (undefined !== process.env.IMJS_DISABLE_INDEXED_EDGES)
    configuration.disableIndexedEdges = true;

  if (undefined !== process.env.IMJS_NO_IMPROVED_ELISION)
    configuration.enableImprovedElision = false;

  if (undefined !== process.env.IMJS_IGNORE_AREA_PATTERNS)
    configuration.ignoreAreaPatterns = true;

  if (undefined !== process.env.IMJS_NO_EXTERNAL_TEXTURES)
    configuration.enableExternalTextures = false;

  if (undefined !== process.env.IMJS_NO_FRONTEND_SCHEDULE_SCRIPTS)
    configuration.enableFrontendScheduleScripts = false;

  if (undefined !== process.env.IMJS_DISABLE_MAGNIFICATION)
    configuration.disableMagnification = true;

  if (undefined !== process.env.IMJS_DISABLE_BREP_CACHE)
    configuration.disableBRepCache = true;

  if (undefined !== process.env.IMJS_DISABLE_UNIFORM_ERRORS)
    configuration.errorOnMissingUniform = false;

  if (undefined !== process.env.IMJS_DEBUG_SHADERS)
    configuration.debugShaders = true;

  if (undefined !== process.env.IMJS_BING_MAPS_KEY)
    configuration.bingMapsKey = process.env.IMJS_BING_MAPS_KEY;

  if (undefined !== process.env.IMJS_MAPBOX_KEY)
    configuration.mapBoxKey = process.env.IMJS_MAPBOX_KEY;

  if (undefined !== process.env.IMJS_CESIUM_ION_KEY)
    configuration.cesiumIonKey = process.env.IMJS_CESIUM_ION_KEY;

  if (undefined !== process.env.IMJS_LOG_LEVEL)
    configuration.logLevel = process.env.IMJS_LOG_LEVEL;

  if (undefined !== process.env.IMJS_WINDOW_SIZE)
    configuration.windowSize = process.env.IMJS_WINDOW_SIZE;

  configuration.devTools = undefined === process.env.IMJS_NO_DEV_TOOLS;
  configuration.cacheTileMetadata = undefined !== process.env.IMJS_CACHE_TILE_METADATA;
  configuration.useProjectExtents = undefined === process.env.IMJS_NO_USE_PROJECT_EXTENTS;
  configuration.noElectronAuth = undefined !== process.env.IMJS_NO_ELECTRON_AUTH;
  configuration.noImdlWorker = undefined !== process.env.IMJS_NO_IMDL_WORKER;
  const gpuMemoryLimit = process.env.IMJS_GPU_MEMORY_LIMIT;
  if (undefined !== gpuMemoryLimit) {
    const gpuByteLimit = Number.parseInt(gpuMemoryLimit, 10);
    configuration.gpuMemoryLimit = Number.isNaN(gpuByteLimit) ? gpuMemoryLimit : gpuByteLimit;
  }

  const parseSeconds = (key: string) => {
    const env = process.env[key];
    if (!env)
      return undefined;

    const val = Number.parseInt(env, 10);
    return Number.isNaN(val) ? undefined : val;
  };

  configuration.tileTreeExpirationSeconds = parseSeconds("IMJS_TILETREE_EXPIRATION_SECONDS");
  configuration.tileExpirationSeconds = parseSeconds("IMJS_TILE_EXPIRATION_SECONDS");

  const maxToSkipVar = process.env.IMJS_MAX_TILES_TO_SKIP;
  if (undefined !== maxToSkipVar) {
    const maxToSkip = Number.parseInt(maxToSkipVar, 10);
    if (!Number.isNaN(maxToSkip))
      configuration.maxTilesToSkip = maxToSkip;
  }

  const minSpatialTolEnv = process.env.IMJS_MIN_SPATIAL_TOLERANCE;
  if (undefined !== minSpatialTolEnv) {
    const minSpatialTol = Number.parseFloat(minSpatialTolEnv);
    if (!Number.isNaN(minSpatialTol))
      configuration.minimumSpatialTolerance = minSpatialTol;
  }

  if (undefined !== process.env.IMJS_DISABLE_LOG_Z)
    configuration.logarithmicZBuffer = false;

  if (undefined !== process.env.IMJS_PRESERVE_SHADER_SOURCE_CODE)
    configuration.preserveShaderSourceCode = true;

  if (undefined !== process.env.IMJS_DISABLE_DPI_AWARE_VIEWPORTS)
    configuration.dpiAwareViewports = false;

  const devicePixelRatioOverrideVar = process.env.IMJS_DEVICE_PIXEL_RATIO_OVERRIDE;
  if (undefined !== devicePixelRatioOverrideVar) {
    const devicePixelRatioOverride = Number.parseFloat(devicePixelRatioOverrideVar);
    if (!Number.isNaN(devicePixelRatioOverride))
      configuration.devicePixelRatioOverride = devicePixelRatioOverride;
  }

  if (undefined !== process.env.IMJS_DPI_LOD)
    configuration.dpiAwareLOD = true;

  const aaSamplesVar = process.env.IMJS_AASAMPLES;
  if (undefined !== aaSamplesVar && "0" !== aaSamplesVar && "false" !== aaSamplesVar.toLowerCase()) {
    const aaSamples = Number.parseInt(aaSamplesVar, 10);
    if (!Number.isNaN(aaSamples))
      configuration.antialiasSamples = aaSamples;
  }

  const useWebGL2Var = process.env.IMJS_USE_WEBGL2;
  if (undefined !== useWebGL2Var && ("0" === useWebGL2Var || "false" === useWebGL2Var.toLowerCase()))
    configuration.useWebGL2 = false;

  const extensions = process.env.IMJS_DISABLED_EXTENSIONS;
  if (undefined !== extensions)
    configuration.disabledExtensions = extensions.split(";");

  configuration.disableEdges = undefined !== process.env.IMJS_DISABLE_EDGE_DISPLAY;
  configuration.alwaysLoadEdges = undefined !== process.env.IMJS_ALWAYS_LOAD_EDGES;
  configuration.alwaysSubdivideIncompleteTiles = undefined !== process.env.IMJS_SUBDIVIDE_INCOMPLETE;

  configuration.iTwinId = process.env.IMJS_ITWIN_ID;

  configuration.iModelId = process.env.IMJS_IMODEL_ID;
  configuration.urlPrefix = process.env.IMJS_URL_PREFIX;
  if (ProcessDetector.isElectronAppFrontend) {
    configuration.oidcClientId = process.env.IMJS_OIDC_ELECTRON_TEST_CLIENT_ID;
    configuration.oidcScope = process.env.IMJS_OIDC_ELECTRON_TEST_SCOPES;
    configuration.oidcRedirectUri = process.env.IMJS_OIDC_ELECTRON_TEST_REDIRECT_URI;
  } else {
    configuration.oidcClientId = process.env.IMJS_OIDC_CLIENT_ID;
    configuration.oidcScope = process.env.IMJS_OIDC_SCOPE;
    configuration.oidcRedirectUri = process.env.IMJS_OIDC_REDIRECT_URI;
  }

  configuration.ignoreCache = undefined !== process.env.IMJS_IGNORE_CACHE;

  return configuration;
};
