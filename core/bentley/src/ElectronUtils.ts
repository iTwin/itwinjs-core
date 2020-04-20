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

/**
 * Utility to wrap import of the electron module
 * @note The value is set to undefined if not running in Electron.
 * @internal
 */
export const electronRenderer = (isElectronRenderer) ? require("electron") : undefined; // tslint:disable-line:no-var-requires
