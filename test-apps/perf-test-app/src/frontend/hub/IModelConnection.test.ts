/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { Id64, OpenMode, Logger, LogLevel } from "@bentley/bentleyjs-core";
import { IModelVersion } from "@bentley/imodeljs-common";
import { TestData } from "./TestData";
import { IModelConnection, MockRender } from "@bentley/imodeljs-frontend";
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

  before(async () => {
    MockRender.App.startup();
    Logger.initializeToConsole();
    Logger.setLevel("imodeljs-frontend.IModelConnection", LogLevel.Error); // Change to trace to debug
    await TestData.load();
    iModel = await IModelConnection.open(TestData.accessToken, TestData.testProjectId, TestData.testIModelId);
  });

  after(async () => {
    if (iModel)
      await iModel.close(TestData.accessToken);
    MockRender.App.shutdown();
  });

  it("should be able to open an IModel", async () => {
    const projectId = await TestData.getTestProjectId(TestData.accessToken, "iModelJsIntegrationTest");
    const iModelId = await TestData.getTestIModelId(TestData.accessToken, projectId, "NoVersionsTest");

    // time to open an imodel with latest revision
    const startTime1 = new Date().getTime();
    const noVersionsIModel = await IModelConnection.open(TestData.accessToken, projectId, iModelId, OpenMode.Readonly, IModelVersion.latest());
    const endTime1 = new Date().getTime();
    assert.isNotNull(noVersionsIModel);
    assert.exists(noVersionsIModel);
    const elapsedTime1 = (endTime1 - startTime1) / 1000.0;
    await TestRpcInterface.getClient().saveCSV("Open", "Open an iModel with latest revision", elapsedTime1);

    // time to open an imodel with first revision
    const startTime = new Date().getTime();
    const noVersionsIModel2 = await IModelConnection.open(TestData.accessToken, projectId, iModelId, OpenMode.Readonly, IModelVersion.first());
    const endTime = new Date().getTime();
    assert.isNotNull(noVersionsIModel2);
    assert.exists(noVersionsIModel2);
    const elapsedTime = (endTime - startTime) / 1000.0;
    await TestRpcInterface.getClient().saveCSV("Open", "Open an iModel with first revision", elapsedTime);
  });

  it("Execute a ECSQL Query", async () => {
    assert.exists(iModel);

    // time to execute a query
    const startTime1 = new Date().getTime();
    const rows = await executeQuery(iModel, "SELECT ECInstanceId,GeometryStream FROM bis.GeometricElement3d WHERE GeometryStream IS NOT NULL LIMIT 1");
    const endTime1 = new Date().getTime();
    const elapsedTime1 = (endTime1 - startTime1) / 1000.0;
    await TestRpcInterface.getClient().saveCSV("ExecuteQuery", "Execute an ECSQL query", elapsedTime1);

    assert.equal(rows.length, 1);
    const row: any = rows[0];
    assert.isTrue(Id64.isValidId64(row.id));
    assert.isDefined(row.geometryStream);
    const geomStream: Uint8Array = row.geometryStream;
    assert.isAtLeast(geomStream.byteLength, 1);
  });

});
