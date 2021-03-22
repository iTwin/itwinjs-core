/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module OIDC
 */

import { Logger as IOidcClientLogger, Log as OidcClientLog, User, UserManager, UserManagerSettings, WebStorageStateStore } from "oidc-client";
import { assert, AuthStatus, BeEvent, BentleyError, ClientRequestContext, Logger, LogLevel } from "@bentley/bentleyjs-core";
import { FrontendAuthorizationClient } from "@bentley/frontend-authorization-client";
import { AccessToken, ImsAuthorizationClient } from "@bentley/itwin-client";
import { FrontendLoggerCategory } from "../FrontendLoggerCategory";
import { FrontendRequestContext } from "../FrontendRequestContext";
import { OidcFrontendClientConfiguration } from "./OidcFrontendClient";

const loggerCategory: string = FrontendLoggerCategory.Authorization;

/** Utility to forward oidc-client logs to the Bentley logger
 * @beta
 * @deprecated Use [[BrowserAuthorizationClient]] and related utilities instead
 */
class OidcClientLogger implements IOidcClientLogger {
  private constructor() {
  }

  public debug(message?: any, ...optionalParams: any[]): void {
    Logger.logTrace(loggerCategory, message, () => optionalParams);
  }

  public info(message?: any, ...optionalParams: any[]): void {
    Logger.logInfo(loggerCategory, message, () => optionalParams);
  }

  public warn(message?: any, ...optionalParams: any[]): void {
    Logger.logWarning(loggerCategory, message, () => optionalParams);
  }

  public error(message?: any, ...optionalParams: any[]): void {
    Logger.logError(loggerCategory, message, () => optionalParams);
  }

  private static initializeLevel() {
    const logLevel: LogLevel | undefined = Logger.getLevel(loggerCategory);
    switch (logLevel) {
      case LogLevel.Error:
        OidcClientLog.level = OidcClientLog.ERROR;
        break;
      case LogLevel.Warning:
        OidcClientLog.level = OidcClientLog.WARN;
        break;
      case LogLevel.Info:
        OidcClientLog.level = OidcClientLog.INFO;
        break;
      case LogLevel.Trace:
        OidcClientLog.level = OidcClientLog.DEBUG;
        break;
      case LogLevel.None:
        OidcClientLog.level = OidcClientLog.NONE;
        break;
      default:
    }
  }

  /** Initializes forwarding of OidcClient logs to the Bentley Logger */
  public static initializeLogger() {
    OidcClientLog.logger = new OidcClientLogger(); // eslint-disable-line deprecation/deprecation
    this.initializeLevel();
  }

  /** Resets (or clears) forwarding of OidcClient logs to the Bentley Logger */
  public static reset() {
    OidcClientLog.reset();
  }
}

/**
 * Utility to generate OIDC/OAuth tokens for Single Page Applications (running in the Browser)
 * @beta
 * @deprecated Use [[BrowserAuthorizationClient]] instead
 */
export class OidcBrowserClient extends ImsAuthorizationClient implements FrontendAuthorizationClient {
  private _userManager?: UserManager;
  protected _accessToken?: AccessToken;
  private _redirectPath: string;

  /** Constructor */
  public constructor(private _configuration: OidcFrontendClientConfiguration) { // eslint-disable-line deprecation/deprecation
    super();
    const redirectUri: URL = new URL(this._configuration.redirectUri);
    this._redirectPath = redirectUri.pathname;
  }

  /**
   * Used to initialize the client - must be awaited before any other methods are called.
   * Attempts a non-interactive sign in by loading the authenticated state from a previous
   * sign-in, or through a silent sign in with the authorization provider.
   */
  public async initialize(requestContext: FrontendRequestContext): Promise<void> {
    /*
     * Any redirection in a SPA causes the entire application to be re-initialized, and subsequently
     * causes this method to be called again. This happens thrice during authorization:
     * - when the application loads up for the first time (signIn hasn't happened yet)
     * - when authorization provider causes browser to redirect to the supplied (and registered) redirectUri
     * - when application causes a redirection after the token was retrieved
     */

    // Initialize user manager and logging
    await this.createUserManager(requestContext);
    OidcClientLogger.initializeLogger(); // eslint-disable-line deprecation/deprecation

    if (this.getIsRedirecting()) {
      // Handle redirection to extract the accessToken
      await this.handleRedirectCallback();
    } else {
      // Sign-in hasn't happened, or has just happened and we are in the final successful redirection
      await this.nonInteractiveSignIn(requestContext); // load from state, or try silent sign-in
    }
  }

  private getIsRedirecting(): boolean {
    return (window.location.pathname === this._redirectPath);
  }

