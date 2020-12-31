/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module NativeApp
 */

import { BeEvent, Config, GuidString, IModelStatus, Logger } from "@bentley/bentleyjs-core";
import {
  BriefcaseDownloader, BriefcaseProps, Events, IModelError, IModelVersion, InternetConnectivityStatus, LocalBriefcaseProps, nativeAppChannel,
  NativeAppIpc, nativeAppIpcVersion, OpenBriefcaseProps, OverriddenBy, RequestNewBriefcaseProps, RpcRegistry, StorageValue, SyncMode,
} from "@bentley/imodeljs-common";
import { ProgressCallback, ProgressInfo, RequestGlobalOptions } from "@bentley/itwin-client";
import { EventSource } from "./EventSource";
import { FrontendIpc } from "./FrontendIpc";
import { FrontendLoggerCategory } from "./FrontendLoggerCategory";
import { AuthorizedFrontendRequestContext, FrontendRequestContext } from "./FrontendRequestContext";
import { IModelApp, IModelAppOptions } from "./IModelApp";
import { LocalBriefcaseConnection } from "./IModelConnection";
import { NativeAppLogger } from "./NativeAppLogger";

/**
 * Options to download a briefcase
 * @internal
 */
export interface DownloadBriefcaseOptions {
  /** This setting defines the operations allowed when synchronizing changes between the briefcase and iModelHub */
  syncMode: SyncMode;
  fileName?: string;
}

/**
 * @internal
 */
export class NativeApp {
  public static backendCall<T extends keyof NativeAppIpc>(name: T, ...args: Parameters<NativeAppIpc[T]>): ReturnType<NativeAppIpc[T]> {
    return FrontendIpc.backendCall(nativeAppChannel, name, ...args) as ReturnType<NativeAppIpc[T]>;
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
    await this.backendCall("overrideInternetConnectivity", by, status);
  }
  private constructor() { }
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
  public static onMemoryWarning = new BeEvent<() => void>();
  public static async checkInternetConnectivity(): Promise<InternetConnectivityStatus> {
    return this.backendCall("checkInternetConnectivity");
  }
  public static async overrideInternetConnectivity(status: InternetConnectivityStatus): Promise<void> {
    return this.backendCall("overrideInternetConnectivity", OverriddenBy.User, status);
  }
  private static _isValid = false;
  public static get isValid(): boolean { return this._isValid; }

  /**
   * This should be called instead of IModelApp.startup() for native apps.
   */
  public static async startup(opts?: IModelAppOptions) {
    Logger.logInfo(FrontendLoggerCategory.NativeApp, "Startup");
    const ipcVersion = await NativeApp.backendCall("getVersion");
    if (ipcVersion !== nativeAppIpcVersion) {
      throw new IModelError(IModelStatus.BadArg, `NativeAppIpc version wrong: backend(${ipcVersion}) vs. frontend(${nativeAppIpcVersion})`);
    }
    await IModelApp.startup(opts);
    const backendConfig = await this.backendCall("getConfig");
    Config.App.merge(backendConfig);
    NativeApp.hookBrowserConnectivityEvents();
    // initialize current state.
    if (typeof window === "object" && typeof window.navigator === "object" && window.navigator.onLine) {
      RequestGlobalOptions.online = window.navigator.onLine;
      await NativeApp.setConnectivity(OverriddenBy.Browser, window.navigator.onLine ? InternetConnectivityStatus.Online : InternetConnectivityStatus.Offline);
    }
    EventSource.global.on(Events.NativeApp.namespace, Events.NativeApp.onMemoryWarning, () => {
      Logger.logWarning(FrontendLoggerCategory.NativeApp, "Low memory warning");
      if (NativeApp.onMemoryWarning.numberOfListeners === 0) {
        alert("Low memory warning");
      }
      NativeApp.onMemoryWarning.raiseEvent();
    });
    EventSource.global.on(Events.NativeApp.namespace, Events.NativeApp.onInternetConnectivityChanged, (args: any) => {
      Logger.logInfo(FrontendLoggerCategory.NativeApp, "Internet connectivity changed");
      NativeApp.onInternetConnectivityChanged.raiseEvent(args.status);
    });
    this._isValid = true;
  }

  public static async shutdown() {
    NativeApp.unhookBrowserConnectivityEvents();
    await NativeAppLogger.flush();
    await IModelApp.shutdown();
    this._isValid = false;
  }

