/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module OIDC */

import { ActivityLoggingContext, BeEvent, AuthStatus, Logger, BentleyError } from "@bentley/bentleyjs-core";
import { UserManagerSettings, UserManager, User } from "oidc-client";
import { OidcClient, IOidcFrontendClient, UserInfo, AccessToken, OidcFrontendClientConfiguration } from "@bentley/imodeljs-clients";

const loggingCategory = "imodeljs-clients-device.OidcBrowserClient";

/** Utility to generate OIDC/OAuth tokens for frontend applications */
export class OidcBrowserClient extends OidcClient implements IOidcFrontendClient {
  private _userManager?: UserManager;
  private _accessToken?: AccessToken;
  private _redirectPath: string;

  /** Constructor */
  public constructor(private _configuration: OidcFrontendClientConfiguration) {
    super();
    const redirectUri: URL = new URL(this._configuration.redirectUri);
    this._redirectPath = redirectUri.pathname;
  }

  /** Used to initialize the client - must be awaited before any other methods are called */
  public async initialize(actx: ActivityLoggingContext): Promise<void> {
    await this.createUserManager(actx);

    // Load any existing user
    const user: User = await this._userManager!.getUser();
    if (user && !user.expired)
      this._onUserLoaded(user);
    else
      this._onUserExpired();

    // Listen to redirect path (happens if a redirect causes app to reinitialize)
    if (window.location.pathname === this._redirectPath) {
      this._userManager!.signinRedirectCallback().then(() => {
        window.location.replace("/");
      }, this._onError);
    }
  }

  /**
   * Start the sign-in process.
   * The call redirects application to the redirectUri specified in the configuration and then
   * redirects back to root when sign-in is complete.
   */
  public signIn(_actx: ActivityLoggingContext) {
    if (!this._userManager)
      throw new BentleyError(AuthStatus.Error, "OidcBrowserClient not initialized", Logger.logError, loggingCategory);
    this._userManager.signinRedirect(); // tslint:disable-line:no-floating-promises
  }

  /**
   * Start the sign-out process.
   * The call redirects application to postSignoutRedirectUri specified in the configuration
   * when sign-out is complete
   */
  public signOut(_actx: ActivityLoggingContext): void {
    if (!this._userManager)
      throw new BentleyError(AuthStatus.Error, "OidcBrowserClient not initialized", Logger.logError, loggingCategory);
    this._userManager.signoutRedirect(); // tslint:disable-line:no-floating-promises
  }

  /** Event called when the user's sign-in state changes - this may be due to calls to signIn(), signOut() or simply because the token expired */
  public readonly onUserStateChanged = new BeEvent<(token: AccessToken | undefined) => void>();

  /** Returns a promise that resolves to the AccessToken. The token is silently refreshed if it's possible and necessary. */
  public async getAccessToken(_actx: ActivityLoggingContext): Promise<AccessToken> {
    return Promise.resolve(this._accessToken!);
  }

  /** Disposes the resources held by this client */
  public dispose(): void {
    if (!this._userManager)
      return;

    this._userManager.events.removeUserLoaded(this._onUserLoaded);
    this._userManager.events.removeSilentRenewError(this._onError);
    this._userManager.events.removeAccessTokenExpired(this._onUserExpired);
    this._userManager.events.removeUserUnloaded(this._onUserUnloaded);
    this._userManager.events.removeUserSignedOut(this._onUserSignedOut);
  }

  private async createUserManager(actx: ActivityLoggingContext): Promise<UserManager> {
    const settings: UserManagerSettings = await this.getUserManagerSettings(actx);

    this._userManager = new UserManager(settings);
    this._userManager.events.addUserLoaded(this._onUserLoaded);
    this._userManager.events.addSilentRenewError(this._onError);
    this._userManager.events.addAccessTokenExpired(this._onUserExpired);
    this._userManager.events.addUserUnloaded(this._onUserUnloaded);
    this._userManager.events.addUserSignedOut(this._onUserSignedOut);

    return this._userManager;
  }

  private async getUserManagerSettings(actx: ActivityLoggingContext): Promise<UserManagerSettings> {
    const userManagerSettings: UserManagerSettings = {
      authority: await this.getUrl(actx),
      client_id: this._configuration.clientId,
      redirect_uri: this._configuration.redirectUri,
      silent_redirect_uri: this._configuration.redirectUri,
      post_logout_redirect_uri: this._configuration.postSignoutRedirectUri,
      automaticSilentRenew: true,
      response_type: "id_token token",
      scope: this._configuration.scope || "openid email profile organization feature_tracking imodelhub context-registry-service imodeljs-router",
    };
    return userManagerSettings;
  }

  private initUser(user: User | undefined) {
    if (!user) {
      this._accessToken = undefined;
      return;
    }

    const startsAt: Date = new Date(user.expires_at - user.expires_in!);
    const expiresAt: Date = new Date(user.expires_at);
    const userInfo = UserInfo.fromJson(user.profile);
    this._accessToken = AccessToken.fromJsonWebTokenString(user.access_token, startsAt, expiresAt, userInfo);
  }

  private getIsLoading(): boolean {
    return (window.location.pathname === this._redirectPath);
  }

  private _onUserStateChanged = (user: User | undefined, _reason: string) => {
    this.initUser(user);

    if (this.getIsLoading()) {
      // no need to raise the event as we're about to get a redirect
      return;
    }

    this.onUserStateChanged.raiseEvent(this._accessToken);
  }

  /**
   * Dispatched when:
   * - a valid user is found (on startup, after token refresh or token callback)
   */
  private _onUserLoaded = (user: User) => {
    this._onUserStateChanged(user, "loaded");
  }

  /**
   * Dispatched when:
   * - no valid user is found on startup
   * - a valid user object expires
   */
  private _onUserExpired = () => {
    this._onUserStateChanged(undefined, "expired");
  }

  /**
   * Dispatched when:
   * - the user is logged out at the auth server
   */
  private _onUserUnloaded = () => {
    this._onUserStateChanged(undefined, "unloaded");
  }

  /**
   * Dispatched when:
   * - the user logs out (with a call to the userManager function)
   */
  private _onUserSignedOut = () => {
    this._onUserStateChanged(undefined, "signed out");
  }

  /**
   * Dispatched when:
   * - the user manager's loading process produces an error
   * - the silent renewal process fails
   */
  private _onError = (e: Error) => {
    console.error(e); // tslint:disable-line:no-console
    this._onUserStateChanged(undefined, e.message);
  }
}
