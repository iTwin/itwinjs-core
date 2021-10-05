/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Logging
 */

/** Logger categories used by this package
 * @note All logger categories in this package start with the `frontend-authorization-client` prefix.
 * @see [Logger]($bentley)
 * @beta
 */
export enum FrontendAuthorizationClientLoggerCategory {
  /** The logger category used by base clients */
  Authorization = "frontend-authorization-client.Authorization",
}
