/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { GuidString, ClientRequestContext } from "@bentley/bentleyjs-core";
import { IModelJsConfig } from "@bentley/config-loader/lib/IModelJsConfig";
import {
  ImsActiveSecureTokenClient, ImsDelegationSecureTokenClient, AuthorizationToken, AccessToken, HubIModel,
  IModelHubClient, IModelClient, ConnectClient, Project, Config, IModelQuery, AuthorizedClientRequestContext,
  ImsUserCredentials,
} from "@bentley/imodeljs-clients";
import { TestUsers } from "./TestUsers";

IModelJsConfig.init(true /* suppress exception */, false /* suppress error message */, Config.App);

function isOfflineSet(): boolean {
  const index = process.argv.indexOf("--offline");
  return process.argv[index + 1] === "mock";
}

/** Basic configuration used by all tests
 */
export class TestConfig {
  /** Name of project used by most tests */
  public static readonly projectName: string = Config.App.get("imjs_test_project_name", "iModelJsTest");
  public static readonly assetName: string = Config.App.get("imjs_test_asset_name", "iModelJsAssetTest");
  public static readonly enableMocks: boolean = isOfflineSet();
  public static readonly enableIModelBank: boolean = Config.App.has("imjs_test_imodel_bank") && !!JSON.parse(Config.App.get("imjs_test_imodel_bank"));

  /** Login the specified user and return the AuthorizationToken */
  public static async login(user: ImsUserCredentials = TestUsers.regular): Promise<AuthorizationToken> {
    if (Config.App.getNumber("imjs_buddi_resolve_url_using_region") !== 0)
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"; // Dev requires that SSL certificate checks be bypassed
    const authToken: AuthorizationToken = await (new ImsActiveSecureTokenClient()).getToken(new ClientRequestContext(), user);
    expect(authToken);
    return authToken;
  }

  /** Login the specified user and return the AccessToken */
  public static async getAccessToken(user: ImsUserCredentials = TestUsers.regular): Promise<AccessToken> {
    const authToken: AuthorizationToken = await TestConfig.login(user);
    const accessToken: AccessToken = await (new ImsDelegationSecureTokenClient()).getToken(new ClientRequestContext(), authToken);
    expect(accessToken);
    return accessToken;
  }

  /** Query for the specified project */
  public static async queryProjectId(requestContext: AuthorizedClientRequestContext, projectName: string): Promise<string> {
    const connectClient = new ConnectClient();
    const project: Project | undefined = await connectClient.getProject(requestContext, {
      $select: "*",
      $filter: `Name+eq+'${projectName}'`,
    });
    if (!project || !project.wsgId) {
      const userInfo = requestContext.accessToken.getUserInfo();
      throw new Error(`Project ${projectName} not found for user ${!userInfo ? "n/a" : userInfo.email}.`);
    }
    return project.wsgId;
  }

  /** Query for the specified iModel */
  public static async queryIModelId(requestContext: AuthorizedClientRequestContext, iModelName: string, projectId: GuidString): Promise<string> {
    const imodelHubClient: IModelClient = new IModelHubClient();
    const iModel: HubIModel = (await imodelHubClient.iModels.get(requestContext, projectId, new IModelQuery().byName(iModelName)))[0];
    if (!iModel || !iModel.wsgId || iModel.name !== iModelName) {
      const userInfo = requestContext.accessToken.getUserInfo();
      throw new Error(`iModel ${iModelName} not found for project ${projectId} for user ${!userInfo ? "n/a" : userInfo.email}.`);
    }

    return iModel.wsgId;
  }
}
