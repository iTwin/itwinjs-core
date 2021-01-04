/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module IpcSocket
 */

import { ClientRequestContext, Config, GuidString, Logger, LogLevel } from "@bentley/bentleyjs-core";
import {
  BriefcaseProps, IModelConnectionProps, IModelError, IModelRpcProps, InternetConnectivityStatus, LocalBriefcaseProps,
  MobileAuthorizationClientConfiguration, nativeAppChannel, NativeAppIpc, nativeAppIpcVersion, OpenBriefcaseProps, OverriddenBy,
  RequestNewBriefcaseProps, StorageValue, TileTreeContentIds,
} from "@bentley/imodeljs-common";
import { IModelJsNative } from "@bentley/imodeljs-native";
import { AuthorizedClientRequestContext } from "@bentley/itwin-client";
import { BriefcaseManager } from "../BriefcaseManager";
import { Downloads } from "../CheckpointManager";
import { BriefcaseDb, IModelDb } from "../IModelDb";
import { MobileDevice } from "../MobileDevice";
import { NativeAppBackend } from "../NativeAppBackend";
import { NativeAppStorage } from "../NativeAppStorage";
import { cancelTileContentRequests } from "../rpc-impl/IModelTileRpcImpl";
import { BackendIpc, IpcHandler } from "./BackendIpc";

export class NativeAppImpl extends IpcHandler implements NativeAppIpc {

  public get channelName() { return nativeAppChannel; }
  public async getVersion() { return nativeAppIpcVersion; }
  public async log(_timestamp: number, level: LogLevel, category: string, message: string, metaData?: any): Promise<void> {
    Logger.logRaw(level, category, message, () => metaData);
  }
  public async checkInternetConnectivity(): Promise<InternetConnectivityStatus> {
    return NativeAppBackend.checkInternetConnectivity();
  }
  public async overrideInternetConnectivity(by: OverriddenBy, status: InternetConnectivityStatus): Promise<void> {
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

  public async downloadBriefcase(request: RequestNewBriefcaseProps, reportProgress: boolean): Promise<LocalBriefcaseProps> {
    const requestContext = ClientRequestContext.current as AuthorizedClientRequestContext;

    const args = {
      ...request,
      onProgress: (_a: number, _b: number) => checkAbort(),
    };

    if (reportProgress) {
      args.onProgress = (loaded, total) => {
        BackendIpc.sendMessage(`nativeApp.progress-${request.iModelId}`, { loaded, total });
        return checkAbort();
      };
    }

    const downloadPromise = BriefcaseManager.downloadBriefcase(requestContext, args);
    const checkAbort = () => {
      const job = Downloads.isInProgress(args.fileName!);
      return (job && (job.request as any).abort === 1) ? 1 : 0;
    };
    return downloadPromise;
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

  public async closeBriefcase(key: string): Promise<void> {
    BriefcaseDb.findByKey(key).close();
  }

  public async deleteBriefcaseFiles(fileName: string): Promise<void> {
    const context = ClientRequestContext.current instanceof AuthorizedClientRequestContext ? ClientRequestContext.current : undefined;
    await BriefcaseManager.deleteBriefcaseFiles(fileName, context);
  }

  public async getCachedBriefcases(iModelId?: GuidString): Promise<LocalBriefcaseProps[]> {
    const requestContext: ClientRequestContext = ClientRequestContext.current;
    requestContext.enter();
    return BriefcaseManager.getCachedBriefcases(iModelId);
  }

  public async storageMgrOpen(storageId: string): Promise<string> {
    return NativeAppStorage.open(storageId).id;
  }

  public async storageMgrClose(storageId: string, deleteIt: boolean): Promise<void> {
    NativeAppStorage.find(storageId)?.close(deleteIt);
  }

  public async storageMgrNames(): Promise<string[]> {
    return NativeAppStorage.getStorageNames();
  }

  public async storageGet(storageId: string, key: string): Promise<StorageValue | undefined> {
    return NativeAppStorage.find(storageId)?.getData(key);
  }

  public async storageSet(storageId: string, key: string, value: StorageValue): Promise<void> {
    NativeAppStorage.find(storageId)?.setData(key, value);
  }

  public async storageRemove(storageId: string, key: string): Promise<void> {
    NativeAppStorage.find(storageId)?.removeData(key);
  }

  public async storageKeys(storageId: string): Promise<string[]> {
    const storage = NativeAppStorage.find(storageId)!;
    return storage.getKeys();
  }

  public async storageRemoveAll(storageId: string): Promise<void> {
    const storage = NativeAppStorage.find(storageId)!;
    storage.removeAll();
  }

  public async authSignIn(): Promise<void> {
    const requestContext = ClientRequestContext.current;
    return MobileDevice.currentDevice.signIn(requestContext);
  }

  public async authSignOut(): Promise<void> {
    const requestContext = ClientRequestContext.current;
    return MobileDevice.currentDevice.signOut(requestContext);
  }

  public async authGetAccessToken(): Promise<string> {
    const requestContext = ClientRequestContext.current;
    const accessToken = await MobileDevice.currentDevice.getAccessToken(requestContext);
    return JSON.stringify(accessToken);
  }

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
