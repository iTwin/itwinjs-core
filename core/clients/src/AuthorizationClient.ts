/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
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
   * or authorized client (in the case of agent applications). The token is refreshed if necessary and possible.
   * @throws [[BentleyError]] If there was an authorization error, or in the case of frontends, if the client wasn't
   * used to signIn.
   */
  getAccessToken(requestContext?: ClientRequestContext): Promise<AccessToken>;
}
