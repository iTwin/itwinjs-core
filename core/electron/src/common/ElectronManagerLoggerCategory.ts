/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Logging
 */

/** Logger categories used by this package
 * @note All logger categories in this package start with the `core-backend` prefix.
 * @see [Logger]($bentley)
 * @public
 */
export enum ElectronManagerLoggerCategory {
  /** The logger category used by the following classes:
   * - [[KeyChainStore]]
   */
  Authorization = "core-electron.Authorization",
}
