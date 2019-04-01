/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module OIDC */

import { AuthStatus, BeEvent, BentleyError, ClientRequestContext, Logger } from "@bentley/bentleyjs-core";
import { AccessToken, IOidcFrontendClient, OidcClient, UserInfo } from "@bentley/imodeljs-clients";
import { LoggerCategory } from "../LoggerCategory";

const loggerCategory: string = LoggerCategory.OidcIOSClient;

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
  private startSignIn(_requestContext: ClientRequestContext): void {
    (window as any).webkit.messageHandlers.signIn.postMessage("");
  }

  /** Start the sign-in and return a promise that fulfils or rejects when it's complete
   */
  public async signIn(requestContext: ClientRequestContext): Promise<AccessToken> {
    return new Promise((resolve, reject) => {
      try {
        this.startSignIn(requestContext);
      } catch (error) {
        reject(error);
      }

      this.onUserStateChanged.addListener((token: AccessToken | undefined, message: string) => {
        if (token)
          resolve(token);
        else
          reject(message);
      });
    });
  }

  /** Should be call to begin signOut process from native side */
  private startSignOut(_requestContext: ClientRequestContext): void {
    (window as any).webkit.messageHandlers.signOut.postMessage("");
  }

  /** Start the sign-out and return a promise that fulfils or rejects when it's complete
   */
  public async signOut(requestContext: ClientRequestContext): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.startSignOut(requestContext);
      } catch (error) {
        reject(error);
      }

      this.onUserStateChanged.addListener((token: AccessToken | undefined, _message: string) => {
        if (!token)
          resolve();
        else
          reject("Unable to signout");
      });
    });
  }
  /** return accessToken */
  public async getAccessToken(requestContext?: ClientRequestContext): Promise<AccessToken> {
    if (this._accessToken)
      return this._accessToken;
    if (requestContext)
      requestContext.enter();
    throw new BentleyError(AuthStatus.Error, "Not authorized.", Logger.logError, loggerCategory);
  }

  /** Set to true if there's a current authorized user or client (in the case of agent applications).
   * Set to true if signed in and the access token has not expired, and false otherwise.
   */
  public get isAuthorized(): boolean {
    return !!this._accessToken;
  }

  /** Set to true if the user has signed in, but the token has expired and requires a refresh */
  public get hasExpired(): boolean {
    return !!this._accessToken; // Always silently refreshed
  }

  /** Set to true if signed in - the accessToken may be active or may have expired and require a refresh */
  public get hasSignedIn(): boolean {
    return !!this._accessToken; // Always silently refreshed
  }

  public dispose(): void {
  }

  public readonly onUserStateChanged = new BeEvent<(token: AccessToken | undefined, message: string) => void>();
}
