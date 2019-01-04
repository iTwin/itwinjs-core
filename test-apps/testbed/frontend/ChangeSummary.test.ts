/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { OpenMode, Logger, LogLevel } from "@bentley/bentleyjs-core";
import { AccessToken } from "@bentley/imodeljs-clients";
import { TestData } from "./TestData";
import { TestRpcInterface } from "../common/TestRpcInterface";
import { IModelConnection } from "@bentley/imodeljs-frontend";
import { MockRender } from "./MockRender";

describe("ChangeSummary (#integration)", () => {
  let iModel: IModelConnection;
  let accessToken: AccessToken;
  let testProjectId: string;
  let testIModelId: string;

  before(async () => {
    MockRender.App.startup();

    Logger.initializeToConsole();
    Logger.setLevel("imodeljs-frontend.IModelConnection", LogLevel.Error); // Change to trace to debug

    accessToken = await TestData.getTestUserAccessToken();
    testProjectId = await TestData.getTestProjectId(accessToken, "iModelJsIntegrationTest");
    testIModelId = await TestData.getTestIModelId(accessToken, testProjectId, "ReadWriteTest");

    iModel = await IModelConnection.open(accessToken, testProjectId, testIModelId);
  });

  after(async () => {
    if (iModel)
      await iModel.close(accessToken);
    MockRender.App.shutdown();
  });

  it("Change cache file generation when attaching change cache", async () => {
    assert.exists(iModel);
    await TestRpcInterface.getClient().deleteChangeCache(iModel.iModelToken);
    await iModel.attachChangeCache();
    const changeSummaryRows: any[] = await iModel.executeQuery("SELECT count(*) cnt FROM change.ChangeSummary");
    assert.equal(changeSummaryRows.length, 1);
    assert.equal(changeSummaryRows[0].cnt, 0);
    const changeSetRows = await iModel.executeQuery("SELECT count(*) cnt FROM imodelchange.ChangeSet");
    assert.equal(changeSetRows.length, 1);
    assert.equal(changeSetRows[0].cnt, 0);
  }).timeout(99999);

  it("Change cache file generation during change summary extraction", async () => {
    assert.exists(iModel);
    // for now, imodel must be open readwrite for changesummary extraction
    await iModel.close(accessToken);

    const testIModel: IModelConnection = await IModelConnection.open(accessToken, testProjectId, testIModelId, OpenMode.ReadWrite);
    try {
      await TestRpcInterface.getClient().deleteChangeCache(testIModel.iModelToken);
      await TestRpcInterface.getClient().extractChangeSummaries(accessToken, testIModel.iModelToken, { currentChangeSetOnly: true });
      await testIModel.attachChangeCache();

      const changeSummaryRows: any[] = await testIModel.executeQuery("SELECT count(*) cnt FROM change.ChangeSummary");
      assert.equal(changeSummaryRows.length, 1);
      const changeSetRows = await testIModel.executeQuery("SELECT count(*) cnt FROM imodelchange.ChangeSet");
      assert.equal(changeSetRows.length, 1);
      assert.equal(changeSetRows[0].cnt, changeSummaryRows[0].cnt);
    } finally {
      await testIModel.close(accessToken);
    }
  }); // .timeout(99999);
});
