/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Authentication */

/**
 * Client configuration to generate OIDC/OAuth tokens for desktop applications
 * @alpha
 */
export interface OidcDesktopClientConfiguration {
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
   * After sucessfully signing in with desktop applications, the browser is redirected to this URI.
   * Typically includes a message to close the browser window, and use the desktop application.
   */
  postSigninSuccessUri?: string;

  /**
   * If there's an error signing in with desktop applications, the browser is redirected to this URI.
   */
  postSigninErrorUri?: string;

  /**
   * Time in seconds that's used as a buffer to check the token for validity/expiry.
   * The checks for authorization, and refreshing access tokens all use this buffer - i.e., the token is considered expired if the current time is within the specified
   * time of the actual expiry.
   * @note If unspecified this defaults to 10 minutes. Also @see defaultOidcDesktopClientExpiryBuffer
   */
  expiryBuffer?: number;
}

/** Default expiry buffer if the expiry buffer is unspecified in [[OidcDesktopClientConfiguration]]
 * @see [[OidcDesktopClientConfiguration]] for expiryBuffer
 * @alpha
 */
export const defaultOidcDesktopClientExpiryBuffer: number = 10 * 60 * 1;  // 10 mins in seconds
