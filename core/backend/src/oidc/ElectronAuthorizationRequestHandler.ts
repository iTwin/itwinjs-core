/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
// Code based on the blog article @ https://authguidance.com

/** @module Authentication */

import { Logger } from "@bentley/bentleyjs-core";
import {
  AuthorizationRequestResponse, AuthorizationError, AuthorizationResponse, AuthorizationRequestHandler, AuthorizationServiceConfiguration, AuthorizationRequest,
  BasicQueryStringUtils, AuthorizationErrorJson, AuthorizationResponseJson,
} from "@openid/appauth";
import { NodeCrypto } from "@openid/appauth/built/node_support";
import * as open from "open";
import { ElectronAuthorizationEvents } from "./ElectronAuthorizationEvents";
import { BackendLoggerCategory } from "../BackendLoggerCategory";

const loggerCategory = BackendLoggerCategory.Authorization;

/**
 * Utility to setup a local web server that listens to authorization responses to the browser and make the necessary redirections
 * @internal
 */
export class ElectronAuthorizationRequestHandler extends AuthorizationRequestHandler {
  private _authorizationPromise: Promise<AuthorizationRequestResponse> | null = null;
  private _authorizationEvents: ElectronAuthorizationEvents;

  /**
   * Constructor
   */
  public constructor(authorizationEvents: ElectronAuthorizationEvents) {
    super(new BasicQueryStringUtils(), new NodeCrypto());
    this._authorizationEvents = authorizationEvents;
  }

  /**
   * Makes an authorization request on the system browser
   */
  public async performAuthorizationRequest(serviceConfiguration: AuthorizationServiceConfiguration, authRequest: AuthorizationRequest): Promise<void> {
    Logger.logTrace(loggerCategory, "Making authorization request", () => ({ serviceConfiguration, authRequest }));

    // Setup a promise to process the authorization response
    this._authorizationPromise = new Promise<AuthorizationRequestResponse>((resolve, _reject) => {

      // Wrap the response from the web browser (with the authorization code)
      this._authorizationEvents.onAuthorizationResponse.addOnce((authErrorJson: AuthorizationErrorJson | null, authResponseJson: AuthorizationResponseJson | null) => {

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

    // Compose the request and invoke in the browser
    const authUrl = this.buildRequestUrl(serviceConfiguration, authRequest);
    await open(authUrl);
  }

  /**
   * Checks if an authorization flow can be completed, and completes it.
   * The handler returns a `Promise<AuthorizationRequestResponse>` if ready, or a `Promise<null>`
   * if not ready.
   */
  protected async completeAuthorizationRequest(): Promise<AuthorizationRequestResponse | null> {
    return this._authorizationPromise;
  }
}
