/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { ActivityLoggingContext } from "@bentley/bentleyjs-core";
import { RpcInterface, RpcManager, IModelToken } from "@bentley/imodeljs-common";
import { TestRpcInterface } from "../common/RpcInterfaces";
import { AccessToken } from "@bentley/imodeljs-clients";
import { IModelDb, ChangeSummaryExtractOptions, ChangeSummaryManager, BriefcaseManager, IModelJsFs, IModelHost } from "@bentley/imodeljs-backend";

export class TestRpcImpl extends RpcInterface implements TestRpcInterface {
  public static register() {
    RpcManager.registerImpl(TestRpcInterface, TestRpcImpl);
  }

  public async restartIModelHost(): Promise<void> {
    IModelHost.shutdown();
    IModelHost.startup();
  }

  public async extractChangeSummaries(accessToken: AccessToken, iModelToken: IModelToken, options: any): Promise<void> {
    const activityContext = ActivityLoggingContext.current; activityContext.enter();
    await ChangeSummaryManager.extractChangeSummaries(activityContext, accessToken, IModelDb.find(iModelToken), options as ChangeSummaryExtractOptions);
  }

  public async deleteChangeCache(iModelToken: IModelToken): Promise<void> {
    const activityContext = ActivityLoggingContext.current; activityContext.enter();
    if (!iModelToken.iModelId)
      throw new Error("iModelToken is invalid. Must not be a standalone iModel");

    const changesPath: string = BriefcaseManager.getChangeCachePathName(iModelToken.iModelId);
    if (IModelJsFs.existsSync(changesPath))
      IModelJsFs.unlinkSync(changesPath);
  }

  public async executeTest(iModelToken: IModelToken, testName: string, params: any): Promise<any> {
    return JSON.parse(IModelDb.find(iModelToken).nativeDb.executeTest(testName, JSON.stringify(params)));
  }
}

TestRpcImpl.register();
