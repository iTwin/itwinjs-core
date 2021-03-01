/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert, BeEvent, ClientRequestContext } from "@bentley/bentleyjs-core";
import { FrontendAuthorizationClient } from "@bentley/frontend-authorization-client";
import { NativeAuthorizationConfiguration } from "@bentley/imodeljs-common";
import { FrontendRequestContext, NativeApp } from "@bentley/imodeljs-frontend";
import { AccessToken, ImsAuthorizationClient } from "@bentley/itwin-client";

/** Utility to provide OIDC/OAuth tokens from native ios app to frontend
 * @alpha
 */
export class MobileAuthorizationFrontend extends ImsAuthorizationClient implements FrontendAuthorizationClient {
  private _accessToken?: AccessToken;
  private _clientConfiguration: NativeAuthorizationConfiguration;
  public constructor(clientConfiguration: NativeAuthorizationConfiguration) {
    super();
    this._clientConfiguration = clientConfiguration;
  }
  /** Used to initialize the client - must be awaited before any other methods are called */
  public async initialize(requestContext: ClientRequestContext): Promise<void> {
    requestContext.enter();
    this.onUserStateChanged.addListener((token?: AccessToken) => {
      this._accessToken = token;
    });
    this._clientConfiguration.issuerUrl = await this.getUrl(requestContext);
    await NativeApp.callNativeHost("initializeAuth", requestContext, this._clientConfiguration);
  }
  /** Start the sign-in process */
  public async signIn(requestContext: ClientRequestContext): Promise<void> {
    await NativeApp.callNativeHost("signIn", requestContext);
  }

  /** Start the sign-out process */
  public async signOut(requestContext: ClientRequestContext): Promise<void> {
    return NativeApp.callNativeHost("signOut", requestContext);
  }

  /** return accessToken */
  public async getAccessToken(requestContext: ClientRequestContext = new FrontendRequestContext()): Promise<AccessToken> {
    requestContext.enter();
    if (this.isAuthorized) {
      return this._accessToken!;
    }
    const tokenProps = await NativeApp.callNativeHost("getAccessTokenProps", requestContext);
    this._accessToken = AccessToken.fromJson(tokenProps);
    return this._accessToken;
  }

  /** Set to true if there's a current authorized user or client (in the case of agent applications).
   * Set to true if signed in and the access token has not expired, and false otherwise.
   */
  public get isAuthorized(): boolean {
    if (!this._accessToken)
      return false;

    const expiresAt = this._accessToken.getExpiresAt();
    assert(!!expiresAt, "Invalid token in MobileAuthorizationClient");
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
    return !!this._accessToken; // Always silently refreshed
  }

  public readonly onUserStateChanged = new BeEvent<(token?: AccessToken) => void>();
}
