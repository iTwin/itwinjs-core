/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module NativeApp
 */

import { BeEvent, Config, GuidString, Logger } from "@bentley/bentleyjs-core";
import {
  BriefcaseDownloader, BriefcaseProps, IModelVersion, InternetConnectivityStatus, LocalBriefcaseProps, nativeAppChannel, NativeAppFunctions,
  NativeAppNotifications, nativeAppNotify, OverriddenBy, RequestNewBriefcaseProps, StorageValue, SyncMode,
} from "@bentley/imodeljs-common";
import { ProgressCallback, RequestGlobalOptions } from "@bentley/itwin-client";
import { FrontendLoggerCategory } from "./FrontendLoggerCategory";
import { AuthorizedFrontendRequestContext, FrontendRequestContext } from "./FrontendRequestContext";
import { IModelAppOptions } from "./imodeljs-frontend";
import { AsyncMethodsOf, IpcApp, IpcAppOptions, NotificationHandler, PromiseReturnType } from "./IpcApp";
import { NativeAppLogger } from "./NativeAppLogger";

/**
 * Options to download a briefcase
 * @alpha
 */
export interface DownloadBriefcaseOptions {
  /** This setting defines the operations allowed when synchronizing changes between the briefcase and iModelHub */
  syncMode: SyncMode;
  fileName?: string;
}

/** receive notifications from backend */
class NativeAppNotifyHandler extends NotificationHandler implements NativeAppNotifications {
  public get channelName() { return nativeAppNotify; }
  public notifyInternetConnectivityChanged(status: InternetConnectivityStatus) {
    Logger.logInfo(FrontendLoggerCategory.NativeApp, "Internet connectivity changed");
    NativeApp.onInternetConnectivityChanged.raiseEvent(status);
  }
  public notifyUserStateChanged(arg: { accessToken: any, err?: string }) {
    NativeApp.onUserStateChanged.raiseEvent(arg);
  }
}

/**
 * The frontend of a native application
 * @see [Native Applications]($docs/learning/NativeApps.md)
 * @alpha
 */
export class NativeApp {
  public static async callNativeHost<T extends AsyncMethodsOf<NativeAppFunctions>>(methodName: T, ...args: Parameters<NativeAppFunctions[T]>) {
    return IpcApp.callIpcChannel(nativeAppChannel, methodName, ...args) as PromiseReturnType<NativeAppFunctions[T]>;
  }

