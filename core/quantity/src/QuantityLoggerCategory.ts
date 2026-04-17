/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Logging
 */

/** Logger categories used by the `@itwin/core-quantity` package.
 * @see [Logger]($bentley)
 * @beta
 */
export enum QuantityLoggerCategory {
  /** The root category for the core-quantity package. */
  Package = "core-quantity",
  /** Logger category for quantity formatting operations. */
  Formatting = "core-quantity.Formatting",
}
