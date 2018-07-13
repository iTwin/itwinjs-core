import { AccessToken, ImsDelegationSecureTokenClient, AuthorizationToken, ImsActiveSecureTokenClient, DeploymentEnv, IModelClient, IModelAccessContext } from "@bentley/imodeljs-clients";
import { BriefcaseManager } from "@bentley/imodeljs-backend/lib/backend";

export class IModelHubAccessContext extends IModelAccessContext {

  public get client(): IModelClient | undefined { return undefined; } // use the default iModelHub server handler

  /** Store the definition of this context as a string that can be used as the contextId property of an IModelToken */
  public toIModelTokenContextId(): string { return ""; }

  /** Create a IModelBankAccessContext from the contextId property of an IModelToken. BriefcaseManager should call this. */
  public static fromIModelTokenContextId(_contextStr: string): IModelAccessContext | undefined {
    return new IModelHubAccessContext();
  }
}

export class BentleyCloudProject {

  public static async getAccessToken(userid: string, password: string, deploymentEnv: DeploymentEnv = "QA") {
    const authToken: AuthorizationToken = await (new ImsActiveSecureTokenClient(deploymentEnv)).getToken(userid, password);
    return await (new ImsDelegationSecureTokenClient(deploymentEnv)).getToken(authToken!);
  }

  public static async getIModelAccessContext(_imodelid: string, _projectid: string): Promise<IModelAccessContext> {
    // TODO: deploy and start up a separate instance of iModelBank for each iModel
    return new IModelHubAccessContext();
  }

  public static async queryProjectIdByName(accessToken: AccessToken, projectName: string): Promise<string> {
    const proj = await BriefcaseManager.connectClient.getProject(accessToken, { $select: "*", $filter: "Name+eq+'" + projectName + "'" });
    return proj!.wsgId;
  }

}
