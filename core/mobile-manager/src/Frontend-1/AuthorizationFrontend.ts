/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { assert, BeEvent, ClientRequestContext, Logger } from "@bentley/bentleyjs-core";
import { FrontendAuthorizationClient } from "@bentley/frontend-authorization-client";
import { FrontendRequestContext, NativeApp } from "@bentley/imodeljs-frontend";
import { AccessToken, ImsAuthorizationClient } from "@bentley/itwin-client";
import { defaultMobileAuthorizationClientExpiryBuffer, MobileAuthorizationClientConfiguration } from "../common/MobileAuthorizationClientConfiguration";
import { MobileApp } from "./MobileApp";

/** Utility to provide OIDC/OAuth tokens from native ios app to frontend
 * @alpha
 */
export class MobileAuthorizationClient extends ImsAuthorizationClient implements FrontendAuthorizationClient {
  private _accessToken?: AccessToken;
  private _clientConfiguration: MobileAuthorizationClientConfiguration;
  public constructor(clientConfiguration: MobileAuthorizationClientConfiguration) {
    super();
    this._clientConfiguration = clientConfiguration;
    NativeApp.onUserStateChanged.addListener((args: any) => {
      if (args.accessToken) {
        this._accessToken = AccessToken.fromJson(args.accessToken);
      } else {
        this._accessToken = undefined;
      }
      if (args.err) {
        Logger.logInfo("mobilefrontend", "onUserStateChanged() threw error", () => args.err);
        throw new Error(args.err);
      }
      this.onUserStateChanged.raiseEvent(this._accessToken);
    });
  }
  /** Used to initialize the client - must be awaited before any other methods are called */
  public async initialize(requestContext: ClientRequestContext): Promise<void> {
    requestContext.enter();
    const issuer = await this.getUrl(requestContext);
    await MobileApp.callBackend("authInitialize", issuer, this._clientConfiguration);
  }
  /** Start the sign-in process */
  public async signIn(requestContext: ClientRequestContext): Promise<void> {
    requestContext.enter();
    await MobileApp.callBackend("authSignIn");
  }

  /** Start the sign-out process */
  public async signOut(requestContext: ClientRequestContext): Promise<void> {
    requestContext.enter();
    return MobileApp.callBackend("authSignOut");
  }

  /** return accessToken */
  public async getAccessToken(requestContext: ClientRequestContext = new FrontendRequestContext()): Promise<AccessToken> {
    requestContext.enter();
    if (this.isAuthorized) {
      return this._accessToken!;
    }
    const tokenString = await MobileApp.callBackend("authGetAccessToken");
    this._accessToken = AccessToken.fromJson(tokenString);
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
    if (expiresAt.getTime() - Date.now() > (this._clientConfiguration.expiryBuffer || defaultMobileAuthorizationClientExpiryBuffer) * 1000)
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

  public readonly onUserStateChanged = new BeEvent<(token: AccessToken | undefined, message?: string) => void>();
}
