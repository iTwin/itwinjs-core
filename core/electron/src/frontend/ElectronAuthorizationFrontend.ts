/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { AccessToken, BeEvent } from "@itwin/core-bentley";
import { AuthorizationClient } from "@itwin/core-common";
import { ITwinElectronApi } from "../backend/ElectronPreload";

export const electronIPCChannelName = "itwin.electron.auth";

/**
 * Frontend Ipc support for Electron apps.
 */
class ElectronAuthIPC  {
  private _api: ITwinElectronApi;
  public async signIn(): Promise<void> {
    await this._api.invoke(`${electronIPCChannelName}.signIn`);
  }
  public async signOut(): Promise<void> {
    await this._api.invoke(`${electronIPCChannelName}.signOut`);
  }
  public async getAccessToken(): Promise<AccessToken> {
    const token = await this._api.invoke(`${electronIPCChannelName}.getAccessToken`);
    return token;
  }
  public addAccessTokenChangeListener(callback: (event: any, token: string) => void) {
    this._api.addListener(`${electronIPCChannelName}.onAccessTokenChanged`, callback);
  }
  constructor() {
    // use the methods on window.itwinjs exposed by ElectronPreload.ts, or ipcRenderer directly if running with nodeIntegration=true (**only** for tests).
    // Note that `require("electron")` doesn't work with nodeIntegration=false - that's what it stops
    this._api = (window as any).itwinjs ?? require("electron").ipcRenderer; // eslint-disable-line @typescript-eslint/no-var-requires
  }
}

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
  private _ipcAuthAPI: ElectronAuthIPC = new ElectronAuthIPC();

  // TODO: Need some way of keeping the expiration time - or is this done with the listener? - but means backend would need a timer

  /** ctor for NativeAppAuthorization
   * @param config if present, overrides backend supplied configuration. Generally not necessary, should be supplied
   * in [NativeHostOpts]($backend)
   */
  public constructor() {
    this.onAccessTokenChanged.addListener((token: AccessToken) => {
      this._cachedToken = token;
    });
    this._ipcAuthAPI.addAccessTokenChangeListener((_event: any, token: AccessToken) => {
      this.onAccessTokenChanged.raiseEvent(token);
    });
  }

  /** Called to start the sign-in process. Subscribe to onUserStateChanged to be notified when sign-in completes */
  public async signIn(): Promise<void> {
    await this._ipcAuthAPI.signIn();
  }

  /** Called to start the sign-out process. Subscribe to onUserStateChanged to be notified when sign-out completes */
  public async signOut(): Promise<void> {
    await this._ipcAuthAPI.signOut();
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
      this._cachedToken = (await this._ipcAuthAPI.getAccessToken()) ?? "";
      this._refreshingToken = false;
    }

    return this._cachedToken ?? "";
  }
}
