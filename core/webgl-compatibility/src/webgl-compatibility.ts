/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
export * from "./Capabilities";
export * from "./RenderCompatibility";

// Set the version number so it can be found at runtime. BUILD_SEMVER is replaced at build time by the webpack DefinePlugin.
declare var BUILD_SEMVER: string;
if ((typeof (BUILD_SEMVER) !== "undefined") && (typeof window !== "undefined") && window) {
  if (!(window as any).iModelJsVersions)
    (window as any).iModelJsVersions = new Map<string, string>();
  (window as any).iModelJsVersions.set("webgl-compatibility", BUILD_SEMVER);
}

/** @docs-package-description
 * The webgl-compatibility package provides APIs for determining the level of compatibility of a browser+device with the iModel.js rendering system.
 */

/**
 * @docs-group-description Compatibility
 * APIs for evaluating compatibility with the iModel.js rendering system.
 */
