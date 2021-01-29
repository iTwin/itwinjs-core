/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module NativeApp
 */

import { BeEvent, BriefcaseStatus, ClientRequestContext, Logger } from "@bentley/bentleyjs-core";
import { AccessToken, CancelRequest, DownloadFailed, ProgressCallback, UserCancelledError } from "@bentley/itwin-client";
import { BatteryState, Orientation } from "../MobileAppProps";

export type MobileCompletionCallback = (downloadUrl: string, downloadFileUrl: string, cancelled: boolean, err?: string) => void;
export type MobileProgressCallback = (bytesWritten: number, totalBytesWritten: number, totalBytesExpectedToWrite: number) => void;
export type MobileCancelCallback = () => boolean;

export interface MobileDeviceAuthSettings {
  issuerUrl: string;
  clientId: string;
  redirectUrl: string;
  scope: string;
  stateKey?: string;
}

export interface DownloadTask {
  url: string;
  downloadPath: string;
  isDetached: boolean;
  isRunning: boolean;
  totalBytes?: number;
  doneBytes?: number;
  cancelId?: number;
  isBackground?: boolean;
  cancel?: MobileCancelCallback;
  toBackground: () => boolean;
  toForeground: () => boolean;
}

class MobileDeviceRpcImpl {
  public getOrientation?: () => Orientation;
  public getBatteryState?: () => BatteryState;
  public getBatteryLevel?: () => number;
  public createDownloadTask?: (downloadUrl: string, isBackground: boolean, downloadTo: string, completion: MobileCompletionCallback, progress?: MobileProgressCallback) => number;
  public cancelDownloadTask?: (cancelId: number) => boolean;
  public getDownloadTasks?: () => DownloadTask[];
  public resumeDownloadInForeground?: (requestId: number) => boolean;
  public resumeDownloadInBackground?: (requestId: number) => boolean;
  public reconnect?: (connection: number) => void;
  public authSignIn?: (ctx: ClientRequestContext, callback: (err?: string) => void) => void;
  public authSignOut?: (ctx: ClientRequestContext, callback: (err?: string) => void) => void;
  public authGetAccessToken?: (ctx: ClientRequestContext, callback: (accessToken?: string, err?: string) => void) => void;
  public authInit?: (ctx: ClientRequestContext, settings: MobileDeviceAuthSettings, callback: (err?: string) => void) => void;
  public authStateChanged?: (accessToken?: string, err?: string) => void;
}

