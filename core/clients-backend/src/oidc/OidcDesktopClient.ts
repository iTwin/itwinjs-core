/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Authentication */

import { BeEvent, BentleyError, AuthStatus, Logger, assert, ClientRequestContext } from "@bentley/bentleyjs-core";
import { AccessToken, UserInfo, OidcClient, IOidcFrontendClient, OidcFrontendClientConfiguration, request, RequestOptions } from "@bentley/imodeljs-clients";
import {
  GRANT_TYPE_AUTHORIZATION_CODE, GRANT_TYPE_REFRESH_TOKEN, DefaultCrypto,
  AuthorizationNotifier, AuthorizationServiceConfiguration, BaseTokenRequestHandler, TokenRequestHandler,
  AuthorizationRequestJson, AuthorizationRequest, AuthorizationResponse, AuthorizationError,
  TokenRequestJson, TokenRequest, TokenResponse, RevokeTokenRequestJson, RevokeTokenRequest,
} from "@openid/appauth";
import { NodeRequestor } from "@openid/appauth/built/node_support";
import { StringMap } from "@openid/appauth/built/types";
import { ElectronTokenStore } from "./ElectronTokenStore";
import { ClientsBackendLoggerCategory } from "../ClientsBackendLoggerCategory";
import { ElectronAuthorizationRequestHandler } from "./ElectronAuthorizationRequestHandler";
import { ElectronAuthorizationEvents } from "./ElectronAuthorizationEvents";

const loggerCategory = ClientsBackendLoggerCategory.OidcDesktopClient;

/**
 * Utility to generate OIDC/OAuth tokens for Desktop Applications
 * @alpha
 */
export class OidcDesktopClient extends OidcClient implements IOidcFrontendClient {
  private _clientConfiguration: OidcFrontendClientConfiguration;
  private _configuration: AuthorizationServiceConfiguration | undefined;
  private _tokenResponse: TokenResponse | undefined;
  private _requestContext?: ClientRequestContext;
  private _accessToken?: AccessToken;
  private _tokenStore: ElectronTokenStore;

  /** Event called when the user's sign-in state changes - this may be due to calls to signIn(), signOut() or simply because the token expired */
  public readonly onUserStateChanged = new BeEvent<(token: AccessToken | undefined) => void>();

