/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module IModelHost */

import { BeEvent } from "@bentley/bentleyjs-core";
import { DeploymentEnv, IModelClient } from "@bentley/imodeljs-clients";
import { BentleyStatus, IModelError, FeatureGates } from "@bentley/imodeljs-common";
import * as path from "path";
import { IModelReadRpcImpl } from "./rpc-impl/IModelReadRpcImpl";
import { IModelTileRpcImpl } from "./rpc-impl/IModelTileRpcImpl";
import { IModelWriteRpcImpl } from "./rpc-impl/IModelWriteRpcImpl";
import { StandaloneIModelRpcImpl } from "./rpc-impl/StandaloneIModelRpcImpl";
import { IModelUnitTestRpcImpl } from "./rpc-impl/IModelUnitTestRpcImpl";
import { KnownLocations } from "./Platform";
import { BisCore } from "./BisCore";
import { NativePlatformRegistry } from "./NativePlatformRegistry";
import { BriefcaseManager } from "./BriefcaseManager";

/**
 * Configuration of imodeljs-backend.
 */
export class IModelHostConfiguration {
  /** The deployment environment of Connect and iModelHub Services - this identifies up the location used to find Projects and iModels */
  public hubDeploymentEnv: DeploymentEnv = "QA";

  /** The native platform to use -- normally, the app should leave this undefined. [[IModelHost.startup]] will set it to the appropriate nativePlatform automatically. */
  public nativePlatform?: any;

  private _briefcaseCacheDir: string = path.normalize(path.join(KnownLocations.tmpdir, "Bentley/IModelJs/cache/"));

  /** The path where the cache of briefcases are stored. Defaults to `path.join(KnownLocations.tmpdir, "Bentley/IModelJs/cache/iModels/")` */
  public get briefcaseCacheDir(): string {
    return this._briefcaseCacheDir;
  }
  public set briefcaseCacheDir(cacheDir: string) {
    this._briefcaseCacheDir = path.normalize(cacheDir.replace(/\/?$/, path.sep));
  }

  /** The directory where the app's assets are found */
  public appAssetsDir?: string;

  /** The kind of iModel server to use. Defaults to iModelHubClient */
  public imodelClient?: IModelClient;
}

/**
 * IModelHost initializes ($backend) and captures its configuration. A backend must call [[IModelHost.startup]] before using any backend classes.
 * See [the learning article]($docs/learning/backend/IModelHost.md)
 */
export class IModelHost {
  public static configuration?: IModelHostConfiguration;
  /** Event raised just after the backend IModelHost was started up */
  public static readonly onAfterStartup = new BeEvent<() => void>();

  /** Event raised just before the backend IModelHost is to be shut down */
  public static readonly onBeforeShutdown = new BeEvent<() => void>();

  /** Configured FeatureGates for this IModelHost. */
  public static readonly features = new FeatureGates();

  /** This method must be called before any iModel.js services are used.
   * @param configuration Host configuration data.
   * Raises [[onAfterStartup]].
   * @see [[shutdown]].
   */
  public static startup(configuration: IModelHostConfiguration = new IModelHostConfiguration()) {
    if (IModelHost.configuration)
      throw new IModelError(BentleyStatus.ERROR, "startup may only be called once");

    if (!NativePlatformRegistry.isNativePlatformLoaded) {
      if (configuration.nativePlatform !== undefined)
        NativePlatformRegistry.register(configuration.nativePlatform);
      else
        NativePlatformRegistry.loadAndRegisterStandardNativePlatform();
    }

    if (configuration.imodelClient)
      BriefcaseManager.imodelClient = configuration.imodelClient;

    IModelReadRpcImpl.register();
    IModelTileRpcImpl.register();
    IModelWriteRpcImpl.register();
    StandaloneIModelRpcImpl.register();
    IModelUnitTestRpcImpl.register();

    BisCore.registerSchema();

    IModelHost.configuration = configuration;
    IModelHost.onAfterStartup.raiseEvent();
  }

  /** This method must be called when an iModel.js services is shut down. Raises [[onBeforeShutdown]] */
  public static shutdown() {
    if (!IModelHost.configuration)
      return;
    IModelHost.onBeforeShutdown.raiseEvent();
    IModelHost.configuration = undefined;
  }

  /** The directory where the app's assets may be found */
  public static get appAssetsDir(): string | undefined {
    return (IModelHost.configuration === undefined) ? undefined : IModelHost.configuration.appAssetsDir;
  }

}
