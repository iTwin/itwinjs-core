
/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Utils
 */

/** A string representing a token used to access resources. An empty string represents an invalid/unavailable token.
 * @see [IModelHost.getAccessToken]($backend) and [IModelApp.getAccessToken]($frontend) to obtain an access token.
 * @see [IModelHostOptions.authorizationClient]($backend) and [IModelAppOptions.authorizationClient]($frontend) to configure how access tokens are obtained.
 * @note Access tokens expire periodically and are automatically refreshed when possible; therefore, tokens should always be requested via an [AuthorizationClient]($common), not cached for later reuse.
 * @public
 */
export type AccessToken = string;
