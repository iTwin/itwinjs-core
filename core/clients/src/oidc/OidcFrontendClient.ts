
/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { IDisposable, BeEvent, ClientRequestContext } from "@bentley/bentleyjs-core";
import { AccessToken } from "../Token";
import { IAuthorizationClient } from "../AuthorizationClient";

/**
 * Interface to implement a typical frontend client
 * @beta
 */
export interface IOidcFrontendClient extends IDisposable, IAuthorizationClient {
  /** Used to initialize the client - must be awaited before any other methods are called */
  initialize(requestContext: ClientRequestContext): Promise<void>;

  /** Called to start the sign-in process. Subscribe to onUserStateChanged to be notified when sign-in completes */
  signIn(requestContext: ClientRequestContext): Promise<void>;

  /** Called to start the sign-out process. Subscribe to onUserStateChanged to be notified when sign-out completes */
  signOut(requestContext: ClientRequestContext): Promise<void>;

  /** Set to true if there's a current authorized user or client (in the case of agent applications).
   * Set to true if signed in and the access token has not expired, and false otherwise.
   */
  isAuthorized: boolean;

  /** Set to true if the user has signed in, but the token has expired and requires a refresh */
  hasExpired: boolean;

  /** Set to true if signed in - the accessToken may be active or may have expired and require a refresh */
  hasSignedIn: boolean;

  /** Returns a promise that resolves to the AccessToken if signed in. The token is refreshed if it's possible and necessary. */
  getAccessToken(requestContext?: ClientRequestContext): Promise<AccessToken>;

  /** Event called when the user's sign-in state changes - this may be due to calls to signIn(), signOut() or simply because the token expired */
  readonly onUserStateChanged: BeEvent<(token: AccessToken | undefined) => void>;
}

/**
 * Client configuration to generate OIDC/OAuth tokens for browser, desktop and mobile applications
 * @beta
 */
export interface OidcFrontendClientConfiguration {
  /** Client application's identifier as registered with the Bentley IMS OIDC/OAuth2 provider. */
  clientId: string;
  /**
   * Upon signing in, the client application receives a response from the Bentley IMS OIDC/OAuth2 provider at this URI
   * For mobile/desktop applications, must be `http://127.0.0.1:${redirectPort}`
   */
  redirectUri: string;
  /** List of space separated scopes to request access to various resources. */
  scope: string;
  /**
   * Upon  signing out, the client application receives a response from the Bentley IMS OIDC/OAuth2 provider at this URI
   * Not specified/used in the case of mobile/desktop applications
   */
  postSignoutRedirectUri?: string;
}
