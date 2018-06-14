import { AccessToken, ImsDelegationSecureTokenClient, AuthorizationToken, ImsActiveSecureTokenClient, DeploymentEnv, Project } from "@bentley/imodeljs-clients";
import { BriefcaseManager, IModelHost } from "@bentley/imodeljs-backend/lib/backend";

/** Credentials for test users */
export interface UserCredentials {
  email: string;
  password: string;
}

/** Test users with various permissions */
export class TestUsers {
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

async function queryProjectByName(accessToken: AccessToken, projectName: string): Promise<Project | undefined> {
  const project: Project = await BriefcaseManager.connectClient.getProject(accessToken, {
    $select: "*",
    $filter: "Name+eq+'" + projectName + "'",
  });
  return project;
}

export class IModelHubIntegration {
  public static accessToken: AccessToken;
  public static testProjectId: string;
  public static deploymentEnv: DeploymentEnv = "QA";
  public static userCredentials = TestUsers.regular;
  public static async startup(projectName: string) {
    IModelHost.startup();
    const authToken: AuthorizationToken = await (new ImsActiveSecureTokenClient(this.deploymentEnv)).getToken(this.userCredentials.email, this.userCredentials.password);
    this.accessToken = await (new ImsDelegationSecureTokenClient(this.deploymentEnv)).getToken(authToken!);
    const proj = await queryProjectByName(this.accessToken, projectName);
    this.testProjectId = proj!.wsgId;
  }
}
