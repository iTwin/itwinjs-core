/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module NativeApp
 */

import { BeEvent, BriefcaseStatus, ClientRequestContext, Logger } from "@bentley/bentleyjs-core";
import { AccessToken, CancelRequest, DownloadFailed, ProgressCallback, UserCancelledError } from "@bentley/itwin-client";

export enum Orientation {
  Unknown = 0,
  Portrait = 0x1,
  PortraitUpsideDown = 0x2,
  LandscapeLeft = 0x4,
  LandscapeRight = 0x8,
  FaceUp = 0x10,
  FaceDown = 0x20,
}

export enum BatteryState {
  Unknown = 0,
  Unplugged = 1,
  Charging = 2,
  Full = 3,
}

export enum DeviceEvents {
  MemoryWarning = "memoryWarning",
  OrientationChanged = "orientationChanged",
  EnterForeground = "enterForeground",
  EnterBackground = "enterBackground",
  WillTerminate = "willTerminate",
}

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
  public emit(eventName: DeviceEvents, ...args: any[]) {
    MobileDevice.currentDevice.emit(eventName, ...args);
  }
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

export class MobileDevice {
  private get _impl(): MobileDeviceRpcImpl {
    const client = (global as any).MobileDeviceRpcImpl as MobileDeviceRpcImpl;
    if (!client) {
      throw new Error("MobileDeviceRpcImpl is not registered.");
    }
    return client;
  }
  private _authInitialized: boolean = false;
  public readonly onMemoryWarning = new BeEvent();
  public readonly onOrientationChanged = new BeEvent();
  public readonly onEnterForeground = new BeEvent();
  public readonly onEnterBackground = new BeEvent();
  public readonly onWillTerminate = new BeEvent();
  public readonly onUserStateChanged = new BeEvent<(accessToken?: string, err?: string) => void>();
  /**
   * Download file
   * @internal
   */
  public async downloadFile(downloadUrl: string, downloadTo: string, progress?: ProgressCallback, cancelRequest?: CancelRequest): Promise<void> {
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

  public static readonly currentDevice = new MobileDevice();
}

export function initialize() {
  if ((global as any).MobileDeviceRpcImpl instanceof MobileDeviceRpcImpl)
    return;
  (global as any).MobileDeviceRpcImpl = new MobileDeviceRpcImpl();
}
