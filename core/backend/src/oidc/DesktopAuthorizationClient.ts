/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
// Code based on the blog article @ https://authguidance.com

/** @packageDocumentation
 * @module Authentication
 */

import { assert, AuthStatus, BeEvent, BentleyError, ClientRequestContext, Logger } from "@bentley/bentleyjs-core";
import { FrontendAuthorizationClient } from "@bentley/frontend-authorization-client";
import { defaultDesktopAuthorizationClientExpiryBuffer, DesktopAuthorizationClientConfiguration } from "@bentley/imodeljs-common";
import { AccessToken, ImsAuthorizationClient, request, RequestOptions } from "@bentley/itwin-client";
import {
  AuthorizationError, AuthorizationNotifier, AuthorizationRequest, AuthorizationRequestJson, AuthorizationResponse, AuthorizationServiceConfiguration,
  BaseTokenRequestHandler, GRANT_TYPE_AUTHORIZATION_CODE, GRANT_TYPE_REFRESH_TOKEN, RevokeTokenRequest, RevokeTokenRequestJson, TokenRequest,
  TokenRequestHandler, TokenRequestJson, TokenResponse,
} from "@openid/appauth";
import { NodeCrypto, NodeRequestor } from "@openid/appauth/built/node_support";
import { StringMap } from "@openid/appauth/built/types";
import { BackendLoggerCategory } from "../BackendLoggerCategory";
import { ElectronAuthorizationEvents } from "./ElectronAuthorizationEvents";
import { ElectronAuthorizationRequestHandler } from "./ElectronAuthorizationRequestHandler";
import { ElectronTokenStore } from "./ElectronTokenStore";
import { LoopbackWebServer } from "./LoopbackWebServer";

const loggerCategory = BackendLoggerCategory.Authorization;
// cSpell:ignore openid appauth signin Pkce Signout

/**
 * Utility to generate OIDC/OAuth tokens for Desktop Applications
 * @alpha
 */
export class DesktopAuthorizationClient extends ImsAuthorizationClient implements FrontendAuthorizationClient {
  private _clientConfiguration: DesktopAuthorizationClientConfiguration;
  private _configuration: AuthorizationServiceConfiguration | undefined;
  private _tokenResponse: TokenResponse | undefined;
  private _accessToken?: AccessToken;
  private _tokenStore: ElectronTokenStore;

  /** Event called when the user's sign-in state changes - this may be due to calls to signIn(), signOut() or simply because the token expired */
  public readonly onUserStateChanged = new BeEvent<(token: AccessToken | undefined) => void>();

  public constructor(clientConfiguration: DesktopAuthorizationClientConfiguration) {
    super();
    this._clientConfiguration = clientConfiguration;
    this._tokenStore = new ElectronTokenStore(this._clientConfiguration.clientId);
  }

  /**
   * Used to initialize the client - must be awaited before any other methods are called.
   * The call attempts a silent sign-if possible.
   */
  public async initialize(requestContext: ClientRequestContext): Promise<void> {
    const url = await this.getUrl(requestContext);
    const tokenRequestor = new NodeRequestor(); // the Node.js based HTTP client
    this._configuration = await AuthorizationServiceConfiguration.fetchFromIssuer(
      url,
      tokenRequestor,
    );
    Logger.logTrace(loggerCategory, "Initialized service configuration", () => ({ configuration: this._configuration }));

    // Attempt to load the access token from store
    await this.loadAccessToken(requestContext);
  }

