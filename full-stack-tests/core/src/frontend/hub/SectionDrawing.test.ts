/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import {
  DrawingViewState,
  IModelApp,
  IModelConnection,
  RemoteBriefcaseConnection,
  SectionDrawingModelState,
} from "@bentley/imodeljs-frontend";
import { TestUsers } from "@bentley/oidc-signin-tool/lib/TestUsers";
import { TestUtility } from "./TestUtility";
import { testOffScreenViewport } from "../TestViewport";

describe("Section Drawings (#integration)", () => {
  const projectName = "iModelJsIntegrationTest";
  let imodel: IModelConnection;

  before(async () => {
    DrawingViewState.alwaysDisplaySpatialView = true;

    await IModelApp.startup({
      authorizationClient: await TestUtility.initializeTestProject(projectName, TestUsers.regular),
      imodelClient: TestUtility.imodelCloudEnv.imodelClient,
      applicationVersion: "1.2.1.1",
    });

    const projectId = await TestUtility.getTestProjectId(projectName);
    const iModelId = await TestUtility.getTestIModelId(projectId, "SectionDrawingLocations");
    imodel = await RemoteBriefcaseConnection.open(projectId, iModelId);
  });

  after(async () => {
    DrawingViewState.alwaysDisplaySpatialView = false;

    if (imodel)
      await imodel.close();

    await IModelApp.shutdown();
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

      const info = first.sectionDrawingInfo!;
      expect(info).not.to.be.undefined;

      expect(info.spatialView).to.equal(spec.spatialView);
      expect(info.drawingToSpatialTransform.isIdentity).to.be.false;

      if (spec.views.length > 1) {
        const second = await imodel.views.load(spec.views[1]) as DrawingViewState;
        expect(second).instanceof(DrawingViewState);
        expect(second.baseModelId).to.equal(first.baseModelId);

        const secondInfo = second.sectionDrawingInfo!;
        expect(secondInfo).not.to.be.undefined;

        expect(secondInfo.spatialView).to.equal(info.spatialView);
        expect(secondInfo.drawingToSpatialTransform.isAlmostEqual(info.drawingToSpatialTransform)).to.be.true;
      }
    }
  });

  it("updates section drawing info when viewed model changes", async () => {
    await testOffScreenViewport(specs[0].views[0], imodel, 40, 30, async (vp) => {
      for (let i = 1; i < specs.length; i++) {
        const view = vp.view as DrawingViewState;
        const oldInfo = view.sectionDrawingInfo!;
        expect(oldInfo).not.to.be.undefined;

        const spec = specs[i];
        await vp.changeViewedModel2d(spec.model);
        expect(vp.view).not.to.equal(view);

        const newInfo = (vp.view as DrawingViewState).sectionDrawingInfo!;
        expect(newInfo).not.to.be.undefined;
        expect(newInfo).not.to.equal(oldInfo);
        expect(newInfo.spatialView).to.equal(spec.spatialView);
      }
    });
  });

  it("clones section drawing info", async () => {
    const first = await imodel.views.load(specs[0].views[0]) as DrawingViewState;
    const info = first.sectionDrawingInfo!;

    const second = first.clone() as DrawingViewState;
    expect(second).not.to.equal(first);
    const secondInfo = second.sectionDrawingInfo!;
    expect(secondInfo).to.deep.equal(info);
  });
});
