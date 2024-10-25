/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module NativeApp
 */

import { AsyncMethodsOf, BeEvent, GuidString, Logger, PromiseReturnType } from "@itwin/core-bentley";
import {
  BriefcaseDownloader, BriefcaseProps, IModelVersion, InternetConnectivityStatus, IpcSocketFrontend, LocalBriefcaseProps,
  NativeAppFunctions, nativeAppIpcStrings, NativeAppNotifications, OverriddenBy,
  RemoveFunction, RequestNewBriefcaseProps, StorageValue, SyncMode,
} from "@itwin/core-common";
import { ProgressCallback } from "./request/Request";
import { FrontendLoggerCategory } from "./common/FrontendLoggerCategory";
import { IpcApp, IpcAppOptions, NotificationHandler } from "./IpcApp";
import { NativeAppLogger } from "./NativeAppLogger";
import { OnDownloadProgress } from "./BriefcaseConnection";
import { _callIpcChannel } from "./common/internal/Symbols";

/** Properties for specifying the BriefcaseId for downloading. May either specify a BriefcaseId directly (preferable) or, for
 * backwards compatibility, a [SyncMode]($common). If [SyncMode.PullAndPush]($common) is supplied, a new briefcaseId will be acquired.
 * @public
 */
export type DownloadBriefcaseId =
  { syncMode?: SyncMode, briefcaseId?: never } |
  { briefcaseId: number, syncMode?: never };

/**
* Options to download a briefcase
* @public
*/
export type DownloadBriefcaseOptions = DownloadBriefcaseId & {
  /** the full path for the briefcase file */
  fileName?: string;
  /** Function called regularly to report progress of download. */
  progressCallback?: OnDownloadProgress;
  /** interval for calling progress function, in milliseconds */
  progressInterval?: number;
};

/** NativeApp notifications from backend */
class NativeAppNotifyHandler extends NotificationHandler implements NativeAppNotifications {
  public get channelName() { return nativeAppIpcStrings.notifyChannel; }
  public notifyInternetConnectivityChanged(status: InternetConnectivityStatus) {
    Logger.logInfo(FrontendLoggerCategory.NativeApp, "Internet connectivity changed");
    NativeApp.onInternetConnectivityChanged.raiseEvent(status);
  }
}

/**
 * Options for [[NativeApp.startup]]
 * @public
 */
export interface NativeAppOpts extends IpcAppOptions {
  nativeApp?: object;
}

/**
 * The frontend of a native application
 * @see [Native Applications]($docs/learning/NativeApps.md)
 * @public
 */
export class NativeApp {
  private static _removeAppNotify?: RemoveFunction;

  /** @deprecated in 3.x. use nativeAppIpc */
  public static async callNativeHost<T extends AsyncMethodsOf<NativeAppFunctions>>(methodName: T, ...args: Parameters<NativeAppFunctions[T]>) {
    return IpcApp[_callIpcChannel](nativeAppIpcStrings.channelName, methodName, ...args) as PromiseReturnType<NativeAppFunctions[T]>;
  }
  /** A Proxy to call one of the [NativeAppFunctions]($common) functions via IPC. */
  public static nativeAppIpc = IpcApp.makeIpcProxy<NativeAppFunctions>(nativeAppIpcStrings.channelName);

  private static _storages = new Map<string, Storage>();
  private static _onOnline = async () => {
    await NativeApp.setConnectivity(OverriddenBy.Browser, InternetConnectivityStatus.Online);
  };
  private static _onOffline = async () => {
    await NativeApp.setConnectivity(OverriddenBy.Browser, InternetConnectivityStatus.Offline);
  };
  private static async setConnectivity(by: OverriddenBy, status: InternetConnectivityStatus) {
    await this.nativeAppIpc.overrideInternetConnectivity(by, status);
  }
  private static hookBrowserConnectivityEvents() {
    if (typeof window === "object" && window.ononline && window.onoffline) {
      window.addEventListener("online", this._onOnline);
      window.addEventListener("offline", this._onOffline);
    }
  }
  private static unhookBrowserConnectivityEvents() {
    if (typeof window === "object" && window.ononline && window.onoffline) {
      window.removeEventListener("online", this._onOnline);
      window.removeEventListener("offline", this._onOffline);
    }
  }
  /** event called when internet connectivity changes, if known */
  public static onInternetConnectivityChanged = new BeEvent<(status: InternetConnectivityStatus) => void>();

