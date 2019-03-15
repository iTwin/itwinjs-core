/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import {
  AuthorizationToken, AccessToken, ImsActiveSecureTokenClient, ImsDelegationSecureTokenClient, Config,
  ConnectClient, Project, IModelHubClient, IModelQuery,
} from "@bentley/imodeljs-clients";
import { ActivityLoggingContext, Guid } from "@bentley/bentleyjs-core";

export class TestData {
  public static get user() {
    return {
      email: Config.App.getString("imjs_test_regular_user_name"),
      password: Config.App.getString("imjs_test_regular_user_password"),
    };
  }
  // Use QA
  public static connectClient = new ConnectClient();
  public static imodelClient = new IModelHubClient();
  public static accessToken: AccessToken;
  public static testProjectId: string;
  public static testIModelId: string;
  public static testChangeSetId: string;

  public static async load() {
    TestData.accessToken = await TestData.getTestUserAccessToken();
    TestData.testProjectId = await TestData.getTestProjectId(TestData.accessToken, "iModelJsIntegrationTest");
    TestData.testIModelId = await TestData.getTestIModelId(TestData.accessToken, TestData.testProjectId, "ConnectionReadTest");
  }

  public static async getAccessToken(email: string, password: string): Promise<AccessToken> {
    const alctx = new ActivityLoggingContext(Guid.createValue());
    const authToken: AuthorizationToken = await (new ImsActiveSecureTokenClient()).getToken(alctx, email, password);
    assert(authToken);

    const accessToken = await (new ImsDelegationSecureTokenClient()).getToken(alctx, authToken!);
    assert(accessToken);
    return accessToken;
  }

  public static async getTestUserAccessToken(): Promise<AccessToken> {
    return TestData.getAccessToken(Config.App.getString("imjs_test_regular_user_name"), Config.App.getString("imjs_test_regular_user_password"));
  }

  public static async getTestProjectId(accessToken: AccessToken, projectName: string): Promise<string> {
    const alctx = new ActivityLoggingContext(Guid.createValue());
    const project: Project = await TestData.connectClient.getProject(alctx, accessToken, {
      $select: "*",
      $filter: "Name+eq+'" + projectName + "'",
    });
    assert(project && project.wsgId);
    return project.wsgId;
  }

  public static async getTestIModelId(accessToken: AccessToken, projectId: string, iModelName: string): Promise<string> {
    const alctx = new ActivityLoggingContext(Guid.createValue());
    const iModels = await TestData.imodelClient.iModels.get(alctx, accessToken, projectId, new IModelQuery().byName(iModelName));
    assert(iModels.length > 0);
    assert(iModels[0].wsgId);

    return iModels[0].wsgId;
  }
}
