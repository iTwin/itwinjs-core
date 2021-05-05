/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { BeDuration, GuidString } from "@bentley/bentleyjs-core";
import { ElectronApp } from "@bentley/electron-manager/lib/ElectronFrontend";
import { IModelVersion, SyncMode } from "@bentley/imodeljs-common";
import { BriefcaseConnection, NativeApp } from "@bentley/imodeljs-frontend";
import { ProgressInfo } from "@bentley/itwin-client";
import { usingOfflineScope } from "../HttpRequestHook";
import { NativeAppTest } from "../NativeAppTest";

describe("NativeApp Download (#integration)", () => {
  let testProjectId: GuidString;

  before(async () => {
    await ElectronApp.startup({
      iModelApp: {
        applicationId: "1234",
        applicationVersion: "testappversion",
        sessionId: "testsessionid",
      },
    });

    testProjectId = await NativeAppTest.initializeTestProject();
  });

  after(async () => ElectronApp.shutdown());

  it("Download Briefcase with progress events (#integration)", async () => {
    let events = 0;
    let loaded = 0;
    let total = 0;
    const locTestIModelId = await NativeAppTest.getTestIModelId(testProjectId, "CodesPushTest");
    const downloader = await NativeApp.requestDownloadBriefcase(testProjectId, locTestIModelId, { syncMode: SyncMode.PullOnly }, IModelVersion.latest(),
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
      const rs = await NativeApp.getCachedBriefcases(locTestIModelId);
      assert(rs.length > 0);
      const connection = await BriefcaseConnection.openFile({ fileName: downloader.fileName });
      const rowCount = await connection.queryRowCount("SELECT ECInstanceId FROM bis.Element LIMIT 1");
      assert.notEqual(rowCount, 0);
      await connection.close();
      await NativeApp.deleteBriefcase(downloader.fileName);
    });
  });

  it("Should be able to cancel download (#integration)", async () => {
    const locTestIModelId = await NativeAppTest.getTestIModelId(testProjectId, "Stadium Dataset 1");
    const downloader = await NativeApp.requestDownloadBriefcase(testProjectId, locTestIModelId, { syncMode: SyncMode.PullOnly });

    let cancelled1 = false;
    let cancelled2 = false;
    void BeDuration.fromSeconds(.5).executeAfter(async () => { cancelled1 = await downloader.requestCancel(); });
    try {
      await downloader.downloadPromise;
    } catch (err) {
      cancelled2 = true;
    }
    await NativeApp.deleteBriefcase(downloader.fileName);
    assert.isTrue(cancelled1);
    assert.isTrue(cancelled2);
  });

});
