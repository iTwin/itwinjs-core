/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { BentleyError, BentleyStatus, ClientRequestContext, ClientRequestContextProps } from "@bentley/bentleyjs-core";
import { BriefcaseDb, BriefcaseManager, ChangeSummaryExtractOptions, ChangeSummaryManager, IModelDb, IModelHost, IModelJsFs } from "@bentley/imodeljs-backend";
import { AuthorizedClientRequestContext, AuthorizedClientRequestContextProps, Config, IModelBankClient, IModelQuery } from "@bentley/imodeljs-clients";
import { IModelRpcProps, RpcInterface, RpcManager } from "@bentley/imodeljs-common";
import { CloudEnvProps, TestRpcInterface } from "../common/RpcInterfaces";
import { CloudEnv } from "./cloudEnv";
import { TestChangeSetUtility } from "./TestChangeSetUtility";

export class TestRpcImpl extends RpcInterface implements TestRpcInterface {
  public static register() {
    RpcManager.registerImpl(TestRpcInterface, TestRpcImpl);
  }

  public async restartIModelHost(): Promise<void> {
    IModelHost.shutdown();
    IModelHost.startup();
  }

  public async extractChangeSummaries(tokenProps: IModelRpcProps, options: any): Promise<void> {
    const requestContext = ClientRequestContext.current as AuthorizedClientRequestContext;
    await ChangeSummaryManager.extractChangeSummaries(requestContext, BriefcaseDb.findByKey(tokenProps.key), options as ChangeSummaryExtractOptions);
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
    const context = ClientRequestContext.current as AuthorizedClientRequestContext;
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

  public async purgeStorageCache(): Promise<void> {
    return IModelJsFs.purgeDirSync(IModelHost.configuration!.nativeAppCacheDir!);
  }

  public async purgeBriefcaseCache(): Promise<void> {
    const requestContext = ClientRequestContext.current as AuthorizedClientRequestContext;
    await BriefcaseManager.purgeCache(requestContext);
  }

  private _testChangeSetUtility?: TestChangeSetUtility;

  public async initTestChangeSetUtility(projectName: string, iModelBaseName: string): Promise<void> {
    const requestContext = ClientRequestContext.current as AuthorizedClientRequestContext;
    this._testChangeSetUtility = new TestChangeSetUtility(requestContext, projectName, iModelBaseName);
  }

  public async createTestIModel(): Promise<string> {
    if (this._testChangeSetUtility === undefined)
      throw new BentleyError(BentleyStatus.ERROR, "First call setupTestChangeSetUtility()");
    await this._testChangeSetUtility.createTestIModel();
    return this._testChangeSetUtility.iModelId;
  }

  public async pushTestChangeSet(): Promise<void> {
    if (this._testChangeSetUtility === undefined)
      throw new BentleyError(BentleyStatus.ERROR, "First call createTestIModel()");
    await this._testChangeSetUtility.pushTestChangeSet();
  }

  public async deleteTestIModel(): Promise<void> {
    if (this._testChangeSetUtility === undefined)
      throw new BentleyError(BentleyStatus.ERROR, "First call createTestIModel()");
    await this._testChangeSetUtility.deleteTestIModel();
  }
}
TestRpcImpl.register();
