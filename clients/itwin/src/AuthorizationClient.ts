/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Authentication
 */

import { ClientRequestContext } from "@bentley/bentleyjs-core";
import { AccessTokenString } from "./Token";

/** Interface to provide authorization information
 * @beta
 */
export interface AuthorizationClient {
  /** Get the expiration date of the access token*/
  readonly expiry: Date;

  /** Get the AccessToken of the currently authorized user. The token is refreshed if necessary and possible. */
  getAccessToken(requestContext?: ClientRequestContext): Promise<AccessTokenString>;
}
