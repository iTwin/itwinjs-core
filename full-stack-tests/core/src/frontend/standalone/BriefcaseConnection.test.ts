/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { ProcessDetector } from "@itwin/core-bentley";
import { BatchType, BriefcaseIdValue, IModelVersion } from "@itwin/core-common";
import { BriefcaseConnection, GenericAbortSignal, IModelApp, IModelTileTree, iModelTileTreeParamsFromJSON, NativeApp, OnDownloadProgress, TileRequest } from "@itwin/core-frontend";
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
      const assertProgress: OnDownloadProgress = (progress) => {
        assert.isAbove(progress.loaded, lastProgressReport.loaded);
        assert.isAtLeast(progress.total, lastProgressReport.total);
        lastProgressReport = progress;
      };

      try {
        await connection.pullChanges(20, { downloadProgressCallback: assertProgress });
      } finally {
        await connection.close();
        await NativeApp.deleteBriefcase(fileName);
      }

      assert.isAbove(lastProgressReport.loaded, 0);
      assert.equal(lastProgressReport.loaded, lastProgressReport.total);
    });

    it.only("should repro bug", async () => {
      const iTwinId = await TestUtility.getTestITwinId();
      const iModelId = await TestUtility.queryIModelIdByName(iTwinId, "mirukuru");

      const downloader = await NativeApp.requestDownloadBriefcase(
        iTwinId,
        iModelId,
        { briefcaseId: BriefcaseIdValue.Unassigned },
        IModelVersion.fromJSON({versionName: "v1"})
      );
      await downloader.downloadPromise;

      const fileName = await NativeApp.getBriefcaseFileName({ iModelId, briefcaseId: downloader.briefcaseId });
      let imodel = await BriefcaseConnection.openFile({ fileName, readonly: true });

      let modelProps = await imodel.models.getProps("0x1c");
      expect(modelProps.length).to.equal(1);

      let treeProps = await IModelApp.tileAdmin.requestTileTreeProps(imodel, modelProps[0].id!);
      expect(treeProps.id).to.equal(modelProps[0].id);
      expect(treeProps.rootTile).not.to.be.undefined;

      const rootTile = treeProps.rootTile;
      expect(rootTile.isLeaf).not.to.be.true; // the backend will only set this to true if the tile range contains no elements.

      let edges = { smooth: false, type: "non-indexed" as const };
      let options = { is3d: true, batchType: BatchType.Primary, edges, allowInstancing: true, timeline: undefined };
      let params = iModelTileTreeParamsFromJSON(treeProps, imodel, "0x1c", options);
      let tree = new IModelTileTree(params, { edges, type: BatchType.Primary });

      const response: TileRequest.Response = await tree.staticBranch.requestContent();
      expect(response).not.to.be.undefined;
      expect(response).instanceof(Uint8Array);
      const isCanceled = () => false; // Our tile has no Request, therefore not considered in "loading" state, so would be immediately treated as "canceled" during loading...
      const gfx = await tree.staticBranch.readContent(response as Uint8Array, IModelApp.renderSystem, isCanceled);

      // Can I compare the response / uint8array before and after maybe?

      await imodel.pullChanges();
      await imodel.close();
      imodel = await BriefcaseConnection.openFile({ fileName, readonly: true });
      modelProps = await imodel.models.getProps("0x1c");
      expect(modelProps.length).to.equal(1);

      treeProps = await IModelApp.tileAdmin.requestTileTreeProps(imodel, modelProps[0].id!);
      expect(treeProps.id).to.equal(modelProps[0].id);
      expect(treeProps.rootTile).not.to.be.undefined;

      edges = { smooth: false, type: "non-indexed" as const };
      options = { is3d: true, batchType: BatchType.Primary, edges, allowInstancing: true, timeline: undefined };
      params = iModelTileTreeParamsFromJSON(treeProps, imodel, "0x1c", options);
      tree = new IModelTileTree(params, { edges, type: BatchType.Primary });

      const response2 = await tree.staticBranch.requestContent();
      expect(response2).not.to.be.undefined;
      expect(response2).instanceof(Uint8Array);

      // I would expect this  to fail, but doesnt
      expect(response2).to.deep.equal(response);


      const gfx2 = await tree.staticBranch.readContent(response2 as Uint8Array, IModelApp.renderSystem, isCanceled);

      // I would expect this to fail, but doesnt
      expect(gfx).to.deep.equal(gfx2);
      // const projExt = imodel.projectExtents;
      // expect(projExt.maxLength()).to.equal(gfx.contentRange!.maxLength());
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
      const downloadProgressCallback: OnDownloadProgress = (progress) => {
        lastProgressReport = progress;

        if (progress.loaded > progress.total / 4)
          abortSignal.abort();
      };

      const pullPromise = connection.pullChanges(50, { downloadProgressCallback, abortSignal, progressInterval: 50 });

      try {
        await expect(pullPromise).to.eventually.be.rejectedWith(/cancelled|aborted/i);
        // Use following assert when BackendIModelsAccess returns IModelError with ChangeSetStatus.DownloadCancelled.
        // await expect(pullPromise).to.eventually.be.rejected.and.have.property("errorNumber", ChangeSetStatus.DownloadCancelled);
      } finally {
        await connection.pullChanges(51); // Finish pulling changes so that the changesets files would be deleted.
        await connection.close();
        await NativeApp.deleteBriefcase(fileName);
      }

      assert.isAbove(lastProgressReport.loaded, 0);
      assert.isBelow(lastProgressReport.loaded, lastProgressReport.total);
    });
  });
}
