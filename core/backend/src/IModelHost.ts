/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module App */

import { BeEvent } from "@bentley/bentleyjs-core";
import { DeploymentEnv } from "@bentley/imodeljs-clients";
import { BentleyStatus, IModelError } from "@bentley/imodeljs-common";
import * as path from "path";
import { IModelReadRpcImpl } from "./rpc-impl/IModelReadRpcImpl";
import { IModelTileRpcImpl } from "./rpc-impl/IModelTileRpcImpl";
import { IModelWriteRpcImpl } from "./rpc-impl/IModelWriteRpcImpl";
import { StandaloneIModelRpcImpl } from "./rpc-impl/StandaloneIModelRpcImpl";
import { IModelUnitTestRpcImpl } from "./rpc-impl/IModelUnitTestRpcImpl";
import { KnownLocations } from "./Platform";
import { BisCore } from "./BisCore";
import { NativePlatformRegistry } from "./NativePlatformRegistry";

/**
 * Configuration of imodeljs-backend.
 * <p><em>Example:</em>
 * ``` ts
 * [[include:IModelHost.startup]]
 * ```
 */
export class IModelHostConfiguration {
  /** Deployment configuration of Connect and IModelHub services - these are used to find Projects and iModels */
  public iModelHubDeployConfig: DeploymentEnv = "QA";

  /** The native platform to use. Normally, the app should leave this undefined. [[IModelHost.startup]] will set it to the appropriate nativePlatform automatically. */
  public nativePlatform?: any;

  private _briefcaseCacheDir: string = path.normalize(path.join(KnownLocations.tmpdir, "Bentley/IModelJs/cache/iModels/"));

  /** The path where the cache of briefcases are stored. Defaults to `path.join(KnownLocations.tmpdir, "Bentley/IModelJs/cache/iModels/")` */
  public get briefcaseCacheDir(): string {
    return this._briefcaseCacheDir;
  }
  public set briefcaseCacheDir(cacheDir: string) {
    this._briefcaseCacheDir = path.normalize(cacheDir.replace(/\/?$/, path.sep));
  }

  /** The directory where the app's assets are found */
  public appAssetsDir?: string;
}

/**
 * IModelHost initializes imodeljs-backend and captures backend configuration. A backend must call [[IModelHost.startup]] before using any of the classes in imodeljs-backend.
 * <p><em>Example:</em>
 * ``` ts
 * [[include:IModelHost.startup]]
 * ```
 */
export class IModelHost {
  public static configuration?: IModelHostConfiguration;
  /** Event raised just after the backend IModelHost was started up */
  public static readonly onAfterStartup = new BeEvent<() => void>();

  /** Event raised just before the backend IModelHost is to be shut down */
  public static readonly onBeforeShutdown = new BeEvent<() => void>();

  /** This method must be called before any iModelJs services are used.
   * @param configuration Host configuration data.
   * Raises [[onAfterStartup]].
   * @see [[shutdown]].
   */
  public static startup(configuration: IModelHostConfiguration = new IModelHostConfiguration()) {
    if (IModelHost.configuration)
      throw new IModelError(BentleyStatus.ERROR, "startup may only be called once");

    if (!NativePlatformRegistry.isNativePlatformLoaded()) {
      if (configuration.nativePlatform !== undefined)
        NativePlatformRegistry.register(configuration.nativePlatform);
      else
        NativePlatformRegistry.loadAndRegisterStandardNativePlatform();
    }

    IModelReadRpcImpl.register();
    IModelTileRpcImpl.register();
    IModelWriteRpcImpl.register();
    StandaloneIModelRpcImpl.register();
    IModelUnitTestRpcImpl.register();

    BisCore.registerSchema();

    IModelHost.configuration = configuration;
    IModelHost.onAfterStartup.raiseEvent();
  }

  /** This method must be called when an iModelJs services is shut down. Raises [[onBeforeShutdown]] */
  public static shutdown() {
    if (!IModelHost.configuration)
      return;
    IModelHost.onBeforeShutdown.raiseEvent();
    IModelHost.configuration = undefined;
  }

  /** The directory where the app's assets are found */
  public static get appAssetsDir(): string | undefined {
    return (IModelHost.configuration === undefined) ? undefined : IModelHost.configuration.appAssetsDir;
  }

}