  private static _storages = new Map<string, Storage>();
  private static _onOnline = async () => {
    await NativeApp.setConnectivity(OverriddenBy.Browser, InternetConnectivityStatus.Online);
  };
  private static _onOffline = async () => {
    await NativeApp.setConnectivity(OverriddenBy.Browser, InternetConnectivityStatus.Offline);
  };
  private static async setConnectivity(by: OverriddenBy, status: InternetConnectivityStatus) {
    RequestGlobalOptions.online = (status === InternetConnectivityStatus.Online);
    await this.callNativeHost("overrideInternetConnectivity", by, status);
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
  public static onInternetConnectivityChanged = new BeEvent<(status: InternetConnectivityStatus) => void>();
  public static onUserStateChanged = new BeEvent<(_arg: { accessToken: any, err?: string }) => void>();

  public static async checkInternetConnectivity(): Promise<InternetConnectivityStatus> {
    return this.callNativeHost("checkInternetConnectivity");
  }
  public static async overrideInternetConnectivity(status: InternetConnectivityStatus): Promise<void> {
    return this.callNativeHost("overrideInternetConnectivity", OverriddenBy.User, status);
  }
  private static _isValid = false;
  public static get isValid(): boolean { return this._isValid; }

  /**
   * This is called by either ElectronApp.startup or MobileApp.startup - it should not be called directly
   * @internal
   */
  public static async startup(opts: { ipcApp?: IpcAppOptions, iModelApp?: IModelAppOptions }) {
    await IpcApp.startup(opts);
    if (this._isValid)
      return;
    this._isValid = true;

    NativeAppNotifyHandler.register(); // receives notifications from backend

    Config.App.merge(await this.callNativeHost("getConfig"));
    NativeApp.hookBrowserConnectivityEvents();

    // initialize current online state.
    if (window.navigator.onLine) {
      RequestGlobalOptions.online = window.navigator.onLine;
      await this.setConnectivity(OverriddenBy.Browser, window.navigator.onLine ? InternetConnectivityStatus.Online : InternetConnectivityStatus.Offline);
    }
  }

  public static async shutdown() {
    NativeApp.unhookBrowserConnectivityEvents();
    await NativeAppLogger.flush();
    await IpcApp.shutdown();
    this._isValid = false;
  }

  public static async requestDownloadBriefcase(contextId: string, iModelId: string, downloadOptions: DownloadBriefcaseOptions,
    asOf: IModelVersion = IModelVersion.latest(), progress?: ProgressCallback): Promise<BriefcaseDownloader> {

    const requestContext = await AuthorizedFrontendRequestContext.create();
    requestContext.enter();

    let stopProgressEvents = () => { };
    if (progress !== undefined) {
      stopProgressEvents = IpcApp.addListener(`nativeApp.progress-${iModelId}`, (_evt: Event, data: { loaded: number, total: number }) => {
        progress(data);
      });
    }

    const briefcaseId = downloadOptions.syncMode === SyncMode.PullOnly ? 0 : await this.callNativeHost("acquireNewBriefcaseId", iModelId);
    requestContext.enter();

    const fileName = downloadOptions.fileName ?? await this.callNativeHost("getBriefcaseFileName", { briefcaseId, iModelId });
    requestContext.enter();

    const requestProps: RequestNewBriefcaseProps = { iModelId, briefcaseId, contextId, asOf: asOf.toJSON(), fileName };

    const doDownload = async (): Promise<void> => {
      const locRequestContext = new FrontendRequestContext();
      locRequestContext.enter();
      try {
        await this.callNativeHost("downloadBriefcase", requestProps, progress !== undefined);
      } finally {
        stopProgressEvents();
      }
    };

    const requestCancel = async (): Promise<boolean> => {
      const status = await this.callNativeHost("requestCancelDownloadBriefcase", fileName);
      if (status)
        stopProgressEvents();
      return status;
    };

    return { briefcaseId, fileName, downloadPromise: doDownload(), requestCancel };
  }

  public static async getBriefcaseFileName(props: BriefcaseProps): Promise<string> {
    return this.callNativeHost("getBriefcaseFileName", props);
  }

  /** Delete an existing briefcase
   * @param fileName the briefcase fileName
   */
  public static async deleteBriefcase(fileName: string): Promise<void> {
    const requestContext = new FrontendRequestContext();
    requestContext.enter();
    await this.callNativeHost("deleteBriefcaseFiles", fileName);
  }

  /**
   * Gets briefcases
   * @returns list of BriefcaseProps in cache
   */
  public static async getCachedBriefcases(iModelId?: GuidString): Promise<LocalBriefcaseProps[]> {
    return this.callNativeHost("getCachedBriefcases", iModelId);
  }

  /**
   * Opens storage. This automatically create the storage with that name if it does not exist
   * @param name Should confirm to a filename rules without extension.
   * @returns storage object that represent the [[Storage]] object.
   */
  public static async openStorage(name: string): Promise<Storage> {
    if (this._storages.has(name)) {
      return this._storages.get(name)!;
    }
    const storage = new Storage(await this.callNativeHost("storageMgrOpen", name));
    this._storages.set(storage.id, storage);
    return storage;
  }

  /**
   * Closes storage cache
   * @param storage normally not call directly instead use Storage.close()
   * @param deleteId if set attempt is made to delete the storage from disk permanently.
   */
  public static async closeStorage(storage: Storage, deleteId: boolean): Promise<void> {
    if (!this._storages.has(storage.id)) {
      throw new Error(`Storage [Id=${storage.id}] not found`);
    }
    await this.callNativeHost("storageMgrClose", storage.id, deleteId);
    (storage as any)._isOpen = false;
    this._storages.delete(storage.id);
  }

  /**
   * Gets storage names
   * @returns return list of storage available on disk.
   */
  public static async getStorageNames(): Promise<string[]> {
    return NativeApp.callNativeHost("storageMgrNames");
  }
}

/**
 *  A local disk-based cache for key value pairs available for NativeApps.
 * @note This should be used only for local caching, since its not guaranteed to exist permanently.
 * @alpha
 */
export class Storage {
  constructor(public readonly id: string, private _isOpen: boolean = true) { }

  /**
   * Gets data against a key
   * @param key a string that represent a key.
   * @returns data return value against the key
   * @internal
   */
  public async getData(key: string): Promise<StorageValue | undefined> {
    if (!this._isOpen) {
      throw new Error(`Storage [Id=${this.id}] is not open`);
    }
    return NativeApp.callNativeHost("storageGet", this.id, key);
  }

  /**
   * Sets data against a key
   * @param key a string that represent a key
   * @param value a value that need to be persisted
   * @internal
   */
  public async setData(key: string, value: StorageValue): Promise<void> {
    if (!this._isOpen) {
      throw new Error(`Storage [Id=${this.id}] is not open`);
    }
    return NativeApp.callNativeHost("storageSet", this.id, key, value);
  }

  /**
   * Return all keys.
   * @note This could be expensive and may block backend depending on size and number of keys
   * @returns keys a string array of all the keys in storage
   */
  public async getKeys(): Promise<string[]> {
    if (!this._isOpen) {
      throw new Error(`Storage [Id=${this.id}] is not open`);
    }
    return NativeApp.callNativeHost("storageKeys", this.id);
  }

  /**
   * Remove all keys
   * @note Delete all keys and data.
   */
  public async removeData(key: string): Promise<void> {
    if (!this._isOpen) {
      throw new Error(`Storage [Id=${this.id}] is not open`);
    }
    return NativeApp.callNativeHost("storageRemove", this.id, key);
  }

  /**
   * Remove all keys
   * @note Delete all keys and data.
   */
  public async removeAll(): Promise<void> {
    if (!this._isOpen) {
      throw new Error(`Storage [Id=${this.id}] is not open`);
    }
    return NativeApp.callNativeHost("storageRemoveAll", this.id);
  }

  /**
   * Closes storage and optionally delete it permanently
   * @param [deleteIt] if set a attempt is made to delete the storage from disk.
   */
  public async close(deleteIt: boolean = false): Promise<void> {
    if (!this._isOpen) {
      throw new Error(`Storage [Id=${this.id}] is not open`);
    }
    return NativeApp.closeStorage(this, deleteIt);
  }

  /**
   * Can be check to see if the storage is still open
   */
  public get isOpen(): boolean {
    return this._isOpen;
  }
}
