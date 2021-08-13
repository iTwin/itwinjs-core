/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { BeDuration, GuidString, Logger } from "@bentley/bentleyjs-core";
import { ChangeSet, ChangeSetQuery, IModelHubClient } from "@bentley/imodelhub-client";
import { IModelVersion } from "@bentley/imodeljs-common";
import { AuthorizedFrontendRequestContext, CheckpointConnection, IModelApp, IModelConnection, MockRender } from "@bentley/imodeljs-frontend";
import { TestUsers } from "@bentley/oidc-signin-tool/lib/TestUsers";
import { TestRpcInterface } from "../../common/RpcInterfaces";
import { TestUtility } from "./TestUtility";

describe("Opening IModelConnection (#integration)", () => {
  let testContextId: GuidString;
  let testIModelId: GuidString;
  let testChangeSetId: string;

  before(async () => {
    await MockRender.App.startup({
      applicationVersion: "1.2.1.1",
    });
    Logger.initializeToConsole();

    const authorizationClient = await TestUtility.initializeTestProject(TestUtility.testContextName, TestUsers.regular);
    IModelApp.authorizationClient = authorizationClient;

    // Setup a model with a large number of change sets
    testContextId = await TestUtility.queryContextIdByName(TestUtility.testContextName);
    testIModelId = await TestUtility.queryIModelIdbyName(testContextId, TestUtility.testIModelNames.stadium);

    // Setup a testChangeSetId somewhere in the middle of the change history
    const authorizedRequestContext = await AuthorizedFrontendRequestContext.create();
    const changeSets: ChangeSet[] = await (new IModelHubClient()).changeSets.get(authorizedRequestContext, testIModelId, new ChangeSetQuery().latest());
    assert.isAbove(changeSets.length, 5);
    testChangeSetId = changeSets[Math.floor(changeSets.length / 2)].wsgId;

    await TestRpcInterface.getClient().purgeCheckpoints(testIModelId);
  });

  after(async () => {
    await TestUtility.purgeAcquiredBriefcases(testIModelId);
    await MockRender.App.shutdown();
  });

  const doTest = async () => {
    const promiseArray = new Array<Promise<IModelConnection>>();
    let promiseChainWithShortWaits: Promise<any> = Promise.resolve();
    let promiseChainWithFullWaits: Promise<any> = Promise.resolve();
    let n = 0;
    while (++n < 10) {
      const openPromise = CheckpointConnection.openRemote(testContextId, testIModelId, IModelVersion.asOfChangeSet(testChangeSetId));
      const waitPromise = BeDuration.wait(5000); // 5 seconds
      const racePromise = Promise.race([openPromise, waitPromise]);

      promiseArray.push(openPromise);
      promiseChainWithShortWaits = promiseChainWithShortWaits.then(async () => racePromise);
      promiseChainWithFullWaits = promiseChainWithFullWaits.then(async () => openPromise);
    }

    await promiseChainWithShortWaits;
    await promiseChainWithFullWaits;

    for (const openPromise of promiseArray) {
      const iModel: IModelConnection = await openPromise;
      assert.isDefined(iModel);
      assert.isTrue(iModel.isOpen);
    }

    const iModelToClose: IModelConnection = await promiseArray[0];
    await iModelToClose.close();
  };

  it("should be able to open multiple read-only connections to an iModel that requires a large number of change sets to be applied", async () => {
    await doTest();
  });

});
