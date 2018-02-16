/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { DeploymentEnv, AccessToken } from "@bentley/imodeljs-clients";
import { BeEvent } from "@bentley/bentleyjs-core/lib/BeEvent";
import { BentleyStatus, IModelError } from "../common/IModelError";
import * as path from "path";
import { KnownLocations } from "./KnownLocations";

/** Global access to the IModelEngine. Initialized by calling IModelEngine.startup(). */
export let iModelEngine: IModelEngine;

export class IModelEngineConfiguration {
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

  /** Method that returns a valid access token for the service user. If defined, this is used for all Connect and iModelHub operations
   * instead of the one passed in from the front end.
   */
  public getServiceUserAccessToken: () => AccessToken | undefined = () => undefined;
}

export class IModelEngine {
  private constructor(public readonly configuration: IModelEngineConfiguration) { }

  /** This method must be called before any iModelJs services are used. */
  public static startup(configuration: IModelEngineConfiguration = new IModelEngineConfiguration()) {
    if (iModelEngine !== undefined)
      throw new IModelError(BentleyStatus.ERROR, "startup may only be called once");

    iModelEngine = new IModelEngine(configuration);
    iModelEngine.onAfterStartup.raiseEvent();
  }

  public static shutdown() {
    if (!iModelEngine)
      throw new IModelError(BentleyStatus.ERROR, "startup needs to be called before shutdown");

    iModelEngine.onBeforeShutdown.raiseEvent();

    (iModelEngine as any) = undefined;
  }

  /** Event raised just after the backend IModelEngine was started up */
  public readonly onAfterStartup = new BeEvent<() => void>();

  /** Event raised just before the backend IModelEngine is to be shut down */
  public readonly onBeforeShutdown = new BeEvent<() => void>();
}
