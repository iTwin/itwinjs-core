/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Logging
 */

/** Logger categories used by this package
 * @note All logger categories in this package start with the `wsg-client` prefix.
 * @see [Logger]($bentley)
 * @internal
 */
export enum WsgClientLoggerCategory {
  /** The logger category used by iModelHub clients */
  Client = "wsg-client.Client",

  /** The logger category used when converting to/from ECJson. */
  ECJson = "wsg-client.ECJson",
}

