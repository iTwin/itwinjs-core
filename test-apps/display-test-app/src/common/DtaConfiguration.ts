/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** Parameters for starting display-test-app with a specified initial configuration */
export interface DtaConfiguration {
  customOrchestratorUri?: string;
  viewName?: string;
  // standalone-specific config:
  standalone?: boolean;
  iModelName?: string;
  filename?: string;
  standalonePath?: string;    // Used when run in the browser - a common base path for all standalone imodels
  signInForStandalone?: boolean; // If true, and standalone is true, then sign in. Required when opening local files containing reality models.
  enableDiagnostics?: boolean; // If true, all RenderDiagnostics will be enabled (assertions, debug output, GL state checks).
  disabledExtensions?: string[]; // An array of names of WebGL extensions to be disabled
  disableInstancing?: boolean; // default false
  enableImprovedElision?: boolean; // default true
  ignoreAreaPatterns?: boolean; // default false
  enableExternalTextures?: boolean; // default true
  disableMagnification?: boolean;
  preserveShaderSourceCode?: boolean;
  useProjectExtents?: boolean; // default ON
  maxTilesToSkip?: number;
  tileTreeExpirationSeconds?: number;
  tileExpirationSeconds?: number;
  logarithmicZBuffer?: boolean; // default ON (if extension supported)
  filterMapTextures?: boolean;  // default OFF
  filterMapDrapeTextures?: boolean; // default ON (if extension supported)
  useFakeCloudStorageTileCache?: boolean; // default OFF
  dpiAwareViewports?: boolean; // default ON
  devicePixelRatioOverride?: number; // default undefined
  dpiAwareLOD?: boolean; // default OFF
  disableEdges?: boolean; // default OFF
  useWebGL2?: boolean; // default ON
  doIdleWork?: boolean; // default ON
  debugShaders?: boolean; // default OFF
  alwaysLoadEdges?: boolean; // default OFF
  minimumSpatialTolerance?: number; // default undefined (no minimum)
  alwaysSubdivideIncompleteTiles?: boolean; // default OFF
  antialiasSamples?: number; // default 1 (No antialiasing)
  openReadWrite?: boolean; // default false
}
