/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { BlankConnection, BriefcaseConnection, CheckpointConnection, IModelApp, ScreenViewport, SheetViewState, SpatialViewState, ViewState } from "@itwin/core-frontend";
import { TestUsers } from "@itwin/oidc-signin-tool/lib/cjs/TestUsers";
import { testOnScreenViewport } from "../TestViewport";
import { TestUtility } from "../TestUtility";
import { coreFullStackTestIpc, initializeEditTools } from "../Editing";
import * as path from "path";
import { Cartographic } from "@itwin/core-common";
import { Range3d } from "@itwin/core-geometry";
import { Guid } from "@itwin/core-bentley";

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

  describe.only("ViewAttachments", () => {
    function createBlankConnection(name = "test-blank-connection",
      location = Cartographic.fromDegrees({ longitude: -75.686694, latitude: 40.065757, height: 0 }),
      extents = new Range3d(-1000, -1000, -100, 1000, 1000, 100),
      iTwinId = Guid.createValue()): BlankConnection {
      return BlankConnection.create({ name, location, extents, iTwinId });
    }

    interface BlankViewportOptions {
      /** Height in pixels. Default 100. */
      height?: number;
      /** Width in pixels. Default 100. */
      width?: number;
      /** iModel. If undefined, a new blank connection will be created. */
      iModel?: BlankConnection;
      /** The position of the containing div. */
      position?: "absolute";
    }

    /** Open a viewport for a blank spatial view.
     * @internal
     */
    function openBlankViewport(options?: BlankViewportOptions): ScreenViewport {
      const height = options?.height ?? 100;
      const width = options?.width ?? 100;
      const iModel = options?.iModel ?? createBlankConnection();

      const parentDiv = document.createElement("div");
      const hPx = `${height}px`;
      const wPx = `${width}px`;

      parentDiv.setAttribute("height", hPx);
      parentDiv.setAttribute("width", wPx);
      parentDiv.style.height = hPx;
      parentDiv.style.width = wPx;

      if (options?.position)
        parentDiv.style.position = options.position;

      document.body.appendChild(parentDiv);

      const view = SpatialViewState.createBlank(iModel, { x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1 });

      class BlankViewport extends ScreenViewport {
        public ownedIModel?: BlankConnection;

        public override[Symbol.dispose](): void {
          if (!this.isDisposed) {
            document.body.removeChild(this.parentDiv);
            super[Symbol.dispose]();
            this.ownedIModel?.closeSync();
          }
        }
      }

      const viewport = BlankViewport.create(parentDiv, view) as BlankViewport;
      if (undefined === options?.iModel)
        viewport.ownedIModel = iModel;

      return viewport;
    }

    it("areAllTileTreesLoaded should return true when attachments are outside of the viewed extents", async () => {
      if (!process.env.IMODELJS_CORE_DIRNAME)
        throw new Error("IMODELJS_CORE_DIRNAME not set");

      const vp = openBlankViewport({ height: 100, width: 100 });
      const sheetViewStateProps = await coreFullStackTestIpc.insertViewAttachmentAndGetSheetViewProps();
      expect(sheetViewStateProps.sheetAttachments).not.to.be.undefined;
      const newSheetView = SheetViewState.createFromProps(sheetViewStateProps, await BriefcaseConnection.openStandalone(path.join(process.env.IMODELJS_CORE_DIRNAME, "core/backend/lib/cjs/test/assets/sheetViewTest.bim")));

      newSheetView.attachToViewport(vp);
      await newSheetView.load();

      expect(newSheetView).not.to.be.undefined;
      expect(newSheetView.viewAttachmentProps.length).to.equal(1);
      expect(newSheetView.attachments).not.to.be.undefined;
    });
  });
});