  public constructor(clientConfiguration: OidcFrontendClientConfiguration) {
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
    const tokenResponse: TokenResponse | undefined = await this._tokenStore.load();
    if (tokenResponse === undefined)
      return undefined;
    try {
      Logger.logTrace(loggerCategory, "Refreshing token from storage");
      this._tokenResponse = tokenResponse; // Only refresh token has been stashed away
      await this.refreshAccessToken(requestContext || new ClientRequestContext());
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

    const authorizationHandler = new ElectronAuthorizationRequestHandler(this._clientConfiguration);

    const notifier = new AuthorizationNotifier();
    authorizationHandler.setAuthorizationNotifier(notifier);
    notifier.setAuthorizationListener(this._authorizationListener);

    const authReqJson: AuthorizationRequestJson = {
      client_id: this._clientConfiguration.clientId,
      redirect_uri: this._clientConfiguration.redirectUri,
      scope: this._clientConfiguration.scope,
      response_type: AuthorizationRequest.RESPONSE_TYPE_CODE,
      extras: { prompt: "consent", access_type: "offline" },
    };

    const authRequest = new AuthorizationRequest(authReqJson, new DefaultCrypto(), true /* = usePkce */);

    this._requestContext = requestContext;
    await authorizationHandler.performAuthorizationRequest(this._configuration, authRequest);
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

  private async getUserInfo(requestContext: ClientRequestContext, tokenResponse: TokenResponse): Promise<UserInfo | undefined> {
    requestContext.enter();
    const options: RequestOptions = {
      method: "GET",
      headers: {
        authorization: `Bearer ${tokenResponse.accessToken}`,
      },
      accept: "application/json",
    };

    const response = await request(requestContext, this._configuration!.userInfoEndpoint!, options);
    return UserInfo.fromJson(response.body);
  }

  private async createAccessTokenFromResponse(requestContext: ClientRequestContext, tokenResponse: TokenResponse): Promise<AccessToken> {
    const startsAt: Date = new Date(tokenResponse.issuedAt * 1000);
    const expiresAt: Date = new Date((tokenResponse.issuedAt + tokenResponse.expiresIn!) * 1000);
    const userInfo: UserInfo | undefined = await this.getUserInfo(requestContext, tokenResponse);
    const accessToken = AccessToken.fromJsonWebTokenString(tokenResponse.accessToken, startsAt, expiresAt, userInfo);
    return accessToken;
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

    const accessToken: AccessToken = await this.createAccessTokenFromResponse(requestContext, tokenResponse);
    requestContext.enter();

    this._tokenResponse = tokenResponse;
    this._accessToken = accessToken;
    await this._tokenStore.save(this._tokenResponse);
    this.onUserStateChanged.raiseEvent(this._accessToken);
  }

  private async refreshAccessToken(requestContext: ClientRequestContext): Promise<AccessToken> {
    requestContext.enter();

    assert(!!this._tokenResponse);
    const tokenResponse: TokenResponse = await this.makeRefreshTokenRequest(requestContext);

    Logger.logTrace(loggerCategory, "Refresh token completed, and issued access token");
    await this.setTokenResponse(requestContext, tokenResponse);

    assert(!!this._accessToken);
    return this._accessToken!;
  }

  /** Returns a promise that resolves to the AccessToken of the currently authorized user.
   * The token is refreshed as necessary.
   * @throws [[BentleyError]] If signIn() was not called, or there was an authorization error.
   */
  public async getAccessToken(requestContext?: ClientRequestContext): Promise<AccessToken> {
    if (requestContext) requestContext.enter();

    // Ensure user is signed in
    if (!this._tokenResponse)
      throw new BentleyError(AuthStatus.Error, "Not signed In. First call signIn()", Logger.logError, loggerCategory);

    // Refresh token if necessary
    if (!this._tokenResponse.isValid())
      await this.refreshAccessToken(requestContext || new ClientRequestContext());

    assert(this._tokenResponse.isValid() && !!this._accessToken);
    return this._accessToken!;
  }

  /**
   * Set to true if there's a current authorized user. i.e., the user has signed in,
   * and the access token has not expired.
   */
  public get isAuthorized(): boolean {
    if (!!this._tokenResponse && this._tokenResponse.isValid()) {
      assert(!!this._accessToken);
      return true;
    }
    return false;
  }

  /** Set to true if the user has signed in, but the token has expired and requires a refresh */
  public get hasExpired(): boolean {
    return !!this._tokenResponse && !this._tokenResponse.isValid();
  }

  /** Set to true if signed in - the accessToken may be active or may have expired and require a refresh */
  public get hasSignedIn(): boolean {
    return !!this._tokenResponse;
  }

  /** Disposes the resources held by this client */
  public dispose(): void {
  }

  private _authorizationListener = async (authRequest: AuthorizationRequest, authResponse: AuthorizationResponse | null, authError: AuthorizationError | null) => {
    // Phase 1 of login has completed to fetch the authorization code - check for errors
    assert(!!this._requestContext);
    const requestContext: ClientRequestContext = this._requestContext!;
    this._requestContext = undefined;
    requestContext.enter();

    let tokenResponse: TokenResponse | undefined;
    Logger.logTrace(loggerCategory, "Authorization listener invoked", () => ({ authRequest, authResponse, authError }));
    if (authError) {
      Logger.logError(loggerCategory, "Authorization error. Unable to get authorization code.", () => authError);
    } else if (!authResponse || authResponse.state !== authRequest.state) {
      Logger.logError(loggerCategory, "Authorization error. Unable to get authorization code", () => ({
        error: "invalid_state",
        errorDescription: "The login response state did not match the login request state.",
      }));
    } else {
      // Phase 2: Swap the authorization code for the access token
      tokenResponse = await this.swapAuthorizationCodeForTokens(requestContext, authResponse.code, authRequest.internal!.code_verifier);
      requestContext.enter();
    }

    ElectronAuthorizationEvents.onAuthorizationResponseCompleted.raiseEvent(authError ? authError : undefined);

    Logger.logTrace(loggerCategory, "Authorization completed, and issued access token");
    await this.setTokenResponse(requestContext, tokenResponse);
  }

  /** Swap the authorization code for a refresh token and access token */
  private async swapAuthorizationCodeForTokens(requestContext: ClientRequestContext, authCode: string, codeVerifier: string): Promise<TokenResponse> {
    requestContext.enter();
    if (!this._configuration)
      throw new BentleyError(AuthStatus.Error, "Not initialized. First call initialize()", Logger.logError, loggerCategory);

    const extras: StringMap = { code_verifier: codeVerifier };
    const tokenRequestJson: TokenRequestJson = {
      grant_type: GRANT_TYPE_AUTHORIZATION_CODE,
      code: authCode,
      redirect_uri: this._clientConfiguration.redirectUri,
      client_id: this._clientConfiguration.clientId,
      extras,
    };

    const tokenRequest = new TokenRequest(tokenRequestJson);
    const tokenRequestor = new NodeRequestor();
    const tokenHandler: TokenRequestHandler = new BaseTokenRequestHandler(tokenRequestor);
    return tokenHandler.performTokenRequest(this._configuration, tokenRequest);
  }

  private async makeRefreshTokenRequest(requestContext: ClientRequestContext): Promise<TokenResponse> {
    requestContext.enter();
    if (!this._configuration)
      throw new BentleyError(AuthStatus.Error, "Not initialized. First call initialize()", Logger.logError, loggerCategory);
    if (!this._tokenResponse)
      throw new BentleyError(AuthStatus.Error, "Missing refresh token. First call signIn() and ensure it's successful", Logger.logError, loggerCategory);

    const tokenRequestJson: TokenRequestJson = {
      grant_type: GRANT_TYPE_REFRESH_TOKEN,
      refresh_token: this._tokenResponse.refreshToken,
      redirect_uri: this._clientConfiguration.redirectUri,
      client_id: this._clientConfiguration.clientId,
    };

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

    const revokeTokenRequestJson: RevokeTokenRequestJson = {
      token: refreshToken,
      token_type_hint: "refresh_token",
      client_id: this._clientConfiguration.clientId,
    };

    const revokeTokenRequest = new RevokeTokenRequest(revokeTokenRequestJson);
    const tokenRequestor = new NodeRequestor();
    const tokenHandler: TokenRequestHandler = new BaseTokenRequestHandler(tokenRequestor);
    await tokenHandler.performRevokeTokenRequest(this._configuration, revokeTokenRequest);
    requestContext.enter();

    Logger.logTrace(loggerCategory, "Authorization revoked, and removed access token");
    await this.setTokenResponse(requestContext, undefined);
  }
}
