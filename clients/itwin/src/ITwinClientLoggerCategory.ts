/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Logging
 */

/** Logger categories used by this package
 * @note All logger categories in this package start with the `itwin-client` prefix.
 * @see [Logger]($bentley)
 * @beta
 */
export enum ITwinClientLoggerCategory {
  /** The logger category used by base clients */
  Clients = "itwin-client.Clients",

  Request = "itwin-client.Request",

  Authorization = "itwin-client.Authorization",
}
