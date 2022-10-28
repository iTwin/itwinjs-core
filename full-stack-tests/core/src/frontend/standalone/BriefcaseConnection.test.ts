/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { ProcessDetector } from "@itwin/core-bentley";
import { BriefcaseIdValue, IModelVersion } from "@itwin/core-common";
import { BriefcaseConnection, GenericAbortSignal, NativeApp } from "@itwin/core-frontend";
import { ProgressCallback } from "@itwin/core-frontend/lib/cjs/request/Request";
import { TestUsers } from "@itwin/oidc-signin-tool/lib/cjs/TestUsers";
import { assert, expect } from "chai";
import { TestUtility } from "../TestUtility";

type AbortSignalListener = (this: MockAbortSignal, ev: any) => any;

class MockAbortSignal implements GenericAbortSignal {
  private _listeners = new Set<AbortSignalListener>();

  public addEventListener(_type: "abort", listener: AbortSignalListener) {
    this._listeners.add(listener);
  }

  public removeEventListener(_type: "abort", listener: AbortSignalListener) {
    this._listeners.delete(listener);
  }

  public abort() {
    this._listeners.forEach((listener) => listener.bind(this)(undefined));
  }
}

if (ProcessDetector.isElectronAppFrontend) {

  describe("BriefcaseConnection (#integration)", async () => {

    beforeEach(async () => {
      await TestUtility.startFrontend();
      await TestUtility.initialize(TestUsers.regular);
    });

    afterEach(async () => {
      await TestUtility.shutdownFrontend();
    });

    it("should report progress when pulling changes", async () => {
      const iTwinId = await TestUtility.getTestITwinId();
      const iModelId = await TestUtility.queryIModelIdByName(iTwinId, TestUtility.testIModelNames.stadium);

      const downloader = await NativeApp.requestDownloadBriefcase(
        iTwinId,
        iModelId,
        { briefcaseId: BriefcaseIdValue.Unassigned },
        IModelVersion.first(),
      );
      await downloader.downloadPromise;

      const fileName = await NativeApp.getBriefcaseFileName({ iModelId, briefcaseId: downloader.briefcaseId });
      const connection = await BriefcaseConnection.openFile({ fileName, readonly: true });

      let lastProgressReport = { loaded: 0, total: 0 };
      const assertProgress: ProgressCallback = (progress) => {
        assert.isAbove(progress.loaded, lastProgressReport.loaded);
        assert.isDefined(progress.total);
        assert.isAtLeast(progress.total!, lastProgressReport.total);
        lastProgressReport = { ...progress, total: progress.total! };
      };

      try {
        await connection.pullChanges(20, { progressCallback: assertProgress });
      } finally {
        await connection.close();
        await NativeApp.deleteBriefcase(fileName);
      }

      assert.isAbove(lastProgressReport.loaded, 0);
      assert.equal(lastProgressReport.loaded, lastProgressReport.total);
    });

    it("should cancel pulling changes after abort signal", async () => {
      const iTwinId = await TestUtility.getTestITwinId();
      const iModelId = await TestUtility.queryIModelIdByName(iTwinId, TestUtility.testIModelNames.stadium);

      const downloader = await NativeApp.requestDownloadBriefcase(
        iTwinId,
        iModelId,
        { briefcaseId: BriefcaseIdValue.Unassigned },
        IModelVersion.first(),
      );
      await downloader.downloadPromise;

      const fileName = await NativeApp.getBriefcaseFileName({ iModelId, briefcaseId: downloader.briefcaseId });
      const connection = await BriefcaseConnection.openFile({ fileName, readonly: true });

      const abortSignal = new MockAbortSignal();
      let lastProgressReport = { loaded: 0, total: 0 };
      const progressCallback: ProgressCallback = (progress) => {
        assert.isDefined(progress.total);
        lastProgressReport = { ...progress, total: progress.total! };

        if (progress.loaded > progress.total! / 2)
          abortSignal.abort();
      };

      const pullPromise = connection.pullChanges(20, { progressCallback, abortSignal, progressInterval: 50 });

      try {
        await expect(pullPromise).to.eventually.be.rejectedWith(/cancelled|aborted/i);
        // Use following assert when BackendIModelsAccess returns IModelError with ChangeSetStatus.DownloadCancelled.
        // await expect(pullPromise).to.eventually.be.rejected.and.have.property("errorNumber", ChangeSetStatus.DownloadCancelled);
      } finally {
        await connection.pullChanges(20); // Finish pulling changes so that the changesets files would be deleted.
        await connection.close();
        await NativeApp.deleteBriefcase(fileName);
      }

      assert.isAbove(lastProgressReport.loaded, 0);
      assert.isBelow(lastProgressReport.loaded, lastProgressReport.total);
    });
  });
}
