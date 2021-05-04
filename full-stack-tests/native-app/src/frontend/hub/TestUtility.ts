/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { ClientRequestContext } from "@bentley/bentleyjs-core";
import { Project } from "@bentley/context-registry-client";
import { FrontendAuthorizationClient } from "@bentley/frontend-authorization-client";
import { IModelCloudEnvironment, IModelQuery } from "@bentley/imodelhub-client";
import { AsyncMethodsOf, AuthorizedFrontendRequestContext, IpcApp } from "@bentley/imodeljs-frontend";
import { AuthorizedClientRequestContext } from "@bentley/itwin-client";
import { TestUserCredentials } from "@bentley/oidc-signin-tool/lib/frontend";
import { testIpcChannel, TestIpcInterface } from "../../common/IpcInterfaces";
import { IModelBankCloudEnv } from "./IModelBankCloudEnv";
import { IModelHubCloudEnv } from "./IModelHubCloudEnv";

export class TestUtility {
  public static imodelCloudEnv: IModelCloudEnvironment;

  public static async callBackend<T extends AsyncMethodsOf<TestIpcInterface>>(methodName: T, ...args: Parameters<TestIpcInterface[T]>) {
    return IpcApp.callIpcChannel(testIpcChannel, methodName, ...args);
  }

  public static async initializeTestProject(testProjectName: string, user: TestUserCredentials): Promise<FrontendAuthorizationClient> {
    const cloudParams = await TestUtility.callBackend("getCloudEnv");
    if (cloudParams.iModelBank) {
      this.imodelCloudEnv = new IModelBankCloudEnv(cloudParams.iModelBank.url, false);
    } else {
      this.imodelCloudEnv = new IModelHubCloudEnv();
    }

    const requestContext = new ClientRequestContext();
    const authorizationClient = this.imodelCloudEnv.getAuthorizationClient(undefined, user);
    await authorizationClient.signIn(requestContext);
    const accessToken = await authorizationClient.getAccessToken();

    if (this.imodelCloudEnv instanceof IModelBankCloudEnv) {
      await this.imodelCloudEnv.bootstrapIModelBankProject(new AuthorizedClientRequestContext(accessToken), testProjectName);
    }

    return authorizationClient;
  }

  public static async getTestProjectId(projectName: string): Promise<string> {
    const requestContext = await AuthorizedFrontendRequestContext.create();
    const project: Project = await this.imodelCloudEnv.contextMgr.queryProjectByName(requestContext, projectName);
    assert(project && project.wsgId);
    return project.wsgId;
  }

  public static async getTestIModelId(projectId: string, iModelName: string): Promise<string> {
    const requestContext = await AuthorizedFrontendRequestContext.create();
    const iModels = await this.imodelCloudEnv.imodelClient.iModels.get(requestContext, projectId, new IModelQuery().byName(iModelName));
    assert(iModels.length > 0);
    assert(iModels[0].wsgId);

    return iModels[0].wsgId;
  }

}
