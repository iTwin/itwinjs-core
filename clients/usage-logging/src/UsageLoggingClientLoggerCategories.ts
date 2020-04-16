/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Logging
 */

/** Logger categories used by this package
 * @note All logger categories in this package start with the `imodeljs-clients` prefix.
 * @see [Logger]($bentley)
 * @beta
 */
export enum UsageLoggingClientLoggerCategory {
  /** The logger category used by base clients */
  Client = "usage-logging-client",
}
