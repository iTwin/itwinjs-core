/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module RpcInterface
 */

import { ClientRequestContext, Config, IModelStatus, Logger, LogLevel } from "@bentley/bentleyjs-core";
import {
  BriefcaseKey, BriefcaseProps, DownloadBriefcaseOptions, Events, IModelConnectionProps, IModelError, IModelRpcProps, IModelVersion, InternetConnectivityStatus,
  MobileAuthorizationClientConfiguration, NativeAppRpcInterface, OpenBriefcaseOptions, OverriddenBy, RequestBriefcaseProps, RpcInterface, RpcManager,
  StorageValue,
  TileTreeContentIds,
} from "@bentley/imodeljs-common";
import { EmitStrategy, IModelJsNative } from "@bentley/imodeljs-native";
import { AuthorizedClientRequestContext, ProgressCallback, ProgressInfo } from "@bentley/itwin-client";
import { BackendLoggerCategory } from "../BackendLoggerCategory";
import { BriefcaseManager } from "../BriefcaseManager";
import { EventSink } from "../EventSink";
import { BriefcaseDb, IModelDb } from "../IModelDb";
import { NativeAppBackend } from "../NativeAppBackend";
import { NativeAppStorage } from "../NativeAppStorage";
import { cancelTileContentRequests } from "./IModelTileRpcImpl";
import { MobileDevice } from "../MobileDevice";

const loggerCategory = BackendLoggerCategory.IModelDb;

/** The backend implementation of NativeAppRpcInterface.
 * @internal
 */
export class NativeAppRpcImpl extends RpcInterface implements NativeAppRpcInterface {
  public static register() {
    RpcManager.registerImpl(NativeAppRpcInterface, NativeAppRpcImpl);
  }

  /**
   * Proxy logger that redirect logging from frontend to backend. Help with debugging issue
   * @param _timestamp unused but would be help ful to tell when event happened
   * @param level log level for the message
   * @param category category of the message
   * @param message message itself
   * @param [metaData] any addition meta data that needed to be logged.
   */
  public async log(_timestamp: number, level: LogLevel, category: string, message: string, metaData?: any) {
    Logger.logRaw(level, category, message, () => metaData);
  }

  /**
   * Checks internet connectivity
   * @returns internet connectivity value at backend.
   */
  public async checkInternetConnectivity(): Promise<InternetConnectivityStatus> {
    return NativeAppBackend.checkInternetConnectivity();
  }

  /**
   * Overrides internet connectivity
   * @param Specify who like to override the status
   * @param [status] online/offline status
   */
  public async overrideInternetConnectivity(by: OverriddenBy, status?: InternetConnectivityStatus): Promise<void> {
    NativeAppBackend.overrideInternetConnectivity(by, status);
  }

  /**
   * Return config object from backend
   * @returns config.
   */
  public async getConfig(): Promise<any> {
    return Config.App.getContainer();
  }

  public async cancelTileContentRequests(tokenProps: IModelRpcProps, contentIds: TileTreeContentIds[]): Promise<void> {
    return cancelTileContentRequests(tokenProps, contentIds);
  }

  public async cancelElementGraphicsRequests(rpcProps: IModelRpcProps, requestIds: string[]): Promise<void> {
    const iModel = IModelDb.findByKey(rpcProps.key);
    return iModel.nativeDb.cancelElementGraphicsRequests(requestIds);
  }

