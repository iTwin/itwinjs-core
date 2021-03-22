/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/**
 * Set to true if the process is running in Electron renderer process
 * @internal
 * @deprecated use ProcessDetector.isElectronAppFrontend
 */
export const isElectronRenderer = typeof navigator === "object" && navigator.userAgent.toLowerCase().indexOf("electron") >= 0;

/**
 * Set to true if the process is running in Electron main process
 * @internal
 * @deprecated use ProcessDetector.isElectronAppBackend
 */
export const isElectronMain = typeof process === "object" && process.versions.hasOwnProperty("electron");

