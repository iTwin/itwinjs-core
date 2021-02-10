/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module NativeAppBackend
 */

import * as path from "path";
import { BeEvent, BentleyError, BentleyStatus, Logger } from "@bentley/bentleyjs-core";
import { BackendIpc, InternetConnectivityStatus, MobileRpcConfiguration, NativeAppResponse, nativeAppResponse, OverriddenBy } from "@bentley/imodeljs-common";
import { RequestGlobalOptions } from "@bentley/itwin-client";
import { BackendLoggerCategory } from "./BackendLoggerCategory";
import { ApplicationType, IModelHost, IModelHostConfiguration } from "./IModelHost";
import { initialize, MobileDevice } from "./MobileDevice";

const loggerCategory = BackendLoggerCategory.NativeApp;
initialize();

/**
 * Used by desktop/mobile native application
 * @internal
 */
export class NativeAppBackend {
  private static _reachability?: InternetConnectivityStatus;
  private constructor() { }
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

  public static notifyFrontend<T extends keyof NativeAppResponse>(methodName: T, ...args: Parameters<NativeAppResponse[T]>) {
    return BackendIpc.send(nativeAppResponse, methodName, ...args);
  }

  /**
   * Start the backend of a native app.
   * @param configuration
   * @note this method calls [[IModelHost.startup]] internally.
   */
  public static async startup(configuration?: IModelHostConfiguration): Promise<void> {
    if (IModelHost.isNativeAppBackend) {
      throw new Error("NativeAppBackend.startup() has already been called once");
    }
    this.onInternetConnectivityChanged.addListener((status: InternetConnectivityStatus) => NativeAppBackend.notifyFrontend("notifyInternetConnectivityChanged", status));

    if (!configuration) {
      configuration = new IModelHostConfiguration();
    }
    /** Override applicationType to NativeApp */
    configuration.applicationType = ApplicationType.NativeApp;
    if (MobileRpcConfiguration.isMobileBackend) {
      MobileDevice.currentDevice.onUserStateChanged.addListener((accessToken?: string, err?: string) => {
        const accessTokenObj = accessToken ? JSON.parse(accessToken) : {};
        NativeAppBackend.notifyFrontend("notifyUserStateChanged", { accessToken: accessTokenObj, err });
      });
    }
    await IModelHost.startup(configuration);
  }

  /**
   * Shutdowns native app backend and at the end also call IModelHost.shutdown()
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
    if (this._reachability) {
      return this._reachability;
    }
    return InternetConnectivityStatus.Online;
  }

  /**
   * Overrides internet connectivity value at backend.
   * @param _overridenBy Meta information about who intent to override the value.
   */
  public static overrideInternetConnectivity(_overridenBy: OverriddenBy, status: InternetConnectivityStatus): void {
    if (this._reachability !== status) {
      this._reachability = status;
      RequestGlobalOptions.online = this._reachability === InternetConnectivityStatus.Online;
      this.onInternetConnectivityChanged.raiseEvent(status);
    }
  }
}
