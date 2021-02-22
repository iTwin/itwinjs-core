/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { Logger, LogLevel, OpenMode } from "@bentley/bentleyjs-core";
import { IModelApp, IModelAppOptions, IModelConnection, MockRender, RemoteBriefcaseConnection } from "@bentley/imodeljs-frontend";
import { TestUsers } from "@bentley/oidc-signin-tool/lib/TestUsers";
import { TestRpcInterface } from "../../common/RpcInterfaces";
import { TestUtility } from "./TestUtility";

const testProjectName = "iModelJsIntegrationTest";
const testIModelName = "ReadWriteTest";

async function executeQuery(iModel: IModelConnection, ecsql: string, bindings?: any[] | object): Promise<any[]> {
  const rows: any[] = [];
  for await (const row of iModel.query(ecsql, bindings)) {
    rows.push(row);
  }
  return rows;
}

/* eslint-disable deprecation/deprecation */
describe("ChangeSummary (#integration)", () => {
  let iModel: RemoteBriefcaseConnection;
  let testProjectId: string;
  let testIModelId: string;

  before(async () => {
    Logger.initializeToConsole();
    Logger.setLevel("imodeljs-frontend.IModelConnection", LogLevel.Error); // Change to trace to debug

    const authorizationClient = await TestUtility.initializeTestProject(testProjectName, TestUsers.regular);

    const options: IModelAppOptions = {
      authorizationClient,
      imodelClient: TestUtility.imodelCloudEnv.imodelClient,
      applicationVersion: "1.2.1.1",
    };
    await IModelApp.shutdown();
    await MockRender.App.startup(options);

    assert(IModelApp.authorizationClient);

    testProjectId = await TestUtility.getTestProjectId(testProjectName);
    testIModelId = await TestUtility.getTestIModelId(testProjectId, testIModelName);

    iModel = await RemoteBriefcaseConnection.open(testProjectId, testIModelId);
  });

  after(async () => {
    if (iModel)
      await iModel.close();
    await MockRender.App.shutdown();
  });

  // ###TODO AFFAN ???
  it.skip("Change cache file generation when attaching change cache", async () => {
    assert.exists(iModel);
    await TestRpcInterface.getClient().deleteChangeCache(iModel.getRpcProps());
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
    // for now, imodel must be open read/write for changesummary extraction
    await iModel.close();

    const testIModel = await RemoteBriefcaseConnection.open(testProjectId, testIModelId, OpenMode.ReadWrite);
    try {
      await TestRpcInterface.getClient().deleteChangeCache(testIModel.getRpcProps());
      await TestRpcInterface.getClient().extractChangeSummaries(testIModel.getRpcProps(), { currentChangeSetOnly: true });
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
