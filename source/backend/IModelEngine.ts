import { DeploymentEnv, AccessToken } from "@bentley/imodeljs-clients";
import { IModelError, IModelStatus } from "../common/IModelError";
import { IModelJsFs } from "./IModelJsFs";
import * as path from "path";
import { KnownLocations } from "./KnownLocations";
import { BriefcaseManager } from "./BriefcaseManager";

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
  public getServiceUserAccessToken: () => AccessToken|undefined = () => undefined;
}

export class IModelEngine {
  private constructor(public readonly configuration: IModelEngineConfiguration) {}

  /** Create a directory, recursively setting up the path as necessary */
  private static makeDirectoryRecursive(dirPath: string) {
    if (IModelJsFs.existsSync(dirPath))
      return;
    IModelEngine.makeDirectoryRecursive(path.dirname(dirPath));
    IModelJsFs.mkdirSync(dirPath);
  }

  /** This method must be called before any iModelJs services are used. */
  public static startup(configuration: IModelEngineConfiguration = new IModelEngineConfiguration()) {
    if (iModelEngine !== undefined)
      throw new IModelError(IModelStatus.AlreadyLoaded, "startup may only be called once");

    if (!IModelJsFs.existsSync(configuration.briefcaseCacheDir))
      IModelEngine.makeDirectoryRecursive(configuration.briefcaseCacheDir);

    iModelEngine = new IModelEngine(configuration);
  }

  public static shutdown() {
    BriefcaseManager.clearCache();
    (iModelEngine as any) = undefined;
  }
}
