/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module App */

import { BeEvent } from "@bentley/bentleyjs-core";
import { DeploymentEnv } from "@bentley/imodeljs-clients";
import { BentleyStatus, IModelError } from "@bentley/imodeljs-common";
import * as path from "path";
import { IModelReadGatewayImpl } from "./gateway-impl/IModelReadGatewayImpl";
import { IModelWriteGatewayImpl } from "./gateway-impl/IModelWriteGatewayImpl";
import { StandaloneIModelGatewayImpl } from "./gateway-impl/StandaloneIModelGatewayImpl";
import { IModelUnitTestGatewayImpl } from "./gateway-impl/IModelUnitTestGatewayImpl";
import { KnownLocations } from "./Platform";
import { BisCore } from "./BisCore";
import { NativePlatformRegistry } from "./NativePlatformRegistry";

export class IModelHostConfiguration {
  /** Deployment configuration of Connect and IModelHub services - these are used to find Projects and iModels */
  public iModelHubDeployConfig: DeploymentEnv = "QA";

  /** The native platform to use */
  public nativePlatform?: any;

  /** The path where the cache of briefcases are stored. */
  private _briefcaseCacheDir: string = path.normalize(path.join(KnownLocations.tmpdir, "Bentley/IModelJs/cache/iModels/"));
  public get briefcaseCacheDir(): string {
    return this._briefcaseCacheDir;
  }
  public set briefcaseCacheDir(cacheDir: string) {
    this._briefcaseCacheDir = path.normalize(cacheDir.replace(/\/?$/, path.sep));
  }
}

export class IModelHost {
  public static configuration?: IModelHostConfiguration;
  /** Event raised just after the backend IModelHost was started up */
  public static readonly onAfterStartup = new BeEvent<() => void>();

  /** Event raised just before the backend IModelHost is to be shut down */
  public static readonly onBeforeShutdown = new BeEvent<() => void>();

  /** This method must be called before any iModelJs services are used. */
  public static startup(configuration: IModelHostConfiguration = new IModelHostConfiguration()) {
    if (IModelHost.configuration)
      throw new IModelError(BentleyStatus.ERROR, "startup may only be called once");

    if (!NativePlatformRegistry.isNativePlatformLoaded()) {
      if (configuration.nativePlatform !== undefined)
        NativePlatformRegistry.register(configuration.nativePlatform);
      else
        NativePlatformRegistry.loadAndRegisterStandardNativePlatform();
    }

    IModelReadGatewayImpl.register();
    IModelWriteGatewayImpl.register();
    StandaloneIModelGatewayImpl.register();
    IModelUnitTestGatewayImpl.register();

    BisCore.registerSchema();

    IModelHost.configuration = configuration;
    IModelHost.onAfterStartup.raiseEvent();
  }

  public static shutdown() {
    if (!IModelHost.configuration)
      return;
    IModelHost.onBeforeShutdown.raiseEvent();
    IModelHost.configuration = undefined;
  }
}