  /**
   * Request download of a briefcase. The call require internet connection and must have valid token.
   * @param requestProps Properties to download the briefcase
   * @param downloadOptions Options to affect the download of the briefcase
   * @param reportProgress Report progress to frontend
   * @returns BriefcaseProps The properties of the briefcase to be downloaded
   */
  public async requestDownloadBriefcase(requestProps: RequestBriefcaseProps, downloadOptions: DownloadBriefcaseOptions, reportProgress: boolean): Promise<BriefcaseProps> {
    const requestContext = ClientRequestContext.current as AuthorizedClientRequestContext;
    BriefcaseManager.initializeOffline();

    if (downloadOptions?.syncMode === undefined) {
      // NEEDS_WORK: This should never happen, but does seem to happen with the WebRpc that forces use of IModelRpcProps for some reason as the default -
      // needs a way to figure a way to force avoiding NativeAppRpcInterface use in these cases. Not a priority since this RPC interface is only registered
      // for native applications.
      throw new IModelError(IModelStatus.BadRequest, "SyncMode must be specified when requesting download");
    }

    const iModelVersion = IModelVersion.asOfChangeSet(requestProps.changeSetId);
    let downloadProgress: ProgressCallback | undefined;
    if (reportProgress) {
      downloadProgress = (progress: ProgressInfo) => {
        EventSink.global.emit(
          Events.NativeApp.namespace,
          `${Events.NativeApp.onBriefcaseDownloadProgress}-${requestProps.iModelId}`,
          { progress }, { strategy: EmitStrategy.PurgeOlderEvents });
      };
    }

    const { briefcaseProps } = await BriefcaseManager.requestDownload(requestContext, requestProps.contextId, requestProps.iModelId, downloadOptions, iModelVersion, downloadProgress);
    return briefcaseProps;
  }

  /**
   * Finishes download of a briefcase. The call require internet connection and must have valid token.
   * @param key Key to locate the briefcase in the disk cache
   */
  public async downloadRequestCompleted(key: BriefcaseKey): Promise<void> {
    const requestContext = ClientRequestContext.current as AuthorizedClientRequestContext;

    const briefcaseEntry = BriefcaseManager.findBriefcaseByKey(key);
    if (briefcaseEntry === undefined)
      throw new IModelError(IModelStatus.BadRequest, "Cannot finish download for a briefcase that not started to download", Logger.logError, loggerCategory, () => key);

    // Finish the download
    try {
      await briefcaseEntry.downloadPromise;
    } finally {
      requestContext.enter();
    }
  }

  /**
   * Cancels the previously requested download of a briefcase
   * @param key Key to locate the briefcase in the disk cache
   * @returns true if the cancel request was acknowledged. false otherwise
   */
  public async requestCancelDownloadBriefcase(key: BriefcaseKey): Promise<boolean> {
    const briefcaseEntry = BriefcaseManager.findBriefcaseByKey(key);
    if (briefcaseEntry === undefined)
      throw new IModelError(IModelStatus.BadRequest, "Cannot cancel download for a briefcase that not started to download", Logger.logError, loggerCategory, () => key);

    return briefcaseEntry.cancelDownloadRequest.cancel();
  }

  /**
   * Opens the briefcase on disk - this api can be called offline
   * @param key Key to locate the briefcase in the disk cache
   * @param openOptions Options to open the briefcase
   * @returns IModelRpcProps which allow to create IModelConnection.
   */
  public async openBriefcase(key: BriefcaseKey, openOptions?: OpenBriefcaseOptions): Promise<IModelConnectionProps> {
    const requestContext = ClientRequestContext.current;
    BriefcaseManager.initializeOffline();

    const db = await BriefcaseDb.open(requestContext, key, openOptions);
    requestContext.enter();
    return db.toJSON();
  }

  /**
   * Closes the briefcase on disk - this api can be called offline
   * @param key Key to locate the briefcase in the disk cache
   */
  public async closeBriefcase(key: BriefcaseKey): Promise<void> {
    const briefcaseDb = BriefcaseDb.findByKey(key);
    briefcaseDb.close();
  }

  /**
   * Deletes a previously downloaded briefcase. The briefcase must be closed.
   * @param key Key to locate the briefcase in the disk cache
   */
  public async deleteBriefcase(key: BriefcaseKey): Promise<void> {
    const requestContext = ClientRequestContext.current;
    await BriefcaseManager.delete(requestContext, key);
  }

  /**
   * Gets all briefcases that were previously requested to be downloaded, or were completely downloaded
   * @returns list of briefcases.
   */
  public async getBriefcases(): Promise<BriefcaseProps[]> {
    const requestContext: ClientRequestContext = ClientRequestContext.current;
    BriefcaseManager.initializeOffline();
    requestContext.enter();
    return BriefcaseManager.getBriefcases();
  }

  /**
   * Open or create a storage backed by a sqlite file
   * @param storageId should a valid file name without extension
   * @returns id of storage use by subsequent calls.
   */
  public async storageMgrOpen(storageId: string): Promise<string> {
    return NativeAppStorage.open(storageId).id;
  }

