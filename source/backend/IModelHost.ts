/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { DeploymentEnv } from "@bentley/imodeljs-clients";
import { BeEvent } from "@bentley/bentleyjs-core/lib/BeEvent";
import { BentleyStatus, IModelError } from "../common/IModelError";
import * as path from "path";
import { KnownLocations } from "./KnownLocations";

/** Global access to the IModelHost. Initialized by calling IModelHost.startup(). */
export let iModelHost: IModelHost;

export class IModelHostConfiguration {
  /** Deployment configuration of Connect and IModelHub services - these are used to find Projects and iModels */
  public iModelHubDeployConfig: DeploymentEnv = "QA";

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
  private constructor(public readonly configuration: IModelHostConfiguration) { }

  /** This method must be called before any iModelJs services are used. */
  public static startup(configuration: IModelHostConfiguration = new IModelHostConfiguration()) {
    if (iModelHost !== undefined)
      throw new IModelError(BentleyStatus.ERROR, "startup may only be called once");

    iModelHost = new IModelHost(configuration);
    iModelHost.onAfterStartup.raiseEvent();
  }

  public static shutdown() {
    if (!iModelHost)
      throw new IModelError(BentleyStatus.ERROR, "startup needs to be called before shutdown");

    iModelHost.onBeforeShutdown.raiseEvent();

    (iModelHost as any) = undefined;
  }

  /** Event raised just after the backend IModelHost was started up */
  public readonly onAfterStartup = new BeEvent<() => void>();

  /** Event raised just before the backend IModelHost is to be shut down */
  public readonly onBeforeShutdown = new BeEvent<() => void>();
}
