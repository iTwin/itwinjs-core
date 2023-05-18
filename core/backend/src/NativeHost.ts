/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module NativeApp
 */

import { join } from "path";
import { AccessToken, assert, BeEvent, GuidString } from "@itwin/core-bentley";
import {
  BriefcaseProps, InternetConnectivityStatus, LocalBriefcaseProps, NativeAppFunctions, nativeAppIpcStrings, NativeAppNotifications,
  OverriddenBy, RequestNewBriefcaseProps, StorageValue,
} from "@itwin/core-common";
import { BriefcaseManager, RequestNewBriefcaseArg } from "./BriefcaseManager";
import { Downloads, ProgressFunction, ProgressStatus } from "./CheckpointManager";
import { IModelHost } from "./IModelHost";
import { IpcHandler, IpcHost, IpcHostOpts, throttleProgressCallback } from "./IpcHost";
import { NativeAppStorage } from "./NativeAppStorage";

/**
 * Implementation of NativeAppFunctions
 */
class NativeAppHandler extends IpcHandler implements NativeAppFunctions {
  public get channelName() { return nativeAppIpcStrings.channelName; }

  public async getAccessToken(): Promise<AccessToken | undefined> {
    return IModelHost.authorizationClient?.getAccessToken();
  }

  public async checkInternetConnectivity(): Promise<InternetConnectivityStatus> {
    return NativeHost.checkInternetConnectivity();
  }
  public async overrideInternetConnectivity(by: OverriddenBy, status: InternetConnectivityStatus): Promise<void> {
    NativeHost.overrideInternetConnectivity(by, status);
  }
  public async acquireNewBriefcaseId(iModelId: GuidString): Promise<number> {
    return BriefcaseManager.acquireNewBriefcaseId({ iModelId });
  }
  public async getBriefcaseFileName(props: BriefcaseProps): Promise<string> {
    return BriefcaseManager.getFileName(props);
  }
  public async downloadBriefcase(request: RequestNewBriefcaseProps, reportProgress: boolean, progressInterval?: number): Promise<LocalBriefcaseProps> {
    const args: RequestNewBriefcaseArg = {
      ...request,
      accessToken: await this.getAccessToken(),
      onProgress: (_a: number, _b: number) => checkAbort(),
    };

    const checkAbort = () => {
      assert(undefined !== args.fileName);
      const job = Downloads.isInProgress(args.fileName);
      return (job && (job.request as any).abort === 1) ? ProgressStatus.Abort : ProgressStatus.Continue;
    };

    if (reportProgress) {
      const progressCallback: ProgressFunction = (loaded, total) => {
        IpcHost.send(`nativeApp.progress-${request.iModelId}`, { loaded, total });
        return checkAbort();
      };
      args.onProgress = throttleProgressCallback(progressCallback, checkAbort, progressInterval);
    }

    return BriefcaseManager.downloadBriefcase(args);
  }

  public async requestCancelDownloadBriefcase(fileName: string): Promise<boolean> {
    const job = Downloads.isInProgress(fileName);
    if (job)
      (job.request as any).abort = 1;
    return job !== undefined;
  }

  public async deleteBriefcaseFiles(fileName: string): Promise<void> {
    await BriefcaseManager.deleteBriefcaseFiles(fileName, await IModelHost.getAccessToken());
  }

  public async getCachedBriefcases(iModelId?: GuidString): Promise<LocalBriefcaseProps[]> {
    return BriefcaseManager.getCachedBriefcases(iModelId);
  }

  public async storageMgrOpen(storageId: string): Promise<string> {
    return NativeAppStorage.open(storageId).id;
  }

  public async storageMgrClose(storageId: string, deleteIt: boolean): Promise<void> {
    NativeAppStorage.find(storageId).close(deleteIt);
  }

  public async storageMgrNames(): Promise<string[]> {
    return NativeAppStorage.getStorageNames();
  }

