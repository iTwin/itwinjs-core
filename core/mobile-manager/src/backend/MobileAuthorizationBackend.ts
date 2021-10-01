/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module OIDC
 */

import { AccessToken, assert } from "@itwin/core-bentley";
import { NativeAppAuthorizationBackend } from "@itwin/core-backend";
import { NativeAppAuthorizationConfiguration } from "@itwin/core-common";
import { MobileHost } from "./MobileHost";

/** Utility to provide OIDC/OAuth tokens from native ios app to frontend
 * @internal
 */
export class MobileAuthorizationBackend extends NativeAppAuthorizationBackend {
  public static defaultRedirectUri = "imodeljs://app/signin-callback";
  public get redirectUri() { return this.config?.redirectUri ?? MobileAuthorizationBackend.defaultRedirectUri; }

  public constructor(config?: NativeAppAuthorizationConfiguration) {
    super(config);
  }

  /** Used to initialize the client - must be awaited before any other methods are called */
  public override async initialize(config?: NativeAppAuthorizationConfiguration): Promise<void> {
    await super.initialize(config);
    assert(this.config !== undefined && this.issuerUrl !== undefined, "URL of authorization provider was not initialized");

    MobileHost.device.authStateChanged = (tokenString?: AccessToken) => {
      this.setAccessToken(tokenString ?? "");
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

  /** return accessToken */
  public async refreshToken(): Promise<AccessToken> {
    return new Promise<AccessToken>((resolve) => {
      MobileHost.device.authGetAccessToken((tokenStringJson?: AccessToken) => {
        resolve(tokenStringJson ?? "");
      });
    });
  }
}
