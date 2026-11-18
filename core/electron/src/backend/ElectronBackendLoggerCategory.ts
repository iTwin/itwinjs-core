/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Main
 */

/** Logger categories used by the backend of this package
 * @note All logger categories in this package start with the `core-electron` prefix.
 * @see [Logger]($bentley)
 * @beta
 */
export enum ElectronBackendLoggerCategory {
  /** The logger category used by [[ElectronHost]], including for IPC messages rejected by [[ElectronHostOptions.restrictIpcToFrontendOrigin]]. */
  ElectronHost = "core-electron.ElectronHost",
}