  /** Loads the access token from the store, and refreshes it if necessary and possible
   * @return AccessToken if it's possible to get a valid access token, and undefined otherwise.
   */
  private async loadAccessToken(requestContext: ClientRequestContext): Promise<AccessToken | undefined> {
    const tokenResponse = await this._tokenStore.load();
    if (tokenResponse === undefined || tokenResponse.refreshToken === undefined)
      return undefined;
    try {
      Logger.logTrace(loggerCategory, "Refreshing token from storage");
      await this.refreshAccessToken(requestContext || new ClientRequestContext(), tokenResponse.refreshToken);
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
  public async signIn(requestContext: ClientRequestContext): Promise<void> {
    requestContext.enter();
    if (!this._configuration)
      throw new BentleyError(AuthStatus.Error, "Not initialized. First call initialize()", Logger.logError, loggerCategory);

    // Attempt to load the access token from store
    await this.loadAccessToken(requestContext);
    if (this._accessToken)
      return;

    // Create the authorization request
    const authReqJson: AuthorizationRequestJson = {
      client_id: this._clientConfiguration.clientId, // eslint-disable-line @typescript-eslint/naming-convention
      redirect_uri: this._clientConfiguration.redirectUri, // eslint-disable-line @typescript-eslint/naming-convention
      scope: this._clientConfiguration.scope,
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
    LoopbackWebServer.start(this._clientConfiguration);

    const authorizationHandler = new ElectronAuthorizationRequestHandler(authorizationEvents);

    // Setup a notifier to obtain the result of authorization
    const notifier = new AuthorizationNotifier();
    authorizationHandler.setAuthorizationNotifier(notifier);
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    notifier.setAuthorizationListener(async (authRequest: AuthorizationRequest, authResponse: AuthorizationResponse | null, authError: AuthorizationError | null) => {
      requestContext.enter();
      Logger.logTrace(loggerCategory, "Authorization listener invoked", () => ({ authRequest, authResponse, authError }));

      const tokenResponse = await this._onAuthorizationResponse(requestContext, authRequest, authResponse, authError);

      authorizationEvents.onAuthorizationResponseCompleted.raiseEvent(authError ? authError : undefined);

      await this.setTokenResponse(requestContext, tokenResponse);
    });

    // Start the signin
    await authorizationHandler.performAuthorizationRequest(this._configuration, authorizationRequest);
  }

  private async _onAuthorizationResponse(requestContext: ClientRequestContext, authRequest: AuthorizationRequest, authResponse: AuthorizationResponse | null, authError: AuthorizationError | null): Promise<TokenResponse | undefined> {
    requestContext.enter();

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
    const tokenResponse = await this.swapAuthorizationCodeForTokens(requestContext, authResponse.code, authRequest.internal!.code_verifier);
    requestContext.enter();
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
  public async signOut(requestContext: ClientRequestContext): Promise<void> {
    requestContext.enter();
    await this.makeRevokeTokenRequest(requestContext);
  }

  private async getUserProfile(requestContext: ClientRequestContext, tokenResponse: TokenResponse): Promise<any | undefined> {
    requestContext.enter();
    const options: RequestOptions = {
      method: "GET",
      headers: {
        authorization: `Bearer ${tokenResponse.accessToken}`,
      },
      accept: "application/json",
    };

    const response = await request(requestContext, this._configuration!.userInfoEndpoint!, options);
    return response?.body;
  }

  private async createAccessTokenFromResponse(requestContext: ClientRequestContext, tokenResponse: TokenResponse): Promise<AccessToken> {
    const profile = await this.getUserProfile(requestContext, tokenResponse);

    const json = {
      /* eslint-disable @typescript-eslint/naming-convention */
      access_token: tokenResponse.accessToken,
      expires_at: tokenResponse.issuedAt + (tokenResponse.expiresIn ?? 0),
      expires_in: tokenResponse.expiresIn,
      /* eslint-enable @typescript-eslint/naming-convention */
    };

    return AccessToken.fromTokenResponseJson(json, profile);
  }

  private async setTokenResponse(requestContext: ClientRequestContext, tokenResponse: TokenResponse | undefined) {
    requestContext.enter();

    if (tokenResponse === undefined) {
      this._tokenResponse = undefined;
      this._accessToken = undefined;
      await this._tokenStore.delete();
      this.onUserStateChanged.raiseEvent(this._accessToken);
      return;
    }

    const accessToken = await this.createAccessTokenFromResponse(requestContext, tokenResponse);
    requestContext.enter();

    this._tokenResponse = tokenResponse;
    this._accessToken = accessToken;
    await this._tokenStore.save(this._tokenResponse);
    this.onUserStateChanged.raiseEvent(this._accessToken);
  }

  private isValidToken(tokenResponse: TokenResponse): boolean {
    const buffer = this._clientConfiguration.expiryBuffer || defaultDesktopAuthorizationClientExpiryBuffer;
    return tokenResponse.isValid(-buffer);
  }

  private async refreshAccessToken(requestContext: ClientRequestContext, refreshToken: string): Promise<AccessToken> {
    requestContext.enter();

    const tokenResponse = await this.makeRefreshAccessTokenRequest(requestContext, refreshToken);

    Logger.logTrace(loggerCategory, "Refresh token completed, and issued access token");
    await this.setTokenResponse(requestContext, tokenResponse);

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
  public async getAccessToken(requestContext?: ClientRequestContext): Promise<AccessToken> {
    if (requestContext) requestContext.enter();

    // Ensure user is signed in
    if (this._tokenResponse === undefined || this._tokenResponse.refreshToken === undefined)
      throw new BentleyError(AuthStatus.Error, "Not signed In. First call signIn()", Logger.logError, loggerCategory);

    // Refresh token if necessary
    if (!this.isValidToken(this._tokenResponse)) {
      await this.refreshAccessToken(requestContext || new ClientRequestContext(), this._tokenResponse.refreshToken);
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
  private async swapAuthorizationCodeForTokens(requestContext: ClientRequestContext, authCode: string, codeVerifier: string): Promise<TokenResponse> {
    requestContext.enter();
    if (!this._configuration)
      throw new BentleyError(AuthStatus.Error, "Not initialized. First call initialize()", Logger.logError, loggerCategory);

    /* eslint-disable @typescript-eslint/naming-convention */
    const extras: StringMap = { code_verifier: codeVerifier };
    const tokenRequestJson: TokenRequestJson = {
      grant_type: GRANT_TYPE_AUTHORIZATION_CODE,
      code: authCode,
      redirect_uri: this._clientConfiguration.redirectUri,
      client_id: this._clientConfiguration.clientId,
      extras,
    };
    /* eslint-enable @typescript-eslint/naming-convention */

    const tokenRequest = new TokenRequest(tokenRequestJson);
    const tokenRequestor = new NodeRequestor();
    const tokenHandler: TokenRequestHandler = new BaseTokenRequestHandler(tokenRequestor);
    return tokenHandler.performTokenRequest(this._configuration, tokenRequest);
  }

  private async makeRefreshAccessTokenRequest(requestContext: ClientRequestContext, refreshToken: string): Promise<TokenResponse> {
    requestContext.enter();
    if (!this._configuration)
      throw new BentleyError(AuthStatus.Error, "Not initialized. First call initialize()", Logger.logError, loggerCategory);

    /* eslint-disable @typescript-eslint/naming-convention */
    const tokenRequestJson: TokenRequestJson = {
      grant_type: GRANT_TYPE_REFRESH_TOKEN,
      refresh_token: refreshToken,
      redirect_uri: this._clientConfiguration.redirectUri,
      client_id: this._clientConfiguration.clientId,
    };
    /* eslint-enable @typescript-eslint/naming-convention */

    const tokenRequest = new TokenRequest(tokenRequestJson);
    const tokenRequestor = new NodeRequestor();
    const tokenHandler: TokenRequestHandler = new BaseTokenRequestHandler(tokenRequestor);
    return tokenHandler.performTokenRequest(this._configuration, tokenRequest);
  }

  private async makeRevokeTokenRequest(requestContext: ClientRequestContext): Promise<void> {
    requestContext.enter();
    if (!this._configuration)
      throw new BentleyError(AuthStatus.Error, "Not initialized. First call initialize()", Logger.logError, loggerCategory);
    if (!this._tokenResponse)
      throw new BentleyError(AuthStatus.Error, "Missing refresh token. First call signIn() and ensure it's successful", Logger.logError, loggerCategory);

    const refreshToken = this._tokenResponse.refreshToken!;

    /* eslint-disable @typescript-eslint/naming-convention */
    const revokeTokenRequestJson: RevokeTokenRequestJson = {
      token: refreshToken,
      token_type_hint: "refresh_token",
      client_id: this._clientConfiguration.clientId,
    };
    /* eslint-enable @typescript-eslint/naming-convention */

    const revokeTokenRequest = new RevokeTokenRequest(revokeTokenRequestJson);
    const tokenRequestor = new NodeRequestor();
    const tokenHandler: TokenRequestHandler = new BaseTokenRequestHandler(tokenRequestor);
    await tokenHandler.performRevokeTokenRequest(this._configuration, revokeTokenRequest);
    requestContext.enter();

    Logger.logTrace(loggerCategory, "Authorization revoked, and removed access token");
    await this.setTokenResponse(requestContext, undefined);
  }
}
