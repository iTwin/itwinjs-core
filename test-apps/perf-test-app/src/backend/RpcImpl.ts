/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { ClientRequestContext } from "@bentley/bentleyjs-core";
import { RpcInterface, RpcManager, IModelToken } from "@bentley/imodeljs-common";
import { AuthorizedClientRequestContext } from "@bentley/imodeljs-clients";
import { TestRpcInterface } from "../common/RpcInterfaces";
import { IModelDb, ChangeSummaryExtractOptions, ChangeSummaryManager, BriefcaseManager, IModelJsFs, IModelHost } from "@bentley/imodeljs-backend";
import * as path from "path";
import * as fs from "fs";

export class TestRpcImpl extends RpcInterface implements TestRpcInterface {
  public static register() {
    RpcManager.registerImpl(TestRpcInterface, TestRpcImpl);
  }

  public async restartIModelHost(): Promise<void> {
    IModelHost.shutdown();
    IModelHost.startup();
  }

  public async extractChangeSummaries(iModelToken: IModelToken, options: any): Promise<void> {
    const requestContext = ClientRequestContext.current as AuthorizedClientRequestContext;
    await ChangeSummaryManager.extractChangeSummaries(requestContext, IModelDb.find(iModelToken), options as ChangeSummaryExtractOptions);
  }

  public async deleteChangeCache(iModelToken: IModelToken): Promise<void> {
    if (!iModelToken.iModelId)
      throw new Error("iModelToken is invalid. Must not be a standalone iModel");

    const changesPath: string = BriefcaseManager.getChangeCachePathName(iModelToken.iModelId);
    if (IModelJsFs.existsSync(changesPath))
      IModelJsFs.unlinkSync(changesPath);
  }

  public async executeTest(iModelToken: IModelToken, testName: string, params: any): Promise<any> {
    return JSON.parse(IModelDb.find(iModelToken).nativeDb.executeTest(testName, JSON.stringify(params)));
  }

  public async saveCSV(testName: string, testDescription: string, testTime: number): Promise<any> {
    const pth = "./lib/outputdir";
    if (!IModelJsFs.existsSync(pth))
      IModelJsFs.mkdirSync(pth);
    const csvPath = path.join(pth, "ImodelPerformance.csv");
    if (!IModelJsFs.existsSync(csvPath)) {
      fs.appendFileSync(csvPath, "Operation,Description,ExecutionTime\n");
    }
    fs.appendFileSync(csvPath, testName + "," + testDescription + "," + testTime + "\n");
  }
}

TestRpcImpl.register();
