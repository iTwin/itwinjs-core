/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { CheckpointConnection, SheetViewState } from "@itwin/core-frontend";
import { TestUsers } from "@itwin/oidc-signin-tool/lib/cjs/TestUsers";
import { testOnScreenViewport } from "../TestViewport";
import { TestUtility } from "../TestUtility";

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

  it("preserves view attachment info when cloned", async () => {
    const v1 = await imodel.views.load(sheetViewId) as SheetViewState;
    const v2 = v1.clone();
    expect(v1).not.to.equal(v2);
    expect(v1.viewAttachmentProps).to.equal(v2.viewAttachmentProps);
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
