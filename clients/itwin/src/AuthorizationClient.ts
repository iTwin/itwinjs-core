/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Authentication
 */

import { AccessToken } from "@itwin/core-bentley";

/** Interface to provide authorization information
 * @beta
 */
export interface AuthorizationClient {
  /** Get the AccessToken of the currently authorized user. The token is refreshed if necessary and possible. */
  getAccessToken(): Promise<AccessToken | undefined>;
}
