/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Authentication */

import { ClientRequestContext } from "@bentley/bentleyjs-core";
import { AccessToken } from "./Token";

/** Interface to provide authorization information for various API
 * @beta
 */
export interface IAuthorizationClient {
  /** Set to true if there's a current authorized user or client (in the case of agent applications).
   * Set to true if signed in and the access token has not expired, and false otherwise.
   */
  isAuthorized: boolean;

  /** Set to true if the user has signed in, but the token has expired and requires a refresh */
  hasExpired: boolean;

  /** Set to true if signed in - the accessToken may be active or may have expired and require a refresh */
  hasSignedIn: boolean;

  /** Returns a promise that resolves to the AccessToken of the currently authorized user
   * or authorized client (in the case of agent applications).
   * The token is refreshed if necessary and possible.
   * @throws [[BentleyError]] If the client was not used to authorize, or there was an authorization error.
   */
  getAccessToken(requestContext?: ClientRequestContext): Promise<AccessToken>;
}
