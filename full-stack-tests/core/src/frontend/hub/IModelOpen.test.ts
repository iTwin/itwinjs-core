/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { BeDuration, GuidString, Logger } from "@itwin/core-bentley";
import { ChangeSet, ChangeSetQuery, IModelHubClient } from "@bentley/imodelhub-client";
import { IModelVersion } from "@itwin/core-common";
import { CheckpointConnection, IModelApp, IModelConnection, MockRender } from "@itwin/core-frontend";
import { TestUsers } from "@itwin/oidc-signin-tool/lib/cjs/TestUsers";
import { TestRpcInterface } from "../../common/RpcInterfaces";
import { TestUtility } from "./TestUtility";

describe("Opening IModelConnection (#integration)", () => {
  let testITwinId: GuidString;
  let testIModelId: GuidString;
  let testChangeSetId: string;

  before(async () => {
    await MockRender.App.startup({
      applicationVersion: "1.2.1.1",
      hubAccess: TestUtility.iTwinPlatformEnv.hubAccess,
    });
    Logger.initializeToConsole();

    await TestUtility.initialize(TestUsers.regular);
    IModelApp.authorizationClient = TestUtility.iTwinPlatformEnv.authClient;

    // Setup a model with a large number of change sets
    testITwinId = await TestUtility.queryITwinIdByName(TestUtility.testITwinName);
    testIModelId = await TestUtility.queryIModelIdByName(testITwinId, TestUtility.testIModelNames.stadium);

    // Setup a testChangeSetId somewhere in the middle of the change history
    const accessToken = await IModelApp.getAccessToken();
    const changeSets: ChangeSet[] = await (new IModelHubClient()).changeSets.get(accessToken, testIModelId, new ChangeSetQuery().latest());
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
      const openPromise = CheckpointConnection.openRemote(testITwinId, testIModelId, IModelVersion.asOfChangeSet(testChangeSetId));
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

  // this test is useless
  it.skip("should be able to open multiple read-only connections to an iModel that requires a large number of change sets to be applied", async () => {
    await doTest();
  });

});
