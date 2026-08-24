/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "vitest";
import { BriefcaseConnection, CheckpointConnection, SheetViewState, ViewState } from "@itwin/core-frontend";
import { TestUsers } from "@itwin/oidc-signin-tool/lib/cjs/TestUsers";
import { testOnScreenViewport } from "../TestViewport";
import { TestUtility } from "../TestUtility";
import { coreFullStackTestCommandIpc, coreFullStackTestIpc, deleteElements, initializeEditTools, saveBriefcaseChanges } from "../Editing";
import * as path from "path";
import { Point2d, Point3d, Range2d } from "@itwin/core-geometry";
import { CompressedId64Set, Id64String, OpenMode } from "@itwin/core-bentley";
import { ViewAttachmentProps } from "@itwin/core-common";

describe("SheetViewState (#integration)", () => {
  let imodel: CheckpointConnection;
  const sheetViewId = "0x96";
  const attachmentCategoryId = "0x93";

  beforeAll(async () => {
    await TestUtility.startFrontend(TestUtility.iModelAppOptions);
    await TestUtility.initialize(TestUsers.regular);

    const iTwinId = await TestUtility.queryITwinIdByName(TestUtility.testITwinName);
    const iModelId = await TestUtility.queryIModelIdByName(iTwinId, TestUtility.testIModelNames.sectionDrawingLocations);
    imodel = await CheckpointConnection.openRemote(iTwinId, iModelId);
  });

  afterAll(async () => {
    if (imodel)
      await imodel.close();

    await TestUtility.shutdownFrontend();
  });

  it("loads view attachment info", async () => {
    const view = await imodel.views.load(sheetViewId) as SheetViewState;
    expect(view).toBeInstanceOf(SheetViewState);

    const props = view.viewAttachmentProps;
    expect(props.length).toBe(1);
    expect(props[0].category).toBe(attachmentCategoryId);
  });

  it("clones view attachment info when cloned", async () => {
    const v1 = await imodel.views.load(sheetViewId) as SheetViewState;
    const v2 = v1.clone();
    expect(v1).not.toBe(v2);
    expect(v1.viewAttachmentProps).not.toBe(v2.viewAttachmentProps);
    expect(v1.viewAttachmentProps).toEqual(v2.viewAttachmentProps);

    const v1Infos = v1.viewAttachmentInfos;
    expect(v1Infos.length > 0).toBe(true);

    const v2Infos = v2.viewAttachmentInfos;
    expect(v1Infos).not.toBe(v2Infos);
    expect(v1Infos.length).toBe(v2Infos.length);
    for (let i = 0; i < v1Infos.length; i++) {
      expect(v1Infos[i]).not.toBe(v2Infos[i]);
      const view1 = (v1Infos[i] as any).attachedView;
      const view2 = (v2Infos[i] as any).attachedView;

      expect(view1).toBeInstanceOf(ViewState);
      expect(view2).toBeInstanceOf(ViewState);

      expect(view1).not.toBe(view2);
      expect(view1.id).toBe(view2.id);
    }
  });

  it("draws tiles from view attachments if so specified", async () => {
    await testOnScreenViewport(sheetViewId, imodel, 40, 30, async (vp) => {
      expect(vp.wantViewAttachments).toBe(true);
      vp.wantViewAttachments = true;
      await vp.waitForAllTilesToRender();
      const numTotalTiles = vp.numSelectedTiles;
      expect(numTotalTiles).toBeGreaterThanOrEqual(2);

      vp.wantViewAttachments = false;
      await vp.waitForAllTilesToRender();
      const numSheetTiles = vp.numSelectedTiles;
      expect(numSheetTiles).toBeGreaterThanOrEqual(1);
      expect(numSheetTiles).toBeLessThan(numTotalTiles);

      vp.wantViewAttachments = true;
      await vp.waitForAllTilesToRender();
      expect(vp.numSelectedTiles).toBe(numTotalTiles);

      expect(vp.sceneValid).toBe(true);
      vp.view.categorySelector.categories.delete(attachmentCategoryId);
      expect(vp.sceneValid).toBe(false);
      await vp.waitForAllTilesToRender();
      expect(vp.numSelectedTiles).toBe(numSheetTiles);
    });
  });

  it("allocates attachments when attached to viewport and deallocates when detached", async () => {
    const v1 = await imodel.views.load(sheetViewId) as SheetViewState;
    expect(v1.attachments).toBeUndefined();
    let v2: SheetViewState;
    let v3: SheetViewState;

    await testOnScreenViewport(sheetViewId, imodel, 40, 30, async (vp) => {
      v2 = vp.view as SheetViewState;
      expect(v2.attachments).not.toBeUndefined();
      expect(v2.attachments!.length).toBe(1);

      v3 = v2.clone();
      expect(v3.attachments).toBeUndefined();

      vp.changeView(v3);
      expect(v2.attachments).toBeUndefined();
      expect(v3.attachments).not.toBeUndefined();
      expect(v3.attachments!.length).toBe(1);

      vp.changeView(v2);
      expect(v2.attachments).not.toBeUndefined();
      expect(v2.attachments!.length).toBe(1);
      expect(v3.attachments).toBeUndefined();
    });

    expect(v2!.attachments).toBeUndefined();
    expect(v3!.attachments).toBeUndefined();
  });

  it("updates view attachment info when viewed model changes", async () => {
    const v1 = await imodel.views.load(sheetViewId) as SheetViewState;
    expect(v1.baseModelId).toBe("0x6f");
    const p1 = v1.viewAttachmentProps;
    expect(p1.length).toBe(1);

    const v2 = v1.clone();
    expect(v2.viewAttachmentProps).toEqual(p1);
    await v2.changeViewedModel("0x71");
    await v2.load();

    const p2 = v2.viewAttachmentProps;
    expect(p2.length).toBe(1);
    expect(p1).not.toBe(p2);
    expect(p1).not.toEqual(p2);
  });

  it("should update subcategories cache when loading a sheetview", async () => {
    // 0x1a, 0x93 are the two category ids that are passed to preload for this view.
    const catIds = ["0x1a", "0x93"];
    const view = await imodel.views.load(sheetViewId) as SheetViewState;
    const props = view.toProps();

    expect(props.sheetProps).not.toBeUndefined();

    for (const catId of catIds) {
      expect(imodel.subcategories.getSubCategories(catId)).not.toBeUndefined();
    }
  });

  it("preserves view attachment info when round-tripped through JSON", async () => {
    const view = await imodel.views.load(sheetViewId) as SheetViewState;
    const props = view.toProps();

    expect(props.sheetProps).not.toBeUndefined();
    expect(props.sheetProps!.width).toBe(view.sheetSize.x);
    expect(props.sheetProps!.height).toBe(view.sheetSize.y);

    expect(props.sheetAttachments).not.toBeUndefined();
    expect(props.sheetAttachments).toEqual(view.viewAttachmentProps.map((x) => x.id));

    const clone = SheetViewState.createFromProps(props, imodel);
    await clone.load();

    // viewAttachmentProps has an extra attachedView member of type ViewState - ignore that.
    delete (view.viewAttachmentProps[0] as any).attachedView;
    delete (clone.viewAttachmentProps[0] as any).attachedView;
    expect(clone.viewAttachmentProps).toEqual(view.viewAttachmentProps);
  });
});

