
/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Authentication
 */

import { BeEvent, ClientRequestContext, isElectronRenderer, electronRenderer, assert, Logger } from "@bentley/bentleyjs-core";
import { AccessToken } from "@bentley/itwin-client";
import { FrontendAuthorizationClient } from "@bentley/frontend-authorization-client";
import { DesktopAuthorizationClientConfiguration, defaultDesktopAuthorizationClientExpiryBuffer } from "@bentley/imodeljs-common";
import { FrontendRequestContext } from "../FrontendRequestContext";
import { FrontendLoggerCategory } from "../FrontendLoggerCategory";

const ipc = isElectronRenderer ? electronRenderer.ipcRenderer : undefined;

const loggerCategory: string = FrontendLoggerCategory.Authorization;

/**
 * Ipc Wrapper around OidcDestkopClient for use in the electron render process
 * @alpha
 */
export class DesktopAuthorizationClient implements FrontendAuthorizationClient {
  private _clientConfiguration: DesktopAuthorizationClientConfiguration;
  private _accessToken?: AccessToken;

  /**
   * Event called when the user's sign-in state changes
   * - this may be due to calls to signIn(), signOut(), or if the token was refreshed by a call to [[getAccessToken]].
   * - see [[getAccessToken]]
   */
  public readonly onUserStateChanged = new BeEvent<(token: AccessToken | undefined) => void>();

  /** Creates a new DesktopAuthorizationClient to be used in the electron render process */
  public constructor(clientConfiguration: DesktopAuthorizationClientConfiguration) {
    this._clientConfiguration = clientConfiguration;
    if (!ipc)
      throw new Error("This code should only be run in the electron renderer process");
  }

  /** Create strongly typed access token from untyped object */
  private createAccessToken(accessTokenObj: any): AccessToken | undefined {
    if (!accessTokenObj)
      return undefined;
    return AccessToken.fromJson(accessTokenObj);
  }

  /** Wrapper around ipc.send to add log traces */
  private ipcSend(message: string, ...args: any[]) {
    Logger.logTrace(loggerCategory, "DesktopAuthorizationClient sends message", () => ({ message }));
    ipc.send(message, ...args);
  }

  /** Wrapper around ipc.on to add log traces */
  private ipcOn(message: string, fn: any) {
    Logger.logTrace(loggerCategory, "DesktopAuthorizationClient receives message", () => ({ message }));
    ipc.on(message, fn);
  }

  /** Used to initialize the client - must be awaited before any other methods are called */
  public async initialize(requestContext: ClientRequestContext): Promise<void> {
    requestContext.enter();

    this.ipcOn("DesktopAuthorizationClient.onUserStateChanged", (_event: any, accessTokenObj: AccessToken | undefined, _additionalArgs: any) => {
      const accessToken = this.createAccessToken(accessTokenObj);
      this._accessToken = accessToken;
      this.onUserStateChanged.raiseEvent(accessToken);
    });

    return new Promise<void>((resolve, reject) => {
      this.ipcSend("DesktopAuthorizationClient.initialize", requestContext, this._clientConfiguration);
      this.ipcOn("DesktopAuthorizationClient.initialize:complete", (_event: any, err: Error) => err ? reject(err) : resolve());
    });
  }

  /** Called to start the sign-in process. Subscribe to onUserStateChanged to be notified when sign-in completes */
  public async signIn(requestContext: ClientRequestContext): Promise<void> {
    requestContext.enter();
    return new Promise<void>((resolve, reject) => {
      this.ipcSend("DesktopAuthorizationClient.signIn", requestContext);
      this.ipcOn("DesktopAuthorizationClient.signIn:complete", (_event: any, err: Error) => err ? reject(err) : resolve());
    });
  }

  /** Called to start the sign-out process. Subscribe to onUserStateChanged to be notified when sign-out completes */
  public async signOut(requestContext: ClientRequestContext): Promise<void> {
    requestContext.enter();
    return new Promise<void>((resolve, reject) => {
      this.ipcSend("DesktopAuthorizationClient.signOut", requestContext);
      this.ipcOn("DesktopAuthorizationClient.signOut:complete", (_event: any, err: Error) => err ? reject(err) : resolve());
    });
  }

  /** Set to true if there's a current authorized user or client (in the case of agent applications).
   * Set to true if signed in and the access token has not expired, and false otherwise.
   */
  public get isAuthorized(): boolean {
    if (!this._accessToken)
      return false;

    const expiresAt = this._accessToken.getExpiresAt();
    assert(!!expiresAt, "Invalid token in DesktopAuthorizationClient");
    if (expiresAt!.getTime() - Date.now() > (this._clientConfiguration.expiryBuffer || defaultDesktopAuthorizationClientExpiryBuffer) * 1000)
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

  /** Returns a promise that resolves to the AccessToken if signed in.
   * - The token is ensured to be valid *at least* for the buffer of time specified by the configuration.
   * - The token is refreshed if it's possible and necessary.
   * - This method must be called to refresh the token - the client does NOT automatically monitor for token expiry.
   * - Getting or refreshing the token will trigger the [[onUserStateChanged]] event.
   */
  public async getAccessToken(requestContext: ClientRequestContext = new FrontendRequestContext()): Promise<AccessToken> {
    requestContext.enter();

    if (this.isAuthorized)
      return this._accessToken!;

    return new Promise<AccessToken>((resolve, reject) => {
      this.ipcSend("DesktopAuthorizationClient.getAccessToken", requestContext);
      this.ipcOn("DesktopAuthorizationClient.getAccessToken:complete", (_event: any, err: Error, accessTokenObj: AccessToken) => {
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
}
