/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { OpenMode, Logger, LogLevel, ClientRequestContext } from "@bentley/bentleyjs-core";
import { ImsTestAuthorizationClient } from "@bentley/imodeljs-clients";
import { TestUtility } from "./TestUtility";
import { TestUsers } from "./TestUsers";
import { TestRpcInterface } from "../../common/RpcInterfaces";
import { IModelConnection, MockRender, IModelApp } from "@bentley/imodeljs-frontend";

async function executeQuery(iModel: IModelConnection, ecsql: string, bindings?: any[] | object): Promise<any[]> {
  const rows: any[] = [];
  for await (const row of iModel.query(ecsql, bindings)) {
    rows.push(row);
  }
  return rows;
}

describe("ChangeSummary (#integration)", () => {
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
    assert(IModelApp.authorizationClient);

    testProjectId = await TestUtility.getTestProjectId("iModelJsIntegrationTest");
    testIModelId = await TestUtility.getTestIModelId(testProjectId, "ReadWriteTest");

    iModel = await IModelConnection.open(testProjectId, testIModelId);
  });

  after(async () => {
    if (iModel)
      await iModel.close();
    MockRender.App.shutdown();
  });

  // ###TODO AFFAN ???
  it.skip("Change cache file generation when attaching change cache", async () => {
    assert.exists(iModel);
    await TestRpcInterface.getClient().deleteChangeCache(iModel.iModelToken.toJSON());
    await iModel.attachChangeCache();
    const changeSummaryRows: any[] = await executeQuery(iModel, "SELECT count(*) cnt FROM change.ChangeSummary");
    assert.equal(changeSummaryRows.length, 1);
    assert.equal(changeSummaryRows[0].cnt, 0);
    const changeSetRows = await executeQuery(iModel, "SELECT count(*) cnt FROM imodelchange.ChangeSet");
    assert.equal(changeSetRows.length, 1);
    assert.equal(changeSetRows[0].cnt, 0);
  }).timeout(99999);

  // FIXME: This test has apparently been failing for a while now...
  it.skip("Change cache file generation during change summary extraction", async () => {
    assert.exists(iModel);
    // for now, imodel must be open readwrite for changesummary extraction
    await iModel.close();

    const testIModel: IModelConnection = await IModelConnection.open(testProjectId, testIModelId, OpenMode.ReadWrite);
    try {

      await TestRpcInterface.getClient().deleteChangeCache(testIModel.iModelToken.toJSON());
      await TestRpcInterface.getClient().extractChangeSummaries(testIModel.iModelToken.toJSON(), { currentChangeSetOnly: true });
      await testIModel.attachChangeCache();

      const changeSummaryRows: any[] = await executeQuery(testIModel, "SELECT count(*) cnt FROM change.ChangeSummary");
      assert.equal(changeSummaryRows.length, 1);
      const changeSetRows = await executeQuery(testIModel, "SELECT count(*) cnt FROM imodelchange.ChangeSet");
      assert.equal(changeSetRows.length, 1);
      assert.equal(changeSetRows[0].cnt, changeSummaryRows[0].cnt);
    } finally {
      await testIModel.close();
    }
  }); // .timeout(99999);
});
