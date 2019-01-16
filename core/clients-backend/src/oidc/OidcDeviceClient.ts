/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { BeEvent, ActivityLoggingContext, BentleyError, AuthStatus, Logger, assert } from "@bentley/bentleyjs-core";
import { AccessToken, OidcClient, IOidcFrontendClient, UserInfo, OidcFrontendClientConfiguration } from "@bentley/imodeljs-clients";
import {
  AuthorizationRequest, AuthorizationRequestJson, AuthorizationNotifier, AuthorizationServiceConfiguration,
  AuthorizationResponse, AuthorizationError, RevokeTokenRequest,
  GRANT_TYPE_AUTHORIZATION_CODE, GRANT_TYPE_REFRESH_TOKEN,
  TokenRequest, TokenRequestJson, BaseTokenRequestHandler, TokenRequestHandler, TokenResponse,
} from "@openid/appauth";
import { NodeBasedHandler, NodeRequestor } from "@openid/appauth/built/node_support";
import { StringMap } from "@openid/appauth/built/types";

const loggingCategory = "imodeljs-clients-device.OidcDeviceClient";

export class OidcDeviceClient extends OidcClient implements IOidcFrontendClient {
  private _clientConfiguration: OidcFrontendClientConfiguration;
  private _notifier: AuthorizationNotifier;
  private _authorizationHandler: NodeBasedHandler;
  private _tokenHandler: TokenRequestHandler;
  private _configuration: AuthorizationServiceConfiguration | undefined;
  private _tokenResponse: TokenResponse | undefined;
  private _nodeRequestor = new NodeRequestor(); // the Node.js based HTTP client
  private _actx?: ActivityLoggingContext;

  /** Event called when the user's sign-in state changes - this may be due to calls to signIn(), signOut() or simply because the token expired */
  public readonly onUserStateChanged = new BeEvent<(token: AccessToken | undefined) => void>();

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
  public async initialize(actx: ActivityLoggingContext): Promise<void> {
    const url = await this.getUrl(actx);
    this._configuration = await AuthorizationServiceConfiguration.fetchFromIssuer(
      url,
      this._nodeRequestor,
    );
    Logger.logTrace(loggingCategory, "Initialized service configuration", () => ({ configuration: this._configuration }));
  }

  public getIsSignedIn(): boolean {
    return !!this._tokenResponse && this._tokenResponse.isValid();
  }

  /** Called to start the sign-in process. Subscribe to onUserStateChanged to be notified when sign-in completes */
  public signIn(actx: ActivityLoggingContext): void {
    if (this.getIsSignedIn())
      return;
    this.makeAuthorizationRequest(actx);
  }

  /** Called to start the sign-out process. Subscribe to onUserStateChanged to be notified when sign-out completes */
  public signOut(actx: ActivityLoggingContext): void {
    if (!this.getIsSignedIn())
      return;

    this.makeRevokeTokenRequest(actx); // tslint:disable-line:no-floating-promises
  }

  /** Returns a promise that resolves to the AccessToken if signed in, and undefined otherwise. The token is refreshed if it's possible and necessary. */
  public async getAccessToken(actx: ActivityLoggingContext): Promise<AccessToken | undefined> {
    actx.enter();
    if (!this._tokenResponse)
      throw new BentleyError(AuthStatus.Error, "Not signed In. First call signIn()", Logger.logError, loggingCategory);

    if (!this._tokenResponse.isValid()) {
      await this.makeAccessTokenRequest(actx);
      assert(this._tokenResponse.isValid());
    }

    const request = new Request(this._configuration!.userInfoEndpoint!, {
      headers: new Headers({ Authorization: `Bearer ${this._tokenResponse.accessToken}` }),
      method: "GET",
      cache: "no-cache",
    });

    const result = await fetch(request);
    const user = await result.json();
    const userInfo = UserInfo.fromJson(user);
    const startsAt: Date = new Date(this._tokenResponse.issuedAt);
    const expiresAt: Date = new Date(this._tokenResponse.issuedAt + this._tokenResponse.expiresIn!);
    const accessToken = AccessToken.fromJsonWebTokenString(this._tokenResponse.accessToken, startsAt, expiresAt, userInfo);
    return Promise.resolve(accessToken);
  }

