/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Logging
 */

/**
 * Logger categories used by this package
 * @note All logger categories in this package start with the `presentation-components` prefix.
 * @see [Logger]($bentley)
 * @public
 */
export enum PresentationComponentsLoggerCategory {
  Package = "presentation-components",

  /** The logger category used by content data providers. */
  Content = "presentation-components.Content",

  /** The logger category used by hierarchy (tree) data providers. */
  Hierarchy = "presentation-components.Hierarchy",
}
