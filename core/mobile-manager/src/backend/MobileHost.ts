/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { BeEvent, BriefcaseStatus, ClientRequestContext, Logger } from "@bentley/bentleyjs-core";
import { IModelHostConfiguration, IpcHandler, IpcHost, IpcHostOptions, NativeHost } from "@bentley/imodeljs-backend";
import { AccessToken, CancelRequest, DownloadFailed, ProgressCallback, UserCancelledError } from "@bentley/itwin-client";
import { BatteryState, DeviceEvents, mobileAppChannel, MobileAppFunctions, Orientation } from "../common/MobileAppProps";
import { MobileAuthorizationClientConfiguration } from "../common/MobileAuthorizationClientConfiguration";
import { setupMobileRpc } from "./MobileRpcServer";

/** @beta */
export type MobileCompletionCallback = (downloadUrl: string, downloadFileUrl: string, cancelled: boolean, err?: string) => void;
/** @beta */
export type MobileProgressCallback = (bytesWritten: number, totalBytesWritten: number, totalBytesExpectedToWrite: number) => void;
/** @beta */
export type MobileCancelCallback = () => boolean;

/** @beta */
export interface MobileDeviceAuthSettings {
  issuerUrl: string;
  clientId: string;
  redirectUrl: string;
  scope: string;
  stateKey?: string;
}

/**
 * @beta
 */
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

/**
 * @beta
 */
export abstract class MobileDevice {
  public emit(eventName: DeviceEvents, ...args: any[]) {
    switch (eventName) {
      case "memoryWarning":
        MobileHost.onMemoryWarning.raiseEvent(...args); break;
      case "orientationChanged":
        MobileHost.onOrientationChanged.raiseEvent(...args); break;
      case "enterForeground":
        MobileHost.onEnterForeground.raiseEvent(...args); break;
      case "enterBackground":
        MobileHost.onEnterBackground.raiseEvent(...args); break;
      case "willTerminate":
        MobileHost.onWillTerminate.raiseEvent(...args); break;
    }
  }

  public abstract getOrientation(): Orientation;
  public abstract getBatteryState(): BatteryState;
  public abstract getBatteryLevel(): number;
  public abstract createDownloadTask(downloadUrl: string, isBackground: boolean, downloadTo: string, completion: MobileCompletionCallback, progress?: MobileProgressCallback): number;
  public abstract cancelDownloadTask(cancelId: number): boolean;
  public abstract getDownloadTasks(): DownloadTask[];
  public abstract resumeDownloadInForeground(requestId: number): boolean;
  public abstract resumeDownloadInBackground(requestId: number): boolean;
  public abstract reconnect(connection: number): void;
  public abstract authSignIn(ctx: ClientRequestContext, callback: (err?: string) => void): void;
  public abstract authSignOut(ctx: ClientRequestContext, callback: (err?: string) => void): void;
  public abstract authGetAccessToken(ctx: ClientRequestContext, callback: (accessToken?: string, err?: string) => void): void;
  public abstract authInit(ctx: ClientRequestContext, settings: MobileDeviceAuthSettings, callback: (err?: string) => void): void;
  public abstract authStateChanged(accessToken?: string, err?: string): void;
}

class MobileAppHandler extends IpcHandler implements MobileAppFunctions {
  public get channelName() { return mobileAppChannel; }
  public async reconnect(connection: number) {
    MobileHost.reconnect(connection);
  }
  public async authSignIn(): Promise<void> {
    const requestContext = ClientRequestContext.current;
    return MobileHost.signIn(requestContext);
  }

  public async authSignOut(): Promise<void> {
    const requestContext = ClientRequestContext.current;
    return MobileHost.signOut(requestContext);
  }

  public async authGetAccessToken(): Promise<string> {
    const requestContext = ClientRequestContext.current;
    const accessToken = await MobileHost.getAccessToken(requestContext);
    return JSON.stringify(accessToken);
  }

  public async authInitialize(issuer: string, config: MobileAuthorizationClientConfiguration): Promise<void> {
    const requestContext = ClientRequestContext.current;
    await MobileHost.authInit(requestContext, {
      issuerUrl: issuer,
      clientId: config.clientId,
      redirectUrl: config.redirectUri,
      scope: config.scope,
    });
  }
}

