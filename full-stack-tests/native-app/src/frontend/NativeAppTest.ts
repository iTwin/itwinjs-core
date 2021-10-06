/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { AsyncMethodsOf, PromiseReturnType } from "@itwin/core-bentley";
import { IModelCloudEnvironment, IModelQuery } from "@bentley/imodelhub-client";
import { IModelApp, IpcApp } from "@itwin/core-frontend";
import { TestUsers } from "@itwin/oidc-signin-tool/lib/cjs/frontend";
import { testIpcChannel, TestIpcInterface } from "../common/IpcInterfaces";
import { IModelBankCloudEnv } from "./hub/IModelBankCloudEnv";
import { IModelHubCloudEnv } from "./hub/IModelHubCloudEnv";

export class NativeAppTest {
  public static imodelCloudEnv: IModelCloudEnvironment;

  public static async callBackend<T extends AsyncMethodsOf<TestIpcInterface>>(methodName: T, ...args: Parameters<TestIpcInterface[T]>) {
    return IpcApp.callIpcChannel(testIpcChannel, methodName, ...args) as PromiseReturnType<TestIpcInterface[T]>;
  }

  public static async initializeTestITwin(): Promise<string> {
    const user = TestUsers.regular;
    const props = await NativeAppTest.callBackend("getTestITwinProps", user);
    if (props.iModelBank) {
      const bank = new IModelBankCloudEnv(props.iModelBank.url, false);
      const authorizationClient = bank.getAuthorizationClient(user);
      await bank.bootstrapITwin((await authorizationClient.getAccessToken())!, props.iTwinName);
      this.imodelCloudEnv = bank;
    } else {
      this.imodelCloudEnv = new IModelHubCloudEnv();
    }

    const accessToken = await IModelApp.getAccessToken();
    const iTwin = await this.imodelCloudEnv.iTwinMgr.getITwinByName(accessToken, props.iTwinName);
    assert(iTwin && iTwin.id);
    return iTwin.id;
  }

  public static async getTestIModelId(projectId: string, iModelName: string): Promise<string> {
    const accessToken = await IModelApp.getAccessToken();
    const iModels = await this.imodelCloudEnv.imodelClient.iModels.get(accessToken, projectId, new IModelQuery().byName(iModelName));
    assert(iModels.length > 0);
    assert(iModels[0].wsgId);

    return iModels[0].wsgId;
  }

}
