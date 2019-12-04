/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Authentication */

import { electronRenderer, Logger } from "@bentley/bentleyjs-core";
import { OidcFrontendClientConfiguration } from "@bentley/imodeljs-clients";
import {
  AuthorizationRequestResponse, AuthorizationError, AuthorizationResponse, AuthorizationRequestHandler, AuthorizationServiceConfiguration, AuthorizationRequest,
  BasicQueryStringUtils, DefaultCrypto, AuthorizationErrorJson, AuthorizationResponseJson,
} from "@openid/appauth";
import * as Http from "http";
import * as Url from "url";
import { ElectronAuthorizationEvents } from "./ElectronAuthorizationEvents";
import { ClientsBackendLoggerCategory } from "../ClientsBackendLoggerCategory";

const loggerCategory = ClientsBackendLoggerCategory.OidcDesktopClient;

/**
 * Utility to setup a local web server that listens to authorization responses to the browser and make the necessary redirections
 * @internal
 */
export class ElectronAuthorizationRequestHandler extends AuthorizationRequestHandler {
  private _clientConfiguration: OidcFrontendClientConfiguration;
  private _httpServer?: Http.Server;
  private _authorizationPromise: Promise<AuthorizationRequestResponse> | null;

  /**
   * Constructor
   * @param clientConfiguration
   */
  public constructor(clientConfiguration: OidcFrontendClientConfiguration) {
    super(new BasicQueryStringUtils(), new DefaultCrypto());
    this._clientConfiguration = clientConfiguration;
  }

  /**
   * Makes an authorization request on the system browser
   */
  public async performAuthorizationRequest(serviceConfiguration: AuthorizationServiceConfiguration, authRequest: AuthorizationRequest): Promise<void> {
    Logger.logTrace(loggerCategory, "Making authorization request", () => ({ serviceConfiguration, authRequest }));

    // Start a web server to listen to the browser requests
    this.startWebServer();

    // Setup a promise to process the authorization response
    this._authorizationPromise = new Promise<AuthorizationRequestResponse>((resolve, _reject) => {
      // Wrap the response from the web browser (with the authorization code)
      ElectronAuthorizationEvents.onAuthorizationResponse.addOnce((authErrorJson: AuthorizationErrorJson | null, authResponseJson: AuthorizationResponseJson | null) => {

        // Resolve the full response including the request
        const authRequestResponse: AuthorizationRequestResponse = {
          request: authRequest,
          error: authErrorJson ? new AuthorizationError(authErrorJson) : null,
          response: authResponseJson ? new AuthorizationResponse(authResponseJson) : null,
        };
        resolve(authRequestResponse);

        // Ask the base class to call our completeAuthorizationRequest - this calls the registered notifier to broadcast the event outside of the client
        this.completeAuthorizationRequestIfPossible(); // tslint:disable-line:no-floating-promises
      });
    });

    await authRequest.setupCodeVerifier();

    // Compose the request and invoke in the browser
    const authUrl = this.buildRequestUrl(serviceConfiguration, authRequest);
    electronRenderer.shell.openItem(authUrl);
  }

  /**
   * Checks if an authorization flow can be completed, and completes it.
   * The handler returns a `Promise<AuthorizationRequestResponse>` if ready, or a `Promise<null>`
   * if not ready.
   */
  protected async completeAuthorizationRequest(): Promise<AuthorizationRequestResponse | null> {
    return this._authorizationPromise;
  }

  /** Listen/Handle browser events */
  private onBrowserRequest(httpRequest: Http.IncomingMessage, httpResponse: Http.ServerResponse): void {
    if (!httpRequest.url)
      return;

    // Parse the request URL to determine the authorization code, state and errors if any
    const urlParts: Url.UrlWithStringQuery = Url.parse(httpRequest.url);
    const searchParams = new Url.URLSearchParams(urlParts.query || "");

    const state = searchParams.get("state") || undefined;
    const code = searchParams.get("code");
    const error = searchParams.get("error");
    if (!state && !code && !error) {
      // ignore irrelevant requests (e.g. favicon.ico)
      return;
    }

    // Notify listeners of the code response or error
    let authorizationResponse: AuthorizationResponseJson | null = null;
    let authorizationError: AuthorizationErrorJson | null = null;
    if (error) {
      const errorUri = searchParams.get("error_uri") || undefined;
      const errorDescription = searchParams.get("error_description") || undefined;
      authorizationError = { error, error_description: errorDescription, error_uri: errorUri, state };
    } else {
      authorizationResponse = { code: code!, state: state! };
    }
    ElectronAuthorizationEvents.onAuthorizationResponse.raiseEvent(authorizationError, authorizationResponse);

    // Handle the authorization completed event
    ElectronAuthorizationEvents.onAuthorizationResponseCompleted.addOnce((authCompletedError?: AuthorizationErrorJson) => {

      // Redirect to success or error page/message
      const signinCompletePage = authCompletedError ? this._clientConfiguration.postSigninErrorUri : this._clientConfiguration.postSigninSuccessUri;
      if (signinCompletePage) {
        httpResponse.writeHead(301, { Location: signinCompletePage });
        httpResponse.end();
      } else {
        const redirectMessage = authCompletedError ? "Error signing in. Close browser and retry from application" : "Successfully signed in. Close browser and use application";
        httpResponse.end(redirectMessage);
      }

      // Stop the web server now that the signin attempt has finished
      this.stopWebServer();
    });
  }

  /** Start a web server to listen to the browser requests */
  private startWebServer() {
    if (this._httpServer)
      return;
    this._httpServer = Http.createServer(this.onBrowserRequest.bind(this));
    const urlParts: Url.UrlWithStringQuery = Url.parse(this._clientConfiguration.redirectUri);
    this._httpServer.listen(urlParts.port);
  }

  /** Stop the web server after the authorization was completed */
  private stopWebServer() {
    if (!this._httpServer)
      return;
    this._httpServer.close();
    this._httpServer = undefined;
  }
}
