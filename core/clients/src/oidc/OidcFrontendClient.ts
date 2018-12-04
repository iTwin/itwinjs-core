
/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { ActivityLoggingContext, IDisposable, BeEvent } from "@bentley/bentleyjs-core";
import { AccessToken } from "../Token";

/** Interface to implement a typical frontend client */
export interface IOidcFrontendClient extends IDisposable {
  /** Used to initialize the client - must be awaited before any other methods are called */
  initialize(actx: ActivityLoggingContext): Promise<void>;

  /** Called to start the sign-in process. Subscribe to onUserStateChanged to be notified when sign-in completes */
  signIn(actx: ActivityLoggingContext): void;

  /** Called to start the sign-out process. Subscribe to onUserStateChanged to be notified when sign-out completes */
  signOut(actx: ActivityLoggingContext): void;

  /** Returns a promise that resolves to the AccessToken if signed in, and undefined otherwise. The token is refreshed if it's possible and necessary. */
  getAccessToken(actx: ActivityLoggingContext): Promise<AccessToken | undefined>;

  /** Event called when the user's sign-in state changes - this may be due to calls to signIn(), signOut() or simply because the token expired */
  readonly onUserStateChanged: BeEvent<(token: AccessToken | undefined) => void>;
}

/** Client configuration to generate OIDC/OAuth tokens for browser, desktop and mobile applications */
export interface OidcFrontendClientConfiguration {
  /** Client application's identifier as registered with the Bentley IMS OIDC/OAuth2 provider. */
  clientId: string;
  /**
   * Upon signing in, the client application receives a response from the Bentley IMS OIDC/OAuth2 provider at this URI
   * For mobile/desktop applications, must be `http://127.0.0.1:${redirectPort}`
   */
  redirectUri: string;
  /**
   * Upon  signing out, the client application receives a response from the Bentley IMS OIDC/OAuth2 provider at this URI
   * Not specified/used in the case of mobile/desktop applications
   */
  postSignoutRedirectUri?: string;
  /**
   * Optional scope that requests access to various resources. If omitted, a default is setup to access the resources typically required,
   * including the iModelHub
   */
  scope?: string;
}