  public static async requestDownloadBriefcase(contextId: string, iModelId: string, downloadOptions: DownloadBriefcaseOptions,
    asOf: IModelVersion = IModelVersion.latest(), progress?: ProgressCallback): Promise<BriefcaseDownloader> {
    if (!IModelApp.initialized)
      throw new IModelError(IModelStatus.BadRequest, "Call NativeApp.startup() before calling requestDownloadBriefcase");

    const requestContext = await AuthorizedFrontendRequestContext.create();
    requestContext.enter();

    let stopProgressEvents = () => { };
    const reportProgress = progress !== undefined;
    if (reportProgress) {
      stopProgressEvents = EventSource.global.on(
        Events.NativeApp.namespace,
        `${Events.NativeApp.onBriefcaseDownloadProgress}-${iModelId}`, (data: any) => {
          progress!(data.progress as ProgressInfo);
        });
    }

    const briefcaseId = downloadOptions.syncMode === SyncMode.PullOnly ? 0 : await this.backendCall("acquireNewBriefcaseId", iModelId);
    requestContext.enter();

    const fileName = downloadOptions.fileName ?? await this.backendCall("getBriefcaseFileName", { briefcaseId, iModelId });
    requestContext.enter();

    const requestProps: RequestNewBriefcaseProps = { iModelId, briefcaseId, contextId, asOf: asOf.toJSON(), fileName };

    const doDownload = async (): Promise<void> => {
      const locRequestContext = new FrontendRequestContext();
      locRequestContext.enter();
      try {
        locRequestContext.useContextForRpc = true;
        await this.backendCall("downloadBriefcase", requestProps, reportProgress);
      } finally {
        stopProgressEvents();
      }
    };

    const requestCancel = async (): Promise<boolean> => {
      const locRequestContext = new FrontendRequestContext();
      locRequestContext.enter();
      let status = false;
      status = await this.backendCall("requestCancelDownloadBriefcase", fileName);
      if (status) {
        stopProgressEvents();
      }
      return status;
    };

    return { briefcaseId, fileName, downloadPromise: doDownload(), requestCancel };
  }

  public static async getBriefcaseFileName(props: BriefcaseProps): Promise<string> {
    return this.backendCall("getBriefcaseFileName", props);
  }

  /** Delete an existing briefcase
   * @param fileName the briefcase fileName
   */
  public static async deleteBriefcase(fileName: string): Promise<void> {
    if (!IModelApp.initialized)
      throw new IModelError(IModelStatus.BadRequest, "Call NativeApp.requestDownloadBriefcase first");

    const requestContext = new FrontendRequestContext();
    requestContext.enter();
    requestContext.useContextForRpc = true;
    await this.backendCall("deleteBriefcaseFiles", fileName);
  }

  public static async openBriefcase(briefcaseProps: OpenBriefcaseProps): Promise<LocalBriefcaseConnection> {
    const requestContext = new FrontendRequestContext();
    requestContext.enter();
    if (!IModelApp.initialized)
      throw new IModelError(IModelStatus.BadRequest, "Call NativeApp.startup() before calling openBriefcase");
    return LocalBriefcaseConnection.open(briefcaseProps);
  }

  public static async closeBriefcase(connection: LocalBriefcaseConnection): Promise<void> {
    const requestContext = new FrontendRequestContext();
    requestContext.enter();
    if (!IModelApp.initialized)
      throw new IModelError(IModelStatus.BadRequest, "Call NativeApp.startup() before calling downloadBriefcase");
    requestContext.useContextForRpc = true;
    await this.backendCall("closeBriefcase", connection.key);
  }

  /**
   * Gets briefcases
   * @returns list of BriefcaseProps in cache
   */
  public static async getCachedBriefcases(iModelId?: GuidString): Promise<LocalBriefcaseProps[]> {
    if (!IModelApp.initialized)
      throw new IModelError(IModelStatus.BadRequest, "Call NativeApp.startup() before calling downloadBriefcase");

    return this.backendCall("getCachedBriefcases", iModelId);
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
    const storage = new Storage(await this.backendCall("storageMgrOpen", name));
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
    await this.backendCall("storageMgrClose", storage.id, deleteId);
    (storage as any)._isOpen = false;
    this._storages.delete(storage.id);
  }

  /**
   * Gets storage names
   * @returns return list of storage available on disk.
   */
  public static async getStorageNames(): Promise<string[]> {
    return NativeApp.backendCall("storageMgrNames");
  }
}

/**
 * Storage allow [[NativeApp]] to data to disk. This data is considered cached and therefore its not ensured to exist permanently
 * @internal
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
    return NativeApp.backendCall("storageGet", this.id, key);
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
    return NativeApp.backendCall("storageSet", this.id, key, value);
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
    return NativeApp.backendCall("storageKeys", this.id);
  }

  /**
   * Remove all keys
   * @note Delete all keys and data.
   */
  public async removeData(key: string): Promise<void> {
    if (!this._isOpen) {
      throw new Error(`Storage [Id=${this.id}] is not open`);
    }
    return NativeApp.backendCall("storageRemove", this.id, key);
  }

  /**
   * Remove all keys
   * @note Delete all keys and data.
   */
  public async removeAll(): Promise<void> {
    if (!this._isOpen) {
      throw new Error(`Storage [Id=${this.id}] is not open`);
    }
    return NativeApp.backendCall("storageRemoveAll", this.id);
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
   * Can be check to see if the storage is still open on frontend
   */
  public get isOpen(): boolean {
    return this._isOpen;
  }
}
