/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @module NativeApp */
import { BeEvent, BentleyStatus, IModelStatus, OpenMode } from "@bentley/bentleyjs-core";
import { AuthorizedClientRequestContext, Config, ProgressCallback, ProgressInfo, RequestGlobalOptions } from "@bentley/imodeljs-clients";
import { BriefcaseProps, Events, IModelError, IModelToken, IModelTokenProps, IModelVersion, InternetConnectivityStatus, NativeAppRpcInterface, OverriddenBy, RpcRegistry, StorageValue } from "@bentley/imodeljs-common";
import { EventSourceManager } from "./EventSource";
import { IModelApp, IModelAppOptions } from "./IModelApp";
import { BriefcaseConnection } from "./IModelConnection";
import { NativeAppLogger } from "./NativeAppLogger";
/**
 * Return by startDownloadBriefcase() and can be use with finishDownloadBriefcase() or cancelDownloadBriefcase().
 * @internal
 */
export class DownloadBriefcaseToken {
  constructor(public iModelToken: IModelToken, public stopProgressEvents: () => void) {
  }
}
/**
 * This should be called instead of IModelApp.startup() for native apps.
 * @internal
 */
export class NativeApp {
  private static _storages = new Map<string, Storage>();
  private static _onOnline = async () => {
    await NativeApp.setConnectivity(OverriddenBy.Browser, InternetConnectivityStatus.Online);
  }
  private static _onOffline = async () => {
    await NativeApp.setConnectivity(OverriddenBy.Browser, InternetConnectivityStatus.Offline);
  }
  private static async setConnectivity(by: OverriddenBy, status: InternetConnectivityStatus) {
    RequestGlobalOptions.online = (status === InternetConnectivityStatus.Online);
    await NativeAppRpcInterface.getClient().overrideInternetConnectivity(by, status);
  }
  private constructor() {
    EventSourceManager.global.on(Events.NativeApp.namespace, Events.NativeApp.onMemoryWarning, () => { NativeApp.onMemoryWarning.raiseEvent(); });
    EventSourceManager.global.on(Events.NativeApp.namespace, Events.NativeApp.onInternetConnectivityChanged, (args: any) => { NativeApp.onInternetConnectivityChanged.raiseEvent(args.status); });
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
  public static onInternetConnectivityChanged: BeEvent<(status: InternetConnectivityStatus) => void> = new BeEvent<(status: InternetConnectivityStatus) => void>();
  public static onMemoryWarning: BeEvent<() => void> = new BeEvent<() => void>();
  public static async checkInternetConnectivity(): Promise<InternetConnectivityStatus> {
    return NativeAppRpcInterface.getClient().checkInternetConnectivity();
  }
  public static async overrideInternetConnectivity(status: InternetConnectivityStatus): Promise<void> {
    return NativeApp.setConnectivity(OverriddenBy.User, status);
  }
  public static async startup(opts?: IModelAppOptions) {
    if (!RpcRegistry.instance.isRpcInterfaceInitialized(NativeAppRpcInterface)) {
      throw new IModelError(IModelStatus.BadArg, "NativeAppRpcInterface must be registered");
    }
    IModelApp.startup(opts);
    (IModelApp as any)._nativeApp = true;
    const backendConfig = await NativeAppRpcInterface.getClient().getConfig();
    Config.App.merge(backendConfig);
    NativeApp.hookBrowserConnectivityEvents();
    // initialize current state.
    if (typeof window === "object" && typeof window.navigator === "object" && window.navigator.onLine) {
      RequestGlobalOptions.online = window.navigator.onLine;
      await NativeApp.setConnectivity(OverriddenBy.Browser, window.navigator.onLine ? InternetConnectivityStatus.Online : InternetConnectivityStatus.Offline);
    }
  }

  public static async shutdown() {
    NativeApp.unhookBrowserConnectivityEvents();
    await NativeAppLogger.flush();
    IModelApp.shutdown();
  }

  public static async downloadBriefcase(requestContext: AuthorizedClientRequestContext, contextId: string, iModelId: string, version: IModelVersion = IModelVersion.latest()): Promise<IModelTokenProps> {
    requestContext.enter();

    // openMode: OpenMode = OpenMode.Readonly
    if (!IModelApp.initialized)
      throw new IModelError(BentleyStatus.ERROR, "Call NativeApp.startup() before calling downloadBriefcase");

    const changeSetId: string = await version.evaluateChangeSet(requestContext, iModelId, IModelApp.iModelClient);
    requestContext.enter();

    const iModelToken = new IModelToken(undefined, contextId, iModelId, changeSetId);
    requestContext.useContextForRpc = true;
    const retIModelToken = await NativeAppRpcInterface.getClient().downloadBriefcase(iModelToken.toJSON());
    return retIModelToken;
  }

  public static async startDownloadBriefcase(requestContext: AuthorizedClientRequestContext, contextId: string, iModelId: string, version: IModelVersion = IModelVersion.latest(), progress?: ProgressCallback): Promise<DownloadBriefcaseToken> {
    requestContext.enter();
    if (!IModelApp.initialized)
      throw new IModelError(BentleyStatus.ERROR, "Call NativeApp.startup() before calling startDownloadBriefcase");

    const changeSetId: string = await version.evaluateChangeSet(requestContext, iModelId, IModelApp.iModelClient);
    requestContext.enter();

    const iModelToken = new IModelToken(undefined, contextId, iModelId, changeSetId);
    requestContext.useContextForRpc = true;
    let stopProgressEvents = () => { };
    const reportProgress = typeof progress !== undefined;
    if (reportProgress) {
      stopProgressEvents = EventSourceManager.global.on(
        Events.NativeApp.namespace,
        Events.NativeApp.onBriefcaseDownloadProgress + "-" + iModelId, (data: any) => {
          progress!(data.progress as ProgressInfo);
        }).off;
    }
    const iModelTokenProps = await NativeAppRpcInterface.getClient().startDownloadBriefcase(iModelToken.toJSON(), reportProgress);
    return new DownloadBriefcaseToken(IModelToken.fromJSON(iModelTokenProps), stopProgressEvents);
  }
  public static async finishDownloadBriefcase(requestContext: AuthorizedClientRequestContext, downloadBriefcaseToken: DownloadBriefcaseToken): Promise<void> {
    requestContext.enter();
    if (!IModelApp.initialized)
      throw new IModelError(BentleyStatus.ERROR, "Call NativeApp.startDownloadBriefcase first");
    try {
      requestContext.useContextForRpc = true;
      await NativeAppRpcInterface.getClient().finishDownloadBriefcase(downloadBriefcaseToken.iModelToken.toJSON());
    } finally {
      downloadBriefcaseToken.stopProgressEvents();
    }
  }

  public static async cancelDownloadBriefcase(requestContext: AuthorizedClientRequestContext, downloadBriefcaseToken: DownloadBriefcaseToken): Promise<boolean> {
    requestContext.enter();
    if (!IModelApp.initialized)
      throw new IModelError(BentleyStatus.ERROR, "Call NativeApp.startDownloadBriefcase first");
    try {
      requestContext.useContextForRpc = true;
      return await NativeAppRpcInterface.getClient().cancelDownloadBriefcase(downloadBriefcaseToken.iModelToken.toJSON());
    } finally {
      downloadBriefcaseToken.stopProgressEvents();
    }
  }

  public static async deleteBriefcase(requestContext: AuthorizedClientRequestContext, iModelToken: IModelTokenProps): Promise<void> {
    requestContext.enter();
    if (!IModelApp.initialized)
      throw new IModelError(BentleyStatus.ERROR, "Call NativeApp.startDownloadBriefcase first");
    requestContext.useContextForRpc = true;
    await NativeAppRpcInterface.getClient().deleteBriefcase(iModelToken);
  }

  public static async openBriefcase(requestContext: AuthorizedClientRequestContext, iModelToken: IModelTokenProps): Promise<BriefcaseConnection> {
    requestContext.enter();
    if (!IModelApp.initialized)
      throw new IModelError(BentleyStatus.ERROR, "Call NativeApp.startup() before calling downloadBriefcase");
    const token = await NativeAppRpcInterface.getClient().openBriefcase(iModelToken);
    requestContext.useContextForRpc = true;
    return BriefcaseConnection.createForNativeAppBriefcase(token, OpenMode.ReadWrite);
  }

  /**
   * Gets briefcases
   * @returns list of BriefcaseProps in cache
   */
  public static async getBriefcases(): Promise<BriefcaseProps[]> {
    if (!IModelApp.initialized)
      throw new IModelError(BentleyStatus.ERROR, "Call NativeApp.startup() before calling downloadBriefcase");

    return NativeAppRpcInterface.getClient().getBriefcases();
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
    const storage = new Storage(await NativeAppRpcInterface.getClient().storageMgrOpen(name));
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
    await NativeAppRpcInterface.getClient().storageMgrClose(storage.id, deleteId);
    (storage as any)._isOpen = false;
    this._storages.delete(storage.id);
  }

  /**
   * Gets storage names
   * @returns return list of storage available on disk.
   */
  public static async getStorageNames(): Promise<string[]> {
    return NativeAppRpcInterface.getClient().storageMgrNames();
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
    return NativeAppRpcInterface.getClient().storageGet(this.id, key);
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
    return NativeAppRpcInterface.getClient().storageSet(this.id, key, value);
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
    return NativeAppRpcInterface.getClient().storageKeys(this.id);
  }

  /**
   * Remove all keys
   * @note Delete all keys and data.
   */
  public async removeAll(): Promise<void> {
    if (!this._isOpen) {
      throw new Error(`Storage [Id=${this.id}] is not open`);
    }
    return NativeAppRpcInterface.getClient().storageRemoveAll(this.id);
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
