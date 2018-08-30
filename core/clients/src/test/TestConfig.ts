/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { DeploymentEnv } from "../Client";
import { ImsActiveSecureTokenClient } from "../ImsClients";
import { AuthorizationToken, AccessToken } from "../Token";
import { Version, IModelRepository, VersionQuery, IModelQuery } from "../imodelhub";
import { IModelHubClient, IModelClient } from "..";
import { ConnectClient, Project } from "../ConnectClients";
import { expect } from "chai";

import { Logger } from "@bentley/bentleyjs-core";

Logger.initializeToConsole();
// Note: Turn this off unless really necessary - it causes Error messages on the
// console with the existing suite of tests, and this is quite misleading,
// especially when diagnosing CI job failures.
const loggingConfigFile: string | undefined = process.env.imodeljs_test_logging_config;
if (!!loggingConfigFile) {
  // tslint:disable-next-line:no-var-requires
  Logger.configureLevels(require(loggingConfigFile));
}

/** Credentials for test users */
export interface UserCredentials {
  email: string;
  password: string;
}

function isOfflineSet(): boolean {
  const index = process.argv.indexOf("--offline");
  return process.argv[index + 1] === "mock";
}

/** Basic configuration used by all tests
 * Note: Setup test cases at both the DEV and QA environments, so that
 * the tests can be run at either place.
 * QA: https://qa-connect-webportal.bentley.com/
 * DEV: https://dev-webportal-eus.cloudapp.net/ and
 */
export class TestConfig {
  /** Deployment environment used by most tests */
  public static deploymentEnv: DeploymentEnv = "QA";

  /** Name of project used by most tests */
  public static readonly projectName: string = "NodeJsTestProject";
  public static readonly enableMocks: boolean = isOfflineSet();

  /** Login the specified user and return the AuthorizationToken */
  public static async login(user: UserCredentials = TestUsers.regular, env: DeploymentEnv = TestConfig.deploymentEnv): Promise<AuthorizationToken> {
    if (TestConfig.deploymentEnv === "DEV" || TestConfig.deploymentEnv === "PERF")
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"; // Dev requires that SSL certificate checks be bypassed

    const authToken: AuthorizationToken | undefined = await (new ImsActiveSecureTokenClient(env)).getToken(user.email, user.password);
    expect(authToken);

    return authToken;
  }

  /** Query for the test file from connect/hub */
  public static async queryTestCase(accessToken: AccessToken, deploymentEnv: DeploymentEnv, projectName: string, iModelName?: string, versionName?: string): Promise<{ project: Project, iModel?: IModelRepository, version?: Version }> {
    const connectClient = new ConnectClient(deploymentEnv);
    const imodelHubClient: IModelClient = new IModelHubClient(deploymentEnv);

    const project: Project | undefined = await connectClient.getProject(accessToken, {
      $select: "*",
      $filter: `Name+eq+'${projectName}'`,
    });
    expect(project);

    let iModel: IModelRepository | undefined = undefined; // tslint:disable-line:no-unnecessary-initializer
    let version: Version | undefined = undefined; // tslint:disable-line:no-unnecessary-initializer
    if (iModelName) {
      const iModels = await imodelHubClient.IModels().get(accessToken, project.wsgId, new IModelQuery().byName(iModelName));
      expect(iModels.length === 1);
      iModel = iModels[0];

      if (versionName) {
        version = (await imodelHubClient.Versions().get(accessToken, iModel.wsgId, new VersionQuery().byName(versionName)))[0];
        expect(version);
      }
    }

    return { project, iModel, version };
  }
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

  /** Just another user */
  public static readonly user3: UserCredentials = {
    email: "vilnius.user1@mailinator.com",
    password: "test123",
  };

  public static readonly serviceAccount1: UserCredentials = {
    email: "bistroATP_pm2@mailinator.com",
    password: "pmanager2",
  };

}