  /**
   * Used to handle the redirection that happens as part of an orchestrated SignIn.
   * If the current pathname is the redirect path, it triggers the redirect call back and completes
   * the SignIn. The returned promise evaluates to true, and the browser is redirected back to the
   * root path.
   * If the current pathname is NOT the redirect path, the returned promise resolves right away with
   * a false value.
   * The application should use this method whenever a redirection happens - since redirection typically causes
   * the re-initialization of a Single Page Application, this method is called already as part of the initialization
   * routine.
   */
  private async handleRedirectCallback(): Promise<boolean> {
    if (!this.getIsRedirecting())
      return false;

    let user: User;
    if (window.parent !== window) {
      // This is an i-frame, and we are doing a silent signin.
      await this._userManager!.signinSilentCallback();
      return true;
    }

    try {
      user = await this._userManager!.signinRedirectCallback();
      assert(user && !user.expired, "Expected userManager.signinRedirectCallback to always resolve to authorized user");
      window.location.replace(user.state.successRedirectUrl);
    } catch (err) {
      Logger.logError(loggerCategory, "Authentication error - cannot retrieve token after redirection");
    }
    return true;
  }

  /**
   * Attempts a silent sign in with the authorization provider
   * @return Resolves to authenticated user if the silent sign in succeeded
   * @throws [[Error]] If the silent sign in fails
   */
  protected async signInSilent(requestContext: ClientRequestContext): Promise<User> {
    requestContext.enter();
    assert(!!this._userManager, "OidcBrowserClient not initialized");

    const user = await this._userManager.signinSilent();
    assert(user && !user.expired, "Expected userManager.signinSilent to always resolve to authorized user");
    return user;
  }

  /**
   * Gets the user from storage
   * @return User found in storage.
   * - Resolves to null if no user was found.
   * - Does not call any events if the user is loaded from storage
   * - Returned user may have expired - so it's up to the caller to check the expired state
   */
  private async getUser(requestContext: ClientRequestContext): Promise<User | null> {
    requestContext.enter();
    assert(!!this._userManager, "OidcBrowserClient not initialized");

    return this._userManager.getUser();
  }

  /**
   * Attempts a non-interactive signIn
   * - tries to load the user from session or local storage
   * - tries to silently sign-in the user
   */
  private async nonInteractiveSignIn(requestContext: ClientRequestContext): Promise<boolean> {
    // Load user from session/local storage
    const user = await this.getUser(requestContext);
    if (user && !user.expired) {
      this._onUserLoaded(user); // Need an explicit broadcast of events because getUser() does not do that internally
      return true;
    }

    // Attempt a silent sign-in
    try {
      await this.signInSilent(requestContext); // internally broadcasts events on successful signin
    } catch (err) {
      Logger.logInfo(loggerCategory, "Silent sign-in failed");
      return false;
    }

    return true;
  }

  /**
   * Start the sign-in process
   * - calls the onUserStateChanged() call back after the authorization completes
   * or if there is an error.
   * - will attempt in order:
   *   (i) load any existing authorized user from local storage,
   *   (ii) a silent sign in with the authorization provider, and if all else fails,
   *   (iii) an interactive signin that requires user input.
   * - if an interactive or silent signin is required with the authorization provider, it will
   * redirect application to the redirectUri specified in the configuration, and then redirect
   * back to specified successRedirectUri when the sign-in is complete.
   */
  public async signIn(requestContext?: ClientRequestContext, successRedirectUrl?: string): Promise<void> {
    requestContext = requestContext ?? new ClientRequestContext();
    requestContext.enter();
    if (!this._userManager)
      throw new BentleyError(AuthStatus.Error, "OidcBrowserClient not initialized", Logger.logError, loggerCategory);

    // Non interactive sign-in
    const status: boolean = await this.nonInteractiveSignIn(requestContext);
    if (status)
      return;

    // Attempt an interactive signin - returns a promise to redirect
    await this._userManager.signinRedirect({
      data: {
        successRedirectUrl: successRedirectUrl || window.location.href,
      },
    });
  }

  /**
   * Start the sign-out process
   * - calls the onUserStateChanged() call back after the authorization completes
   *   or if there is an error.
   * - redirects application to the postSignoutRedirectUri specified in the configuration when the sign out is
   *   complete
   */
  public async signOut(requestContext?: ClientRequestContext): Promise<void> {
    requestContext?.enter();
    await this._userManager!.signoutRedirect();
  }

  /**
   * Event called when the user's sign-in state changes - this may be due to calls to signIn(), signOut(), if the token
   * expired, or if the token was silently refreshed.
   */
  public readonly onUserStateChanged = new BeEvent<(token: AccessToken | undefined) => void>();

