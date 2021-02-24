
/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Authentication
 */

import { assert, BeEvent, ClientRequestContext } from "@bentley/bentleyjs-core";
import { NativeAuthorizationConfiguration } from "@bentley/imodeljs-common";
import { FrontendRequestContext, NativeApp } from "@bentley/imodeljs-frontend";
import { AccessToken } from "@bentley/itwin-client";

/**
 * For use in desktop apps
 * @alpha
 */
export class DesktopAuthorizationFrontend {
  private _clientConfiguration: NativeAuthorizationConfiguration;
  private _accessToken?: AccessToken;
  public readonly onUserStateChanged = new BeEvent<(token?: AccessToken) => void>();

  public constructor(clientConfiguration: NativeAuthorizationConfiguration) {
    this._clientConfiguration = clientConfiguration;
  }

  /** Used to initialize the client - must be awaited before any other methods are called */
  public async initialize(requestContext: ClientRequestContext): Promise<void> {
    requestContext.enter();
    return NativeApp.callNativeHost("initializeAuth", requestContext, this._clientConfiguration);
  }

  /** Called to start the sign-in process. Subscribe to onUserStateChanged to be notified when sign-in completes */
  public async signIn(requestContext: ClientRequestContext): Promise<void> {
    requestContext.enter();
    return NativeApp.callNativeHost("signIn", requestContext);
  }

  /** Called to start the sign-out process. Subscribe to onUserStateChanged to be notified when sign-out completes */
  public async signOut(requestContext: ClientRequestContext): Promise<void> {
    requestContext.enter();
    return NativeApp.callNativeHost("signOut", requestContext);
  }

  /** Set to true if there's a current authorized user or client (in the case of agent applications).
   * Set to true if signed in and the access token has not expired, and false otherwise.
   */
  public get isAuthorized(): boolean {
    if (!this._accessToken)
      return false;

    const expiresAt = this._accessToken.getExpiresAt();
    assert(!!expiresAt, "Invalid token in DesktopAuthorizationClient");
    if (expiresAt.getTime() - Date.now() > (this._clientConfiguration.expiryBuffer || 60 * 10) * 1000)
      return true;

    return false;
  }

  /** Set to true if the user has signed in, but the token has expired and requires a refresh */
  public get hasExpired(): boolean {
    if (!this._accessToken)
      return false;

    return !this.isAuthorized;
  }

  /** Set to true if signed in - the accessToken may be active or may have expired and require a refresh */
  public get hasSignedIn(): boolean {
    return !!this._accessToken;
  }

  /** Returns a promise that resolves to the AccessToken if signed in.
   * - The token is ensured to be valid *at least* for the buffer of time specified by the configuration.
   * - The token is refreshed if it's possible and necessary.
   * - This method must be called to refresh the token - the client does NOT automatically monitor for token expiry.
   * - Getting or refreshing the token will trigger the [[onUserStateChanged]] event.
   */
  public async getAccessToken(requestContext?: ClientRequestContext): Promise<AccessToken> {
    requestContext = requestContext ?? new FrontendRequestContext();
    requestContext.enter();
    if (!this.isAuthorized)
      this._accessToken = AccessToken.fromJson(await NativeApp.callNativeHost("getAccessTokenProps", requestContext));
    return this._accessToken!;
  }
}
