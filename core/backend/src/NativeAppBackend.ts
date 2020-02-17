/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @module NativeAppBackend */

import { InternetConnectivityStatus, OverriddenBy, Events } from "@bentley/imodeljs-common";
import { BeEvent } from "@bentley/bentleyjs-core";
import { IModelHost, IModelHostConfiguration, ApplicationType } from "./IModelHost";
import { EventSinkManager, EmitStrategy } from "./EventSink";
import * as path from "path";
import * as os from "os";

/**
 * Used by desktop/mobile native application
 * @internal
 */
export class NativeAppBackend {
  private static _reachability?: InternetConnectivityStatus;
  private constructor() { }
  public static onInternetConnectivityChanged: BeEvent<(status: InternetConnectivityStatus) => void> = new BeEvent<(status: InternetConnectivityStatus) => void>();

  /**
   * Startups native app backend. It does necessary initialization of the backend.
   * @param [configuration]
   * @note this should be called instead of IModelHost.startup(). But it would indirectly call that.
   */
  public static startup(configuration?: IModelHostConfiguration) {
    if (IModelHost.isNativeAppBackend) {
      throw new Error("NativeAppBackend.startup() has already been called once");
    }
    this.onInternetConnectivityChanged.addListener((status: InternetConnectivityStatus) => {
      EventSinkManager.global.emit(Events.NativeApp.namespace, Events.NativeApp.onInternetConnectivityChanged, { status }, { strategy: EmitStrategy.PurgeOlderEvents });
    });

    if (!configuration) {
      configuration = new IModelHostConfiguration();
    }
    /** Override applicationType to NativeApp */
    configuration!.applicationType = ApplicationType.NativeApp;

    /** Set briefcase cache to home directory */
    if (configuration.isDefaultBriefcaseCacheDir) {
      configuration.briefcaseCacheDir = path.normalize(path.join(this.cacheFolder, "bentley/imodeljs/cache/"));
    }
    if (!configuration.nativeAppCacheDir) {
      configuration.nativeAppCacheDir = path.normalize(path.join(this.cacheFolder, "bentley/imodeljs-native-app/storage"));
    }
    IModelHost.startup(configuration);
  }

  /**
   * Gets cache folder for the native application.
   */
  private static get cacheFolder(): string {
    const homedir = os.homedir();
    const platform = os.platform() as string;
    switch (platform) {
      case "win32":
        return path.join(homedir, "AppData", "Local");
      case "darwin":
      case "ios":
        return path.join(homedir, "Library", "Caches");
      case "linux":
        return path.join(homedir, ".cache");
    }
    throw new Error("Could not determine cache folder");
  }

  /**
   * Shutdowns native app backend and at the end also call IModelHost.shutdown()
   */
  public static shutdown() {
    this.onInternetConnectivityChanged.clear();
    IModelHost.shutdown();
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
  public static overrideInternetConnectivity(_overridenBy: OverriddenBy, status?: InternetConnectivityStatus): void {
    if (this._reachability !== status) {
      this._reachability = status;
      this.onInternetConnectivityChanged.raiseEvent();
    }
  }
}
