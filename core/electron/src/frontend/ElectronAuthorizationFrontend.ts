/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

// TODO: Before the 3.0 release this whole file needs to be removed from the repo.

import { AccessToken, BeEvent } from "@itwin/core-bentley";
import { AuthorizationClient } from "@bentley/itwin-client";

/**
 * Object to be set as `IModelApp.authorizationClient` for the frontend of ElectronApps.
 * Since Electron Apps use the backend for all authorization, this class sends signIn/signOut requests to the backend
 * and then gets the access token from the backend.
 * @public
 */
export class ElectronAppAuthorization implements AuthorizationClient {
  private _cachedToken: AccessToken = "";
  private _refreshingToken = false;
  protected _expireSafety = 60 * 10; // seconds before real expiration time so token will be refreshed before it expires
  public readonly onAccessTokenChanged = new BeEvent<(token: AccessToken) => void>();
  public get hasSignedIn() { return this._cachedToken !== ""; }
  public get isAuthorized(): boolean {
    return this.hasSignedIn;
  }

  /** ctor for NativeAppAuthorization
   * @param config if present, overrides backend supplied configuration. Generally not necessary, should be supplied
   * in [NativeHostOpts]($backend)
   */
  public constructor() {
    this.onAccessTokenChanged.addListener((token: AccessToken) => {
      this._cachedToken = token;
    });
  }

  /** Called to start the sign-in process. Subscribe to onUserStateChanged to be notified when sign-in completes */
  public async signIn(): Promise<void> {
    // Needs to call something setup directly in
    // return NativeApp.callNativeHost("signIn");
  }

  /** Called to start the sign-out process. Subscribe to onUserStateChanged to be notified when sign-out completes */
  public async signOut(): Promise<void> {
    // Needs to be implemented in  call something setup directly using the Electron IPC
    // return NativeApp.callNativeHost("signOut");
  }

  /** Returns a promise that resolves to the AccessToken if signed in.
   * - The token is ensured to be valid *at least* for the buffer of time specified by the configuration.
   * - The token is refreshed if it's possible and necessary.
   * - This method must be called to refresh the token - the client does NOT automatically monitor for token expiry.
   * - Getting or refreshing the token will trigger the [[onUserStateChanged]] event.
   */
  public async getAccessToken(): Promise<AccessToken> {
    // if we have a valid token, return it. Otherwise call backend to refresh the token.
    if (!this.isAuthorized) {
      if (this._refreshingToken) {
        return Promise.reject(); // short-circuits any recursive use of this function
      }

      this._refreshingToken = true;
      // this._cachedToken = (await NativeApp.callNativeHost("getAccessToken"));
      this._refreshingToken = false;
    }

    return this._cachedToken ?? "";
  }
}
