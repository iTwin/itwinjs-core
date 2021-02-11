/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module NativeApp
 */

import * as path from "path";
import { BeEvent, ClientRequestContext, Config, GuidString } from "@bentley/bentleyjs-core";
import {
  BriefcaseProps, InternetConnectivityStatus, LocalBriefcaseProps, nativeAppChannel, NativeAppFunctions, NativeAppNotifications, nativeAppNotify,
  OverriddenBy, RequestNewBriefcaseProps, StorageValue,
} from "@bentley/imodeljs-common";
import { AuthorizedClientRequestContext, RequestGlobalOptions } from "@bentley/itwin-client";
import { BriefcaseManager } from "./BriefcaseManager";
import { Downloads } from "./CheckpointManager";
import { IModelHost, IModelHostConfiguration } from "./IModelHost";
import { IpcHandler, IpcHost, IpcHostOptions } from "./IpcHost";
import { NativeAppStorage } from "./NativeAppStorage";

/**
 * Implementation of NativeAppFunctions
 */
class NativeAppHandler extends IpcHandler implements NativeAppFunctions {
  public get channelName() { return nativeAppChannel; }
  public async checkInternetConnectivity(): Promise<InternetConnectivityStatus> {
    return NativeHost.checkInternetConnectivity();
  }
  public async overrideInternetConnectivity(by: OverriddenBy, status: InternetConnectivityStatus): Promise<void> {
    NativeHost.overrideInternetConnectivity(by, status);
  }

  public async getConfig(): Promise<any> {
    return Config.App.getContainer();
  }

  public async acquireNewBriefcaseId(iModelId: GuidString): Promise<number> {
    const requestContext = ClientRequestContext.current as AuthorizedClientRequestContext;
    return BriefcaseManager.acquireNewBriefcaseId(requestContext, iModelId);
  }

  public async getBriefcaseFileName(props: BriefcaseProps): Promise<string> {
    return BriefcaseManager.getFileName(props);
  }

  public async downloadBriefcase(request: RequestNewBriefcaseProps, reportProgress: boolean): Promise<LocalBriefcaseProps> {
    const requestContext = ClientRequestContext.current as AuthorizedClientRequestContext;

    const args = {
      ...request,
      onProgress: (_a: number, _b: number) => checkAbort(),
    };

    if (reportProgress) {
      args.onProgress = (loaded, total) => {
        IpcHost.send(`nativeApp.progress-${request.iModelId}`, { loaded, total });
        return checkAbort();
      };
    }

    const downloadPromise = BriefcaseManager.downloadBriefcase(requestContext, args);
    const checkAbort = () => {
      const job = Downloads.isInProgress(args.fileName!);
      return (job && (job.request as any).abort === 1) ? 1 : 0;
    };
    return downloadPromise;
  }

  public async requestCancelDownloadBriefcase(fileName: string): Promise<boolean> {
    const job = Downloads.isInProgress(fileName);
    if (job)
      (job.request as any).abort = 1;
    return job !== undefined;
  }

  public async deleteBriefcaseFiles(fileName: string): Promise<void> {
    const context = ClientRequestContext.current instanceof AuthorizedClientRequestContext ? ClientRequestContext.current : undefined;
    await BriefcaseManager.deleteBriefcaseFiles(fileName, context);
  }

  public async getCachedBriefcases(iModelId?: GuidString): Promise<LocalBriefcaseProps[]> {
    const requestContext: ClientRequestContext = ClientRequestContext.current;
    requestContext.enter();
    return BriefcaseManager.getCachedBriefcases(iModelId);
  }

  public async storageMgrOpen(storageId: string): Promise<string> {
    return NativeAppStorage.open(storageId).id;
  }

  public async storageMgrClose(storageId: string, deleteIt: boolean): Promise<void> {
    NativeAppStorage.find(storageId)?.close(deleteIt);
  }

  public async storageMgrNames(): Promise<string[]> {
    return NativeAppStorage.getStorageNames();
  }

  public async storageGet(storageId: string, key: string): Promise<StorageValue | undefined> {
    return NativeAppStorage.find(storageId)?.getData(key);
  }

  public async storageSet(storageId: string, key: string, value: StorageValue): Promise<void> {
    NativeAppStorage.find(storageId)?.setData(key, value);
  }

  public async storageRemove(storageId: string, key: string): Promise<void> {
    NativeAppStorage.find(storageId)?.removeData(key);
  }

  public async storageKeys(storageId: string): Promise<string[]> {
    const storage = NativeAppStorage.find(storageId)!;
    return storage.getKeys();
  }

  public async storageRemoveAll(storageId: string): Promise<void> {
    const storage = NativeAppStorage.find(storageId)!;
    storage.removeAll();
  }
}

/**
 * Used by desktop/mobile native applications
 * @beta
 */
export class NativeHost {
  private static _reachability?: InternetConnectivityStatus;
  private constructor() { }

  public static onInternetConnectivityChanged: BeEvent<(status: InternetConnectivityStatus) => void> = new BeEvent<(status: InternetConnectivityStatus) => void>();

  private static _appSettingsCacheDir?: string;

  /** Get the local cache folder for application settings */
  public static get appSettingsCacheDir(): string {
    if (this._appSettingsCacheDir === undefined) {
      this._appSettingsCacheDir = path.join(IModelHost.cacheDir, "appSettings");
    }
    return this._appSettingsCacheDir;
  }

  public static notifyNativeFrontend<T extends keyof NativeAppNotifications>(methodName: T, ...args: Parameters<NativeAppNotifications[T]>) {
    return IpcHost.send(nativeAppNotify, methodName, ...args);
  }

  private static _isValid = false;
  public static get isValid(): boolean { return this._isValid; }

  /**
   * Start the backend of a native app.
   * @param configuration
   * @note this method calls [[IModelHost.startup]] internally.
   */
  public static async startup(opt?: { ipcHost?: IpcHostOptions, iModelHost?: IModelHostConfiguration }): Promise<void> {
    if (!this.isValid) {
      this._isValid = true;
      this.onInternetConnectivityChanged.addListener((status: InternetConnectivityStatus) => NativeHost.notifyNativeFrontend("notifyInternetConnectivityChanged", status));
    }
    await IpcHost.startup(opt);
    if (IpcHost.isValid) // for tests, we use NativeHost but don't have a frontend
      NativeAppHandler.register();
  }

  /**
   * Shutdown native app backend. Also calls IpcAppHost.shutdown()
   */
  public static async shutdown(): Promise<void> {
    this._isValid = false;
    this.onInternetConnectivityChanged.clear();
    await IpcHost.shutdown();
  }

  /**
   * Checks internet connectivity
   * @returns return current value of internet connectivity from backend.
   */
  public static checkInternetConnectivity(): InternetConnectivityStatus {
    return this._reachability ?? InternetConnectivityStatus.Online;
  }

  /**
   * Overrides internet connectivity value at backend.
   * @param _overridenBy who overrode the value.
   */
  public static overrideInternetConnectivity(_overridenBy: OverriddenBy, status: InternetConnectivityStatus): void {
    if (this._reachability !== status) {
      this._reachability = status;
      RequestGlobalOptions.online = this._reachability === InternetConnectivityStatus.Online;
      this.onInternetConnectivityChanged.raiseEvent(status);
    }
  }
}
