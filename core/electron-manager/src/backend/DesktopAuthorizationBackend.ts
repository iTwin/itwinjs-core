/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
// Code based on the blog article @ https://authguidance.com

/** @packageDocumentation
 * @module Authentication
 */

import { assert, AuthStatus, BentleyError, ClientRequestContext, Guid, Logger } from "@bentley/bentleyjs-core";
import { AuthorizationBackend, NativeHost } from "@bentley/imodeljs-backend";
import { AuthorizationConfiguration } from "@bentley/imodeljs-common";
import { AccessToken, request as httpRequest, RequestOptions } from "@bentley/itwin-client";
import {
  AuthorizationError, AuthorizationNotifier, AuthorizationRequest, AuthorizationRequestJson, AuthorizationResponse, AuthorizationServiceConfiguration,
  BaseTokenRequestHandler, GRANT_TYPE_AUTHORIZATION_CODE, GRANT_TYPE_REFRESH_TOKEN, RevokeTokenRequest, RevokeTokenRequestJson, StringMap,
  TokenRequest, TokenRequestHandler, TokenRequestJson, TokenResponse,
} from "@openid/appauth";
import { NodeCrypto, NodeRequestor } from "@openid/appauth/built/node_support";
import { ElectronAuthorizationEvents } from "./ElectronAuthorizationEvents";
import { ElectronAuthorizationRequestHandler } from "./ElectronAuthorizationRequestHandler";
import { ElectronTokenStore } from "./ElectronTokenStore";
import { LoopbackWebServer } from "./LoopbackWebServer";

const loggerCategory = "electron-backend";
// cSpell:ignore openid appauth signin Pkce Signout

/**
 * Utility to generate OIDC/OAuth tokens for Desktop Applications
 * @alpha
 */
export class DesktopAuthorizationBackend extends AuthorizationBackend {
  private _configuration: AuthorizationServiceConfiguration | undefined;
  private _tokenResponse: TokenResponse | undefined;

  private _tokenStore?: ElectronTokenStore;
  public get tokenStore() { return this._tokenStore!; }

  /**
   * Used to initialize the client - must be awaited before any other methods are called.
   * The call attempts a silent sign-if possible.
   */
  public async initialize(requestContext: ClientRequestContext, config: AuthorizationConfiguration): Promise<void> {
    await super.initialize(requestContext, config);
    this._tokenStore = new ElectronTokenStore(config.clientId);
    this._session = { applicationId: requestContext.applicationId, applicationVersion: requestContext.applicationVersion, sessionId: requestContext.sessionId };

    const url = await this.getUrl(requestContext);
    const tokenRequestor = new NodeRequestor(); // the Node.js based HTTP client
    this._configuration = await AuthorizationServiceConfiguration.fetchFromIssuer(
      url,
      tokenRequestor,
    );
    Logger.logTrace(loggerCategory, "Initialized service configuration", () => ({ configuration: this._configuration }));

    // Attempt to load the access token from store
    await this.loadAccessToken();
  }

  /** Loads the access token from the store, and refreshes it if necessary and possible
   * @return AccessToken if it's possible to get a valid access token, and undefined otherwise.
   */
  private async loadAccessToken(): Promise<AccessToken | undefined> {
    const tokenResponse = await this.tokenStore.load();
    if (tokenResponse === undefined || tokenResponse.refreshToken === undefined)
      return undefined;
    try {
      Logger.logTrace(loggerCategory, "Refreshing token from storage");
      await this.refreshAccessToken(tokenResponse.refreshToken);
    } catch (err) {
      return undefined;
    }
    return this._accessToken!;
  }

  /**
   * Start the sign-in process
   * - calls the onUserStateChanged() call back after the authorization completes
   * or if there is an error.
   * - will attempt in order:
   *   (i) load any existing authorized user from storage,
   *   (ii) an interactive signin that requires user input.
   */
  public async signIn(): Promise<void> {
    if (!this._configuration)
      throw new BentleyError(AuthStatus.Error, "Not initialized. First call initialize()", Logger.logError, loggerCategory);

    // Attempt to load the access token from store
    await this.loadAccessToken();
    if (this._accessToken)
      return;

    // Create the authorization request
    const nativeConfig = this.config;
    const authReqJson: AuthorizationRequestJson = {
      client_id: nativeConfig.clientId, // eslint-disable-line @typescript-eslint/naming-convention
      redirect_uri: nativeConfig.redirectUri, // eslint-disable-line @typescript-eslint/naming-convention
      scope: nativeConfig.scope,
      response_type: AuthorizationRequest.RESPONSE_TYPE_CODE, // eslint-disable-line @typescript-eslint/naming-convention
      extras: { prompt: "consent", access_type: "offline" }, // eslint-disable-line @typescript-eslint/naming-convention
    };
    const authorizationRequest = new AuthorizationRequest(authReqJson, new NodeCrypto(), true /* = usePkce */);
    await authorizationRequest.setupCodeVerifier();

    // Create events for this signin attempt
    const authorizationEvents = new ElectronAuthorizationEvents();

    // Ensure that completion callbacks are correlated to the correct authorization request
    LoopbackWebServer.addCorrelationState(authorizationRequest.state, authorizationEvents);

    // Start a web server to listen to the browser requests
    LoopbackWebServer.start(nativeConfig);

    const authorizationHandler = new ElectronAuthorizationRequestHandler(authorizationEvents);

    // Setup a notifier to obtain the result of authorization
    const notifier = new AuthorizationNotifier();
    authorizationHandler.setAuthorizationNotifier(notifier);
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    notifier.setAuthorizationListener(async (authRequest: AuthorizationRequest, authResponse: AuthorizationResponse | null, authError: AuthorizationError | null) => {
      Logger.logTrace(loggerCategory, "Authorization listener invoked", () => ({ authRequest, authResponse, authError }));

      const tokenResponse = await this._onAuthorizationResponse(authRequest, authResponse, authError);

      authorizationEvents.onAuthorizationResponseCompleted.raiseEvent(authError ? authError : undefined);

      await this.setTokenResponse(tokenResponse);
    });

    // Start the signin
    await authorizationHandler.performAuthorizationRequest(this._configuration, authorizationRequest);
  }

