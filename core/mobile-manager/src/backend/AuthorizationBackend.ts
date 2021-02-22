/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module OIDC
 */

import { assert, BeEvent, ClientRequestContext, Logger } from "@bentley/bentleyjs-core";
import { FrontendAuthorizationClient } from "@bentley/frontend-authorization-client";
import { BackendRequestContext } from "@bentley/imodeljs-backend";
import { AccessToken, ImsAuthorizationClient } from "@bentley/itwin-client";
import { defaultMobileAuthorizationClientExpiryBuffer, MobileAuthorizationClientConfiguration } from "../common/MobileAuthorizationClientConfiguration";
import { MobileHost } from "./MobileHost";

/** Utility to provide OIDC/OAuth tokens from native ios app to frontend
 * @alpha
 */
export class MobileAuthorizationClient extends ImsAuthorizationClient implements FrontendAuthorizationClient {
  private _accessToken?: AccessToken;
  private _clientConfiguration: MobileAuthorizationClientConfiguration;
  public constructor(clientConfiguration: MobileAuthorizationClientConfiguration) {
    super();
    this._clientConfiguration = clientConfiguration;
    MobileHost.onUserStateChanged.addListener((accessToken?: string, err?: string) => {
      if (accessToken) {
        this._accessToken = AccessToken.fromJson(accessToken);
      } else {
        this._accessToken = undefined;
      }
      if (err) {
        Logger.logInfo("mobile", "onUserStateChanged() threw error", () => err);
        throw new Error(err);
      }
      this.onUserStateChanged.raiseEvent(this._accessToken);
    });
  }
  /** Used to initialize the client - must be awaited before any other methods are called */
  public async initialize(requestContext: ClientRequestContext): Promise<void> {
    requestContext.enter();
    const issuer = await this.getUrl(requestContext);
    await MobileHost.authInit(requestContext, {
      issuerUrl: issuer,
      clientId: this._clientConfiguration.clientId,
      redirectUrl: this._clientConfiguration.redirectUri,
      scope: this._clientConfiguration.scope,
    });
  }
  /** Start the sign-in process */
  public async signIn(requestContext: ClientRequestContext): Promise<void> {
    requestContext.enter();
    await MobileHost.signIn(requestContext);
  }

  /** Start the sign-out process */
  public async signOut(requestContext: ClientRequestContext): Promise<void> {
    requestContext.enter();
    return MobileHost.signOut(requestContext);
  }

  /** return accessToken */
  public async getAccessToken(requestContext: ClientRequestContext = new BackendRequestContext()): Promise<AccessToken> {
    requestContext.enter();
    if (this.isAuthorized) {
      return this._accessToken!;
    }
    const accessTokenStr = await MobileHost.getAccessToken(requestContext);
    this._accessToken = AccessToken.fromJson(JSON.stringify(accessTokenStr));
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
