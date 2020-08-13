/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

function isElectronRendererFn() {
  return (typeof window !== "undefined" && typeof window.process === "object" && (window.process as any).type === "renderer");
}

/**
 * Set to true if the process is running in Electron
 * @internal
 */
export const isElectronRenderer = isElectronRendererFn();

function electronRendererFn() {
  if (isElectronRenderer) {
    // Wrapping this require in a try/catch signals to webpack that this is only an optional dependency
    try {
      return require("electron"); // eslint-disable-line @typescript-eslint/no-var-requires
    } catch (error) { }
  }
  return undefined;
}

/**
 * Utility to wrap import of the electron module
 * @note The value is set to undefined if not running in Electron.
 * @internal
 */
export const electronRenderer = electronRendererFn();
