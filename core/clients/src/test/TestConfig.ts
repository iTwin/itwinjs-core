/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Logger, GuidString } from "@bentley/bentleyjs-core";
import { TestUserCredentials, TestUsers, getAccessTokenFromBackend } from "@bentley/oidc-signin-tool/lib/frontend";

import { HubIModel } from "../imodelhub/iModels";
import { IModelHubClient, IModelClient } from "../imodeljs-clients";
import { ConnectClient, Project } from "../ConnectClient";

import { AuthorizedClientRequestContext } from "../AuthorizedClientRequestContext";
import { AccessToken } from "../Token";

// Note: Turn this off unless really necessary - it causes Error messages on the
// console with the existing suite of tests, and this is quite misleading,
// especially when diagnosing CI job failures.
const loggingConfigFile: string | undefined = process.env.imjs_test_logging_config;
if (!!loggingConfigFile) {
  // tslint:disable-next-line:no-var-requires
  Logger.configureLevels(require(loggingConfigFile));
}

function isOfflineSet(): boolean {
  const index = process.argv.indexOf("--offline");
  return process.argv[index + 1] === "mock";
}

/** Basic configuration used by all tests
 */
export class TestConfig {
  /** Name of project used by most tests */
  public static readonly projectName: string = "iModelJsIntegrationTest";
  public static readonly enableMocks: boolean = isOfflineSet();

  /** Login the specified user and return the AuthorizationToken */
  public static async getAuthorizedClientRequestContext(user: TestUserCredentials = TestUsers.regular): Promise<AuthorizedClientRequestContext> {
    const accessToken = await getAccessTokenFromBackend(user);
    return new AuthorizedClientRequestContext((accessToken as any) as AccessToken);
  }

  public static async queryProject(requestContext: AuthorizedClientRequestContext, projectName: string): Promise<Project> {
    const connectClient = new ConnectClient();
    const project: Project | undefined = await connectClient.getProject(requestContext, {
      $select: "*",
      $filter: `Name+eq+'${projectName}'`,
    });
    if (!project || !project.wsgId)
      throw new Error(`Project ${projectName} not found for user.`);
    return project;
  }

  public static async queryIModel(requestContext: AuthorizedClientRequestContext, projectId: GuidString): Promise<HubIModel> {
    const imodelHubClient: IModelClient = new IModelHubClient();
    const iModel: HubIModel = await imodelHubClient.iModel.get(requestContext, projectId);
    if (!iModel || !iModel.wsgId)
      throw new Error(`Primary iModel not found for project ${projectId}`);
    return iModel;
  }
}