  /** determine whether the app currently has internet connectivity, if known */
  public static async checkInternetConnectivity(): Promise<InternetConnectivityStatus> {
    return this.nativeAppIpc.checkInternetConnectivity();
  }
  /** @internal */
  public static async overrideInternetConnectivity(status: InternetConnectivityStatus): Promise<void> {
    return this.nativeAppIpc.overrideInternetConnectivity(OverriddenBy.User, status);
  }
  private static _isValid = false;
  public static get isValid(): boolean { return this._isValid; }

  /**
   * This is called by either ElectronApp.startup or MobileApp.startup - it should not be called directly
   * @internal
   */
  public static async startup(ipc: IpcSocketFrontend, opts?: NativeAppOpts) {
    await IpcApp.startup(ipc, opts);
    if (this._isValid)
      return;
    this._isValid = true;

    this._removeAppNotify = NativeAppNotifyHandler.register(); // receives notifications from backend
    NativeApp.hookBrowserConnectivityEvents();

    // initialize current online state.
    if (window.navigator.onLine) {
      await this.setConnectivity(OverriddenBy.Browser, window.navigator.onLine ? InternetConnectivityStatus.Online : InternetConnectivityStatus.Offline);
    }
  }

  /** @internal */
  public static async shutdown() {
    this._removeAppNotify?.();
    NativeApp.unhookBrowserConnectivityEvents();
    await NativeAppLogger.flush();
    await IpcApp.shutdown();
    this._isValid = false;
  }

  public static async requestDownloadBriefcase(iTwinId: string, iModelId: string, downloadOptions: DownloadBriefcaseOptions,
    asOf?: IModelVersion): Promise<BriefcaseDownloader>;

  /**
   * @deprecated in 3.6. `progress` argument is now deprecated, use [[DownloadBriefcaseOptions.progressCallback]] instead.
   */
  public static async requestDownloadBriefcase(iTwinId: string, iModelId: string, downloadOptions: DownloadBriefcaseOptions,
    // eslint-disable-next-line @typescript-eslint/unified-signatures, @typescript-eslint/no-deprecated
    asOf?: IModelVersion, progress?: ProgressCallback): Promise<BriefcaseDownloader>;

  public static async requestDownloadBriefcase(
    iTwinId: string,
    iModelId: string,
    downloadOptions: DownloadBriefcaseOptions,
    asOf: IModelVersion = IModelVersion.latest(),
    progress?: ProgressCallback, // eslint-disable-line @typescript-eslint/no-deprecated
  ): Promise<BriefcaseDownloader> {
    const shouldReportProgress = !!progress || !!downloadOptions.progressCallback;

    let stopProgressEvents = () => { };
    if (shouldReportProgress) {
      const handleProgress = (_evt: Event, data: { loaded: number, total: number }) => {
        progress?.(data);
        downloadOptions.progressCallback?.(data);
      };

      stopProgressEvents = IpcApp.addListener(`nativeApp.progress-${iModelId}`, handleProgress);
    }

    const briefcaseId = (undefined !== downloadOptions.briefcaseId) ? downloadOptions.briefcaseId :
      (downloadOptions.syncMode === SyncMode.PullOnly ? 0 : await this.nativeAppIpc.acquireNewBriefcaseId(iModelId));

    const fileName = downloadOptions.fileName ?? await this.getBriefcaseFileName({ briefcaseId, iModelId });
    const requestProps: RequestNewBriefcaseProps = { iModelId, briefcaseId, iTwinId, asOf: asOf.toJSON(), fileName };

    const doDownload = async (): Promise<void> => {
      try {
        await this.nativeAppIpc.downloadBriefcase(requestProps, shouldReportProgress, downloadOptions.progressInterval);
      } finally {
        stopProgressEvents();
      }
    };

    const requestCancel = async (): Promise<boolean> => {
      const status = await this.nativeAppIpc.requestCancelDownloadBriefcase(fileName);
      if (status)
        stopProgressEvents();
      return status;
    };

    return { briefcaseId, fileName, downloadPromise: doDownload(), requestCancel };
  }

