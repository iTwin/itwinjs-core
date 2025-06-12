/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { BriefcaseConnection, CheckpointConnection, SheetViewState, ViewState } from "@itwin/core-frontend";
import { TestUsers } from "@itwin/oidc-signin-tool/lib/cjs/TestUsers";
import { testOnScreenViewport } from "../TestViewport";
import { TestUtility } from "../TestUtility";
import { coreFullStackTestIpc } from "../Editing";
import * as path from "path";
import { Point2d, Point3d, Range2d } from "@itwin/core-geometry";

describe("Sheet views (#integration)", () => {
  let imodel: CheckpointConnection;
  const sheetViewId = "0x96";
  const attachmentCategoryId = "0x93";

  before(async () => {
    await TestUtility.startFrontend(TestUtility.iModelAppOptions);
    await TestUtility.initialize(TestUsers.regular);

    const iTwinId = await TestUtility.queryITwinIdByName(TestUtility.testITwinName);
    const iModelId = await TestUtility.queryIModelIdByName(iTwinId, TestUtility.testIModelNames.sectionDrawingLocations);
    imodel = await CheckpointConnection.openRemote(iTwinId, iModelId);
  });

  after(async () => {
    if (imodel)
      await imodel.close();

    await TestUtility.shutdownFrontend();
  });

  it("loads view attachment info", async () => {
    const view = await imodel.views.load(sheetViewId) as SheetViewState;
    expect(view).instanceof(SheetViewState);

    const props = view.viewAttachmentProps;
    expect(props.length).to.equal(1);
    expect(props[0].category).to.equal(attachmentCategoryId);
  });

  it("clones view attachment info when cloned", async () => {
    const v1 = await imodel.views.load(sheetViewId) as SheetViewState;
    const v2 = v1.clone();
    expect(v1).not.to.equal(v2);
    expect(v1.viewAttachmentProps).not.to.equal(v2.viewAttachmentProps);
    expect(v1.viewAttachmentProps).to.deep.equal(v2.viewAttachmentProps);

    const v1Infos = v1.viewAttachmentInfos;
    expect(v1Infos.length > 0).to.be.true;

    const v2Infos = v2.viewAttachmentInfos;
    expect(v1Infos).not.to.equal(v2Infos);
    expect(v1Infos.length).to.equal(v2Infos.length);
    for (let i = 0; i < v1Infos.length; i++) {
      expect(v1Infos[i]).not.to.equal(v2Infos[i]);
      const view1 = (v1Infos[i] as any).attachedView;
      const view2 = (v2Infos[i] as any).attachedView;

      expect(view1).instanceof(ViewState);
      expect(view2).instanceof(ViewState);

      expect(view1).not.to.equal(view2);
      expect(view1.id).to.equal(view2.id);
    }
  });

  it("draws tiles from view attachments if so specified", async () => {
    await testOnScreenViewport(sheetViewId, imodel, 40, 30, async (vp) => {
      expect(vp.wantViewAttachments).to.be.true;
      vp.wantViewAttachments = true;
      await vp.waitForAllTilesToRender();
      const numTotalTiles = vp.numSelectedTiles;
      expect(numTotalTiles).least(2);

      vp.wantViewAttachments = false;
      await vp.waitForAllTilesToRender();
      const numSheetTiles = vp.numSelectedTiles;
      expect(numSheetTiles).least(1);
      expect(numSheetTiles).lessThan(numTotalTiles);

      vp.wantViewAttachments = true;
      await vp.waitForAllTilesToRender();
      expect(vp.numSelectedTiles).to.equal(numTotalTiles);

      expect(vp.sceneValid).to.be.true;
      vp.view.categorySelector.categories.delete(attachmentCategoryId);
      expect(vp.sceneValid).to.be.false;
      await vp.waitForAllTilesToRender();
      expect(vp.numSelectedTiles).to.equal(numSheetTiles);
    });
  });

  it("allocates attachments when attached to viewport and deallocates when detached", async () => {
    const v1 = await imodel.views.load(sheetViewId) as SheetViewState;
    expect(v1.attachments).to.be.undefined;
    let v2: SheetViewState;
    let v3: SheetViewState;

    await testOnScreenViewport(sheetViewId, imodel, 40, 30, async (vp) => {
      v2 = vp.view as SheetViewState;
      expect(v2.attachments).not.to.be.undefined;
      expect(v2.attachments!.length).to.equal(1);

      v3 = v2.clone();
      expect(v3.attachments).to.be.undefined;

      vp.changeView(v3);
      expect(v2.attachments).to.be.undefined;
      expect(v3.attachments).not.to.be.undefined;
      expect(v3.attachments!.length).to.equal(1);

      vp.changeView(v2);
      expect(v2.attachments).not.to.be.undefined;
      expect(v2.attachments!.length).to.equal(1);
      expect(v3.attachments).to.be.undefined;
    });

    expect(v2!.attachments).to.be.undefined;
    expect(v3!.attachments).to.be.undefined;
  });

  it("updates view attachment info when viewed model changes", async () => {
    const v1 = await imodel.views.load(sheetViewId) as SheetViewState;
    expect(v1.baseModelId).to.equal("0x6f");
    const p1 = v1.viewAttachmentProps;
    expect(p1.length).to.equal(1);

    const v2 = v1.clone();
    expect(v2.viewAttachmentProps).to.deep.equal(p1);
    await v2.changeViewedModel("0x71");
    await v2.load();

    const p2 = v2.viewAttachmentProps;
    expect(p2.length).to.equal(1);
    expect(p1).not.to.equal(p2);
    expect(p1).not.to.deep.equal(p2);
  });

  it("should update subcategories cache when loading a sheetview", async () => {
    // 0x1a, 0x93 are the two category ids that are passed to preload for this view.
    const catIds = ["0x1a", "0x93"];
    const view = await imodel.views.load(sheetViewId) as SheetViewState;
    const props = view.toProps();

    expect(props.sheetProps).not.to.be.undefined;

    for (const catId of catIds) {
      expect(imodel.subcategories.getSubCategories(catId)).not.to.be.undefined;
    }
  });

  it("preserves view attachment info when round-tripped through JSON", async () => {
    const view = await imodel.views.load(sheetViewId) as SheetViewState;
    const props = view.toProps();

    expect(props.sheetProps).not.to.be.undefined;
    expect(props.sheetProps!.width).to.equal(view.sheetSize.x);
    expect(props.sheetProps!.height).to.equal(view.sheetSize.y);

    expect(props.sheetAttachments).not.to.be.undefined;
    expect(props.sheetAttachments).to.deep.equal(view.viewAttachmentProps.map((x) => x.id));

    const clone = SheetViewState.createFromProps(props, imodel);
    await clone.load();

    // viewAttachmentProps has an extra attachedView member of type ViewState - ignore that.
    delete (view.viewAttachmentProps[0] as any).attachedView;
    delete (clone.viewAttachmentProps[0] as any).attachedView;
    expect(clone.viewAttachmentProps).to.deep.equal(view.viewAttachmentProps);
  });
});