export class MobileHost {
  private static _authInitialized: boolean = false;
  public static readonly onMemoryWarning = new BeEvent();
  public static readonly onOrientationChanged = new BeEvent();
  public static readonly onEnterForeground = new BeEvent();
  public static readonly onEnterBackground = new BeEvent();
  public static readonly onWillTerminate = new BeEvent();
  public static readonly onUserStateChanged = new BeEvent<(accessToken?: string, err?: string) => void>();
  /**
   * Download file
   * @internal
   */
  public static async downloadFile(downloadUrl: string, downloadTo: string, progress?: ProgressCallback, cancelRequest?: CancelRequest): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (!this._impl.createDownloadTask) {
        throw new Error("Native backend did not registered downloadFile() functions");
      }
      let progressCb: MobileProgressCallback | undefined;
      if (progress) {
        progressCb = (_bytesWritten: number, totalBytesWritten: number, totalBytesExpectedToWrite: number) => {
          const percent = Number((100 * (totalBytesWritten / totalBytesExpectedToWrite)).toFixed(2));
          progress({ total: totalBytesExpectedToWrite, loaded: totalBytesWritten, percent });
        };
      }
      const requestId = this._impl.createDownloadTask(downloadUrl, false, downloadTo, (_downloadUrl: string, _downloadFileUrl: string, cancelled: boolean, err?: string) => {
        if (cancelled)
          reject(new UserCancelledError(BriefcaseStatus.DownloadCancelled, "User cancelled download", Logger.logWarning));
        else if (err)
          reject(new DownloadFailed(400, "Download failed"));
        else
          resolve();
      }, progressCb);
      if (cancelRequest) {
        // eslint-disable-next-line @typescript-eslint/unbound-method
        cancelRequest.cancel = () => { return this._impl.cancelDownloadTask!(requestId); };
      }
    });
  }
  /**
   * Reconnect app
   * @internal
   */
  public reconnect(connection: number) {
    if (!this._impl.reconnect) {
      throw new Error("Native backend did not registered reconnect() functions");
    }
    this._impl.reconnect(connection);
  }

  public emit(eventName: DeviceEvents, ...args: any[]) {
    switch (eventName) {
      case DeviceEvents.MemoryWarning:
        this.onMemoryWarning.raiseEvent(...args); break;
      case DeviceEvents.OrientationChanged:
        this.onOrientationChanged.raiseEvent(...args); break;
      case DeviceEvents.EnterForeground:
        this.onEnterForeground.raiseEvent(...args); break;
      case DeviceEvents.EnterBackground:
        this.onEnterBackground.raiseEvent(...args); break;
      case DeviceEvents.WillTerminate:
        this.onWillTerminate.raiseEvent(...args); break;
    }
  }
  public get hasAuthClient(): boolean {
    return !(!this._impl.authSignIn || !this._impl.authSignOut || !this._impl.authInit || !this._impl.authGetAccessToken);
  }
  public async authInit(ctx: ClientRequestContext, settings: MobileDeviceAuthSettings) {
    if (!this.hasAuthClient) {
      throw new Error("App did not registered any native auth client or implement all required functions");
    }
    if (this._authInitialized) {
      return;
    }
    // Set callback for ios
    this._impl.authStateChanged = (accessToken?: string, err?: string) => {
      if (accessToken) {
        // Patch user info
        const tmp = JSON.parse(accessToken);
        if (typeof tmp._userInfo === undefined) {
          tmp._userInfo = {};
        }
        accessToken = JSON.stringify(tmp);
      }
      this.onUserStateChanged.raiseEvent(accessToken, err);
    };

    return new Promise<void>((resolve, reject) => {
      this._impl.authInit!(ctx, settings, (err?: string) => {
        if (!err) {
          this._authInitialized = true;
          resolve();
        } else {
          this._authInitialized = false;
          reject(new Error(err));
        }
      });
    });
  }
  public async signIn(ctx: ClientRequestContext): Promise<void> {
    // eslint-disable-next-line no-console
    console.log("signIn() ", JSON.stringify(ctx));
    if (!this.hasAuthClient) {
      throw new Error("App did not registered any native auth client or implement all required functions");
    }
    return new Promise<void>((resolve, reject) => {
      this._impl.authSignIn!(ctx, (err?: string) => {
        if (!err) {
          resolve();
        } else {
          reject(new Error(err));
        }
      });
    });
  }

  public async signOut(ctx: ClientRequestContext): Promise<void> {
    if (!this.hasAuthClient) {
      throw new Error("App did not registered any native auth client or implement all required functions");
    }
    return new Promise<void>((resolve, reject) => {
      this._impl.authSignOut!(ctx, (err?: string) => {
        if (!err) {
          resolve();
        } else {
          reject(new Error(err));
        }
      });
    });
  }
  public async getAccessToken(ctx: ClientRequestContext): Promise<AccessToken> {
    if (!this.hasAuthClient) {
      throw new Error("App did not registered any native auth client or implement all required functions");
    }
    return new Promise<AccessToken>((resolve, reject) => {
      this._impl.authGetAccessToken!(ctx, (accessToken?: string, err?: string) => {
        if (!err) {
          resolve(AccessToken.fromJson(accessToken));
        } else {
          reject(new Error(err));
        }
      });
    });
  }
  public async authSignIn(): Promise<void> {
    const requestContext = ClientRequestContext.current;
    return MobileDevice.currentDevice.signIn(requestContext);
  }

  public async authSignOut(): Promise<void> {
    const requestContext = ClientRequestContext.current;
    return MobileDevice.currentDevice.signOut(requestContext);
  }

  public async authGetAccessToken(): Promise<string> {
    const requestContext = ClientRequestContext.current;
    const accessToken = await MobileDevice.currentDevice.getAccessToken(requestContext);
    return JSON.stringify(accessToken);
  }

  public async authInitialize(issuer: string, config: MobileAuthorizationClientConfiguration): Promise<void> {
    const requestContext = ClientRequestContext.current;
    await MobileDevice.currentDevice.authInit(requestContext, {
      issuerUrl: issuer,
      clientId: config.clientId,
      redirectUrl: config.redirectUri,
      scope: config.scope,
    });
  }

  private static _isValid: boolean = false;
  public static get isValid() { return this._isValid; }

  /**
   * Start the backend of a native app.
   * @param configuration
   * @note this method calls [[IModelHost.startup]] internally.
   */
  public static async startup(opt?: { ipcHost?: IpcHostOptions, iModelHost?: IModelHostConfiguration }): Promise<void> {
    if (!this.isValid) {
      this._isValid = true;
      MobileDevice.currentDevice.onUserStateChanged.addListener((accessToken?: string, err?: string) => {
        const accessTokenObj = accessToken ? JSON.parse(accessToken) : {};
        NativeHost.notifyNativeFrontend("notifyUserStateChanged", { accessToken: accessTokenObj, err });
      });
    }
    await NativeHost.startup(opt);
  }
}