  private async _onAuthorizationResponse(authRequest: AuthorizationRequest, authResponse: AuthorizationResponse | null, authError: AuthorizationError | null): Promise<TokenResponse | undefined> {

    // Phase 1 of login has completed to fetch the authorization code - check for errors
    if (authError) {
      Logger.logError(loggerCategory, "Authorization error. Unable to get authorization code.", () => authError);
      return undefined;
    }

    if (!authResponse || authResponse.state !== authRequest.state) {
      Logger.logError(loggerCategory, "Authorization error. Unable to get authorization code", () => ({
        error: "invalid_state",
        errorDescription: "The login response state did not match the login request state.",
      }));
      return undefined;
    }

    // Phase 2: Swap the authorization code for the access token
    const tokenResponse = await this.swapAuthorizationCodeForTokens(authResponse.code, authRequest.internal!.code_verifier);
    Logger.logTrace(loggerCategory, "Authorization completed, and issued access token");
    return tokenResponse;
  }

  /**
   * Start the sign-out process
   * - calls the onUserStateChanged() call back after the authorization completes
   *   or if there is an error.
   * - redirects application to the postSignoutRedirectUri specified in the configuration when the sign out is
   *   complete
   */
  public async signOut(): Promise<void> {
    await this.makeRevokeTokenRequest();
  }

  private async getUserProfile(tokenResponse: TokenResponse): Promise<any | undefined> {
    const options: RequestOptions = {
      method: "GET",
      headers: {
        authorization: `Bearer ${tokenResponse.accessToken}`,
      },
      accept: "application/json",
    };

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    const session = this._session!;
    const httpContext = new ClientRequestContext(Guid.createValue(), session.applicationId, session.applicationVersion, session.sessionId);
    const response = await httpRequest(httpContext, this._configuration!.userInfoEndpoint!, options);
    return response?.body;
  }

  private async createAccessTokenFromResponse(tokenResponse: TokenResponse): Promise<AccessToken> {
    const profile = await this.getUserProfile(tokenResponse);

    const json = {
      /* eslint-disable @typescript-eslint/naming-convention */
      access_token: tokenResponse.accessToken,
      expires_at: tokenResponse.issuedAt + (tokenResponse.expiresIn ?? 0),
      expires_in: tokenResponse.expiresIn,
      /* eslint-enable @typescript-eslint/naming-convention */
    };

    return AccessToken.fromTokenResponseJson(json, profile);
  }

  private async setTokenResponse(tokenResponse: TokenResponse | undefined) {
    if (tokenResponse === undefined) {
      this._tokenResponse = undefined;
      this._accessToken = undefined;
      await this.tokenStore.delete();
      NativeHost.onUserStateChanged.raiseEvent(this._accessToken);
      return;
    }

    const accessToken = await this.createAccessTokenFromResponse(tokenResponse);
    this._tokenResponse = tokenResponse;
    this._accessToken = accessToken;
    await this.tokenStore.save(this._tokenResponse);
    NativeHost.onUserStateChanged.raiseEvent(this._accessToken);
  }

  private isValidToken(tokenResponse: TokenResponse): boolean {
    const buffer = this.clientConfiguration!.expiryBuffer || 60 * 10;
    return tokenResponse.isValid(-buffer);
  }

  private async refreshAccessToken(refreshToken: string): Promise<AccessToken> {
    const tokenResponse = await this.makeRefreshAccessTokenRequest(refreshToken);

    Logger.logTrace(loggerCategory, "Refresh token completed, and issued access token");
    await this.setTokenResponse(tokenResponse);

    assert(!!this._accessToken);
    return this._accessToken;
  }

