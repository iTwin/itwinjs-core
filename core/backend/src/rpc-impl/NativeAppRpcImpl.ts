/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module RpcInterface
 */

import {
  IModelRpcProps,
  NativeAppRpcInterface,
  InternetConnectivityStatus,
  OverriddenBy,
  QueuedEvent,
  RpcInterface,
  RpcManager,
  TileTreeContentIds,
  IModelVersion,
  IModelProps,
  BriefcaseRpcProps,
  StorageValue,
  IModelError,
  Events,
} from "@bentley/imodeljs-common";
import { EventSinkManager, EmitStrategy } from "../EventSink";
import { cancelTileContentRequests } from "./IModelTileRpcImpl";
import { NativeAppBackend } from "../NativeAppBackend";
import { Config, AuthorizedClientRequestContext, ProgressInfo } from "@bentley/imodeljs-clients";
import { Logger, LogLevel, ClientRequestContext, DbResult } from "@bentley/bentleyjs-core";
import { BriefcaseDb, OpenParams } from "../IModelDb";
import { BriefcaseManager, KeepBriefcase } from "../BriefcaseManager";
import { NativeAppStorage } from "../NativeAppStorage";

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

  /**
   * Fetches events from backend
   * @param tokenProps global or imodel base context for event queue
   * @param limit maximum number of event to return.
   * @returns list of queued event that is pending on backend.
   */
  public async fetchEvents(tokenProps: IModelRpcProps, limit: number): Promise<QueuedEvent[]> {
    let key: string = EventSinkManager.GLOBAL;
    if (tokenProps.key && tokenProps.key !== EventSinkManager.GLOBAL)
      key = tokenProps.key;

    return EventSinkManager.get(key).fetch(limit);
  }

  public async cancelTileContentRequests(tokenProps: IModelRpcProps, contentIds: TileTreeContentIds[]): Promise<void> {
    return cancelTileContentRequests(tokenProps, contentIds);
  }

  /**
   * Downloads briefcase and wait for it until its done
   * @param tokenProps context for imodel to download.
   * @returns briefcase id of the briefcase that is downloaded.
   * @note this api can be call only in connected mode where internet is available.
   */
  public async downloadBriefcase(tokenProps: IModelRpcProps): Promise<IModelRpcProps> {
    const requestContext = ClientRequestContext.current as AuthorizedClientRequestContext;

    await BriefcaseManager.initializeBriefcaseCacheFromDisk(requestContext);

    const openParams: OpenParams = OpenParams.pullOnly();
    const iModelVersion = IModelVersion.asOfChangeSet(tokenProps.changeSetId!);
    return BriefcaseDb.downloadBriefcase(requestContext, tokenProps.contextId!, tokenProps.iModelId!, openParams, iModelVersion);
  }

  /**
   * Starts downloading a briefcase
   * @param tokenProps context for imodel to download.
   * @returns briefcase id of the briefcase that is downloaded.
   * @note this api can be call only in connected mode where internet is available.
   */
  public async startDownloadBriefcase(tokenProps: IModelRpcProps, reportProgress: boolean): Promise<IModelRpcProps> {
    const requestContext = ClientRequestContext.current as AuthorizedClientRequestContext;

    await BriefcaseManager.initializeBriefcaseCacheFromDisk(requestContext);
    const openParams: OpenParams = OpenParams.pullOnly();
    if (reportProgress) {
      openParams.downloadProgress = (progress: ProgressInfo) => {
        EventSinkManager.global.emit(
          Events.NativeApp.namespace,
          Events.NativeApp.onBriefcaseDownloadProgress + "-" + tokenProps.iModelId,
          { progress }, { strategy: EmitStrategy.PurgeOlderEvents });
      };
    }
    const iModelVersion = IModelVersion.asOfChangeSet(tokenProps.changeSetId!);
    return BriefcaseDb.startDownloadBriefcase(requestContext, tokenProps.contextId!, tokenProps.iModelId!, openParams, iModelVersion);
  }

  /**
   * Finishes downloading a briefcase
   * @param tokenProps context for imodel to download.
   */
  public async finishDownloadBriefcase(tokenProps: IModelRpcProps): Promise<void> {
    const requestContext = ClientRequestContext.current as AuthorizedClientRequestContext;
    await BriefcaseDb.finishDownloadBriefcase(requestContext, tokenProps);
  }

  /**
   * Cancels downloading a briefcase
   * @param tokenProps context for imodel to download.
   */
  public async cancelDownloadBriefcase(tokenProps: IModelRpcProps): Promise<boolean> {
    const status = BriefcaseDb.cancelDownloadBriefcase(tokenProps);
    return status;
  }

  /**
   * Opens briefcase on the backend. The briefcase must be present or download before call this api.
   * @param tokenProps Context for imodel to open.
   * @returns briefcase id of briefcase.
   */
  public async openBriefcase(tokenProps: IModelRpcProps): Promise<IModelProps> {
    const requestContext = ClientRequestContext.current;

    await BriefcaseManager.initializeBriefcaseCacheFromDisk(requestContext);
    requestContext.enter();

    if (!tokenProps.key) {
      const allBriefcases = await BriefcaseManager.getBriefcasesFromDisk(requestContext);
      const briefcases = allBriefcases.filter((v) => {
        return v.changeSetId === tokenProps.changeSetId
          && v.iModelId === tokenProps.iModelId;
      });
      if (briefcases.length === 0) {
        throw new IModelError(DbResult.BE_SQLITE_ERROR_FileNotFound, "Briefcase not found with requested iModelId/changesetId/openMode");
      }

      Object.assign(tokenProps, { key: briefcases[0].key });
    }
    const db = await BriefcaseDb.openBriefcase(requestContext, tokenProps);
    requestContext.enter();
    return db.toJSON();
  }

  /**
   * Closes briefcase on the backend
   * @param tokenProps Identifies briefcase to be closed
   */
  public async closeBriefcase(tokenProps: IModelRpcProps): Promise<boolean> {
    const requestContext = ClientRequestContext.current;
    await BriefcaseDb.findByKey(tokenProps.key).closeBriefcase(requestContext, KeepBriefcase.Yes);
    return Promise.resolve(true);
  }

  /**
   * Deletes briefcase on the backend
   */
  public async deleteBriefcase(tokenProps: IModelRpcProps): Promise<void> {
    const requestContext = ClientRequestContext.current as AuthorizedClientRequestContext;
    await BriefcaseDb.deleteBriefcase(requestContext, tokenProps);
  }

  /**
   * Return list of briefcase available on disk
   * @returns briefcases
   * @note The ContextId in empty and should remain empty when pass to openBriefcase() call.
   */
  public async getBriefcases(): Promise<BriefcaseRpcProps[]> {
    const requestContext: ClientRequestContext = ClientRequestContext.current;
    await BriefcaseManager.initializeBriefcaseCacheFromDisk(requestContext);
    requestContext.enter();
    return BriefcaseManager.getBriefcasesFromDisk(requestContext);
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
}
