import { DeploymentEnv } from "@bentley/imodeljs-clients";

/** Common configuration for various API */
export abstract class Configuration {

  private static _iModelHubDeployConfig?: DeploymentEnv;

  /** Get the deployment configuration of Connect and IModelHub services - these are used to find Projects and iModels
   */
  public static get iModelHubDeployConfig(): DeploymentEnv {
    return Configuration._iModelHubDeployConfig ? Configuration._iModelHubDeployConfig : "QA";
  }

  /**
   * Set the deployment configuration of Connect and IModelHub services - these are used to find Projects and iModels
   * @remarks This needs to be setup just once before any iModels are opened, and cannot be switched thereafter.
   */
  public static set iModelHubDeployConfig(deploymentEnv: DeploymentEnv) {
    Configuration._iModelHubDeployConfig = deploymentEnv;
  }
}
