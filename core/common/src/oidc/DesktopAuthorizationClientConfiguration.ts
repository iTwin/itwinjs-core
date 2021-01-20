/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Authentication
 */

/**
 * Client configuration to generate OIDC/OAuth tokens for desktop applications
 * @alpha
 */
export interface DesktopAuthorizationClientConfiguration {
  /** Client application's identifier as registered with the Bentley IMS OIDC/OAuth2 provider. */
  clientId: string;

  /**
   * Upon signing in, the client application receives a response from the Bentley IMS OIDC/OAuth2 provider at this URI
   * For mobile/desktop applications, must be `http://localhost:${redirectPort}` or `https://localhost:${redirectPort}`
   */
  redirectUri: string;

  /** List of space separated scopes to request access to various resources. */
  scope: string;

  /**
   * Time in seconds that's used as a buffer to check the token for validity/expiry.
   * The checks for authorization, and refreshing access tokens all use this buffer - i.e., the token is considered expired if the current time is within the specified
   * time of the actual expiry.
   * @note If unspecified this defaults to 10 minutes. Also @see defaultDesktopAuthorizationClientExpiryBuffer
   */
  expiryBuffer?: number;
}

/** Default expiry buffer if the expiry buffer is unspecified in [[DesktopAuthorizationClientConfiguration]]
 * @see [[DesktopAuthorizationClientConfiguration]] for expiryBuffer
 * @alpha
 */
export const defaultDesktopAuthorizationClientExpiryBuffer: number = 10 * 60 * 1;  // 10 mins in seconds

/**
 * IPC messages passed for authorization
 * @internal
 */
export class DesktopAuthorizationClientMessages {
  private static readonly prefix = "desktopAuth.";
  private static readonly completeSuffix = ":complete";

  public static readonly signIn = `${DesktopAuthorizationClientMessages.prefix}signIn`;
  public static readonly signInComplete = `${DesktopAuthorizationClientMessages.signIn}${DesktopAuthorizationClientMessages.completeSuffix}`;

  public static readonly initialize = `${DesktopAuthorizationClientMessages.prefix}initialize`;
  public static readonly initializeComplete = `${DesktopAuthorizationClientMessages.initialize}${DesktopAuthorizationClientMessages.completeSuffix}`;

  public static readonly signOut = `${DesktopAuthorizationClientMessages.prefix}signOut`;
  public static readonly signOutComplete = `${DesktopAuthorizationClientMessages.signOut}${DesktopAuthorizationClientMessages.completeSuffix}`;

  public static readonly getAccessToken = `${DesktopAuthorizationClientMessages.prefix}getAccessToken`;
  public static readonly getAccessTokenComplete = `${DesktopAuthorizationClientMessages.getAccessToken}${DesktopAuthorizationClientMessages.completeSuffix}`;

  public static readonly onUserStateChanged = `${DesktopAuthorizationClientMessages.prefix}onUserStateChanged`;
  public static readonly onUserStateChangedComplete = `${DesktopAuthorizationClientMessages.onUserStateChanged}${DesktopAuthorizationClientMessages.completeSuffix}`;
}
