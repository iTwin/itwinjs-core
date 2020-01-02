
/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Authentication */

import { BeEvent, ClientRequestContext, isElectronRenderer, electronRenderer, assert, Logger } from "@bentley/bentleyjs-core";
import { IOidcFrontendClient, AccessToken, UserInfo } from "@bentley/imodeljs-clients";
import { OidcDesktopClientConfiguration, defaultOidcDesktopClientExpiryBuffer } from "@bentley/imodeljs-common";
import { FrontendRequestContext } from "../FrontendRequestContext";
import { FrontendLoggerCategory } from "../FrontendLoggerCategory";

const ipc = isElectronRenderer ? electronRenderer.ipcRenderer : undefined;

const loggerCategory: string = FrontendLoggerCategory.Authorization;

/**
 * Ipc Wrapper around OidcDestkopClient for use in the electron render process
 * @alpha
 */
export class OidcDesktopClientRenderer implements IOidcFrontendClient {
  private _clientConfiguration: OidcDesktopClientConfiguration;
  private _accessToken?: AccessToken;

  /** Event called when the user's sign-in state changes - this may be due to calls to signIn(), signOut() or simply because the token expired */
  public readonly onUserStateChanged = new BeEvent<(token: AccessToken | undefined) => void>();

  /** Creates a new OidcDesktopClient to be used in the electron render process */
  public constructor(clientConfiguration: OidcDesktopClientConfiguration) {
    this._clientConfiguration = clientConfiguration;
    if (!ipc)
      throw new Error("This code should only be run in the electron renderer process");
  }

  /** Create strongly typed access token from untyped object */
  private createAccessToken(accessTokenObj: any): AccessToken | undefined {
    if (!accessTokenObj)
      return undefined;
    const startsAt = accessTokenObj._startsAt === undefined ? undefined : new Date(accessTokenObj._startsAt);
    const expiresAt = accessTokenObj._expiresAt === undefined ? undefined : new Date(accessTokenObj._expiresAt);
    let userInfo: UserInfo | undefined;
    if (accessTokenObj._userInfo !== undefined) {
      userInfo = new UserInfo(accessTokenObj._userInfo.id, accessTokenObj._userInfo.email,
        accessTokenObj._userInfo.profile, accessTokenObj._userInfo.organization, accessTokenObj._userInfo.featureTracking);
    }
    return AccessToken.fromJsonWebTokenString(accessTokenObj._jwt, startsAt, expiresAt, userInfo);
  }

  /** Wrapper around ipc.send to add log traces */
  private ipcSend(message: string, ...args: any[]) {
    Logger.logTrace(loggerCategory, "OidcDesktopClientRenderer sends message", () => ({ message }));
    ipc.send(message, ...args);
  }

  /** Wrapper around ipc.on to add log traces */
  private ipcOn(message: string, fn: any) {
    Logger.logTrace(loggerCategory, "OidcDesktopClientRenderer receives message", () => ({ message }));
    ipc.on(message, fn);
  }

  /** Used to initialize the client - must be awaited before any other methods are called */
  public async initialize(requestContext: ClientRequestContext): Promise<void> {
    requestContext.enter();

    this.ipcOn("OidcDesktopClient.onUserStateChanged", (_event: any, accessTokenObj: AccessToken | undefined, _additionalArgs: any) => {
      const accessToken = this.createAccessToken(accessTokenObj);
      this._accessToken = accessToken;
      this.onUserStateChanged.raiseEvent(accessToken);
    });

    return new Promise<void>((resolve, reject) => {
      this.ipcSend("OidcDesktopClient.initialize", requestContext, this._clientConfiguration);
      this.ipcOn("OidcDesktopClient.initialize:complete", (_event: any, err: Error) => err ? reject(err) : resolve());
    });
  }

  /** Called to start the sign-in process. Subscribe to onUserStateChanged to be notified when sign-in completes */
  public async signIn(requestContext: ClientRequestContext): Promise<void> {
    requestContext.enter();
    return new Promise<void>((resolve, reject) => {
      this.ipcSend("OidcDesktopClient.signIn", requestContext);
      this.ipcOn("OidcDesktopClient.signIn:complete", (_event: any, err: Error) => err ? reject(err) : resolve());
    });
  }

  /** Called to start the sign-out process. Subscribe to onUserStateChanged to be notified when sign-out completes */
  public async signOut(requestContext: ClientRequestContext): Promise<void> {
    requestContext.enter();
    return new Promise<void>((resolve, reject) => {
      this.ipcSend("OidcDesktopClient.signOut", requestContext);
      this.ipcOn("OidcDesktopClient.signOut:complete", (_event: any, err: Error) => err ? reject(err) : resolve());
    });
  }

  /** Set to true if there's a current authorized user or client (in the case of agent applications).
   * Set to true if signed in and the access token has not expired, and false otherwise.
   */
  public get isAuthorized(): boolean {
    if (!this._accessToken)
      return false;

    const expiresAt = this._accessToken.getExpiresAt();
    assert(!!expiresAt, "Invalid token in OidcDesktopClient");
    if (expiresAt!.getTime() - Date.now() > (this._clientConfiguration.expiryBuffer || defaultOidcDesktopClientExpiryBuffer) * 1000)
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
    return !!this._accessToken;
  }

  /** Returns a promise that resolves to the AccessToken if signed in. The token is refreshed if it's possible and necessary. */
  public async getAccessToken(requestContext: ClientRequestContext = new FrontendRequestContext()): Promise<AccessToken> {
    requestContext.enter();

    if (this.isAuthorized)
      return this._accessToken!;

    return new Promise<AccessToken>((resolve, reject) => {
      this.ipcSend("OidcDesktopClient.getAccessToken", requestContext);
      this.ipcOn("OidcDesktopClient.getAccessToken:complete", (_event: any, err: Error, accessTokenObj: AccessToken) => {
        if (err) {
          reject(err);
        } else {
          const accessToken = this.createAccessToken(accessTokenObj);
          this._accessToken = accessToken;
          resolve(accessToken);
        }
      });
    });
  }

  /** Disposes of any resources owned */
  public dispose(): void {
    this.ipcSend("OidcDesktopClient.dispose");
  }
}
