/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ClientRequestContext, ClientRequestContextProps } from "@bentley/bentleyjs-core";
import { IModelBankClient } from "@bentley/imodelhub-client";
import { IModelDb, IModelHost, IModelJsFs } from "@bentley/imodeljs-backend";
import { V1CheckpointManager } from "@bentley/imodeljs-backend/cjs/CheckpointManager";
import { IModelRpcProps, RpcInterface, RpcManager } from "@bentley/imodeljs-common";
import { AuthorizedClientRequestContext, AuthorizedClientRequestContextProps } from "@bentley/itwin-client";
import { CloudEnvProps, TestRpcInterface } from "../common/RpcInterfaces";
import { CloudEnv } from "./cloudEnv";

export class TestRpcImpl extends RpcInterface implements TestRpcInterface {
  public static register() {
    RpcManager.registerImpl(TestRpcInterface, TestRpcImpl);
  }

  public async restartIModelHost(): Promise<void> {
    await IModelHost.shutdown();
    await IModelHost.startup();
  }

  public async executeTest(tokenProps: IModelRpcProps, testName: string, params: any): Promise<any> {
    return JSON.parse(IModelDb.findByKey(tokenProps.key).nativeDb.executeTest(testName, JSON.stringify(params)));
  }

  public async reportRequestContext(): Promise<ClientRequestContextProps> {
    if (ClientRequestContext.current instanceof AuthorizedClientRequestContext)
      throw new Error("Did not expect AuthorizedClientRequestContext");
    return ClientRequestContext.current.toJSON();
  }

  public async reportAuthorizedRequestContext(): Promise<AuthorizedClientRequestContextProps> {
    if (!(ClientRequestContext.current instanceof AuthorizedClientRequestContext))
      throw new Error("Expected AuthorizedClientRequestContext");
    const context = ClientRequestContext.current;
    return context.toJSON();
  }

  public async getCloudEnv(): Promise<CloudEnvProps> {
    const requestContext = ClientRequestContext.current as AuthorizedClientRequestContext;
    if (CloudEnv.cloudEnv.isIModelHub) {
      const region = process.env.IMJS_BUDDI_RESOLVE_URL_USING_REGION || "0";
      return { iModelHub: { region } };
    }
    const url = await (CloudEnv.cloudEnv.imodelClient as IModelBankClient).getUrl(requestContext);
    return { iModelBank: { url } };
  }

  public async purgeCheckpoints(iModelId: string): Promise<void> {
    IModelJsFs.removeSync(V1CheckpointManager.getFolder(iModelId));
  }
}

TestRpcImpl.register();
