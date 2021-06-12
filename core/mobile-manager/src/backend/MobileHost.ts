/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { BeEvent, BriefcaseStatus, ClientRequestContext, Logger } from "@bentley/bentleyjs-core";
import { IModelHost, IpcHandler, IpcHost, NativeHost, NativeHostOpts } from "@bentley/imodeljs-backend";
import { IModelReadRpcInterface, IModelTileRpcInterface, InternetConnectivityStatus, NativeAppAuthorizationConfiguration, RpcInterfaceDefinition, SnapshotIModelRpcInterface } from "@bentley/imodeljs-common";
import { CancelRequest, DownloadFailed, ProgressCallback, UserCancelledError } from "@bentley/itwin-client";
import { PresentationRpcInterface } from "@bentley/presentation-common";
import { BatteryState, DeviceEvents, mobileAppChannel, MobileAppFunctions, Orientation } from "../common/MobileAppProps";
import { MobileRpcManager } from "../common/MobileRpcManager";
import { MobileAuthorizationBackend } from "../MobileBackend";
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
  public authInit(_ctx: ClientRequestContext, _config: NativeAppAuthorizationConfiguration, callback: (err?: string) => void): void { callback(); }
  public abstract authStateChanged(accessToken?: string, err?: string): void;
}

class MobileAppHandler extends IpcHandler implements MobileAppFunctions {
  public get channelName() { return mobileAppChannel; }
  public async reconnect(connection: number) {
    MobileHost.reconnect(connection);
  }
}

/** @beta */
export interface MobileHostOpts extends NativeHostOpts {
  mobileHost?: {
    device?: MobileDevice;
    /** list of RPC interface definitions to register */
    rpcInterfaces?: RpcInterfaceDefinition[];
    /** if present, [[NativeHost.authorizationClient]] will be set to an instance of NativeAppAuthorizationBackend and will be initialized. */
    authConfig?: NativeAppAuthorizationConfiguration;
    /** if true, do not attempt to initialize AuthorizationClient on startup */
    noInitializeAuthClient?: boolean;
  };
}

/**
 * @beta
 */
export class MobileHost {
  private static _device?: MobileDevice;
  public static get device() { return this._device!; }
  public static readonly onMemoryWarning = new BeEvent();
  public static readonly onOrientationChanged = new BeEvent();
  public static readonly onEnterForeground = new BeEvent();
  public static readonly onEnterBackground = new BeEvent();
  public static readonly onWillTerminate = new BeEvent();

  /** @internal */
  public static get authorization() { return IModelHost.authorizationClient as MobileAuthorizationBackend; }

  /**  @internal */
  public static reconnect(connection: number) {
    this.device.reconnect(connection);
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

  public static get isValid() { return undefined !== this._device; }

  /** Start the backend of a mobile app. */
  public static async startup(opt?: MobileHostOpts): Promise<void> {
    if (!this.isValid) {
      setupMobileRpc();
      this._device = opt?.mobileHost?.device ?? new (MobileDevice as any)();
    }

    await NativeHost.startup(opt);
    if (IpcHost.isValid)
      MobileAppHandler.register();

    const rpcInterfaces = opt?.mobileHost?.rpcInterfaces ?? [
      IModelReadRpcInterface,
      IModelTileRpcInterface,
      SnapshotIModelRpcInterface,
      PresentationRpcInterface,
    ];

    MobileRpcManager.initializeImpl(rpcInterfaces);

    const authorizationBackend = new MobileAuthorizationBackend(opt?.mobileHost?.authConfig);
    const connectivityStatus = NativeHost.checkInternetConnectivity();
    if (opt?.mobileHost?.authConfig && true !== opt?.mobileHost?.noInitializeAuthClient && connectivityStatus === InternetConnectivityStatus.Online) {
      await authorizationBackend.initialize(opt?.mobileHost?.authConfig);
    }
    IModelHost.authorizationClient = authorizationBackend;
  }
}
