/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Logging
 */

/** Logger categories used by this package
 * @note All logger categories in this package start with the `imodelhub-client` prefix.
 * @see [Logger]($bentley)
 * @public
 */
export enum IModelHubClientLoggerCategory {
  /** The logger category used by iModelHub clients */
  IModelHub = "imodelhub-client.iModelHub",

  /** @internal */
  IModelBank = "imodelhub-client.iModelBank",

  /** The logger category used for file handlers */
  FileHandlers = "imodelhub-client.FileHandlers",

  /** The logger category used for requests. */
  Request = "imodelhub-client.Request",

  /** The logger category used by base clients */
  Clients = "imodelhub-client.Clients",
}
