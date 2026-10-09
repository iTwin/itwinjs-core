/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "vitest";
import { CheckpointConnection, DrawingViewState, IModelConnection, SectionDrawingModelState, ViewState3d } from "@itwin/core-frontend";
import { TestUsers } from "@itwin/oidc-signin-tool/lib/cjs/TestUsers";
import { TestUtility } from "../TestUtility";
import { testOnScreenViewport, TestViewport } from "../TestViewport";

describe("Section Drawings (#integration)", () => {
  let imodel: IModelConnection;

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

  afterEach(() => {
    DrawingViewState.alwaysDisplaySpatialView = false;
    DrawingViewState.hideDrawingGraphics = false;
  });

  const specs = [
    { model: "0x70", views: ["0x99", "0x8a"], spatialView: "0x78" },
    { model: "0x72", views: ["0x8f"], spatialView: "0x80" },
    { model: "0xa1", views: ["0xa3"], spatialView: "0x7c" },
  ];

  it("instantiates a SectionDrawingModelState", async () => {
    const modelIds = specs.map((x) => x.model);
    await imodel.models.load(modelIds);
    for (const modelId of modelIds) {
      const model = imodel.models.getLoaded(modelId)!;
      expect(model).not.toBeUndefined();
      expect(model).toBeInstanceOf(SectionDrawingModelState);
    }
  });

  it("loads section drawing info for view", async () => {
    for (const spec of specs) {
      const first = await imodel.views.load(spec.views[0]) as DrawingViewState;
      expect(first).toBeInstanceOf(DrawingViewState);
      expect(first.baseModelId).toBe(spec.model);

      const info = first.sectionDrawingInfo;

      expect(info.spatialView).toBe(spec.spatialView);
      expect(info.drawingToSpatialTransform.isIdentity).toBe(false);

      if (spec.views.length > 1) {
        const second = await imodel.views.load(spec.views[1]) as DrawingViewState;
        expect(second).toBeInstanceOf(DrawingViewState);
        expect(second.baseModelId).toBe(first.baseModelId);

        const secondInfo = second.sectionDrawingInfo;

        expect(secondInfo.spatialView).toBe(info.spatialView);
        expect(secondInfo.drawingToSpatialTransform.isAlmostEqual(info.drawingToSpatialTransform)).toBe(true);
      }
    }
  });

  it("updates section drawing info when viewed model changes", async () => {
    let view = await imodel.views.load(specs[0].views[0]) as DrawingViewState;
    for (let i = 1; i < specs.length; i++) {
      const oldInfo = view.sectionDrawingInfo;

      const spec = specs[i];
      view = view.clone();
      await view.changeViewedModel(spec.model);

      const newInfo = view.sectionDrawingInfo;
      expect(newInfo).not.toBe(oldInfo);
      expect(newInfo.spatialView).toBe(spec.spatialView);
    }
  });

  it("clones section drawing info", async () => {
    const first = await imodel.views.load(specs[0].views[0]) as DrawingViewState;
    const info = first.sectionDrawingInfo;

    const second = first.clone();
    expect(second).not.toBe(first);
    const secondInfo = second.sectionDrawingInfo;
    expect(secondInfo).toEqual(info);
  });

  it("preserves section drawing info when round-tripped through JSON", async () => {
    const view = await imodel.views.load(specs[0].views[0]) as DrawingViewState;
    const info = view.sectionDrawingInfo;

    const props = view.toProps();
    expect(props.sectionDrawing).not.toBeUndefined();

    const clone = DrawingViewState.createFromProps(props, view.iModel);
    expect(clone.sectionDrawingProps).not.toBeUndefined();
    expect(clone.sectionDrawingProps).toEqual(view.sectionDrawingProps);

    await clone.load();
    expect(clone.sectionDrawingInfo).not.toBeUndefined();
    expect(clone.sectionDrawingInfo).toEqual(info);
  });

  it("clones attachment info when view is cloned", async () => {
    const v1 = await imodel.views.load(specs[0].views[0]) as DrawingViewState;
    expect(typeof v1.attachmentInfo.spatialView).toBe("string");

    const v2 = v1.clone();
    expect(v2.attachmentInfo).not.toBe(v1.attachmentInfo);
    expect(v2.attachmentInfo).toEqual(v1.attachmentInfo);
  });

  it("clones attached spatial view when cloned", async () => {
    DrawingViewState.alwaysDisplaySpatialView = true;

    const v1 = await imodel.views.load(specs[0].views[0]) as DrawingViewState;
    expect(v1.attachmentInfo.spatialView).toBeInstanceOf(ViewState3d);

    const v2 = v1.clone();
    expect(v2.attachmentInfo.spatialView).toBeInstanceOf(ViewState3d);
    expect(v2.attachmentInfo.spatialView).not.toBe(v1.attachmentInfo.spatialView);

    DrawingViewState.alwaysDisplaySpatialView = false;
  });

  it("only allocates attachment if attachment is to be displayed", async () => {
    expect(DrawingViewState.alwaysDisplaySpatialView).toBe(false);
    await testOnScreenViewport(specs[0].views[0], imodel, 40, 30, async (vp) => {
      expect((vp.view as DrawingViewState).attachment).toBeUndefined();
    });

    DrawingViewState.alwaysDisplaySpatialView = true;
    await testOnScreenViewport(specs[0].views[0], imodel, 40, 30, async (vp) => {
      expect((vp.view as DrawingViewState).attachment).not.toBeUndefined();
    });
  });

  it("allocates attachment when attached to viewport and disposes of it when detached from viewport", async () => {
    DrawingViewState.alwaysDisplaySpatialView = true;
    const v1 = await imodel.views.load(specs[0].views[0]) as DrawingViewState;
    expect(v1.attachment).toBeUndefined();
    let v2: DrawingViewState;
    let v3: DrawingViewState;
    await testOnScreenViewport(specs[0].views[0], imodel, 40, 30, async (vp) => {
      v2 = vp.view as DrawingViewState;
      expect(v2.attachment).not.toBeUndefined();

      v3 = v2.clone();
      expect(v3.attachment).toBeUndefined();

      vp.changeView(v3);
      expect(v2.attachment).toBeUndefined();
      expect(v3.attachment).not.toBeUndefined();

      vp.changeView(v2);
      expect(v2.attachment).not.toBeUndefined();
      expect(v3.attachment).toBeUndefined();
    });

    expect(v2!.attachment).toBeUndefined();
    expect(v3!.attachment).toBeUndefined();
  });

  it("displays the 3d tiles in the 2d view if so specified", async () => {
    async function test(func: (vp: TestViewport) => void): Promise<void> {
      await testOnScreenViewport(specs[0].views[0], imodel, 40, 30, async (vp) => {
        await vp.waitForAllTilesToRender();
        func(vp);
      });
    }

    expect(DrawingViewState.alwaysDisplaySpatialView).toBe(false);
    let num2dTiles = 0;
    await test((vp) => {
      num2dTiles = vp.numSelectedTiles;
      expect(num2dTiles).toBeGreaterThanOrEqual(1);
    });

    DrawingViewState.alwaysDisplaySpatialView = true;
    DrawingViewState.hideDrawingGraphics = true;
    let num3dTiles = 0;
    await test((vp) => {
      num3dTiles = vp.numSelectedTiles;
      expect(num3dTiles).toBeGreaterThanOrEqual(1);
    });

    DrawingViewState.hideDrawingGraphics = false;
    await test((vp) => {
      expect(vp.numSelectedTiles).toBe(num2dTiles + num3dTiles);
    });
  });
});
