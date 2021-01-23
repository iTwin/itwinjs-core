/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { BentleyError, BentleyStatus, ClientRequestContext, ClientRequestContextProps, Config } from "@bentley/bentleyjs-core";
import { IModelBankClient, IModelQuery } from "@bentley/imodelhub-client";
import {
  BriefcaseDb, BriefcaseManager, ChangeSummaryExtractOptions, ChangeSummaryManager, IModelDb, IModelHost, IModelJsFs,
} from "@bentley/imodeljs-backend";
import { V1CheckpointManager } from "@bentley/imodeljs-backend/lib/CheckpointManager";
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

  public async extractChangeSummaries(tokenProps: IModelRpcProps, options: any): Promise<void> {
    const requestContext = ClientRequestContext.current as AuthorizedClientRequestContext;
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    await ChangeSummaryManager.extractChangeSummaries(requestContext, BriefcaseDb.findByKey(tokenProps.key) as BriefcaseDb, options as ChangeSummaryExtractOptions);
  }

  public async deleteChangeCache(tokenProps: IModelRpcProps): Promise<void> {
    if (!tokenProps.iModelId)
      throw new Error("iModelToken is invalid. Must not be a standalone iModel");

    const changesPath: string = BriefcaseManager.getChangeCachePathName(tokenProps.iModelId);
    if (IModelJsFs.existsSync(changesPath))
      IModelJsFs.unlinkSync(changesPath);
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
      const region = Config.App.get("imjs_buddi_resolve_url_using_region") || "0";
      return { iModelHub: { region } };
    }
    const url = await (CloudEnv.cloudEnv.imodelClient as IModelBankClient).getUrl(requestContext);
    return { iModelBank: { url } };
  }

  public async createIModel(name: string, contextId: string, deleteIfExists: boolean): Promise<string> {
    const requestContext = ClientRequestContext.current as AuthorizedClientRequestContext;

    const imodels = await CloudEnv.cloudEnv.imodelClient.iModels.get(requestContext, contextId, new IModelQuery().byName(name));

    if (imodels.length > 0) {
      if (!deleteIfExists)
        return imodels[0].id!;
      await CloudEnv.cloudEnv.imodelClient.iModels.delete(requestContext, contextId, imodels[0].id!);
      requestContext.enter();
    }

    const hubIModel = await CloudEnv.cloudEnv.imodelClient.iModels.create(requestContext, contextId, name, { timeOutInMilliseconds: 240000 });
    if (hubIModel.id === undefined)
      throw new BentleyError(BentleyStatus.ERROR);
    return hubIModel.id;
  }

  public async purgeCheckpoints(iModelId: string): Promise<void> {
    IModelJsFs.removeSync(V1CheckpointManager.getFolder(iModelId));
  }
}

TestRpcImpl.register();
