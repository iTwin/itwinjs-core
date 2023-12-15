/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { AccessToken, BeEvent, BriefcaseStatus } from "@itwin/core-bentley";
import { IpcHandler, IpcHost, NativeHost, NativeHostOpts } from "@itwin/core-backend";
import { IpcWebSocketBackend, RpcInterfaceDefinition } from "@itwin/core-common";
import { CancelRequest, DownloadFailed, UserCancelledError } from "./MobileFileHandler";
import { ProgressCallback } from "./Request";
import { mobileAppStrings } from "../common/MobileAppChannel";
import { BatteryState, DeviceEvents, MobileAppFunctions, MobileNotifications, Orientation } from "../common/MobileAppProps";
import { MobileRpcManager } from "../common/MobileRpcManager";
import { MobileAuthorizationBackend } from "./MobileAuthorizationBackend";
import { setupMobileRpc } from "./MobileRpcServer";

/** @beta */
export type MobileCompletionCallback = (downloadUrl: string, downloadFileUrl: string, cancelled: boolean, err?: string) => void;
/** @beta */
export type MobileProgressCallback = (bytesWritten: number, totalBytesWritten: number, totalBytesExpectedToWrite: number) => void;
/** @beta */
export type MobileCancelCallback = () => boolean;

/** @beta */
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

