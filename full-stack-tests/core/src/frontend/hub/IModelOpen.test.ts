/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { ChangeSet, ChangeSetQuery, IModelHubClient } from "@bentley/imodelhub-client";
import { ProgressInfo } from "@bentley/itwin-client";
import { BeDuration, GuidString, Logger, ProcessDetector } from "@itwin/core-bentley";
import { IModelVersion, SyncMode } from "@itwin/core-common";
import { BriefcaseConnection, CheckpointConnection, IModelApp, IModelConnection, MockRender, NativeApp } from "@itwin/core-frontend";
import { TestUsers } from "@itwin/oidc-signin-tool/lib/cjs/TestUsers";
import { TestRpcInterface } from "../../common/RpcInterfaces";
import { usingOfflineScope } from "../HttpRequestHook";
import { TestUtility } from "../TestUtility";

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

if (ProcessDetector.isElectronAppFrontend) {

  describe("Electron/Native iModel Download (#integration)", async () => {

    let iTwinId: GuidString;

    before(async () => {
      iTwinId = await TestUtility.getTestITwinId();
    });

    it("Download Briefcase with progress events (#integration)", async () => {
      let events = 0;
      let loaded = 0;
      let total = 0;
      const iModelId = await TestUtility.queryIModelIdByName(TestUtility.testITwinName, TestUtility.testIModelNames.codePush);
      const downloader = await NativeApp.requestDownloadBriefcase(iTwinId, iModelId, { syncMode: SyncMode.PullOnly }, IModelVersion.latest(),
        (progress: ProgressInfo) => {
          assert.isNumber(progress.loaded);
          assert.isNumber(progress.total);
          assert.isTrue(progress.loaded >= loaded);
          assert.isTrue(progress.total! >= progress.loaded);
          loaded = progress.loaded;
          total = progress.total!;
          events++;
        });

      assert(loaded >= total);
      await downloader.downloadPromise;
      assert.notEqual(events, 0);

      await usingOfflineScope(async () => {
        const rs = await NativeApp.getCachedBriefcases(iModelId);
        assert(rs.length > 0);
        const connection = await BriefcaseConnection.openFile({ fileName: downloader.fileName });
        const rowCount = await connection.queryRowCount("SELECT ECInstanceId FROM bis.Element LIMIT 1");
        assert.notEqual(rowCount, 0);
        await connection.close();
        await NativeApp.deleteBriefcase(downloader.fileName);
      });
    });

    it("Should be able to cancel download (#integration)", async () => {
      const iModelId = await TestUtility.queryIModelIdByName(TestUtility.testITwinName, TestUtility.testIModelNames.stadium);
      let downloadAborted = false;
      const fileName = await NativeApp.getBriefcaseFileName({ iModelId, briefcaseId: 0 });
      await NativeApp.deleteBriefcase(fileName);

      const downloader = await NativeApp.requestDownloadBriefcase(iTwinId, iModelId, { fileName, syncMode: SyncMode.PullOnly }, IModelVersion.latest(),
        (progress: ProgressInfo) => {
          assert.isNumber(progress.loaded);
          assert.isNumber(progress.total);
          assert.isTrue(progress.total! >= progress.loaded);
          if (progress.total! > 0 && progress.loaded > (progress.total! / 8))
            void downloader.requestCancel(); // cancel after 1/8 of the file is downloaded
        });

      try {
        await downloader.downloadPromise;
      } catch (err: any) {
        assert.isTrue(err.message.includes("cancelled"));
        downloadAborted = true;
      }
      await NativeApp.deleteBriefcase(downloader.fileName);
      assert.isTrue(downloadAborted, "download should abort");
    });

  });
}
