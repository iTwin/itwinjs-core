/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { OpenMode, Logger, LogLevel, ClientRequestContext } from "@bentley/bentleyjs-core";
import { ImsTestAuthorizationClient } from "@bentley/imodeljs-clients";
import { IModelVersion } from "@bentley/imodeljs-common";
import { TestUtility } from "./TestUtility";
import { TestUsers } from "./TestUsers";
import { IModelConnection, MockRender, IModelApp } from "@bentley/imodeljs-frontend";
import { TestRpcInterface } from "../../common/RpcInterfaces";

async function executeQuery(iModel: IModelConnection, ecsql: string, bindings?: any[] | object): Promise<any[]> {
  const rows: any[] = [];
  for await (const row of iModel.query(ecsql, bindings)) {
    rows.push(row);
  }
  return rows;
}

describe("IModelConnection (#integration)", () => {
  let iModel: IModelConnection;
  let testProjectId: string;
  let testIModelId: string;

  before(async () => {
    MockRender.App.startup();
    Logger.initializeToConsole();
    Logger.setLevel("imodeljs-frontend.IModelConnection", LogLevel.Error); // Change to trace to debug

    const imsTestAuthorizationClient = new ImsTestAuthorizationClient();
    await imsTestAuthorizationClient.signIn(new ClientRequestContext(), TestUsers.regular);
    IModelApp.authorizationClient = imsTestAuthorizationClient;

    assert(IModelApp.authorizationClient);

    testProjectId = await TestUtility.getTestProjectId("Bridge866");
    testIModelId = await TestUtility.getTestIModelId(testProjectId, "Building");

    iModel = await IModelConnection.open(testProjectId, testIModelId, OpenMode.Readonly, IModelVersion.latest());
    await iModel.close();
  });

  after(async () => {
    if (iModel)
      await iModel.close();
    MockRender.App.shutdown();
  });

  it("should be able to open an IModel", async () => {
    const projectId = await TestUtility.getTestProjectId("Bridge866");
    const iModelId = await TestUtility.getTestIModelId(projectId, "Building");

    // time to open an imodel with latest revision
    const startTime1 = new Date().getTime();
    const noVersionsIModel = await IModelConnection.open(projectId, iModelId, OpenMode.Readonly, IModelVersion.latest());
    const endTime1 = new Date().getTime();
    assert.isNotNull(noVersionsIModel);
    assert.exists(noVersionsIModel);
    const elapsedTime1 = (endTime1 - startTime1) / 1000.0;
    await TestRpcInterface.getClient().saveCSV("Open", "Open an iModel with latest revision", elapsedTime1);
    await noVersionsIModel.close();

    // time to open an imodel with first revision
    const startTime = new Date().getTime();
    const noVersionsIModel2 = await IModelConnection.open(projectId, iModelId, OpenMode.Readonly, IModelVersion.first());
    const endTime = new Date().getTime();
    assert.isNotNull(noVersionsIModel2);
    assert.exists(noVersionsIModel2);
    const elapsedTime = (endTime - startTime) / 1000.0;
    await TestRpcInterface.getClient().saveCSV("Open", "Open an iModel with first revision", elapsedTime);
    await noVersionsIModel2.close();
  });

  it("Execute a ECSQL Query", async () => {
    iModel = await IModelConnection.open(testProjectId, testIModelId, OpenMode.Readonly, IModelVersion.latest());
    assert.exists(iModel);

    // time to execute a query
    const startTime1 = new Date().getTime();
    const rows = await executeQuery(iModel, "SELECT * FROM BisCore.LineStyle");
    const endTime1 = new Date().getTime();
    const elapsedTime1 = (endTime1 - startTime1) / 1000.0;
    await TestRpcInterface.getClient().saveCSV("ExecuteQuery", "Execute a simple ECSQL query", elapsedTime1);
    assert.equal(rows.length, 7);
  });

});
