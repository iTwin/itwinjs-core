/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Logging
 */

/** Logger categories used by this package
 * @note All logger categories in this package start with the `core-frontend` prefix.
 * @see [Logger]($bentley)
 * @public
 * @extensions
 */
export enum FrontendLoggerCategory {
  Package = "core-frontend",

  /** The logger category used by the [[IModelConnection]] class and other related classes. */
  IModelConnection = "core-frontend.IModelConnection",

  /** The logger category used for NativeApp */
  NativeApp = "core-frontend.NativeApp",

  /** The logger category used for making network requests. */
  Request = "core-frontend.Request",

  /**
   * The logger category used by FeatureTrackingManager
   * @alpha
   */
  FeatureTracking = "core-frontend.FeatureTracking",
  /**
   * The logger category used by RealityData
   * @alpha
   */
  RealityData = "core-frontend.RealityData",

  /** The logger category used for creating and displaying graphics. */
  Render = "core-frontend.Render",

  /** The logger category used for loading and executing Extensions
   * @alpha
   */
  Extensions = "core-frontend.Extensions",
}