  /** Disposes the resources held by this client */
  public dispose(): void {
  }

  private async authorizationListener(authRequest: AuthorizationRequest, authResponse: AuthorizationResponse | null, authError: AuthorizationError | null) {
    assert(!!this._actx);
    const actx: ActivityLoggingContext = this._actx!;
    this._actx = undefined;
    actx.enter();

    Logger.logTrace(loggingCategory, "Authorization listener invoked", () => ({ authRequest, authResponse, authError }));
    if (authError || !authResponse)
      throw new BentleyError(AuthStatus.Error, "Authorization error", Logger.logError, loggingCategory, () => authError);

    await this.makeRefreshTokenRequest(this._actx!, authResponse.code, authRequest);
    actx.enter();

    const accessToken: AccessToken | undefined = await this.getAccessToken(this._actx!);
    actx.enter();

    Logger.logTrace(loggingCategory, "Authorization completed, and issued access token");
    this.onUserStateChanged.raiseEvent(accessToken);
  }

  private makeAuthorizationRequest(actx: ActivityLoggingContext) {
    actx.enter();
    if (!this._configuration)
      throw new BentleyError(AuthStatus.Error, "Not initialized. First call initialize()", Logger.logError, loggingCategory);

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

    Logger.logTrace(loggingCategory, "Making authorization request", () => ({ configuration: this._configuration, request }));
    this._actx = actx;
    this._authorizationHandler.performAuthorizationRequest(
      this._configuration,
      request,
    );
  }

  /** Make a request for a refresh token starting with the authorization code */
  private async makeRefreshTokenRequest(actx: ActivityLoggingContext, authCode: string, authRequest: AuthorizationRequest): Promise<TokenResponse> {
    actx.enter();
    if (!this._configuration)
      throw new BentleyError(AuthStatus.Error, "Not initialized. First call initialize()", Logger.logError, loggingCategory);

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
    this._tokenResponse = await this._tokenHandler.performTokenRequest(this._configuration, request);
    return this._tokenResponse;
  }

  private async makeAccessTokenRequest(actx: ActivityLoggingContext): Promise<TokenResponse> {
    actx.enter();
    if (!this._configuration)
      throw new BentleyError(AuthStatus.Error, "Not initialized. First call initialize()", Logger.logError, loggingCategory);
    if (!this._tokenResponse)
      throw new BentleyError(AuthStatus.Error, "Missing refresh token. First call signIn() and ensure it's successful", Logger.logError, loggingCategory);

    const tokenRequestJson: TokenRequestJson = {
      grant_type: GRANT_TYPE_REFRESH_TOKEN,
      refresh_token: this._tokenResponse.refreshToken,
      redirect_uri: this._clientConfiguration.redirectUri,
      client_id: this._clientConfiguration.clientId,
    };

    const request = new TokenRequest(tokenRequestJson);
    this._tokenResponse = await this._tokenHandler.performTokenRequest(this._configuration, request);
    actx.enter();

    return this._tokenResponse;
  }

  private async makeRevokeTokenRequest(actx: ActivityLoggingContext): Promise<void> {
    actx.enter();
    if (!this._configuration)
      throw new BentleyError(AuthStatus.Error, "Not initialized. First call initialize()", Logger.logError, loggingCategory);
    if (!this._tokenResponse)
      throw new BentleyError(AuthStatus.Error, "Missing refresh token. First call signIn() and ensure it's successful", Logger.logError, loggingCategory);

    const request = new RevokeTokenRequest({ token: this._tokenResponse.refreshToken! });
    await this._tokenHandler.performRevokeTokenRequest(this._configuration, request);
    actx.enter();

    this._tokenResponse = undefined;
    Logger.logTrace(loggingCategory, "Authorization revoked, and removed access token");
    this.onUserStateChanged.raiseEvent(undefined);
  }
}