  /** Get the full path filename for a briefcase within the briefcase cache */
  public static async getBriefcaseFileName(props: BriefcaseProps): Promise<string> {
    return this.nativeAppIpc.getBriefcaseFileName(props);
  }

  /** Delete an existing briefcase
   * @param fileName the briefcase fileName
   */
  public static async deleteBriefcase(fileName: string): Promise<void> {
    await this.nativeAppIpc.deleteBriefcaseFiles(fileName);
  }

  /** Get a list of all briefcase files held in the local briefcase cache directory */
  public static async getCachedBriefcases(iModelId?: GuidString): Promise<LocalBriefcaseProps[]> {
    return this.nativeAppIpc.getCachedBriefcases(iModelId);
  }

  /**
   * Open a [[Storage]]. Creates a new Storage with that name if it does not already exist.
   * @param name Should be a local filename without an extension.
   * @returns a Promise for the [[Storage]].
   */
  public static async openStorage(name: string): Promise<Storage> {
    if (this._storages.has(name))
      return this._storages.get(name)!;

    const storage = new Storage(await this.nativeAppIpc.storageMgrOpen(name));
    this._storages.set(storage.id, storage);
    return storage;
  }

  /**
   * Close a Storage and optionally delete it.
   * @param storage normally not call directly instead use Storage.close()
   * @param deleteStorage if true, delete the storage from disk after closing it.
   */
  public static async closeStorage(storage: Storage, deleteStorage: boolean = false): Promise<void> {
    if (!this._storages.has(storage.id))
      throw new Error(`Storage [Id=${storage.id}] not open`);

    await this.nativeAppIpc.storageMgrClose(storage.id, deleteStorage);
    this._storages.delete(storage.id);
  }

  /** Get the list of existing Storages on the local disk. */
  public static async getStorageNames(): Promise<string[]> {
    return NativeApp.nativeAppIpc.storageMgrNames();
  }
}

/**
 *  A local disk-based cache for key value pairs for NativeApps.
 * @note This should be used only for local caching, since its not guaranteed to exist permanently.
 * @public
 */
export class Storage {
  constructor(public readonly id: string) { }

  /** get the type of a value for a key, or undefined if not present. */
  public async getValueType(key: string): Promise<"number" | "string" | "boolean" | "Uint8Array" | "null" | undefined> {
    return NativeApp.nativeAppIpc.storageGetValueType(this.id, key);
  }

  /** Get the value for a key */
  public async getData(key: string): Promise<StorageValue> {
    return NativeApp.nativeAppIpc.storageGet(this.id, key);
  }

  /** Set value for a key */
  public async setData(key: string, value: StorageValue): Promise<void> {
    return NativeApp.nativeAppIpc.storageSet(this.id, key, value);
  }

  /**
   * Return an array of all keys in this Storage.
   * @note This can be expensive, depending on the number of keys present.
   */
  public async getKeys(): Promise<string[]> {
    return NativeApp.nativeAppIpc.storageKeys(this.id);
  }

  /** Remove a key and its data. */
  public async removeData(key: string): Promise<void> {
    return NativeApp.nativeAppIpc.storageRemove(this.id, key);
  }

  /** Remove all keys and their data. */
  public async removeAll(): Promise<void> {
    return NativeApp.nativeAppIpc.storageRemoveAll(this.id);
  }
}
