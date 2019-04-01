/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Logging */

/** Logger categories used by this package
 * @note All logger categories in this package start with the `imodeljs-frontend` prefix.
 * @see [Logger]($bentley)
 * @public
 */
export const enum LoggerCategory {
  /** The logger category used by the [[FrontendRequestContext]] class and other related classes. */
  FrontendRequestContext = "imodeljs-frontend.FrontendRequestContext",

  /** The logger category used by the [[IModelConnection]] class and other related classes. */
  IModelConnection = "imodeljs-frontend.IModelConnection",

  /** The logger category used by OIDC-related functions in the browser. */
  OidcBrowserClient = "imodeljs-frontend.OidcBrowserClient",

  /** The logger category used by OIDC-related functions on iOS. */
  OidcIOSClient = "imodeljs-frontend.OidcIOSClient",
}
