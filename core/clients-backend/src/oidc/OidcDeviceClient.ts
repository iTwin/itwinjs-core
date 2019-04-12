/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { BeEvent, BentleyError, AuthStatus, Logger, assert, ClientRequestContext } from "@bentley/bentleyjs-core";
import { AccessToken, OidcClient, IOidcFrontendClient, UserInfo, OidcFrontendClientConfiguration } from "@bentley/imodeljs-clients";
import {
  AuthorizationRequest, AuthorizationRequestJson, AuthorizationNotifier, AuthorizationServiceConfiguration,
  AuthorizationResponse, AuthorizationError, RevokeTokenRequest,
  GRANT_TYPE_AUTHORIZATION_CODE, GRANT_TYPE_REFRESH_TOKEN,
  TokenRequest, TokenRequestJson, BaseTokenRequestHandler, TokenRequestHandler, TokenResponse,
} from "@openid/appauth";
import { NodeBasedHandler, NodeRequestor } from "@openid/appauth/built/node_support";
import { StringMap } from "@openid/appauth/built/types";
import { LoggerCategory } from "../LoggerCategory";

const loggerCategory: string = LoggerCategory.OidcDeviceClient;

export class OidcDeviceClient extends OidcClient implements IOidcFrontendClient {
  private _clientConfiguration: OidcFrontendClientConfiguration;
  private _notifier: AuthorizationNotifier;
  private _authorizationHandler: NodeBasedHandler;
  private _tokenHandler: TokenRequestHandler;
  private _configuration: AuthorizationServiceConfiguration | undefined;
  private _tokenResponse: TokenResponse | undefined;
  private _nodeRequestor = new NodeRequestor(); // the Node.js based HTTP client
  private _requestContext?: ClientRequestContext;
  private _accessToken?: AccessToken;

  /** Event called when the user's sign-in state changes - this may be due to calls to signIn(), signOut() or simply because the token expired */
  public readonly onUserStateChanged = new BeEvent<(token: AccessToken | undefined, message: string) => void>();

  public constructor(clientConfiguration: OidcFrontendClientConfiguration) {
    super();
    this._clientConfiguration = clientConfiguration;
    this._notifier = new AuthorizationNotifier();
    this._authorizationHandler = new NodeBasedHandler();

    this._tokenHandler = new BaseTokenRequestHandler(this._nodeRequestor);
    // set notifier to deliver responses

    this._authorizationHandler.setAuthorizationNotifier(this._notifier);

    const redirectUrl = new URL(this._clientConfiguration.redirectUri);
    this._authorizationHandler.httpServerPort = +redirectUrl.port;

    // set a listener to listen for authorization responses
    this._notifier.setAuthorizationListener(this.authorizationListener);
  }

  /** Used to initialize the client - must be awaited before any other methods are called */
  public async initialize(requestContext: ClientRequestContext): Promise<void> {
    const url = await this.getUrl(requestContext);
    this._configuration = await AuthorizationServiceConfiguration.fetchFromIssuer(
      url,
      this._nodeRequestor,
    );
    Logger.logTrace(loggerCategory, "Initialized service configuration", () => ({ configuration: this._configuration }));
  }

  /**
   * Start the sign-in process
   * - calls the onUserStateChanged() call back after the authorization completes
   * or if there is an error.
   * - redirects application to the redirectUri specified in the configuration and then
   * redirects back to root when sign-in is complete.
   */
  public async signIn(requestContext: ClientRequestContext): Promise<void> {
    if (this.hasSignedIn)
      return;
    this.makeAuthorizationRequest(requestContext);
  }

  /**
   * Start the sign-out process
   * - calls the onUserStateChanged() call back after the authorization completes
   *   or if there is an error.
   * - redirects application to the postSignoutRedirectUri specified in the configuration when the sign out is
   *   complete
   */
  public async signOut(requestContext: ClientRequestContext): Promise<void> {
    if (!this.hasSignedIn)
      return;
    this.makeRevokeTokenRequest(requestContext); // tslint:disable-line:no-floating-promises   });
  }

  private async getUserInfo(requestContext: ClientRequestContext): Promise<UserInfo | undefined> {
    requestContext.enter();

    assert(!!this._tokenResponse);
    const request = new Request(this._configuration!.userInfoEndpoint!, {
      headers: new Headers({ Authorization: `Bearer ${this._tokenResponse!.accessToken}` }),
      method: "GET",
      cache: "no-cache",
    });

    const result = await fetch(request);
    const user = await result.json();
    requestContext.enter();

    return UserInfo.fromJson(user);
  }

  /** Returns a promise that resolves to the AccessToken if signed in. The token is refreshed if it's possible and necessary. */
  private async createOrRefreshAccessToken(requestContext: ClientRequestContext): Promise<void> {
    requestContext.enter();

    if (!this._tokenResponse)
      throw new BentleyError(AuthStatus.Error, "Not signed In. First call signIn()", Logger.logError, loggerCategory);

    if (this._tokenResponse.isValid()) {
      if (this._accessToken)
        return; // No need to update
    } else {
      this._tokenResponse = await this.makeRefreshTokenRequest(requestContext);
      requestContext.enter();
      assert(this._tokenResponse.isValid());
    }

    const startsAt: Date = new Date(this._tokenResponse.issuedAt);
    const expiresAt: Date = new Date(this._tokenResponse.issuedAt + this._tokenResponse.expiresIn!);
    const userInfo: UserInfo | undefined = await this.getUserInfo(requestContext);

    this._accessToken = AccessToken.fromJsonWebTokenString(this._tokenResponse.accessToken, startsAt, expiresAt, userInfo);
  }

