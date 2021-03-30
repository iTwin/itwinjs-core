/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Authentication
 */

import { ClientRequestContext } from "@bentley/bentleyjs-core";
import { AccessToken } from "./Token";

/** Interface to provide authorization information
 * @beta
 */
export interface AuthorizationClient {
  /** is the user currently authorized? */
  readonly isAuthorized: boolean;

  /** Get the AccessToken of the currently authorized user. The token is refreshed if necessary and possible. */
  getAccessToken(requestContext?: ClientRequestContext): Promise<AccessToken>;
}
