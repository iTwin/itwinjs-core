/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @module Logging */

/** Logger categories used by this package
 * @note All logger categories in this package start with the `imodeljs-clients` prefix.
 * @see [Logger]($bentley)
 * @beta
 */
export enum ClientsLoggerCategory {
  /** The logger category used by base clients */
  Clients = "imodeljs-clients.Clients",

  /** The logger category used when converting to/from ECJson. */
  ECJson = "imodeljs-clients.ECJson",

  /** @internal */
  IModelBank = "imodeljs-clients.iModelBank",

  /** The logger category used for interactions with iModelHub. */
  IModelHub = "imodeljs-clients.imodelhub",

  /** @internal */
  ImsClients = "imodeljs-clients.ImsClients",

  Request = "imodeljs-clients.Request",

  /** @internal */
  UlasClient = "imodeljs-clients.ulasclient",
}