describe("Sheet views", () => {
  before(async () => {
    await TestUtility.startFrontend(undefined, undefined, true);
  });

  after(async () => {
    await TestUtility.shutdownFrontend();
  });

  describe("ViewAttachments", () => {
    it("areAllTileTreesLoaded should return true when attachments are outside of the viewed extents", async () => {
      // Create Sheet View with attachment
      const filePath = path.join(process.env.IMODELJS_CORE_DIRNAME!, "core/backend-tests/lib/cjs/test/assets/sheetViewTest.bim");
      const sheetViewId = await coreFullStackTestIpc.insertSheetViewWithAttachment(filePath);
      const iModel = await BriefcaseConnection.openStandalone(filePath);

      await testOnScreenViewport(sheetViewId, iModel, 1, 1, async (vp) => {

        // get view from viewport
        const sheetView = vp.view as SheetViewState;
        expect(sheetView).instanceof(SheetViewState);
        expect(sheetView.viewAttachmentProps.length).to.equal(1);
        expect(sheetView.attachments).not.to.be.undefined;

        // Get Viewed Extents
        const viewedExtents = sheetView.calculateFrustum()?.toRange();
        expect(viewedExtents).not.to.be.undefined;
        const viewedExtents2d = new Range2d(viewedExtents!.xLow, viewedExtents!.yLow, viewedExtents!.xHigh, viewedExtents!.yHigh);

        // Get Attachment Range
        const attachment = sheetView.viewAttachmentProps[0];
        const origin = Point2d.fromJSON(attachment.placement?.origin);
        expect(origin).not.to.be.undefined;

        const bbox = Range2d.fromJSON(attachment.placement?.bbox);
        expect(bbox).not.to.be.undefined;
        const attachmentRange = new Range2d(origin.x + bbox.xLow, origin.y + bbox.yLow, origin.x + bbox.xHigh, origin.y + bbox.yHigh);

        await vp.waitForSceneCompletion();

        // Expect areAllTileTreesLoaded to be true when attachment is outside of the viewed extents and not yet loaded
        expect(viewedExtents2d.intersectsRange(attachmentRange)).to.be.false;
        expect(sheetView.areAllAttachmentsLoaded()).to.be.false;
        expect(sheetView.areAllTileTreesLoaded).to.be.true;

        //Fit view
        vp.zoom(new Point3d(attachmentRange.xLow, attachmentRange.yLow, 0), 1)

        // Expect attachments to not yet be loaded as the scene is not yet complete
        expect(sheetView.areAllAttachmentsLoaded()).to.be.false;
        expect(sheetView.areAllTileTreesLoaded).to.be.false;
        await vp.waitForSceneCompletion();

        // Get new viewed extents
        const newExtents = sheetView.calculateFrustum()?.toRange();
        expect(newExtents).not.to.be.undefined;
        const newExtents2d = new Range2d(newExtents!.xLow, newExtents!.yLow, newExtents!.xHigh, newExtents!.yHigh);

        //Expect areAllTileTreesLoaded to be true when attachment is inside of the viewed extents and loaded
        expect(newExtents2d.intersectsRange(attachmentRange)).to.be.true;
        expect(sheetView.areAllAttachmentsLoaded()).to.be.true;
        expect(sheetView.areAllTileTreesLoaded).to.be.true;
      });

      await iModel.close();
    });
  });
});
