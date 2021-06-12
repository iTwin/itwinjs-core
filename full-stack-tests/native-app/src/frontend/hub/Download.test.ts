/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { GuidString } from "@bentley/bentleyjs-core";
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
    const iModelId = await NativeAppTest.getTestIModelId(testProjectId, "CodesPushTest");
    const downloader = await NativeApp.requestDownloadBriefcase(testProjectId, iModelId, { syncMode: SyncMode.PullOnly }, IModelVersion.latest(),
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
    const iModelId = await NativeAppTest.getTestIModelId(testProjectId, "Stadium Dataset 1");
    let downloadAborted = false;
    const fileName = await NativeApp.getBriefcaseFileName({ iModelId, briefcaseId: 0 });
    await NativeApp.deleteBriefcase(fileName);

    const downloader = await NativeApp.requestDownloadBriefcase(testProjectId, iModelId, { fileName, syncMode: SyncMode.PullOnly }, IModelVersion.latest(),
      (progress: ProgressInfo) => {
        assert.isNumber(progress.loaded);
        assert.isNumber(progress.total);
        assert.isTrue(progress.total! >= progress.loaded);
        if (progress.total! > 0 && progress.loaded > (progress.total! / 8))
          void downloader.requestCancel(); // cancel after 1/8 of the file is downloaded
      });

    try {
      await downloader.downloadPromise;
    } catch (err) {
      assert.isTrue(err.message.includes("cancelled"));
      downloadAborted = true;
    }
    await NativeApp.deleteBriefcase(downloader.fileName);
    assert.isTrue(downloadAborted, "download should abort");
  });

});
