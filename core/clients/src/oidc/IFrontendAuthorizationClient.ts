/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { BeEvent, ClientRequestContext, IDisposable } from "@bentley/bentleyjs-core";
import { IAuthorizationClient } from "../AuthorizationClient";
import { AccessToken } from "../Token";

/**
 * @beta
 */
export interface IFrontendAuthorizationClient extends IDisposable, IAuthorizationClient {
  /** Called to start the sign-in process. Subscribe to onUserStateChanged to be notified when sign-in completes */
  signIn(requestContext: ClientRequestContext): Promise<void>;

  /** Called to start the sign-out process. Subscribe to onUserStateChanged to be notified when sign-out completes */
  signOut(requestContext: ClientRequestContext): Promise<void>;

  /** Event called when the user's sign-in state changes - this may be due to calls to signIn(), signOut() or simply because the token expired */
  readonly onUserStateChanged: BeEvent<(token: AccessToken | undefined) => void>;
}
