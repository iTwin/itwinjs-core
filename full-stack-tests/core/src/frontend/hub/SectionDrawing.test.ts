/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { CheckpointConnection, DrawingViewState, IModelApp, IModelConnection, SectionDrawingModelState } from "@bentley/imodeljs-frontend";
import { TestUsers } from "@bentley/oidc-signin-tool/lib/TestUsers";
import { testOnScreenViewport, TestViewport } from "../TestViewport";
import { TestUtility } from "./TestUtility";

describe("Section Drawings (#integration)", () => {
  const projectName = "iModelJsIntegrationTest";
  let imodel: IModelConnection;

  before(async () => {
    await IModelApp.startup({
      authorizationClient: await TestUtility.initializeTestProject(projectName, TestUsers.regular),
      imodelClient: TestUtility.imodelCloudEnv.imodelClient,
      applicationVersion: "1.2.1.1",
    });

    const projectId = await TestUtility.getTestProjectId(projectName);
    const iModelId = await TestUtility.getTestIModelId(projectId, "SectionDrawingLocations");
    imodel = await CheckpointConnection.openRemote(projectId, iModelId);
  });

  after(async () => {
    if (imodel)
      await imodel.close();

    await IModelApp.shutdown();
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
      expect(model).not.to.be.undefined;
      expect(model).instanceof(SectionDrawingModelState);
    }
  });

  it("loads section drawing info for view", async () => {
    for (const spec of specs) {
      const first = await imodel.views.load(spec.views[0]) as DrawingViewState;
      expect(first).instanceof(DrawingViewState);
      expect(first.baseModelId).to.equal(spec.model);

      const info = first.sectionDrawingInfo;

      expect(info.spatialView).to.equal(spec.spatialView);
      expect(info.drawingToSpatialTransform.isIdentity).to.be.false;

      if (spec.views.length > 1) {
        const second = await imodel.views.load(spec.views[1]) as DrawingViewState;
        expect(second).instanceof(DrawingViewState);
        expect(second.baseModelId).to.equal(first.baseModelId);

        const secondInfo = second.sectionDrawingInfo;

        expect(secondInfo.spatialView).to.equal(info.spatialView);
        expect(secondInfo.drawingToSpatialTransform.isAlmostEqual(info.drawingToSpatialTransform)).to.be.true;
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
      expect(newInfo).not.to.equal(oldInfo);
      expect(newInfo.spatialView).to.equal(spec.spatialView);
    }
  });

  it("clones section drawing info", async () => {
    const first = await imodel.views.load(specs[0].views[0]) as DrawingViewState;
    const info = first.sectionDrawingInfo;

    const second = first.clone();
    expect(second).not.to.equal(first);
    const secondInfo = second.sectionDrawingInfo;
    expect(secondInfo).to.deep.equal(info);
  });

  it("preserves section drawing info when round-tripped through JSON", async () => {
    const view = await imodel.views.load(specs[0].views[0]) as DrawingViewState;
    const info = view.sectionDrawingInfo;

    const props = view.toProps();
    expect(props.sectionDrawing).not.to.be.undefined;

    const clone = DrawingViewState.createFromProps(props, view.iModel);
    expect(clone.sectionDrawingProps).not.to.be.undefined;
    expect(clone.sectionDrawingProps).to.deep.equal(view.sectionDrawingProps);

    await clone.load();
    expect(clone.sectionDrawingInfo).not.to.be.undefined;
    expect(clone.sectionDrawingInfo).to.deep.equal(info);
  });

  it("clones attachment info when view is cloned", async () => {
    const v1 = await imodel.views.load(specs[0].views[0]) as DrawingViewState;
    const v2 = v1.clone();
    expect(v2.attachmentInfo).not.to.equal(v1.attachmentInfo);
    expect(v2.attachmentInfo).to.deep.equal(v1.attachmentInfo);
  });

  it("only allocates attachment if attachment is to be displayed", async () => {
    expect(DrawingViewState.alwaysDisplaySpatialView).to.be.false;
    await testOnScreenViewport(specs[0].views[0], imodel, 40, 30, async (vp) => {
      expect((vp.view as DrawingViewState).attachment).to.be.undefined;
    });

    DrawingViewState.alwaysDisplaySpatialView = true;
    await testOnScreenViewport(specs[0].views[0], imodel, 40, 30, async (vp) => {
      expect((vp.view as DrawingViewState).attachment).not.to.be.undefined;
    });
  });

  it("allocates attachment when attached to viewport and disposes of it when detached from viewport", async () => {
    DrawingViewState.alwaysDisplaySpatialView = true;
    const v1 = await imodel.views.load(specs[0].views[0]) as DrawingViewState;
    expect(v1.attachment).to.be.undefined;
    let v2: DrawingViewState;
    let v3: DrawingViewState;
    await testOnScreenViewport(specs[0].views[0], imodel, 40, 30, async (vp) => {
      v2 = vp.view as DrawingViewState;
      expect(v2.attachment).not.to.be.undefined;

      v3 = v2.clone();
      expect(v3.attachment).to.be.undefined;

      vp.changeView(v3);
      expect(v2.attachment).to.be.undefined;
      expect(v3.attachment).not.to.be.undefined;

      vp.changeView(v2);
      expect(v2.attachment).not.to.be.undefined;
      expect(v3.attachment).to.be.undefined;
    });

    expect(v2!.attachment).to.be.undefined;
    expect(v3!.attachment).to.be.undefined;
  });

  it("displays the 3d tiles in the 2d view if so specified", async () => {
    async function test(func: (vp: TestViewport) => void): Promise<void> {
      await testOnScreenViewport(specs[0].views[0], imodel, 40, 30, async (vp) => {
        await vp.waitForAllTilesToRender();
        func(vp);
      });
    }

    expect(DrawingViewState.alwaysDisplaySpatialView).to.be.false;
    let num2dTiles = 0;
    await test((vp) => {
      num2dTiles = vp.numSelectedTiles;
      expect(num2dTiles).least(1);
    });

    DrawingViewState.alwaysDisplaySpatialView = true;
    DrawingViewState.hideDrawingGraphics = true;
    let num3dTiles = 0;
    await test((vp) => {
      num3dTiles = vp.numSelectedTiles;
      expect(num3dTiles).least(1);
    });

    DrawingViewState.hideDrawingGraphics = false;
    await test((vp) => {
      expect(vp.numSelectedTiles).to.equal(num2dTiles + num3dTiles);
    });
  });
});
