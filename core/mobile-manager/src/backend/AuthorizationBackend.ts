/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module OIDC
 */

import { assert, ClientRequestContext } from "@bentley/bentleyjs-core";
import { BackendRequestContext, NativeAuthorizationBackend, NativeHost } from "@bentley/imodeljs-backend";
import { NativeAuthorizationConfiguration } from "@bentley/imodeljs-common";
import { AccessToken, AccessTokenProps } from "@bentley/itwin-client";
import { MobileHost } from "./MobileHost";

/** Utility to provide OIDC/OAuth tokens from native ios app to frontend
 * @alpha
 */
export class MobileAuthorizationBackend extends NativeAuthorizationBackend {
  private _accessToken?: AccessToken;
  private _clientConfiguration?: NativeAuthorizationConfiguration;
  public get clientConfiguration() { return this._clientConfiguration!; }
  /** Used to initialize the client - must be awaited before any other methods are called */
  public async initialize(requestContext: ClientRequestContext, config: NativeAuthorizationConfiguration): Promise<void> {
    requestContext.enter();
    this._clientConfiguration = config;
    this._clientConfiguration.issuerUrl = await this.getUrl(requestContext);

    MobileHost.device.authStateChanged = (tokenString?: string) => {
      let token: AccessToken | undefined;
      if (tokenString) {
        const tokenJson = JSON.parse(tokenString) as AccessTokenProps;
        // Patch user info
        if (typeof tokenJson._userInfo === undefined)
          tokenJson._userInfo = { id: "" };
        token = AccessToken.fromJson(tokenJson);
      }
      NativeHost.onUserStateChanged.raiseEvent(token);
    };

    return new Promise<void>((resolve, reject) => {
      MobileHost.device.authInit(requestContext, config, (err?: string) => {
        if (!err) {
          resolve();
        } else {
          reject(new Error(err));
        }
      });
    });
  }

  /** Start the sign-in process */
  public async signIn(requestContext: ClientRequestContext): Promise<void> {
    requestContext.enter();
    return new Promise<void>((resolve, reject) => {
      MobileHost.device.authSignIn(requestContext, (err?: string) => {
        if (!err) {
          resolve();
        } else {
          reject(new Error(err));
        }
      });
    });
  }

  /** Start the sign-out process */
  public async signOut(requestContext: ClientRequestContext): Promise<void> {
    requestContext.enter();
    return new Promise<void>((resolve, reject) => {
      MobileHost.device.authSignOut(requestContext, (err?: string) => {
        if (!err) {
          resolve();
        } else {
          reject(new Error(err));
        }
      });
    });
  }

  /** return accessToken */
  public async getAccessToken(requestContext: ClientRequestContext = new BackendRequestContext()): Promise<AccessToken> {
    requestContext.enter();
    if (this.isAuthorized) {
      return this._accessToken!;
    }
    return new Promise<AccessToken>((resolve, reject) => {
      MobileHost.device.authGetAccessToken(requestContext, (tokenString?: string, err?: string) => {
        if (!err && tokenString) {
          this._accessToken = AccessToken.fromJson(JSON.parse(tokenString) as AccessTokenProps);
          resolve(this._accessToken);
        } else {
          reject(new Error(err));
        }
      });
    });
  }

  /** Set to true if there's a current authorized user or client (in the case of agent applications).
   * Set to true if signed in and the access token has not expired, and false otherwise.
   */
  public get isAuthorized(): boolean {
    if (!this._accessToken)
      return false;

    const expiresAt = this._accessToken.getExpiresAt();
    assert(!!expiresAt, "Invalid token in MobileAuthorizationClient");
    if (expiresAt.getTime() - Date.now() > (this.clientConfiguration.expiryBuffer || 60 * 10) * 1000)
      return true;

    return false;
  }

  /** Set to true if the user has signed in, but the token has expired and requires a refresh */
  public get hasExpired(): boolean {
    if (!this._accessToken)
      return false;

    return !this.isAuthorized;
  }

  /** Set to true if signed in - the accessToken may be active or may have expired and require a refresh */
  public get hasSignedIn(): boolean {
    return !!this._accessToken; // Always silently refreshed
  }
}
