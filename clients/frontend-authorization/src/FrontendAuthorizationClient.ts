/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Authorization
 */
import { BeEvent } from "@bentley/bentleyjs-core";
import { AccessToken } from "@bentley/itwin-client";

/**
 * @beta
 */
export interface FrontendAuthorizationClient {
  /** Called to start the sign-in process. Subscribe to  onUserStateChanged to be notified when sign-in completes */
  signIn(): Promise<void>;

  /** Called to start the sign-out process. Subscribe to onUserStateChanged to be notified when sign-out completes */
  signOut(): Promise<void>;

  /** Event called when the user's sign-in state changes - this may be due to calls to signIn(), signOut() or simply because the token expired */
  readonly onUserStateChanged: BeEvent<(token?: AccessToken) => void>;

  getAccessToken(): Promise<AccessToken>;
}
