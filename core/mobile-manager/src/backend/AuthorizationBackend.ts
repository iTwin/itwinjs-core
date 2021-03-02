/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module OIDC
 */

import { assert, ClientRequestContext, ClientRequestContextProps, Guid } from "@bentley/bentleyjs-core";
import { AuthorizationBackend, NativeHost } from "@bentley/imodeljs-backend";
import { AuthorizationConfiguration } from "@bentley/imodeljs-common";
import { AccessToken, AccessTokenProps, UserInfo } from "@bentley/itwin-client";
import { MobileHost } from "./MobileHost";

/** Utility to provide OIDC/OAuth tokens from native ios app to frontend
 * @alpha
 */
export class MobileAuthorizationBackend extends AuthorizationBackend {
  private getRequestContext() { return ClientRequestContext.fromJSON(this.session); }
  /** Used to initialize the client - must be awaited before any other methods are called */
  public async initialize(props: ClientRequestContextProps, config: AuthorizationConfiguration): Promise<void> {
    await super.initialize(props, config);
    const requestContext = ClientRequestContext.fromJSON(props);
    if (!this.config.issuerUrl) {
      this.config.issuerUrl = await this.getUrl(requestContext);
    }
    MobileHost.device.authStateChanged = (tokenString?: string) => {
      let token: AccessToken | undefined;
      if (tokenString) {
        const tokenJson = JSON.parse(tokenString) as AccessTokenProps;
        // Patch user info
        if (typeof tokenJson.userInfo === "undefined")
          tokenJson.userInfo = { id: "" };
        else
          tokenJson.userInfo = UserInfo.fromTokenResponseJson(tokenJson.userInfo);

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
  public async signIn(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      MobileHost.device.authSignIn(this.getRequestContext(), (err?: string) => {
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
      MobileHost.device.authSignOut(this.getRequestContext(), (err?: string) => {
        if (!err) {
          resolve();
        } else {
          reject(new Error(err));
        }
      });
    });
  }

  /** return accessToken */
  public async getAccessToken(): Promise<AccessToken> {
    if (this.isAuthorized) {
      return this._accessToken!;
    }
    return new Promise<AccessToken>((resolve, reject) => {
      MobileHost.device.authGetAccessToken(this.getRequestContext(), (tokenString?: string, err?: string) => {
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
    if (expiresAt.getTime() - Date.now() > (this.clientConfiguration!.expiryBuffer || 60 * 10) * 1000)
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