describe("SheetViewState", () => {
  let iModel: BriefcaseConnection;
  let sheetViewId: Id64String;
  const filePath = path.join(process.env.IMODELJS_CORE_DIRNAME!, "core/backend/lib/cjs/test/assets/sheetViewTest.bim");

  beforeAll(async () => {
    await TestUtility.startFrontend(undefined, undefined, true);
    await initializeEditTools();
  });

  beforeEach(async () => {
    sheetViewId = await coreFullStackTestIpc.insertSheetViewWithAttachment(filePath);
    iModel = await BriefcaseConnection.openStandalone(filePath, OpenMode.ReadWrite);
  });

  afterEach(async () => {
    await iModel.close();
  });

  afterAll(async () => {
    await TestUtility.shutdownFrontend();
  });

  describe("ViewAttachments", () => {
    it("areAllTileTreesLoaded should return true when attachments are outside of the viewed extents", async () => {
      await testOnScreenViewport(sheetViewId, iModel, 1, 1, async (vp) => {

        // get view from viewport
        const sheetView = vp.view as SheetViewState;
        expect(sheetView).toBeInstanceOf(SheetViewState);
        expect(sheetView.viewAttachmentProps.length).toBe(1);
        expect(sheetView.attachments).not.toBeUndefined();

        // Get Viewed Extents
        const viewedExtents = sheetView.calculateFrustum()?.toRange();
        expect(viewedExtents).not.toBeUndefined();
        const viewedExtents2d = new Range2d(viewedExtents!.xLow, viewedExtents!.yLow, viewedExtents!.xHigh, viewedExtents!.yHigh);

        // Get Attachment Range
        const attachment = sheetView.viewAttachmentProps[0];
        const origin = Point2d.fromJSON(attachment.placement?.origin);
        expect(origin).not.toBeUndefined();

        const bbox = Range2d.fromJSON(attachment.placement?.bbox);
        expect(bbox).not.toBeUndefined();
        const attachmentRange = new Range2d(origin.x + bbox.xLow, origin.y + bbox.yLow, origin.x + bbox.xHigh, origin.y + bbox.yHigh);

        await vp.waitForSceneCompletion();

        // Expect areAllTileTreesLoaded to be true when attachment is outside of the viewed extents and not yet loaded
        expect(viewedExtents2d.intersectsRange(attachmentRange)).toBe(false);
        expect(sheetView.areAllAttachmentsLoaded()).toBe(false);
        expect(sheetView.areAllTileTreesLoaded).toBe(true);

        //Fit view
        vp.zoom(new Point3d(attachmentRange.xLow, attachmentRange.yLow, 0), 1)

        // Expect attachments to not yet be loaded as the scene is not yet complete
        expect(sheetView.areAllAttachmentsLoaded()).toBe(false);
        expect(sheetView.areAllTileTreesLoaded).toBe(false);
        await vp.waitForSceneCompletion();

        // Get new viewed extents
        const newExtents = sheetView.calculateFrustum()?.toRange();
        expect(newExtents).not.toBeUndefined();
        const newExtents2d = new Range2d(newExtents!.xLow, newExtents!.yLow, newExtents!.xHigh, newExtents!.yHigh);

        //Expect areAllTileTreesLoaded to be true when attachment is inside of the viewed extents and loaded
        expect(newExtents2d.intersectsRange(attachmentRange)).toBe(true);
        expect(sheetView.areAllAttachmentsLoaded()).toBe(true);
        expect(sheetView.areAllTileTreesLoaded).toBe(true);
      });
    });

    describe("are reloaded when ViewAttachments are inserted, updated, or deleted", () => {
      async function waitForViewAttachmentsToReload(view: SheetViewState, operation: () => Promise<void>): Promise<void> {
        const reloaded = new Promise<void>((resolve) => {
          view.onViewAttachmentsReloaded.addOnce(() => {
            resolve();
          });
        });

        await operation();
        return reloaded;
      }

      it("when not attached to a viewport", async () => {
        const changedElements = new Set<Id64String>();
        iModel.txns.onElementsChanged.addListener((changes) => {
          for (const key of ["inserted", "updated", "deleted"] as const) {
            const elems = changes[key];
            if (undefined !== elems) {
              for (const elem of CompressedId64Set.iterable(elems)) {
                changedElements.add(elem);
              }
            }
          }
        });

        function expectChanges(expected: Id64String[]): void {
          const actual = Array.from(changedElements);
          changedElements.clear();
          expect(actual).toEqual(expected);
        }

        const view = await iModel.views.load(sheetViewId) as SheetViewState;
        expect(view).toBeInstanceOf(SheetViewState);
        expect(view.viewAttachmentProps.length).toBe(1);
        expect(view.attachments).toBeUndefined();

        expect(view.viewAttachmentProps[0].placement?.origin).toEqual([100, 100]);

        // Modify the placement of the attachment.
        const oldAttachmentId = view.viewAttachmentProps[0].id!;
        expect(oldAttachmentId).not.toBeUndefined();
        const props = await iModel.elements.loadProps(oldAttachmentId) as ViewAttachmentProps;
        expect(props.placement).not.toBeUndefined();
        props.placement!.origin = [101, 99];
        await coreFullStackTestCommandIpc.updateElement(iModel.key, props);

        await waitForViewAttachmentsToReload(view, async () => saveBriefcaseChanges(iModel));
        expectChanges([oldAttachmentId]);

        // Verify we really did update the element's placement.
        const newProps = await iModel.elements.loadProps(oldAttachmentId) as ViewAttachmentProps;
        expect(newProps.placement?.origin).toEqual([101, 99]);

        // Verify the view reloaded the attachment with the updated placement.
        expect(view.viewAttachmentProps[0].placement?.origin).toEqual([101, 99]);

        // Add a new attachment
        props.placement!.origin = [102, 98];
        props.federationGuid = props.id = undefined;
        const newAttachmentId = await coreFullStackTestCommandIpc.insertElement(iModel.key, props);
        await waitForViewAttachmentsToReload(view, async () => saveBriefcaseChanges(iModel));

        expect(view.viewAttachmentProps.length).toBe(2);
        expect(view.viewAttachmentProps[1].id).toBe(newAttachmentId);
        expect(view.viewAttachmentProps[1].placement?.origin).toEqual([102, 98]);

        // Delete an attachment
        await deleteElements(iModel, [newAttachmentId]);
        await waitForViewAttachmentsToReload(view, async () => saveBriefcaseChanges(iModel));
        expect(view.viewAttachmentProps.length).toBe(1);
        expect(view.viewAttachmentProps[0].id).toBe(oldAttachmentId);
        expect(view.viewAttachmentProps[0].placement?.origin).toEqual([101, 99]);

        // Undo everything so we don't affect subsequent tests (and to verify the SheetViewState reacts).
        // -- undo delete
        await waitForViewAttachmentsToReload(view, async () => { await iModel.txns.reverseSingleTxn(); });
        expect(view.viewAttachmentProps.length).toBe(2);

        // -- undo insert
        await waitForViewAttachmentsToReload(view, async () => { await iModel.txns.reverseSingleTxn(); });
        expect(view.viewAttachmentProps.length).toBe(1);

        // -- undo update
        await waitForViewAttachmentsToReload(view, async () => { await iModel.txns.reverseSingleTxn(); });
        expect(view.viewAttachmentProps.length).toBe(1);
        expect(view.viewAttachmentProps[0].placement?.origin).toEqual([100, 100]);
      });

      it("when attached to a viewport", async () => {
        await testOnScreenViewport(sheetViewId, iModel, 250, 250, async (vp) => {
          const view = vp.view as SheetViewState;
          expect(view.viewAttachmentProps.length).toBe(1);
          expect(view.attachments).not.toBeUndefined();

          expect(view.viewAttachmentProps[0].placement?.origin).toEqual([100, 100]);
          await vp.waitForSceneCompletion();
          expect(vp.areAllTilesLoaded).toBe(true);

          // Modify the placement of the attachment
          async function waitForReload() {
            await waitForViewAttachmentsToReload(view, async () => undefined);
            await vp.waitForSceneCompletion();
          }

          const oldAttachmentId = view.viewAttachmentProps[0].id!;
          expect(oldAttachmentId).not.toBeUndefined();
          const props = await iModel.elements.loadProps(oldAttachmentId) as ViewAttachmentProps;
          expect(props.placement).not.toBeUndefined();
          props.placement!.origin = [101, 99];
          await coreFullStackTestCommandIpc.updateElement(iModel.key, props);

          expect(vp.areAllTilesLoaded).toBe(true);
          const reloadAfterUpdate = waitForReload();
          await saveBriefcaseChanges(iModel);
          expect(vp.areAllTilesLoaded).toBe(false);
          await reloadAfterUpdate;
          expect(vp.areAllTilesLoaded).toBe(true);

          // Verify the view reloaded the attachment with the updated placement.
          expect(view.viewAttachmentProps[0].placement?.origin).toEqual([101, 99]);

          // Add a new attachment
          props.placement!.origin = [102, 98];
          props.federationGuid = props.id = undefined;
          const newAttachmentId = await coreFullStackTestCommandIpc.insertElement(iModel.key, props);

          expect(vp.areAllTilesLoaded).toBe(true);
          const reloadAfterInsert = waitForReload();
          await saveBriefcaseChanges(iModel);
          expect(vp.areAllTilesLoaded).toBe(false);
          await reloadAfterInsert;
          expect(vp.areAllTilesLoaded).toBe(true);

          expect(view.viewAttachmentProps.length).toBe(2);
          expect(view.viewAttachmentProps[1].id).toBe(newAttachmentId);
          expect(view.viewAttachmentProps[1].placement?.origin).toEqual([102, 98]);

          // Delete an attachment
          await deleteElements(iModel, [newAttachmentId]);
          expect(vp.areAllTilesLoaded).toBe(true);
          const reloadAfterDelete = waitForReload();
          await saveBriefcaseChanges(iModel);
          expect(vp.areAllTilesLoaded).toBe(false);
          await reloadAfterDelete;
          expect(vp.areAllTilesLoaded).toBe(true);

          expect(view.viewAttachmentProps.length).toBe(1);
          expect(view.viewAttachmentProps[0].id).toBe(oldAttachmentId);
          expect(view.viewAttachmentProps[0].placement?.origin).toEqual([101, 99]);

          // Undo everything so we don't affect subsequent tests (and to verify the Viewport reacts).
          // -- undo delete
          const reloadAfterUndoDelete = waitForReload();
          await iModel.txns.reverseSingleTxn();
          expect(vp.areAllTilesLoaded).toBe(false);
          await reloadAfterUndoDelete;
          expect(vp.areAllTilesLoaded).toBe(true);
          expect(view.viewAttachmentProps.length).toBe(2);

          // -- undo insert
          const reloadAfterUndoInsert = waitForReload();
          await iModel.txns.reverseSingleTxn();
          expect(vp.areAllTilesLoaded).toBe(false);
          await reloadAfterUndoInsert;
          expect(vp.areAllTilesLoaded).toBe(true);
          expect(view.viewAttachmentProps.length).toBe(1);

          // -- undo update
          const reloadAfterUndoUpdate = waitForReload();
          await iModel.txns.reverseSingleTxn();
          expect(vp.areAllTilesLoaded).toBe(false);
          await reloadAfterUndoUpdate;

          expect(vp.areAllTilesLoaded).toBe(true);
          expect(view.viewAttachmentProps.length).toBe(1);
          expect(view.viewAttachmentProps[0].placement?.origin).toEqual([100, 100]);
        });
      });
    });
  });
});





