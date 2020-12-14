/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module RpcInterface
 */

import { ClientRequestContext, Config, GuidString, Logger, LogLevel } from "@bentley/bentleyjs-core";
import {
  BriefcaseProps, Events, IModelConnectionProps, IModelError, IModelRpcProps, InternetConnectivityStatus,
  LocalBriefcaseProps,
  MobileAuthorizationClientConfiguration, NativeAppRpcInterface, OpenBriefcaseProps, OverriddenBy, RequestNewBriefcaseProps,
  RpcInterface, RpcManager, StorageValue, TileTreeContentIds,
} from "@bentley/imodeljs-common";
import { EmitStrategy, IModelJsNative } from "@bentley/imodeljs-native";
import { AuthorizedClientRequestContext } from "@bentley/itwin-client";
import { BriefcaseManager } from "../BriefcaseManager";
import { Downloads } from "../CheckpointManager";
import { EventSink } from "../EventSink";
import { BriefcaseDb, IModelDb } from "../IModelDb";
import { MobileDevice } from "../MobileDevice";
import { NativeAppBackend } from "../NativeAppBackend";
import { NativeAppStorage } from "../NativeAppStorage";
import { cancelTileContentRequests } from "./IModelTileRpcImpl";

/** The backend implementation of NativeAppRpcInterface.
 * @internal
 */
export class NativeAppRpcImpl extends RpcInterface implements NativeAppRpcInterface {
  public static register() {
    RpcManager.registerImpl(NativeAppRpcInterface, NativeAppRpcImpl);
  }

  public async log(_timestamp: number, level: LogLevel, category: string, message: string, metaData?: any) {
    Logger.logRaw(level, category, message, () => metaData);
  }

  public async checkInternetConnectivity(): Promise<InternetConnectivityStatus> {
    return NativeAppBackend.checkInternetConnectivity();
  }

  public async overrideInternetConnectivity(by: OverriddenBy, status?: InternetConnectivityStatus): Promise<void> {
    NativeAppBackend.overrideInternetConnectivity(by, status);
  }

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

  public async acquireNewBriefcaseId(iModelId: GuidString): Promise<number> {
    const requestContext = ClientRequestContext.current as AuthorizedClientRequestContext;
    return BriefcaseManager.acquireNewBriefcaseId(requestContext, iModelId);
  }

  public async getBriefcaseFileName(props: BriefcaseProps): Promise<string> {
    return BriefcaseManager.getFileName(props);
  }

  public async downloadBriefcase(request: RequestNewBriefcaseProps, reportProgress: boolean): Promise<void> {
    const requestContext = ClientRequestContext.current as AuthorizedClientRequestContext;

    const args = {
      ...request,
      abort: 0,
      onProgress: (_a: number, _b: number) => args.abort,
    };

    if (reportProgress) {
      args.onProgress = (loaded, total) => {
        EventSink.global.emit(
          Events.NativeApp.namespace,
          `${Events.NativeApp.onBriefcaseDownloadProgress}-${request.iModelId}`,
          { loaded, total }, { strategy: EmitStrategy.PurgeOlderEvents });
        return args.abort;
      };
    }

    return BriefcaseManager.downloadBriefcase(requestContext, args);
  }

  public async requestCancelDownloadBriefcase(fileName: string): Promise<boolean> {
    const job = Downloads.isInProgress(fileName);
    if (job)
      (job.request as any).abort = 1;
    return job !== undefined;
  }

  public async open(args: OpenBriefcaseProps): Promise<IModelConnectionProps> {
    const requestContext = ClientRequestContext.current;
    const db = await BriefcaseDb.open(requestContext, args);
    requestContext.enter();
    return db.toJSON();
  }

  /**
   * Closes the briefcase on disk - this api can be called offline
   * @param key Key returned by BriefcaseDb.open
   * @throws IModelNotFoundResponse if the BriefcaseDb is not open
   */
  public async closeBriefcase(key: string): Promise<void> {
    BriefcaseDb.findByKey(key).close();
  }

  /**
   * Deletes a local briefcase and all associated files, releasing the BriefcaseId from iModelHub. The briefcase must be closed.
   * @param fileName - the local filename of the briefcase.
   */
  public async deleteBriefcaseFiles(fileName: string): Promise<void> {
    await BriefcaseManager.deleteBriefcaseFiles(ClientRequestContext.current, fileName);
  }

  /**
   * Gets all briefcases that were previously be downloaded
   * @returns list of briefcases.
   */
  public async getBriefcases(): Promise<LocalBriefcaseProps[]> {
    const requestContext: ClientRequestContext = ClientRequestContext.current;
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
