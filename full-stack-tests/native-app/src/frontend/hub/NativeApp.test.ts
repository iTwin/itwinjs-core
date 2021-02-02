/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { Config, GuidString } from "@bentley/bentleyjs-core";
import { ElectronApp } from "@bentley/electron-manager/lib/ElectronFrontend";
import { BriefcaseDownloader, IModelVersion, SyncMode } from "@bentley/imodeljs-common";
import { BriefcaseConnection, IModelApp, NativeApp, NativeAppLogger } from "@bentley/imodeljs-frontend";
import { ProgressInfo } from "@bentley/itwin-client";
import { TestFrontendAuthorizationClient, TestUsers } from "@bentley/oidc-signin-tool/lib/frontend";
import { rpcInterfaces } from "../../common/RpcInterfaces";
import { usingOfflineScope } from "./HttpRequestHook";
import { TestUtility } from "./TestUtility";

describe("NativeApp (#integration)", () => {
  let testProjectName: string;
  let testProjectId: GuidString;
  let testIModelName: string;
  let testIModelId: GuidString;

  before(async () => {
    await ElectronApp.startup({
      iModelApp: {
        rpcInterfaces,
        applicationId: "1234",
        applicationVersion: "testappversion",
        sessionId: "testsessionid",
      },
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
    await ElectronApp.shutdown();
    IModelApp.authorizationClient = undefined;
  });

  it("Download Briefcase (#integration)", async () => {
    // Redirect native log to backend. Logger must be config.
    NativeAppLogger.initialize();

    const downloader: BriefcaseDownloader = await NativeApp.requestDownloadBriefcase(testProjectId, testIModelId, { syncMode: SyncMode.PullOnly });
    await downloader.downloadPromise;

    await usingOfflineScope(async () => {
      const rs = await NativeApp.getCachedBriefcases(testIModelId);
      assert(rs.length > 0);
      const conn = await BriefcaseConnection.openFile({ fileName: downloader.fileName });
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

    const downloader = await NativeApp.requestDownloadBriefcase(testProjectId, locTestIModelId, { syncMode: SyncMode.PullOnly });
    await downloader.downloadPromise;

    const connection = await BriefcaseConnection.openFile({ fileName: downloader.fileName });
    await connection.close();
    await NativeApp.deleteBriefcase(downloader.fileName);
  });

  it("Progress event (#integration)", async () => {
    // Redirect native log to backend. Logger must be config.
    NativeAppLogger.initialize();
    const locTestIModelName = "Stadium Dataset 1";
    const locTestIModelId = await TestUtility.getTestIModelId(testProjectId, locTestIModelName);

    let events = 0;
    let loaded = 0;
    const downloader = await NativeApp.requestDownloadBriefcase(testProjectId, locTestIModelId, { syncMode: SyncMode.PullOnly }, IModelVersion.latest(),
      (progress: ProgressInfo) => {
        assert.isNumber(progress.loaded);
        assert.isNumber(progress.total);
        assert.isTrue(progress.loaded >= loaded);
        assert.isTrue(progress.total! >= progress.loaded);
        loaded = progress.loaded;
        events++;
      });

    await downloader.downloadPromise;
    assert.notEqual(events, 0);

    await NativeApp.deleteBriefcase(downloader.fileName);
  });

  it("Should be able to cancel an in progress download (#integration)", async () => {
    NativeAppLogger.initialize();
    const locTestIModelName = "Stadium Dataset 1";
    const locTestIModelId = await TestUtility.getTestIModelId(testProjectId, locTestIModelName);

    const downloader = await NativeApp.requestDownloadBriefcase(testProjectId, locTestIModelId, { syncMode: SyncMode.PullOnly });

    let cancelled1: boolean = false;
    setTimeout(async () => { cancelled1 = await downloader.requestCancel(); }, 1000);
    let cancelled2: boolean = false;
    try {
      await downloader.downloadPromise;
      await NativeApp.deleteBriefcase(downloader.fileName);
    } catch (err) {
      cancelled2 = true;
    }

    assert.isTrue(cancelled1);
    assert.isTrue(cancelled2);
  });

});