/** @beta */
export abstract class MobileDevice {
  public emit(eventName: DeviceEvents, ...args: any[]) {
    switch (eventName) {
      case "memoryWarning":
        MobileHost.onMemoryWarning.raiseEvent(...args);
        break;
      case "orientationChanged":
        MobileHost.onOrientationChanged.raiseEvent(...args);
        break;
      case "enterForeground":
        MobileHost.onEnterForeground.raiseEvent(...args);
        break;
      case "enterBackground":
        MobileHost.onEnterBackground.raiseEvent(...args);
        break;
      case "willTerminate":
        MobileHost.onWillTerminate.raiseEvent(...args);
        break;
      case "authAccessTokenChanged":
        MobileHost.onAuthAccessTokenChanged.raiseEvent(args[0], args[1]);
        break;
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
  public abstract authGetAccessToken(callback: (accessToken?: string, expirationDate?: string, err?: string) => void): void;
}

class MobileAppHandler extends IpcHandler implements MobileAppFunctions {
  public get channelName() { return mobileAppStrings.mobileAppChannel; }
  public async reconnect(connection: number) {
    MobileHost.reconnect(connection);
  }
  public async getAccessToken() {
    return MobileHost.authGetAccessToken();
  }
}

/** @beta */
export interface MobileHostOpts extends NativeHostOpts {
  mobileHost?: {
    device?: MobileDevice;
    /** list of RPC interface definitions to register */
    rpcInterfaces?: RpcInterfaceDefinition[];
  };
}

/**
 * @beta
 */
export class MobileHost {
  private static _device?: MobileDevice;
  public static get device() { return this._device!; }
  /**
   * Raised when the mobile OS informs a mobile app that it is running low on memory.
   *
   * @note iOS and iPadOS send this warning so often as to make it not very useful.
   */
  public static readonly onMemoryWarning = new BeEvent();
  /**
   * Raised when the device orientation changes on a device running a mobile app.
   */
  public static readonly onOrientationChanged = new BeEvent();
  /**
   * Raised after a mobile app returns to the foreground.
   */
  public static readonly onEnterForeground = new BeEvent();
  /**
   * Raised when a mobile app is about to enter the background.
   */
  public static readonly onEnterBackground = new BeEvent();
  /**
   * Raised after a mobile backend connects to the mobile frontend.
   *
   * @note this will be raised at startup, and it will also be raised every time the app returns
   * to the foreground from the background.
   */
  public static readonly onConnected = new BeEvent();
  /**
   * Raised when a mobile app is about to be terminated by the mobile OS.
   */
  public static readonly onWillTerminate = new BeEvent();
  /**
   * Raised when the native auth client informs the mobile host that the access token has changed.
   */
  public static readonly onAuthAccessTokenChanged = new BeEvent<(accessToken: string | undefined, expirationDate: string | undefined) => void>();

  /** Send a notification to the MobileApp connected to this MobileHost. */
  public static notifyMobileFrontend<T extends keyof MobileNotifications>(methodName: T, ...args: Parameters<MobileNotifications[T]>) {
    return IpcHost.send(mobileAppStrings.mobileAppNotify, methodName, ...args);
  }

  /**  @internal */
  public static reconnect(connection: number) {
    this.device.reconnect(connection);
  }

  /**  @internal */
  public static async authGetAccessToken() {
    return new Promise<[AccessToken, string]>((resolve, reject) => {
      this.device.authGetAccessToken((tokenString?: AccessToken, expirationDate?: string, error?: string) => {
        if (error) {
          reject(error);
        } else {
          resolve([tokenString ?? "", expirationDate ?? ""]);
        }
      });
    });
  }

  /**  @internal */
  public static async downloadFile(downloadUrl: string, downloadTo: string, progress?: ProgressCallback, cancelRequest?: CancelRequest): Promise<void> {
    return new Promise<void>((resolve, reject) => {

      let progressCb: MobileProgressCallback | undefined;
      let lastReportedOn = Date.now();
      const minTimeBeforeReportingProgress = 1000;
      if (progress) {
        progressCb = (_bytesWritten: number, totalBytesWritten: number, totalBytesExpectedToWrite: number) => {
          const currentTime = Date.now();
          const timeSinceLastEvent = currentTime - lastReportedOn;
          // report all event for last 5 Mbs so we never miss 100% progress event
          const lastEvent = (totalBytesExpectedToWrite - totalBytesWritten) < 1024 * 1024 * 5;
          if (timeSinceLastEvent < minTimeBeforeReportingProgress && !lastEvent)
            return;

          lastReportedOn = currentTime;
          const percent = Number((100 * (totalBytesWritten / totalBytesExpectedToWrite)).toFixed(2));
          progress({ total: totalBytesExpectedToWrite, loaded: totalBytesWritten, percent });
        };
      }
      const requestId = this.device.createDownloadTask(downloadUrl, false, downloadTo, (_downloadUrl: string, _downloadFileUrl: string, cancelled: boolean, err?: string) => {
        if (cancelled)
          reject(new UserCancelledError(BriefcaseStatus.DownloadCancelled, "User cancelled download"));
        else if (err)
          reject(new DownloadFailed(400, "Download failed"));
        else
          resolve();
      }, progressCb);
      if (cancelRequest) {
        // eslint-disable-next-line @typescript-eslint/unbound-method
        cancelRequest.cancel = () => this.device.cancelDownloadTask(requestId);
      }
    });
  }

  public static get isValid() { return undefined !== this._device; }

  /** Start the backend of a mobile app. */
  public static async startup(opt?: MobileHostOpts): Promise<void> {
    const authorizationClient = new MobileAuthorizationBackend();
    if (!this.isValid) {
      this._device = opt?.mobileHost?.device ?? new (MobileDevice as any)();
      // set global device interface.
      // NOTE: __iTwinJsNativeBridge is used by backend native code.
      (global as any).__iTwinJsNativeBridge = this._device;
      this.onMemoryWarning.addListener(() => {
        MobileHost.notifyMobileFrontend("notifyMemoryWarning");
      });
      this.onOrientationChanged.addListener(() => {
        try {
          MobileHost.notifyMobileFrontend("notifyOrientationChanged");
        } catch (_ex) { } // Ignore: frontend is not currently connected
      });
      this.onWillTerminate.addListener(() => {
        MobileHost.notifyMobileFrontend("notifyWillTerminate");
      });
      this.onAuthAccessTokenChanged.addListener((accessToken: string | undefined, expirationDate: string | undefined) => {
        authorizationClient.setAccessToken(accessToken, expirationDate);
        MobileHost.notifyMobileFrontend("notifyAuthAccessTokenChanged", accessToken, expirationDate);
      });

      // following will provide impl for device specific api.
      setupMobileRpc();
    }

    const socket = opt?.ipcHost?.socket ?? new IpcWebSocketBackend();
    opt = { ...opt, mobileHost: { ...opt?.mobileHost }, ipcHost: { ...opt?.ipcHost, socket } };

    const iModelHost = opt?.iModelHost ?? {};
    iModelHost.authorizationClient = authorizationClient;
    await NativeHost.startup({ ...opt, iModelHost });

    if (IpcHost.isValid)
      MobileAppHandler.register();

    const rpcInterfaces = opt?.mobileHost?.rpcInterfaces ?? [];

    MobileRpcManager.initializeImpl(rpcInterfaces);
  }
}
