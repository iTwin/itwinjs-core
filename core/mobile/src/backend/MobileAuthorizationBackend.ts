/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module OIDC
 */

import { AccessToken, assert, AuthStatus } from "@itwin/core-bentley";
import { AuthorizationClient, IModelError } from "@itwin/core-common";
import { MobileHost } from "./MobileHost";

/**
 * Client configuration to generate OIDC/OAuth tokens for mobile applications
 * @beta
 */
export interface MobileAppAuthorizationConfiguration {
  /**
   * The OAuth token issuer URL. Defaults to Bentley's auth URL if undefined.
   */
  issuerUrl?: string;

  /**
   * Upon signing in, the client application receives a response from the Bentley IMS OIDC/OAuth2 provider at this URI
   * For mobile/desktop applications, must start with `http://localhost:${redirectPort}` or `https://localhost:${redirectPort}`
   */
  readonly redirectUri?: string;

  /** Client application's identifier as registered with the OIDC/OAuth2 provider. */
  readonly clientId: string;

  /** List of space separated scopes to request access to various resources. */
  readonly scope: string;

  /**
   * Time in seconds that's used as a buffer to check the token for validity/expiry.
   * The checks for authorization, and refreshing access tokens all use this buffer - i.e., the token is considered expired if the current time is within the specified
   * time of the actual expiry.
   * @note If unspecified this defaults to 10 minutes.
   */
  readonly expiryBuffer?: number;
}

/** Utility to provide OIDC/OAuth tokens from native ios app to frontend
   * @internal
   */
export class MobileAuthorizationBackend implements AuthorizationClient {
  protected _accessToken?: AccessToken;
  public config?: MobileAppAuthorizationConfiguration;
  public expireSafety = 60 * 10; // refresh token 10 minutes before real expiration time
  public issuerUrl?: string;
  public static defaultRedirectUri = "imodeljs://app/signin-callback";
  public get redirectUri() { return this.config?.redirectUri ?? MobileAuthorizationBackend.defaultRedirectUri; }
  protected _baseUrl = "https://ims.bentley.com";
  protected _url?: string;

  public constructor(config?: MobileAppAuthorizationConfiguration) {
    this.config = config;
  }

  // public getClientRequestContext() { return ClientRequestContext.fromJSON(IModelHost.session); }

  /** Used to initialize the client - must be awaited before any other methods are called */
  public async initialize(config?: MobileAppAuthorizationConfiguration): Promise<void> {
    this.config = config ?? this.config;
    if (!this.config)
      throw new IModelError(AuthStatus.Error, "Must specify a valid configuration when initializing authorization");
    if (this.config.expiryBuffer)
      this.expireSafety = this.config.expiryBuffer;
    this.issuerUrl = this.config.issuerUrl ?? this.getUrl();
    if (!this.issuerUrl)
      throw new IModelError(AuthStatus.Error, "The URL of the authorization provider was not initialized");

    MobileHost.device.authStateChanged = (tokenString?: AccessToken) => {
      this.setAccessToken(tokenString);
    };

    return new Promise<void>((resolve, reject) => {
      assert(this.config !== undefined);
      MobileHost.device.authInit({ ...this.config, issuerUrl: this.issuerUrl }, (err?: string) => {
        if (!err) {
          resolve();
        } else {
          reject(new Error(err));
        }
      });
    });
  }

  /** Start the sign-in process */
  public async signIn(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      MobileHost.device.authSignIn((err?: string) => {
        if (!err) {
          resolve();
        } else {
          reject(new Error(err));
        }
      });
    });
  }

  /** Start the sign-out process */
  public async signOut(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      MobileHost.device.authSignOut((err?: string) => {
        if (!err) {
          resolve();
        } else {
          reject(new Error(err));
        }
      });
    });
  }

  public setAccessToken(token?: AccessToken) {
    if (token === this._accessToken)
      return;
    this._accessToken = token;
  }

  public async getAccessToken(): Promise<AccessToken> {
    if (!this._accessToken)
      this.setAccessToken(await this.refreshToken());
    return this._accessToken ?? "";
  }

  /** return accessToken */
  public async refreshToken(): Promise<AccessToken> {
    return new Promise<AccessToken>((resolve, reject) => {
      MobileHost.device.authGetAccessToken((tokenStringJson?: AccessToken, err?: string) => {
        if (!err && tokenStringJson) {
          resolve(tokenStringJson);
        } else {
          reject(new Error(err));
        }
      });
    });
  }
  /**
   * Gets the URL of the service. Uses the default URL provided by client implementations.
   * If defined, the value of `IMJS_URL_PREFIX` will be used as a prefix to all urls provided
   * by the client implementations.
   *
   * Note that for consistency sake, the URL is stripped of any trailing "/".
   * @returns URL for the service
   */
  private getUrl(): string {
    if (this._url)
      return this._url;

    if (!this._baseUrl) {
      throw new Error("The client is missing a default url.");
    }

    const prefix = process.env.IMJS_URL_PREFIX;
    const authority = new URL(this.config?.issuerUrl ?? this._baseUrl);

    if (prefix && !this.config?.issuerUrl)
      authority.hostname = prefix + authority.hostname;
    this._url = authority.href.replace(/\/$/, "");

    return this._url;
  }
}