  /** Returns a promise that resolves to the AccessToken of the currently authorized user.
   * The token is refreshed as necessary.
   * @throws [[BentleyError]] If signIn() was not called, or there was an authorization error.
   */
  public async getAccessToken(requestContext?: ClientRequestContext): Promise<AccessToken> {
    if (this.isAuthorized)
      return this._accessToken!;
    await this.createOrRefreshAccessToken(requestContext || new ClientRequestContext());
    assert(!!this._accessToken);
    return this._accessToken!;
  }

  /** Returns true if there's a current authorized user or client (in the case of agent applications).
   * Returns true if signed in and the access token has not expired, and false otherwise.
   */
  public get isAuthorized(): boolean {
    return this.hasSignedIn && this._tokenResponse!.isValid();
  }

  /** Returns true if the user has signed in, but the token has expired and requires a refresh */
  public get hasExpired(): boolean {
    return this.hasSignedIn && !this._tokenResponse!.isValid();
  }

  /** Returns true if the user has signed in, but the token has expired and requires a refresh */
  public get hasSignedIn(): boolean {
    return !!this._tokenResponse && !!this._accessToken;
  }

  /** Disposes the resources held by this client */
  public dispose(): void {
  }

  private async authorizationListener(authRequest: AuthorizationRequest, authResponse: AuthorizationResponse | null, authError: AuthorizationError | null) {
    assert(!!this._requestContext);
    const requestContext: ClientRequestContext = this._requestContext!;
    this._requestContext = undefined;
    requestContext.enter();

    Logger.logTrace(loggerCategory, "Authorization listener invoked", () => ({ authRequest, authResponse, authError }));
    if (authError || !authResponse) {
      const errorMessage = authError ? authError.error : "Authorization error";
      Logger.logError(loggerCategory, errorMessage, () => authError);
      this.onUserStateChanged.raiseEvent(undefined, errorMessage);
      return;
    }

    this._tokenResponse = await this.requestAccessTokenFromCode(requestContext, authResponse.code, authRequest);
    requestContext.enter();

    await this.createOrRefreshAccessToken(requestContext);
    requestContext.enter();

    const message = "Authorization completed, and issued access token";
    Logger.logTrace(loggerCategory, message);
    this.onUserStateChanged.raiseEvent(this._accessToken, message);
  }

  private makeAuthorizationRequest(requestContext: ClientRequestContext) {
    requestContext.enter();
    if (!this._configuration)
      throw new BentleyError(AuthStatus.Error, "Not initialized. First call initialize()", Logger.logError, loggerCategory);

    const reqJson: AuthorizationRequestJson = {
      response_type: AuthorizationRequest.RESPONSE_TYPE_CODE,
      client_id: this._clientConfiguration.clientId,
      redirect_uri: this._clientConfiguration.redirectUri,
      scope: this._clientConfiguration.scope,
      extras: { prompt: "consent", access_type: "offline" },
    };
    const request = new AuthorizationRequest(
      reqJson,
      undefined /* state */,
      true, /* usePkce */
    );

    Logger.logTrace(loggerCategory, "Making authorization request", () => ({ configuration: this._configuration, request }));
    this._requestContext = requestContext;
    this._authorizationHandler.performAuthorizationRequest(
      this._configuration,
      request,
    );
  }

  /** Make a request for a refresh token starting with the authorization code */
  private async requestAccessTokenFromCode(requestContext: ClientRequestContext, authCode: string, authRequest: AuthorizationRequest): Promise<TokenResponse> {
    requestContext.enter();
    if (!this._configuration)
      throw new BentleyError(AuthStatus.Error, "Not initialized. First call initialize()", Logger.logError, loggerCategory);

    let extras: StringMap | undefined;
    if (authRequest && authRequest.internal) {
      extras = {};
      extras.code_verifier = authRequest.internal.code_verifier;
    }

    const tokenRequestJson: TokenRequestJson = {
      grant_type: GRANT_TYPE_AUTHORIZATION_CODE,
      code: authCode,
      redirect_uri: this._clientConfiguration.redirectUri,
      client_id: this._clientConfiguration.clientId,
      extras,
    };

    const request = new TokenRequest(tokenRequestJson);
    return this._tokenHandler.performTokenRequest(this._configuration, request);
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

    const request = new TokenRequest(tokenRequestJson);
    return this._tokenHandler.performTokenRequest(this._configuration, request);
  }

  private async makeRevokeTokenRequest(requestContext: ClientRequestContext): Promise<void> {
    requestContext.enter();
    if (!this._configuration)
      throw new BentleyError(AuthStatus.Error, "Not initialized. First call initialize()", Logger.logError, loggerCategory);
    if (!this._tokenResponse)
      throw new BentleyError(AuthStatus.Error, "Missing refresh token. First call signIn() and ensure it's successful", Logger.logError, loggerCategory);

    const request = new RevokeTokenRequest({ token: this._tokenResponse.refreshToken! });
    await this._tokenHandler.performRevokeTokenRequest(this._configuration, request);
    requestContext.enter();

    this._tokenResponse = undefined;
    Logger.logTrace(loggerCategory, "Authorization revoked, and removed access token");
    this.onUserStateChanged.raiseEvent(undefined);
  }
}