  /**
   * Close the storage and subsequent api cannot use it.
   * @param storageId  id of the storage
   * @param deleteIt optionally let you delete the underlying sqlite file.
   */
  public async storageMgrClose(storageId: string, deleteIt: boolean): Promise<void> {
    NativeAppStorage.find(storageId)?.close(deleteIt);
  }

  /**
   * List available storage on disk.
   * @returns list name that can be use to open a storage.
   */
  public async storageMgrNames(): Promise<string[]> {
    return NativeAppStorage.getStorageNames();
  }

  /**
   * Get a value from storage.
   * @param storageId id of the storage from which to return the value.
   * @param key a key can be any string large or small for which this function will return a value.
   * @returns value or undefined.
   */
  public async storageGet(storageId: string, key: string): Promise<StorageValue | undefined> {
    return NativeAppStorage.find(storageId)?.getData(key);
  }

  /**
   * Set a value in storage against a key.
   * @param storageId id of the storage that would hold the key/value pair.
   * @param key a string value that can be large or small.
   * @param value that would be written to db and persisted across sessions.
   */
  public async storageSet(storageId: string, key: string, value: StorageValue): Promise<void> {
    NativeAppStorage.find(storageId)?.setData(key, value);
  }

  /**
   * Remove a value from storage.
   * @param storageId id of the storage that would hold the key/value pair.
   * @param key a string value that can be large or small.
   */
  public async storageRemove(storageId: string, key: string): Promise<void> {
    NativeAppStorage.find(storageId)?.removeData(key);
  }

  /**
   * Return list of keys in storage.
   * @param storageId  id of the storage that would hold the key/value pairs.
   * @returns keys list of string.
   * @note this function could have performance issue if the number of keys are large or each key is a large string object.
   */
  public async storageKeys(storageId: string): Promise<string[]> {
    const storage = NativeAppStorage.find(storageId)!;
    return storage.getKeys();
  }

  /**
   * Storages remove all key and values.
   * @param storageId id of the storage that would hold the key/value pairs.
   */
  public async storageRemoveAll(storageId: string): Promise<void> {
    const storage = NativeAppStorage.find(storageId)!;
    storage.removeAll();
  }

  /**
   * Causing signIn on the backend
   */
  public async authSignIn(): Promise<void> {
    const requestContext = ClientRequestContext.current;
    return MobileDevice.currentDevice.signIn(requestContext);
  }

  /**
   * Causing signOut on the backend
   */
  public async authSignOut(): Promise<void> {
    const requestContext = ClientRequestContext.current;
    return MobileDevice.currentDevice.signOut(requestContext);
  }

  /**
   * Read access token and perform silent refresh as necessary
   */
  public async authGetAccessToken(): Promise<string> {
    const requestContext = ClientRequestContext.current;
    const accessToken = await MobileDevice.currentDevice.getAccessToken(requestContext);
    return JSON.stringify(accessToken);
  }

  /**
   * Initialize oidc client with configuration
   */
  public async authInitialize(issuer: string, config: MobileAuthorizationClientConfiguration): Promise<void> {
    const requestContext = ClientRequestContext.current;
    await MobileDevice.currentDevice.authInit(requestContext, {
      issuerUrl: issuer,
      clientId: config.clientId,
      redirectUrl: config.redirectUri,
      scope: config.scope,
    });
  }

  public async toggleInteractiveEditingSession(tokenProps: IModelRpcProps, startSession: boolean): Promise<boolean> {
    const imodel = IModelDb.findByKey(tokenProps.key);
    const val: IModelJsNative.ErrorStatusOrResult<any, boolean> = imodel.nativeDb.setGeometricModelTrackingEnabled(startSession);
    if (val.error)
      throw new IModelError(val.error.status, "Failed to toggle interactive editing session");

    return val.result!;
  }

  public async isInteractiveEditingSupported(tokenProps: IModelRpcProps): Promise<boolean> {
    const imodel = IModelDb.findByKey(tokenProps.key);
    return imodel.nativeDb.isGeometricModelTrackingSupported();
  }
}
