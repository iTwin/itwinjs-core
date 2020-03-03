/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { OpenMode, Logger, GuidString, BeDuration } from "@bentley/bentleyjs-core";

import { ChangeSetQuery, IModelHubClient, ChangeSet } from "@bentley/imodeljs-clients";
import { IModelVersion } from "@bentley/imodeljs-common";
import { TestUtility } from "./TestUtility";
import { TestAuthorizationClient, TestUsers } from "@bentley/oidc-signin-tool/lib/TestUsers";
import { IModelConnection, MockRender, IModelApp, AuthorizedFrontendRequestContext } from "@bentley/imodeljs-frontend";

describe("Opening IModelConnection (#integration)", () => {
  let testProjectId: GuidString;
  let testIModelId: GuidString;
  let testChangeSetId: GuidString;

  before(async () => {
    MockRender.App.startup();
    Logger.initializeToConsole();

    const testProjectName = "iModelJsIntegrationTest";
    const testIModelName = "Stadium Dataset 1";

    await TestUtility.initializeTestProject(testProjectName, TestUsers.regular);

    const requestContext = await TestUtility.getAuthorizedClientRequestContext(TestUsers.regular);
    IModelApp.authorizationClient = new TestAuthorizationClient(requestContext.accessToken);

    // Setup a model with a large number of change sets
    testProjectId = await TestUtility.getTestProjectId(testProjectName);
    testIModelId = await TestUtility.getTestIModelId(testProjectId, testIModelName);

    // Setup a testChangeSetId somewhere in the middle of the change history
    const authorizedRequestContext = await AuthorizedFrontendRequestContext.create();
    const changeSets: ChangeSet[] = await (new IModelHubClient()).changeSets.get(authorizedRequestContext, testIModelId, new ChangeSetQuery().latest());
    assert.isAbove(changeSets.length, 5);
    testChangeSetId = changeSets[Math.floor(changeSets.length / 2)].wsgId;
  });

  after(async () => {
    await TestUtility.purgeAcquiredBriefcases(testIModelId);
    MockRender.App.shutdown();
  });

  const doTest = async (openMode: OpenMode) => {
    const promiseArray = new Array<Promise<IModelConnection>>();
    let promiseChainWithShortWaits: Promise<void> = Promise.resolve();
    let promiseChainWithFullWaits: Promise<void> = Promise.resolve();
    let n = 0;
    while (++n < 10) {
      const openPromise = IModelConnection.open(testProjectId, testIModelId, openMode, IModelVersion.asOfChangeSet(testChangeSetId));
      const waitPromise = BeDuration.wait(5000); // 5 seconds
      const racePromise = Promise.race([openPromise, waitPromise]).then(() => Promise.resolve());

      promiseArray.push(openPromise);
      promiseChainWithShortWaits = promiseChainWithShortWaits.then(async () => racePromise);
      promiseChainWithFullWaits = promiseChainWithFullWaits.then(async () => openPromise).then(() => Promise.resolve());
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
    await doTest(OpenMode.Readonly);
  });

  it("should be able to open multiple read-write connections to an iModel that requires a large number of change sets to be applied", async () => {
    await doTest(OpenMode.ReadWrite);
  });

});