  public async storageGetValueType(storageId: string, key: string): Promise<"number" | "string" | "boolean" | "Uint8Array" | "null" | undefined> {
    return NativeAppStorage.find(storageId).getValueType(key);
  }

  public async storageGet(storageId: string, key: string): Promise<StorageValue | undefined> {
    return NativeAppStorage.find(storageId).getData(key);
  }

  public async storageSet(storageId: string, key: string, value: StorageValue): Promise<void> {
    NativeAppStorage.find(storageId).setData(key, value);
  }

  public async storageRemove(storageId: string, key: string): Promise<void> {
    NativeAppStorage.find(storageId).removeData(key);
  }

  public async storageKeys(storageId: string): Promise<string[]> {
    return NativeAppStorage.find(storageId).getKeys();
  }

  public async storageRemoveAll(storageId: string): Promise<void> {
    NativeAppStorage.find(storageId).removeAll();
  }
}

/** Options for [[NativeHost.startup]]
 * @public
 */
export interface NativeHostOpts extends IpcHostOpts {
  nativeHost?: {
    /** Application name. Used, for example, to name the settings file. If not supplied, defaults to "iTwinApp". */
    applicationName?: string;
  };
}

/**
 * Backend for desktop/mobile native applications
 * @public
 */
export class NativeHost {
  private static _reachability?: InternetConnectivityStatus;
  private static _applicationName: string;
  private constructor() { } // no instances - static methods only

  /** Event called when the internet connectivity changes, if known. */
  public static readonly onInternetConnectivityChanged = new BeEvent<(status: InternetConnectivityStatus) => void>();

  private static _appSettingsCacheDir?: string;

  /** Get the local cache folder for application settings */
  public static get appSettingsCacheDir(): string {
    return this._appSettingsCacheDir ??= join(IModelHost.cacheDir, "appSettings");
  }

  /** Send a notification to the NativeApp connected to this NativeHost. */
  public static notifyNativeFrontend<T extends keyof NativeAppNotifications>(methodName: T, ...args: Parameters<NativeAppNotifications[T]>) {
    return IpcHost.send(nativeAppIpcStrings.notifyChannel, methodName, ...args);
  }

  private static _isValid = false;
  public static get isValid(): boolean { return this._isValid; }
  public static get applicationName() { return this._applicationName; }
  /** Get the settings store for this NativeHost. */
  public static get settingsStore() {
    return NativeAppStorage.open(this.applicationName);
  }

  /**
   * Start the backend of a native app.
   * @note this method calls [[IpcHost.startup]] internally.
   */
  public static async startup(opt?: NativeHostOpts): Promise<void> {
    if (!this.isValid) {
      this._isValid = true;
      this.onInternetConnectivityChanged.addListener((status: InternetConnectivityStatus) =>
        NativeHost.notifyNativeFrontend("notifyInternetConnectivityChanged", status));
      this._applicationName = opt?.nativeHost?.applicationName ?? "iTwinApp";
    }

    await IpcHost.startup(opt);
    if (IpcHost.isValid)  // for tests, we use NativeHost but don't have a frontend
      NativeAppHandler.register();
  }

  /** Shutdown native app backend. Also calls [[IpcHost.shutdown]] */
  public static async shutdown(): Promise<void> {
    this._isValid = false;
    this.onInternetConnectivityChanged.clear();
    await IpcHost.shutdown();
  }

  /** get current value of internet connectivity */
  public static checkInternetConnectivity(): InternetConnectivityStatus {
    return this._reachability ?? InternetConnectivityStatus.Online;
  }

  /**
   * Override internet connectivity state
   * @param _overridenBy who overrode the value.
   * @internal
   */
  public static overrideInternetConnectivity(_overridenBy: OverriddenBy, status: InternetConnectivityStatus): void {
    if (this._reachability !== status) {
      this._reachability = status;
      this.onInternetConnectivityChanged.raiseEvent(status);
    }
  }
}
