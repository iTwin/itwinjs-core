/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module NativeApp
 */

import { BeEvent, Config, GuidString, Logger, SessionProps } from "@bentley/bentleyjs-core";
import {
  BriefcaseDownloader, BriefcaseProps, IModelVersion, InternetConnectivityStatus, IpcSocketFrontend, LocalBriefcaseProps,
  NativeAppAuthorizationConfiguration, nativeAppChannel, NativeAppFunctions, NativeAppNotifications, nativeAppNotify, OverriddenBy,
  RequestNewBriefcaseProps, StorageValue, SyncMode,
} from "@bentley/imodeljs-common";
import { AccessToken, AccessTokenProps, ProgressCallback, RequestGlobalOptions } from "@bentley/itwin-client";
import { FrontendLoggerCategory } from "./FrontendLoggerCategory";
import { IModelApp } from "./imodeljs-frontend";
import { AsyncMethodsOf, IpcApp, IpcAppOptions, NotificationHandler, PromiseReturnType } from "./IpcApp";
import { NativeAppLogger } from "./NativeAppLogger";

/** Properties for specifying the Briefcaseid for downloading
 * @beta
 */
export type DownloadBriefcaseId =
  { syncMode?: SyncMode, briefcaseId?: never } |
  { briefcaseId: number, syncMode?: never };

/**
* Options to download a briefcase
* @beta
*/
export type DownloadBriefcaseOptions = DownloadBriefcaseId & { fileName?: string, progressInterval?: number };

/** NativeApp notifications from backend */
class NativeAppNotifyHandler extends NotificationHandler implements NativeAppNotifications {
  public get channelName() { return nativeAppNotify; }
  public notifyInternetConnectivityChanged(status: InternetConnectivityStatus) {
    Logger.logInfo(FrontendLoggerCategory.NativeApp, "Internet connectivity changed");
    NativeApp.onInternetConnectivityChanged.raiseEvent(status);
  }
  public notifyUserStateChanged(props?: AccessTokenProps) {
    IModelApp.authorizationClient?.onUserStateChanged.raiseEvent(props ? AccessToken.fromJson(props) : undefined);
  }
}

/**
 * Object to be set as `IModelApp.authorizationClient` for the frontend of NativeApps.
 * Since NativeApps use the backend for all authorization, this class sends signIn/signOut requests to the backend
 * and then listens for the `onUserStateChanged` event to cache the accessToken. The token is cached
 * here on the frontend because it is used for every RPC operation, even when we're running as a NativeApp.
 * We must therefore check for expiration and request refreshes as/when necessary.
 * @alpha
 */
export class NativeAppAuthorization {
  private _config: NativeAppAuthorizationConfiguration;
  private _cachedToken?: AccessToken;
  protected _expireSafety = 60 * 10; // seconds before real expiration time so token will be refreshed before it expires
  public readonly onUserStateChanged = new BeEvent<(token?: AccessToken) => void>();
  public get hasSignedIn() { return this._cachedToken !== undefined; }
  public get isAuthorized(): boolean { return this.hasSignedIn && !this._cachedToken!.isExpired(this._expireSafety); }

  public constructor(config: NativeAppAuthorizationConfiguration) {
    this._config = config;
    if (config.expiryBuffer)
      this._expireSafety = config.expiryBuffer;

    this.onUserStateChanged.addListener((token?: AccessToken) => {
      this._cachedToken = token;
    });
  }

  /** Used to initialize the the backend authorization. Must be awaited before any other methods are called */
  public async initialize(props: SessionProps): Promise<void> {
    return NativeApp.callNativeHost("initializeAuth", props, this._config);
  }

  /** Called to start the sign-in process. Subscribe to onUserStateChanged to be notified when sign-in completes */
  public async signIn(): Promise<void> {
    return NativeApp.callNativeHost("signIn");
  }

  /** Called to start the sign-out process. Subscribe to onUserStateChanged to be notified when sign-out completes */
  public async signOut(): Promise<void> {
    return NativeApp.callNativeHost("signOut");
  }

  /** Returns a promise that resolves to the AccessToken if signed in.
   * - The token is ensured to be valid *at least* for the buffer of time specified by the configuration.
   * - The token is refreshed if it's possible and necessary.
   * - This method must be called to refresh the token - the client does NOT automatically monitor for token expiry.
   * - Getting or refreshing the token will trigger the [[onUserStateChanged]] event.
   */
  public async getAccessToken(): Promise<AccessToken> {
    // if we have a valid token, return it. Otherwise call backend to refresh the token.
    if (!this.isAuthorized)
      this._cachedToken = AccessToken.fromJson(await NativeApp.callNativeHost("getAccessTokenProps"));

    return this._cachedToken!;
  }
}

/**
 * Options for [[NativeApp.startup]]
 * @alpha
 */
export interface NativeAppOpts extends IpcAppOptions {
  nativeApp?: {
    /** if present, [[IModelApp.authorizationClient]] will be set to an instance of NativeAppAuthorization and will be initialized. */
    authConfig?: NativeAppAuthorizationConfiguration;
  };
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
  public static async startup(ipc: IpcSocketFrontend, opts?: NativeAppOpts) {
    await IpcApp.startup(ipc, opts);
    if (this._isValid)
      return;
    this._isValid = true;

    NativeAppNotifyHandler.register(); // receives notifications from backend

    Config.App.merge(await this.callNativeHost("getConfig"));
    NativeApp.hookBrowserConnectivityEvents();

    if (opts?.nativeApp?.authConfig) {
      const auth = new NativeAppAuthorization(opts.nativeApp.authConfig);
      IModelApp.authorizationClient = auth;
      await auth.initialize({ applicationId: IModelApp.applicationId, applicationVersion: IModelApp.applicationVersion, sessionId: IModelApp.sessionId });
    }

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

    let stopProgressEvents = () => { };
    if (progress !== undefined) {
      stopProgressEvents = IpcApp.addListener(`nativeApp.progress-${iModelId}`, (_evt: Event, data: { loaded: number, total: number }) => {
        progress(data);
      });
    }

    const briefcaseId = (undefined !== downloadOptions.briefcaseId) ? downloadOptions.briefcaseId :
      (downloadOptions.syncMode === SyncMode.PullOnly ? 0 : await this.callNativeHost("acquireNewBriefcaseId", iModelId));

    const fileName = downloadOptions.fileName ?? await this.getBriefcaseFileName({ briefcaseId, iModelId });
    const requestProps: RequestNewBriefcaseProps = { iModelId, briefcaseId, contextId, asOf: asOf.toJSON(), fileName };

    const doDownload = async (): Promise<void> => {
      try {
        await this.callNativeHost("downloadBriefcase", requestProps, progress !== undefined, downloadOptions.progressInterval);
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
