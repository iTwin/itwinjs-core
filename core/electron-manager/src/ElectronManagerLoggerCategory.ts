/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Logging */

/** Logger categories used by this package
 * @note All logger categories in this package start with the `imodeljs-backend` prefix.
 * @see [Logger]($bentley)
 * @public
 */
export enum ElectronManagerLoggerCategory {
  /** The logger category used by the following classes:
   * - [[KeyChainStore]]
   */
  Authentication = "electron-manager.Authentication",
}
