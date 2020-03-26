/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module RpcInterface
 */

import {
  IModelTokenProps,
  NativeAppRpcInterface,
  InternetConnectivityStatus,
  OverriddenBy,
  QueuedEvent,
  RpcInterface,
  RpcManager,
  TileTreeContentIds,
  IModelToken,
  IModelVersion,
  IModelProps,
  BriefcaseProps,
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
  public async fetchEvents(tokenProps: IModelTokenProps, limit: number): Promise<QueuedEvent[]> {
    let key: string = EventSinkManager.GLOBAL;
    if (tokenProps.key && tokenProps.key !== EventSinkManager.GLOBAL)
      key = tokenProps.key;

    return EventSinkManager.get(key).fetch(limit);
  }

  public async cancelTileContentRequests(tokenProps: IModelTokenProps, contentIds: TileTreeContentIds[]): Promise<void> {
    return cancelTileContentRequests(tokenProps, contentIds);
  }

  /**
   * Downloads briefcase and wait for it until its done
   * @param tokenProps context for imodel to download.
   * @returns briefcase id of the briefcase that is downloaded.
   * @note this api can be call only in connected mode where internet is available.
   */
  public async downloadBriefcase(tokenProps: IModelTokenProps): Promise<IModelTokenProps> {
    const requestContext = ClientRequestContext.current as AuthorizedClientRequestContext;

    BriefcaseManager.initializeBriefcaseCacheFromDisk();

    const iModelToken = IModelToken.fromJSON(tokenProps);
    const openParams: OpenParams = OpenParams.pullOnly();
    const iModelVersion = IModelVersion.asOfChangeSet(iModelToken.changeSetId!);
    const db = await BriefcaseDb.downloadBriefcase(requestContext, iModelToken.contextId!, iModelToken.iModelId!, openParams, iModelVersion);
    return db.toJSON();
  }

  /**
   * Starts downloading a briefcase
   * @param tokenProps context for imodel to download.
   * @returns briefcase id of the briefcase that is downloaded.
   * @note this api can be call only in connected mode where internet is available.
   */
  public async startDownloadBriefcase(tokenProps: IModelTokenProps, reportProgress: boolean): Promise<IModelTokenProps> {
    const requestContext = ClientRequestContext.current as AuthorizedClientRequestContext;

    BriefcaseManager.initializeBriefcaseCacheFromDisk();
    const iModelToken = IModelToken.fromJSON(tokenProps);
    const openParams: OpenParams = OpenParams.pullOnly();
    if (reportProgress) {
      openParams.downloadProgress = (progress: ProgressInfo) => {
        EventSinkManager.global.emit(
          Events.NativeApp.namespace,
          Events.NativeApp.onBriefcaseDownloadProgress + "-" + tokenProps.iModelId,
          { progress }, { strategy: EmitStrategy.PurgeOlderEvents });
      };
    }
    const iModelVersion = IModelVersion.asOfChangeSet(iModelToken.changeSetId!);
    const db = await BriefcaseDb.startDownloadBriefcase(requestContext, iModelToken.contextId!, iModelToken.iModelId!, openParams, iModelVersion);
    return db.toJSON();
  }

  /**
   * Finishes downloading a briefcase
   * @param tokenProps context for imodel to download.
   */
  public async finishDownloadBriefcase(tokenProps: IModelTokenProps): Promise<void> {
    const requestContext = ClientRequestContext.current as AuthorizedClientRequestContext;
    const iModelToken = IModelToken.fromJSON(tokenProps);
    await BriefcaseDb.finishDownloadBriefcase(requestContext, iModelToken);
  }

  /**
   * Cancels downloading a briefcase
   * @param tokenProps context for imodel to download.
   */
  public async cancelDownloadBriefcase(tokenProps: IModelTokenProps): Promise<boolean> {
    const iModelToken = IModelToken.fromJSON(tokenProps);
    const status = BriefcaseDb.cancelDownloadBriefcase(iModelToken);
    return status;
  }

  /**
   * Opens briefcase on the backend. The briefcase must be present or download before call this api.
   * @param tokenProps Context for imodel to open.
   * @returns briefcase id of briefcase.
   */
  public async openBriefcase(tokenProps: IModelTokenProps): Promise<IModelProps> {
    const requestContext = ClientRequestContext.current;

    BriefcaseManager.initializeBriefcaseCacheFromDisk();

    const iModelToken = IModelToken.fromJSON(tokenProps);
    if (!tokenProps.key) {
      const allBriefcases = await BriefcaseManager.getBriefcasesFromDisk();
      const briefcases = allBriefcases.filter((v) => {
        return v.changeSetId === iModelToken.changeSetId
          && v.iModelId === iModelToken.iModelId;
      });
      if (briefcases.length === 0) {
        throw new IModelError(DbResult.BE_SQLITE_ERROR_FileNotFound, "Briefcase not found with requested iModelId/changesetId/openMode");
      }

      Object.assign(iModelToken, { key: briefcases[0].key });
    }
    const db = await BriefcaseDb.openBriefcase(requestContext, iModelToken);
    return db.toJSON();
  }

  /**
   * Closes briefcase on the backend
   * @param tokenProps Identifies briefcase to be closed
   */
  public async closeBriefcase(tokenProps: IModelTokenProps): Promise<boolean> {
    const requestContext = ClientRequestContext.current as AuthorizedClientRequestContext;
    await BriefcaseDb.findByKey(tokenProps.key).close(requestContext, KeepBriefcase.Yes);
    return Promise.resolve(true);
  }

  /**
   * Deletes briefcase on the backend
   */
  public async deleteBriefcase(tokenProps: IModelTokenProps): Promise<void> {
    const requestContext = ClientRequestContext.current as AuthorizedClientRequestContext;
    const iModelToken = IModelToken.fromJSON(tokenProps);
    await BriefcaseDb.deleteBriefcase(requestContext, iModelToken);
  }

  /**
   * Return list of briefcase available on disk
   * @returns briefcases
   * @note The ContextId in empty and should remain empty when pass to openBriefcase() call.
   */
  public async getBriefcases(): Promise<BriefcaseProps[]> {
    BriefcaseManager.initializeBriefcaseCacheFromDisk();
    return BriefcaseManager.getBriefcasesFromDisk();
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
