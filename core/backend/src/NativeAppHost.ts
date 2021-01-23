/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module NativeAppBackend
 */

import * as path from "path";
import { BeEvent, BentleyError, BentleyStatus, ClientRequestContext, Config, GuidString, Logger } from "@bentley/bentleyjs-core";
import {
  BackendIpc, BriefcaseProps, InternetConnectivityStatus, IpcHandler, LocalBriefcaseProps, MobileAuthorizationClientConfiguration,
  MobileRpcConfiguration, nativeAppChannel, NativeAppFunctions, NativeAppNotifications, nativeAppNotify, OverriddenBy, RequestNewBriefcaseProps, StorageValue,
} from "@bentley/imodeljs-common";
import { AuthorizedClientRequestContext, RequestGlobalOptions } from "@bentley/itwin-client";
import { BriefcaseManager } from "./BriefcaseManager";
import { Downloads } from "./CheckpointManager";
import { NativeAppStorage } from "./NativeAppStorage";
import { BackendLoggerCategory } from "./BackendLoggerCategory";
import { ApplicationType, IModelHost, IModelHostConfiguration } from "./IModelHost";
import { IpcAppHost } from "./IpcAppHost";
import { initialize, MobileDevice } from "./MobileDevice";

const loggerCategory = BackendLoggerCategory.NativeApp;
initialize();

/**
 * Implementation for backend of NativeAppIpc
 * @internal
 */
class NativeAppImpl extends IpcHandler implements NativeAppFunctions {

  public get channelName() { return nativeAppChannel; }
  public async checkInternetConnectivity(): Promise<InternetConnectivityStatus> {
    return NativeAppHost.checkInternetConnectivity();
  }
  public async overrideInternetConnectivity(by: OverriddenBy, status: InternetConnectivityStatus): Promise<void> {
    NativeAppHost.overrideInternetConnectivity(by, status);
  }

  public async getConfig(): Promise<any> {
    return Config.App.getContainer();
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
        BackendIpc.send(`nativeApp.progress-${request.iModelId}`, { loaded, total });
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

}

/**
 * Used by desktop/mobile native applications
 * @beta
 */
export class NativeAppHost extends IpcAppHost {
  private static _reachability?: InternetConnectivityStatus;
  private constructor() { super(); }

  public static onInternetConnectivityChanged: BeEvent<(status: InternetConnectivityStatus) => void> = new BeEvent<(status: InternetConnectivityStatus) => void>();

  private static _appSettingsCacheDir?: string;

  /** Get the local cache folder for application settings */
  public static get appSettingsCacheDir(): string {
    if (this._appSettingsCacheDir === undefined) {
      if (!IModelHost.isNativeAppBackend)
        throw new BentleyError(BentleyStatus.ERROR, "Call NativeAppBackend.startup before fetching the appSettingsCacheDir", Logger.logError, loggerCategory);
      this._appSettingsCacheDir = path.join(IModelHost.cacheDir, "appSettings");
    }
    return this._appSettingsCacheDir;
  }

  public static notifyNativeFrontend<T extends keyof NativeAppNotifications>(methodName: T, ...args: Parameters<NativeAppNotifications[T]>) {
    return BackendIpc.send(nativeAppNotify, methodName, ...args);
  }

  /**
   * Start the backend of a native app.
   * @param configuration
   * @note this method calls [[IModelHost.startup]] internally.
   */
  public static async startup(configuration: IModelHostConfiguration = new IModelHostConfiguration()): Promise<void> {
    this.onInternetConnectivityChanged.addListener((status: InternetConnectivityStatus) => NativeAppHost.notifyNativeFrontend("notifyInternetConnectivityChanged", status));

    /** Override applicationType to NativeApp */
    configuration.applicationType = ApplicationType.NativeApp;
    if (MobileRpcConfiguration.isMobileBackend) {
      MobileDevice.currentDevice.onUserStateChanged.addListener((accessToken?: string, err?: string) => {
        const accessTokenObj = accessToken ? JSON.parse(accessToken) : {};
        NativeAppHost.notifyNativeFrontend("notifyUserStateChanged", { accessToken: accessTokenObj, err });
      });
    }
    await super.startup(configuration);
    NativeAppImpl.register();
  }

  /**
   * Shutdown native app backend. Also calls IModelHost.shutdown()
   */
  public static async shutdown(): Promise<void> {
    this.onInternetConnectivityChanged.clear();
    await IModelHost.shutdown();
  }

  /**
   * Checks internet connectivity
   * @returns return current value of internet connectivity from backend.
   */
  public static checkInternetConnectivity(): InternetConnectivityStatus {
    return this._reachability ?? InternetConnectivityStatus.Online;
  }

  /**
   * Overrides internet connectivity value at backend.
   * @param _overridenBy who overrode the value.
   */
  public static overrideInternetConnectivity(_overridenBy: OverriddenBy, status: InternetConnectivityStatus): void {
    if (this._reachability !== status) {
      this._reachability = status;
      RequestGlobalOptions.online = this._reachability === InternetConnectivityStatus.Online;
      this.onInternetConnectivityChanged.raiseEvent(status);
    }
  }
}
