/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Logging */

/** Logger categories used by this package
 * @note All logger categories in this package start with the `imodeljs-clients` prefix.
 * @see [Logger]($bentley)
 * @public
 */
export enum LoggerCategory {
  /** The logger category used for interactions with iModelHub.
   * @note Should match LoggerCategory.IModelHub from @bentley/imodeljs-clients.
   */
  IModelHub = "imodeljs-clients.imodelhub",

  /** The logger category used by OidcDeviceClient */
  OidcDeviceClient = "imodeljs-clients-device.OidcDeviceClient",
}
