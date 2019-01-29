/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { IOidcFrontendClient, AccessToken, OidcClient, UserInfo } from "@bentley/imodeljs-clients";
import { BeEvent } from "@bentley/bentleyjs-core";

/** Utility to provide OIDC/OAuth tokens from native ios app to frontend */
export class OidcIOSClient extends OidcClient implements IOidcFrontendClient {
  private _accessToken: AccessToken | undefined;
  public constructor() {
    super();
  }

  /** Initialize client by hooking to notifOidcClient handler called by native side */
  public async initialize(): Promise<void> {
    return new Promise<void>((resolve) => {
      (window as any).notifyOidcClient = () => {
        this.realodInfo();
        this.onUserStateChanged.raiseEvent(this._accessToken);
      };
      resolve();
    });
  }

  /** Load oidc info that is set by native side and set access_token */
  private realodInfo() {
    const settings = window.localStorage.getItem("ios:oidc_info");
    const info = JSON.parse(settings!);
    const startsAt: Date = new Date(info!.expires_at - info!.expires_in);
    const expiresAt: Date = new Date(info!.expires_at);
    const userInfo = UserInfo.fromJson(info.user_info);
    this._accessToken = AccessToken.fromJsonWebTokenString(info.access_token, startsAt, expiresAt, userInfo);
  }

  /** Should be call to begin signIn process from native side */
  public signIn(): void {
    (window as any).webkit.messageHandlers.signIn.postMessage("");
  }

  /** Should be call to begin signOut process from native side */
  public signOut(): void {
    (window as any).webkit.messageHandlers.signOut.postMessage("");
  }

  /** return accessToken */
  public async getAccessToken(): Promise<AccessToken | undefined> {
    return new Promise<AccessToken | undefined>((resolve) => {
      resolve(this._accessToken);
    });
  }

  public dispose(): void {
  }

  public readonly onUserStateChanged = new BeEvent<(token: AccessToken | undefined) => void>();
}
