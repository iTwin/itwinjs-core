/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { Config, GuidString } from "@bentley/bentleyjs-core";
import { BriefcaseDownloader, BriefcaseProps, IModelVersion, SyncMode } from "@bentley/imodeljs-common";
import { IModelApp, NativeApp, NativeAppLogger } from "@bentley/imodeljs-frontend";
import { ProgressInfo } from "@bentley/itwin-client";
import { TestFrontendAuthorizationClient, TestUsers } from "@bentley/oidc-signin-tool/lib/frontend";
import { usingOfflineScope } from "./HttpRequestHook";
import { TestChangeSetUtility } from "./TestChangeSetUtility";
import { TestUtility } from "./TestUtility";

describe("NativeApp (#integration)", () => {
  let testProjectName: string;
  let testProjectId: GuidString;
  let testIModelName: string;
  let testIModelId: GuidString;

  before(async () => {
    await NativeApp.startup({
      applicationId: "1234",
      applicationVersion: "testappversion",
      sessionId: "testsessionid",
    });

    const requestContext = await TestUtility.getAuthorizedClientRequestContext(TestUsers.regular);
    IModelApp.authorizationClient = new TestFrontendAuthorizationClient(requestContext.accessToken);

    testProjectName = Config.App.get("imjs_test_project_name");
    testIModelName = Config.App.get("imjs_test_imodel_name");

    await TestUtility.initializeTestProject(testProjectName, TestUsers.regular);
    testProjectId = await TestUtility.getTestProjectId(testProjectName);
    testIModelId = await TestUtility.getTestIModelId(testProjectId, testIModelName);

    await TestUtility.purgeAcquiredBriefcases(testIModelId);
  });

  after(async () => {
    await NativeApp.shutdown();
    IModelApp.authorizationClient = undefined;
  });

  it.skip("should purge the briefcase cache", async () => {
    await TestUtility.purgeBriefcaseCache();
  });

  it("Download Briefcase (#integration)", async () => {
    // Redirect native log to backend. Logger must be config.
    NativeAppLogger.initialize();

    const downloader: BriefcaseDownloader = await NativeApp.requestDownloadBriefcase(testProjectId, testIModelId, { syncMode: SyncMode.PullOnly });
    await downloader.downloadPromise;

    await usingOfflineScope(async () => {
      const briefcases = await NativeApp.getBriefcases();
      const rs = briefcases.filter((_: BriefcaseProps) => _.iModelId === testIModelId);
      assert(rs.length > 0);
      assert.isNumber(rs[0].fileSize);
      assert(rs[0].fileSize! > 0);
      const conn = await NativeApp.openBriefcase(downloader.briefcaseProps);
      const rowCount = await conn.queryRowCount("SELECT ECInstanceId FROM bis.Element");
      assert.notEqual(rowCount, 0);
    });
  });

  it("Download Briefcase Offline (#integration)", async () => {
    // Redirect native log to backend. Logger must be config.
    NativeAppLogger.initialize();

    await usingOfflineScope(async () => {
      try {
        const downloader: BriefcaseDownloader = await NativeApp.requestDownloadBriefcase(testProjectId, testIModelId, { syncMode: SyncMode.PullOnly });
        await downloader.downloadPromise;
        assert(false, "downloadBriefcase() should fail in offlineScope");
      } catch {
      }
    });
  });

  it("should be able to start and finish downloading a briefcase (#integration)", async () => {
    // Redirect native log to backend. Logger must be config.
    NativeAppLogger.initialize();
    const locTestIModelName = "Stadium Dataset 1";
    const locTestIModelId = await TestUtility.getTestIModelId(testProjectId, locTestIModelName);

    const downloader: BriefcaseDownloader = await NativeApp.requestDownloadBriefcase(testProjectId, locTestIModelId, { syncMode: SyncMode.PullOnly });
    await downloader.downloadPromise;

    const briefcaseKey = downloader.briefcaseProps.key;
    await NativeApp.openBriefcase(downloader.briefcaseProps);
    await NativeApp.closeBriefcase(briefcaseKey);

    await NativeApp.deleteBriefcase(briefcaseKey);
  });

  it("Progress event (#integration)", async () => {
    // Redirect native log to backend. Logger must be config.
    NativeAppLogger.initialize();
    const locTestIModelName = "Stadium Dataset 1";
    const locTestIModelId = await TestUtility.getTestIModelId(testProjectId, locTestIModelName);

    let events = 0;
    const downloader: BriefcaseDownloader = await NativeApp.requestDownloadBriefcase(testProjectId, locTestIModelId, { syncMode: SyncMode.PullOnly }, IModelVersion.latest(),
      (_progress: ProgressInfo) => {
        events++;
      });

    await downloader.downloadPromise;
    assert.notEqual(events, 0);

    await NativeApp.deleteBriefcase(downloader.briefcaseProps.key);
  });

  // NEEDS_WORK: VSTS#295999
  it("Should be able to cancel an in progress download (#integration)", async () => {
    NativeAppLogger.initialize();
    const locTestIModelName = "Stadium Dataset 1";
    const locTestIModelId = await TestUtility.getTestIModelId(testProjectId, locTestIModelName);

    const downloader: BriefcaseDownloader = await NativeApp.requestDownloadBriefcase(testProjectId, locTestIModelId, { syncMode: SyncMode.PullOnly });

    let cancelled1: boolean = false;
    setTimeout(async () => {
      try {
        cancelled1 = await downloader.requestCancel();
      } catch (err) {
        assert(false, "WIP: The 'user cancelled' error is now caught here...");
      }
    }, 10000);

    let cancelled2: boolean = false;
    try {
      await downloader.downloadPromise;
      await NativeApp.deleteBriefcase(downloader.briefcaseProps.key);
    } catch (err) {
      cancelled2 = true;
    }

    assert.isTrue(cancelled1);
    assert.isTrue(cancelled2);
  });

  // NEEDS_WORK: VSTS#295999
  it.skip("should be able to update a briefcase by reopening it", async () => {
    const testIModelBaseName = "NativeAppTest";
    const testChangeSetUtility = new TestChangeSetUtility();
    await testChangeSetUtility.initialize(testProjectName, testIModelBaseName);

    // Create a test iModel (using syncMode: PullAndPush)
    const locTestIModelId = await testChangeSetUtility.createTestIModel();

    // Download the test iModel in NativeApp (using syncMode: PullOnly)
    const downloader: BriefcaseDownloader = await NativeApp.requestDownloadBriefcase(testProjectId, locTestIModelId, { syncMode: SyncMode.PullOnly }, IModelVersion.latest());
    await downloader.downloadPromise;

    const briefcases: BriefcaseProps[] = await NativeApp.getBriefcases();
    assert.isTrue(briefcases.length > 0);

    // Update test iModel in the Hub with a change set
    await testChangeSetUtility.pushTestChangeSet();

    // Restart the Host (to force re-initialization of caches)
    await TestUtility.restartIModelHost();

    // Download the test iModel in NativeApp again (using SyncMode: PUllOnly)
    const updatedDownloader: BriefcaseDownloader = await NativeApp.requestDownloadBriefcase(testProjectId, locTestIModelId, { syncMode: SyncMode.PullOnly }, IModelVersion.latest());
    await updatedDownloader.downloadPromise;

    // Validate that the change set got updated
    assert.notEqual(updatedDownloader.briefcaseProps.changeSetId, downloader.briefcaseProps.changeSetId);
    // NEEDS_WORK: Check that the change set id matches the one that was pushed

    const updatedBriefcases: BriefcaseProps[] = await NativeApp.getBriefcases();
    assert.equal(updatedBriefcases.length, briefcases.length);

    // Delete the downloaded test iModel in NativeApp
    await NativeApp.deleteBriefcase(updatedDownloader.briefcaseProps.key);

    // Delete test iModel from the Hub and disk
    await testChangeSetUtility.deleteTestIModel();
  });

});
