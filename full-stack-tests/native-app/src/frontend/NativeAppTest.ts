/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { IModelCloudEnvironment, IModelQuery } from "@bentley/imodelhub-client";
import { AsyncMethodsOf, AuthorizedFrontendRequestContext, IpcApp, PromiseReturnType } from "@bentley/imodeljs-frontend";
import { AuthorizedClientRequestContext } from "@bentley/itwin-client";
import { TestUsers } from "@bentley/oidc-signin-tool/lib/frontend";
import { testIpcChannel, TestIpcInterface } from "../common/IpcInterfaces";
import { IModelBankCloudEnv } from "./hub/IModelBankCloudEnv";
import { IModelHubCloudEnv } from "./hub/IModelHubCloudEnv";

export class NativeAppTest {
  public static imodelCloudEnv: IModelCloudEnvironment;

  public static async callBackend<T extends AsyncMethodsOf<TestIpcInterface>>(methodName: T, ...args: Parameters<TestIpcInterface[T]>) {
    return IpcApp.callIpcChannel(testIpcChannel, methodName, ...args) as PromiseReturnType<TestIpcInterface[T]>;
  }

  public static async initializeTestProject(): Promise<string> {
    const user = TestUsers.regular;
    const props = await NativeAppTest.callBackend("getTestProjectProps", user);
    if (props.iModelBank) {
      const bank = new IModelBankCloudEnv(props.iModelBank.url, false);
      const authorizationClient = bank.getAuthorizationClient(undefined, user);
      await bank.bootstrapIModelBankProject(new AuthorizedClientRequestContext(await authorizationClient.getAccessToken()), props.projectName);
      this.imodelCloudEnv = bank;
    } else {
      this.imodelCloudEnv = new IModelHubCloudEnv();
    }

    const project = await this.imodelCloudEnv.contextMgr.queryProjectByName(await AuthorizedFrontendRequestContext.create(), props.projectName);
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
