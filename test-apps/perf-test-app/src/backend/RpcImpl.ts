/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import * as path from "path";

import { RpcInterface, RpcManager } from "@bentley/imodeljs-common";
import { IModelJsFs } from "@bentley/imodeljs-backend";
import { Reporter } from "@bentley/perf-tools/lib/Reporter";
import { TestRpcInterface } from "../common/RpcInterfaces";

export class TestRpcImpl extends RpcInterface implements TestRpcInterface {
  public static reporter: Reporter;

  public async initializeReporter(): Promise<any> {
    TestRpcImpl.reporter = new Reporter();
  }

  public async addNewEntry(testSuit: string, testName: string, valueDescription: string, value: number, info: string): Promise<any> {
    const temp = JSON.parse(info);
    TestRpcImpl.reporter.addEntry(testSuit, testName, valueDescription, value, temp);
  }

  public async saveReport(): Promise<any> {
    const pth = "./lib/outputdir";
    if (!IModelJsFs.existsSync(pth))
      IModelJsFs.mkdirSync(pth);
    const csvPath = path.join(pth, "IntegrationPefTests.csv");
    TestRpcImpl.reporter.exportCSV(csvPath);
  }

  public static register() {
    RpcManager.registerImpl(TestRpcInterface, TestRpcImpl);
  }
}

TestRpcImpl.register();
