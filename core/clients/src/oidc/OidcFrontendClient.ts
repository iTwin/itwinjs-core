
/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Authentication
 */

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

  /** Returns a promise that resolves to the AccessToken if signed in. The token is refreshed if it's possible and necessary.
   * Note that some implementations may require this method to be called to refresh the token - not all clients
   * refresh the token by monitoring the expiry.
   */
  getAccessToken(requestContext?: ClientRequestContext): Promise<AccessToken>;

  /** Event called when the user's sign-in state changes
   * @see [[getAccessToken]]
   */
  readonly onUserStateChanged: BeEvent<(token: AccessToken | undefined) => void>;
}

/** IOidcFrontendClient type guard.
 * @beta
 */
export const isIOidcFrontendClient = (client: IAuthorizationClient | undefined): client is IOidcFrontendClient => {
  return client !== undefined && (client as IOidcFrontendClient).signIn !== undefined && (client as IOidcFrontendClient).signOut !== undefined;
};

/**
 * Client configuration to generate OIDC/OAuth tokens for browser applications
 * @beta
 */
export interface OidcFrontendClientConfiguration {
  /** Client application's identifier as registered with the Bentley IMS OIDC/OAuth2 provider. */
  clientId: string;
  /**
   * Upon signing in, the client application receives a response from the Bentley IMS OIDC/OAuth2 provider at this URI
   */
  redirectUri: string;
  /** List of space separated scopes to request access to various resources. */
  scope: string;
  /**
   * Upon  signing out, the client application receives a response from the Bentley IMS OIDC/OAuth2 provider at this URI
   * Not specified/used in the case of mobile/desktop applications
   */
  postSignoutRedirectUri?: string;
  /**
   * The type(s) of response(s) desired from the OIDC/OAuth2 provider.
   * Assumes the server does allow CORS on the metadata endpoint.
   * Pass "id_token token" for use with implicit flow, and "code" for use in
   * authorization code flows.
   * @internal
   */
  responseType?: string;
  /**
   * The URL of the OIDC/OAuth2 provider - if unspecified this defaults to the Bentley provider.
   * @internal
   */
  authority?: string;

  /**
   * The authority URL setting is used to make HTTP requests to discover more information about the
   * OIDC/OAuth2 provider and populate a metadata property on the settings. Need not be specified
   * if accessing the Bentley authorization provider. It's only useful when authorization requests
   * are made to providers that do NOT allow CORS on the metadata endpoint, and allows these end points
   * to be manually configured. The metadata can include issuer, authorization_endpoint, userinfo_endpoint,
   * end_session_endpoint, jwks_uri
   * @internal
   */
  metadata?: any;
  /**
   * The window of time (in seconds) to allow the current time to deviate when validating id_token
   * Defaults to 300 seconds
   * @internal
   */
  clockSkew?: number;
}