  /**
   * Returns a promise that resolves to the AccessToken of the currently authorized user.
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

  /**
   * Set to true if there's a current authorized user. i.e., the user has signed in,
   * and the access token has not expired.
   */
  public get isAuthorized(): boolean {
    return !!this._accessToken; // Note: The accessToken maintained by this client is always silently refreshed if possible.
  }

  /** Set to true if the user has signed in, but the token has expired and requires a refresh */
  public get hasExpired(): boolean {
    return !this._accessToken; // Note: the token in this client is always silently refreshed if possible.
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
    this._userManager.events.removeAccessTokenExpiring(this._onAccessTokenExpiring);
    this._userManager.events.removeAccessTokenExpired(this._onAccessTokenExpired);
    this._userManager.events.removeUserUnloaded(this._onUserUnloaded);
    this._userManager.events.removeSilentRenewError(this._onSilentRenewError);
    this._userManager.events.removeUserSignedOut(this._onUserSignedOut);
    OidcClientLogger.reset(); // eslint-disable-line deprecation/deprecation
    this._userManager = undefined;
  }

  private async createUserManager(requestContext: FrontendRequestContext): Promise<UserManager> {
    const settings: UserManagerSettings = await this.getUserManagerSettings(requestContext);

    this._userManager = new UserManager(settings);
    this._userManager.events.addUserLoaded(this._onUserLoaded);
    this._userManager.events.addUserUnloaded(this._onUserUnloaded);
    this._userManager.events.addAccessTokenExpiring(this._onAccessTokenExpiring);
    this._userManager.events.addAccessTokenExpired(this._onAccessTokenExpired);
    this._userManager.events.addSilentRenewError(this._onSilentRenewError);
    this._userManager.events.addUserSignedOut(this._onUserSignedOut);

    return this._userManager;
  }

  /**
   * Override to customize the user manager settings used by the underlying oidc-client-js.
   * This allows setting additional fields that are not exposed by [[OidcFrontendClientConfiguration]] or customizing the defaults.
   * @internal
   */
  protected async getUserManagerSettings(requestContext: FrontendRequestContext): Promise<UserManagerSettings> {
    /* eslint-disable @typescript-eslint/naming-convention */
    const userManagerSettings: UserManagerSettings = {
      authority: this._configuration.authority || await this.getUrl(requestContext),
      client_id: this._configuration.clientId,
      redirect_uri: this._configuration.redirectUri,
      silent_redirect_uri: this._configuration.redirectUri,
      post_logout_redirect_uri: this._configuration.postSignoutRedirectUri,
      automaticSilentRenew: true,
      response_type: this._configuration.responseType || "id_token token",
      query_status_response_type: this._configuration.responseType || "id_token token",
      scope: this._configuration.scope,
      loadUserInfo: true,
      userStore: new WebStorageStateStore({ store: window.localStorage }),
      clockSkew: this._configuration.clockSkew,
      metadata: this._configuration.metadata,
      accessTokenExpiringNotificationTime: 60, // 60 seconds before expiry
      monitorSession: false,
      silentRequestTimeout: 20000,
    };
    /* eslint-enable @typescript-eslint/naming-convention */
    return userManagerSettings;
  }

  private initAccessToken(user: User | undefined) {
    if (!user) {
      this._accessToken = undefined;
      return;
    }

    this._accessToken = AccessToken.fromTokenResponseJson(user, user.profile);
  }

  private _onUserStateChanged = (user: User | undefined) => {
    if (this.getIsRedirecting()) {
      /*
       * no need to raise the event when still redirecting, since
       * the application will be refreshed after the authorization is complete.
       * We as we're about to get a redirect
       */
      return;
    }

    this.initAccessToken(user);
    try {
      this.onUserStateChanged.raiseEvent(this._accessToken);
    } catch (err) {
      Logger.logError(loggerCategory, "Error thrown when handing OidcBrowserClient.onUserStateChanged event", () => ({ message: err.message }));
    }
  };

  /**
   * Raised when a user session has been established (or re-established).
   * This can happen on startup, after token refresh or token callback.
   */
  private _onUserLoaded = (user: User) => {
    this._onUserStateChanged(user);
  };

  /**
   * Raised when a user session has been terminated.
   */
  private _onUserUnloaded = () => {
    this._onUserStateChanged(undefined);
  };

  /**
   * Raised prior to the access token expiring
   */
  private _onAccessTokenExpiring = () => {
  };

  /**
   * Raised after the access token has expired.
   */
  private _onAccessTokenExpired = () => {
    this._onUserStateChanged(undefined);
  };

  /**
   * Raised when the automatic silent renew has failed.
   */
  private _onSilentRenewError = () => {
    this._onUserStateChanged(undefined);
  };

  /**
   * Raised when the user's sign-in status at the OP has changed.
   */
  private _onUserSignedOut = () => {
    this._onUserStateChanged(undefined);
  };

}
