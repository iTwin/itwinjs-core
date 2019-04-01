/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module OIDC */

import { AuthStatus, BeEvent, BentleyError, ClientRequestContext, Logger } from "@bentley/bentleyjs-core";
import { AccessToken, IOidcFrontendClient, OidcClient, OidcFrontendClientConfiguration, UserInfo } from "@bentley/imodeljs-clients";
import { User, UserManager, UserManagerSettings } from "oidc-client";
import { FrontendRequestContext } from "../FrontendRequestContext";
import { LoggerCategory } from "../LoggerCategory";

const loggerCategory: string = LoggerCategory.OidcBrowserClient;

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

  /** Used to initialize the client - must be awaited before any other methods are called
   * The application should use this method whenever a redirection happens - redirection typically causes
   * the re-initialization of a Single Page Application.
   */
  public async initialize(requestContext: FrontendRequestContext): Promise<void> {
    await this.createUserManager(requestContext);

    // Load any existing user
    const user: User = await this._userManager!.getUser();
    if (user && !user.expired)
      this._onUserLoaded(user);
    else
      this._onUserExpired();

    // Handle any redirection if necessary
    await this.handleRedirectCallback();
  }

  /** Used to handle the redirection that happens as part of an orchestrated SignIn.
   * If the current pathname is the redirect path, it triggers the redirect call back and completes
   * the SignIn. The returned promise evaluates to true, and the browser is redirected back to the
   * root path.
   * If the current pathname is NOT the redirect path, the returned promise resolves right away with
   * a false value.
   * The application should use this method whenever a redirection happens - redirection typically causes
   * the re-initialization of a Single Page Application.
   */
  public async handleRedirectCallback(): Promise<boolean> {
    if (window.location.pathname !== this._redirectPath)
      return false;

    try {
      await this._userManager!.signinRedirectCallback();
    } catch (err) {
      this._onError(err);
    }

    history.pushState(null, "", "/");
    return true;
  }

  /**
   * Start the sign-in process.
   * The call redirects application to the redirectUri specified in the configuration and then
   * redirects back to root when sign-in is complete.
   */
  private startSignIn(_requestContext: ClientRequestContext) {
    if (!this._userManager)
      throw new BentleyError(AuthStatus.Error, "OidcBrowserClient not initialized", Logger.logError, loggerCategory);
    this._userManager.signinRedirect(); // tslint:disable-line:no-floating-promises
  }

  /** Start the sign-in and return a promise that fulfils or rejects when it's complete
   * The call redirects application to the redirectUri specified in the configuration and then
   * redirects back to root when sign-in is complete.
   */
  public async signIn(requestContext: ClientRequestContext): Promise<AccessToken> {
    return new Promise((resolve, reject) => {
      try {
        this.startSignIn(requestContext);
      } catch (error) {
        reject(error);
      }

      this.onUserStateChanged.addListener((token: AccessToken | undefined, message: string) => {
        if (token)
          resolve(token);
        else
          reject(message);
      });
    });
  }

  /**
   * Start the sign-out process.
   * The call redirects application to postSignoutRedirectUri specified in the configuration
   * when sign-out is complete
   */
  private startSignOut(_requestContext: ClientRequestContext): void {
    if (!this._userManager)
      throw new BentleyError(AuthStatus.Error, "OidcBrowserClient not initialized", Logger.logError, loggerCategory);
    this._userManager.signoutRedirect(); // tslint:disable-line:no-floating-promises
  }

  /** Start the sign-out and return a promise that fulfils or rejects when it's complete
   * The call redirects application to postSignoutRedirectUri specified in the configuration
   * when sign-out is complete
   */
  public async signOut(requestContext: ClientRequestContext): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.startSignOut(requestContext);
      } catch (error) {
        reject(error);
      }

      this.onUserStateChanged.addListener((token: AccessToken | undefined, _message: string) => {
        if (!token)
          resolve();
        else
          reject("Unable to signout");
      });
    });
  }

  /** Event called when the user's sign-in state changes - this may be due to calls to signIn(), signOut() or simply because the token expired */
  public readonly onUserStateChanged = new BeEvent<(token: AccessToken | undefined, message: string) => void>();

  /** Returns a promise that resolves to the AccessToken of the currently authorized user.
   * The token is refreshed as necessary.
   * @throws [[BentleyError]] If signIn() was not called, or there was an authorization error.
   */
  public async getAccessToken(requestContext?: ClientRequestContext): Promise<AccessToken> {
    if (this._accessToken)
      return this._accessToken;
    if (requestContext)
      requestContext.enter();
    throw new BentleyError(AuthStatus.Error, "Not signed in.", Logger.logError, loggerCategory);
  }

  /** Set to true if there's a current authorized user or client (in the case of agent applications).
   * Set to true if signed in and the access token has not expired, and false otherwise.
   */
  public get isAuthorized(): boolean {
    return !!this._accessToken;
  }

  /** Set to true if the user has signed in, but the token has expired and requires a refresh */
  public get hasExpired(): boolean {
    return !!this._accessToken; // Always silently refreshed
  }

  /** Set to true if signed in - the accessToken may be active or may have expired and require a refresh */
  public get hasSignedIn(): boolean {
    return !!this._accessToken; // Always silently refreshed
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

  private async createUserManager(requestContext: FrontendRequestContext): Promise<UserManager> {
    const settings: UserManagerSettings = await this.getUserManagerSettings(requestContext);

    this._userManager = new UserManager(settings);
    this._userManager.events.addUserLoaded(this._onUserLoaded);
    this._userManager.events.addSilentRenewError(this._onError);
    this._userManager.events.addAccessTokenExpired(this._onUserExpired);
    this._userManager.events.addUserUnloaded(this._onUserUnloaded);
    this._userManager.events.addUserSignedOut(this._onUserSignedOut);

    return this._userManager;
  }

  private async getUserManagerSettings(requestContext: FrontendRequestContext): Promise<UserManagerSettings> {
    const userManagerSettings: UserManagerSettings = {
      authority: await this.getUrl(requestContext),
      client_id: this._configuration.clientId,
      redirect_uri: this._configuration.redirectUri,
      silent_redirect_uri: this._configuration.redirectUri,
      post_logout_redirect_uri: this._configuration.postSignoutRedirectUri,
      automaticSilentRenew: true,
      response_type: "id_token token",
      scope: this._configuration.scope,
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

  private _onUserStateChanged = (user: User | undefined, message: string) => {
    this.initUser(user);

    if (this.getIsLoading()) {
      // no need to raise the event as we're about to get a redirect
      return;
    }

    this.onUserStateChanged.raiseEvent(this._accessToken, message);
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