  /** Returns a promise that resolves to the AccessToken of the currently authorized user.
 * - The token is ensured to be valid *at least* for the buffer of time specified by the configuration.
 * - The token is refreshed if it's possible and necessary.
 * - This method must be called to refresh the token - the client does NOT automatically monitor for token expiry.
 * - Getting or refreshing the token will trigger the [[onUserStateChanged]] event.
 * @throws [[BentleyError]] If signIn() was not called, or there was an authorization error.
 */
  public async getAccessToken(): Promise<AccessToken> {
    // Ensure user is signed in
    if (this._tokenResponse === undefined || this._tokenResponse.refreshToken === undefined)
      throw new BentleyError(AuthStatus.Error, "Not signed In. First call signIn()", Logger.logError, loggerCategory);

    // Refresh token if necessary
    if (!this.isValidToken(this._tokenResponse)) {
      await this.refreshAccessToken(this._tokenResponse.refreshToken);
    }

    assert(this.isValidToken(this._tokenResponse) && !!this._accessToken);
    return this._accessToken;
  }

  /**
   * Set to true if there's a current authorized user. i.e., the user has signed in, and the access token has not expired.
   * @note Returns true only if the current time is within the configuration specified buffer of time short of the actual expiry.
   */
  public get isAuthorized(): boolean {
    if (!!this._tokenResponse && this.isValidToken(this._tokenResponse)) {
      assert(!!this._accessToken);
      return true;
    }
    return false;
  }

  /**
   * Set to true if the user has signed in, but the token has expired and requires a refresh
   * @note Returns true if the current time is beyond or within the configuration specified buffer of time short of the actual expiry.
   */
  public get hasExpired(): boolean {
    return !!this._tokenResponse && !this.isValidToken(this._tokenResponse);
  }

  /** Set to true if signed in - the accessToken may be active or may have expired and require a refresh */
  public get hasSignedIn(): boolean {
    return !!this._tokenResponse;
  }

  /** Swap the authorization code for a refresh token and access token */
  private async swapAuthorizationCodeForTokens(authCode: string, codeVerifier: string): Promise<TokenResponse> {
    if (!this._configuration)
      throw new BentleyError(AuthStatus.Error, "Not initialized. First call initialize()", Logger.logError, loggerCategory);

    /* eslint-disable @typescript-eslint/naming-convention */
    const nativeConfig = this.config;
    const extras: StringMap = { code_verifier: codeVerifier };
    const tokenRequestJson: TokenRequestJson = {
      grant_type: GRANT_TYPE_AUTHORIZATION_CODE,
      code: authCode,
      redirect_uri: nativeConfig.redirectUri,
      client_id: nativeConfig.clientId,
      extras,
    };
    /* eslint-enable @typescript-eslint/naming-convention */

    const tokenRequest = new TokenRequest(tokenRequestJson);
    const tokenRequestor = new NodeRequestor();
    const tokenHandler: TokenRequestHandler = new BaseTokenRequestHandler(tokenRequestor);
    return tokenHandler.performTokenRequest(this._configuration, tokenRequest);
  }

  private async makeRefreshAccessTokenRequest(refreshToken: string): Promise<TokenResponse> {
    if (!this._configuration)
      throw new BentleyError(AuthStatus.Error, "Not initialized. First call initialize()", Logger.logError, loggerCategory);

    const nativeConfig = this.config;
    /* eslint-disable @typescript-eslint/naming-convention */
    const tokenRequestJson: TokenRequestJson = {
      grant_type: GRANT_TYPE_REFRESH_TOKEN,
      refresh_token: refreshToken,
      redirect_uri: nativeConfig.redirectUri,
      client_id: nativeConfig.clientId,
    };
    /* eslint-enable @typescript-eslint/naming-convention */

    const tokenRequest = new TokenRequest(tokenRequestJson);
    const tokenRequestor = new NodeRequestor();
    const tokenHandler: TokenRequestHandler = new BaseTokenRequestHandler(tokenRequestor);
    return tokenHandler.performTokenRequest(this._configuration, tokenRequest);
  }

  private async makeRevokeTokenRequest(): Promise<void> {
    if (!this._tokenResponse)
      throw new BentleyError(AuthStatus.Error, "Missing refresh token. First call signIn() and ensure it's successful", Logger.logError, loggerCategory);

    const refreshToken = this._tokenResponse.refreshToken!;

    /* eslint-disable @typescript-eslint/naming-convention */
    const nativeConfig = this.config;
    const revokeTokenRequestJson: RevokeTokenRequestJson = {
      token: refreshToken,
      token_type_hint: "refresh_token",
      client_id: nativeConfig.clientId,
    };
    /* eslint-enable @typescript-eslint/naming-convention */

    const revokeTokenRequest = new RevokeTokenRequest(revokeTokenRequestJson);
    const tokenRequestor = new NodeRequestor();
    const tokenHandler: TokenRequestHandler = new BaseTokenRequestHandler(tokenRequestor);
    await tokenHandler.performRevokeTokenRequest(this._configuration!, revokeTokenRequest);

    Logger.logTrace(loggerCategory, "Authorization revoked, and removed access token");
    await this.setTokenResponse(undefined);
  }
}