/**
 * @beta
 */
export class MobileHost {
  private static _device?: MobileDevice;
  public static get device() { return this._device!; }
  private static _authInitialized: boolean = false;
  public static readonly onMemoryWarning = new BeEvent();
  public static readonly onOrientationChanged = new BeEvent();
  public static readonly onEnterForeground = new BeEvent();
  public static readonly onEnterBackground = new BeEvent();
  public static readonly onWillTerminate = new BeEvent();
  public static readonly onUserStateChanged = new BeEvent<(accessToken?: string, err?: string) => void>();

  /**  @internal */
  public static reconnect(connection: number) {
    this.device.reconnect(connection);
  }

  /**  @internal */
  public static async downloadFile(downloadUrl: string, downloadTo: string, progress?: ProgressCallback, cancelRequest?: CancelRequest): Promise<void> {
    return new Promise<void>((resolve, reject) => {

      let progressCb: MobileProgressCallback | undefined;
      if (progress) {
        progressCb = (_bytesWritten: number, totalBytesWritten: number, totalBytesExpectedToWrite: number) => {
          const percent = Number((100 * (totalBytesWritten / totalBytesExpectedToWrite)).toFixed(2));
          progress({ total: totalBytesExpectedToWrite, loaded: totalBytesWritten, percent });
        };
      }
      const requestId = this.device.createDownloadTask(downloadUrl, false, downloadTo, (_downloadUrl: string, _downloadFileUrl: string, cancelled: boolean, err?: string) => {
        if (cancelled)
          reject(new UserCancelledError(BriefcaseStatus.DownloadCancelled, "User cancelled download", Logger.logWarning));
        else if (err)
          reject(new DownloadFailed(400, "Download failed"));
        else
          resolve();
      }, progressCb);
      if (cancelRequest) {
        // eslint-disable-next-line @typescript-eslint/unbound-method
        cancelRequest.cancel = () => { return this.device.cancelDownloadTask(requestId); };
      }
    });
  }
  public static async authInit(ctx: ClientRequestContext, settings: MobileDeviceAuthSettings) {
    if (this._authInitialized)
      return;

    // Set callback for ios
    this.device.authStateChanged = (accessToken?: string, err?: string) => {
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
      this.device.authInit(ctx, settings, (err?: string) => {
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

  public static async signIn(ctx: ClientRequestContext): Promise<void> {
    // eslint-disable-next-line no-console
    console.log("signIn() ", JSON.stringify(ctx));
    return new Promise<void>((resolve, reject) => {
      this.device.authSignIn(ctx, (err?: string) => {
        if (!err) {
          resolve();
        } else {
          reject(new Error(err));
        }
      });
    });
  }

  public static async signOut(ctx: ClientRequestContext): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.device.authSignOut(ctx, (err?: string) => {
        if (!err) {
          resolve();
        } else {
          reject(new Error(err));
        }
      });
    });
  }

  public static async getAccessToken(ctx: ClientRequestContext): Promise<AccessToken> {
    return new Promise<AccessToken>((resolve, reject) => {
      this.device.authGetAccessToken(ctx, (accessToken?: string, err?: string) => {
        if (!err) {
          resolve(AccessToken.fromJson(accessToken));
        } else {
          reject(new Error(err));
        }
      });
    });
  }

  public static get isValid() { return undefined !== this._device; }

  /**
   * Start the backend of a mobile app.
   */
  public static async startup(opt?: { mobileHost?: { device?: MobileDevice }, ipcHost?: IpcHostOptions, iModelHost?: IModelHostConfiguration }): Promise<void> {
    if (!this.isValid) {
      setupMobileRpc();

      this._device = opt?.mobileHost?.device ?? new (MobileDevice as any)();
      this.onUserStateChanged.addListener((accessToken?: string, err?: string) => {
        const accessTokenObj = accessToken ? JSON.parse(accessToken) : {};
        NativeHost.notifyNativeFrontend("notifyUserStateChanged", { accessToken: accessTokenObj, err });
      });
    }
    await NativeHost.startup(opt);
    if (IpcHost.isValid)
      MobileAppHandler.register();
  }
}
