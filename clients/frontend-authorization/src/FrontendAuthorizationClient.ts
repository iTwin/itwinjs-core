/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Authorization
 */
import { AccessToken, BeEvent } from "@itwin/core-bentley";
import { AuthorizationClient } from "@bentley/itwin-client";

/**
 * @beta
 */
export interface FrontendAuthorizationClient extends AuthorizationClient {
  /** Called to start the sign-in process. Subscribe to onUserStateChanged to be notified when sign-in completes */
  signIn(): Promise<void>;

  /** Called to start the sign-out process. Subscribe to onUserStateChanged to be notified when sign-out completes */
  signOut(): Promise<void>;

  /** Event called when the user's sign-in state changes - this may be due to calls to signIn(), signOut() or because token was refreshed */
  readonly onAccessTokenChanged: BeEvent<(token: AccessToken) => void>;

  /** Set to true if signed in - the accessToken may be active or may have expired and require a refresh */
  readonly hasSignedIn: boolean;
}

/** FrontendAuthorization type guard.
 * @beta
 */
export const isFrontendAuthorizationClient = (client: AuthorizationClient | undefined): client is FrontendAuthorizationClient => {
  return client !== undefined && (client as FrontendAuthorizationClient).signIn !== undefined && (client as FrontendAuthorizationClient).signOut !== undefined;
};
