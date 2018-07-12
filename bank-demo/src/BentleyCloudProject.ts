import { AccessToken, ImsDelegationSecureTokenClient, AuthorizationToken, ImsActiveSecureTokenClient, DeploymentEnv, IModelClient, IModelAccessContext } from "@bentley/imodeljs-clients";
import { BriefcaseManager } from "@bentley/imodeljs-backend/lib/backend";

export class IModelHubIModelAccessContext extends IModelAccessContext {

  constructor(id: string, pid: string) {
    super(id, pid);
  }

  public get client(): IModelClient | undefined { return undefined; } // use the default iModelHub server handler
}

export class BentleyCloudProject {

  public static async getAccessToken(userid: string, password: string, deploymentEnv: DeploymentEnv = "QA") {
    const authToken: AuthorizationToken = await (new ImsActiveSecureTokenClient(deploymentEnv)).getToken(userid, password);
    return await (new ImsDelegationSecureTokenClient(deploymentEnv)).getToken(authToken!);
  }

  public static async getIModelAccessContext(imodelid: string, projectid: string): Promise<IModelAccessContext> {
    // TODO: deploy and start up a separate instance of iModelBank for each iModel
    return new IModelHubIModelAccessContext(imodelid, projectid);
  }

  public static async queryProjectIdByName(accessToken: AccessToken, projectName: string): Promise<string> {
    const proj = await BriefcaseManager.connectClient.getProject(accessToken, { $select: "*", $filter: "Name+eq+'" + projectName + "'" });
    return proj!.wsgId;
  }
}
