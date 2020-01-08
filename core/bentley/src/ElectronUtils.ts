/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

declare var __non_webpack_require__: NodeRequire;

function isElectronRendererFn() {
  return (typeof window !== "undefined" && typeof window.process === "object" && (window.process as any).type === "renderer");
}

/**
 * Set to true if the process is running in Electron
 * @internal
 */
export const isElectronRenderer = isElectronRendererFn();

/**
 * Imports the specified module only if it's running in electron
 * @param moduleName
 * @internal
 */
function requireInElectronRenderer(moduleName: string) {
  if (!isElectronRenderer)
    return undefined;

  const realRequire = (typeof __non_webpack_require__ !== "undefined") ? __non_webpack_require__ : require;
  return realRequire(moduleName);
}

/**
 * Utility to wrap import of the electron module
 * @note The value is set to undefined if not running in Electron.
 * @internal
 */
export const electronRenderer = requireInElectronRenderer("electron");
