import { AccessToken, ImsDelegationSecureTokenClient, AuthorizationToken, ImsActiveSecureTokenClient, DeploymentEnv } from "@bentley/imodeljs-clients";
import { BriefcaseManager } from "@bentley/imodeljs-backend/lib/backend";

/** Credentials for test users */
export interface UserCredentials {
  email: string;
  password: string;
}

/** Test users with various permissions */
export class BentleyImsTestUsers {
  /** User with the typical permissions of the regular/average user - Co-Admin: No, Connect-Services-Admin: No */
  public static readonly regular: UserCredentials = {
    email: "Regular.IModelJsTestUser@mailinator.com",
    password: "Regular@iMJs",
  };

  /** User with typical permissions of the project administrator - Co-Admin: Yes, Connect-Services-Admin: No */
  public static readonly manager: UserCredentials = {
    email: "Manager.IModelJsTestUser@mailinator.com",
    password: "Manager@iMJs",
  };

  /** User with the typical permissions of the connected services administrator - Co-Admin: No, Connect-Services-Admin: Yes */
  public static readonly super: UserCredentials = {
    email: "Super.IModelJsTestUser@mailinator.com",
    password: "Super@iMJs",
  };

  /** User with the typical permissions of the connected services administrator - Co-Admin: Yes, Connect-Services-Admin: Yes */
  public static readonly superManager: UserCredentials = {
    email: "SuperManager.IModelJsTestUser@mailinator.com",
    password: "SuperManager@iMJs",
  };

  /** Just another user */
  public static readonly user1: UserCredentials = {
    email: "bistroDEV_pmadm1@mailinator.com",
    password: "pmadm1",
  };
}

export class BentleyCloudProject {

  public static async getAccessToken() {
    const deploymentEnv: DeploymentEnv = "QA";
    const userCredentials = BentleyImsTestUsers.regular;    // simulate user supplying credentials
    const authToken: AuthorizationToken = await (new ImsActiveSecureTokenClient(deploymentEnv)).getToken(userCredentials.email, userCredentials.password);
    return await (new ImsDelegationSecureTokenClient(deploymentEnv)).getToken(authToken!);
  }

  public static startImodelServer(_imodelid: string): string {
    return "";
  }

  public static async queryProjectIdByName(accessToken: AccessToken, projectName: string): Promise<string> {
    const proj = await BriefcaseManager.connectClient.getProject(accessToken, { $select: "*", $filter: "Name+eq+'" + projectName + "'" });
    return proj!.wsgId;
  }
}
