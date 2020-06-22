/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { Point3d } from "@bentley/geometry-core";
import { SectionType } from "@bentley/imodeljs-common";
import {
  IModelApp, IModelConnection, RemoteBriefcaseConnection, SnapshotConnection,
} from "@bentley/imodeljs-frontend";
import {
  HyperModeling, SectionDrawingLocationState, SectionMarker, SectionMarkerSetDecorator,
} from "@bentley/hypermodeling-frontend";
import { TestUsers } from "@bentley/oidc-signin-tool/lib/TestUsers";
import { TestUtility } from "./TestUtility";
import { testOnScreenViewport } from "../TestViewport";

describe("HyperModeling (#integration)", () => {
  const projectName = "iModelJsIntegrationTest";
  let imodel: IModelConnection; // An iModel containing no section drawing locations
  let hypermodel: IModelConnection; // An iModel containing 3 section drawing locations

  before(async () => {
    await IModelApp.startup({
      authorizationClient: await TestUtility.initializeTestProject(projectName, TestUsers.regular),
      imodelClient: TestUtility.imodelCloudEnv.imodelClient,
      applicationVersion: "1.2.1.1",
    });

    await HyperModeling.initialize();
    imodel = await SnapshotConnection.openFile("mirukuru.ibim");

    const projectId = await TestUtility.getTestProjectId(projectName);
    const iModelId = await TestUtility.getTestIModelId(projectId, "SectionDrawingLocations");
    hypermodel = await RemoteBriefcaseConnection.open(projectId, iModelId);
  });

  after(async () => {
    if (imodel)
      await imodel.close();

    if (hypermodel)
      await hypermodel.close();

    await IModelApp.shutdown();
  });

  it("determines if hypermodeling is supported for a given iModel", async () => {
    expect(await HyperModeling.isSupportedForIModel(imodel)).to.be.false;
    expect(await HyperModeling.isSupportedForIModel(hypermodel)).to.be.true;
  });

  it("queries all section locations", async () => {
    let states = await SectionDrawingLocationState.queryAll(imodel);
    expect(states.length).to.equal(0);

    states = await SectionDrawingLocationState.queryAll(hypermodel);
    expect(states.length).to.equal(3);

    const expectedStates = [
      {
        id: "0xa7",
        type: SectionType.Plan,
        label: "Plan",
        origin: Point3d.create(0.3050, 1.4094, 4.1873),
        sectionViewId: "0x99",
        spatialViewId: "0x78",
        viewAttachmentId: "0x9c",
      },
      {
        id: "0xa8",
        type: SectionType.Elevation,
        label: "Elevation",
        origin: Point3d.create(1.5917, 2.4411, -0.2803),
        sectionViewId: "0xa3",
        spatialViewId: "0x7c",
        viewAttachmentId: "0xa6",
      },
      {
        id: "0xa9",
        type: SectionType.Section,
        label: "Section",
        origin: Point3d.create(3.2358, 1.4094, 8.3745),
        sectionViewId: "0x8f",
        spatialViewId: "0x80",
        viewAttachmentId: undefined,
      },
    ];

    for (const expected of expectedStates) {
      const actual = states.find((state) =>
        state.id === expected.id && state.sectionType === expected.type && state.userLabel === expected.label &&
        state.placement.origin.isAlmostEqual(expected.origin, 0.001) && state.drawingViewId === expected.sectionViewId &&
        state.spatialViewId === expected.spatialViewId && state.viewAttachment?.id === expected.viewAttachmentId)!;

      expect(actual).not.to.be.undefined;
      expect(await actual.tryLoadDrawingView()).not.to.be.undefined;
      expect(await actual.tryLoadSpatialView()).not.to.be.undefined;
      expect(undefined === await actual.tryLoadSheetView()).to.equal(undefined === expected.viewAttachmentId);
    }
  });

  it("does not register decorator if no section drawing locations are present", async () => {
    await testOnScreenViewport("0x24", imodel, 100, 100, async (vp) => {
      await SectionMarkerSetDecorator.showOrHide(vp, true);
      expect(SectionMarkerSetDecorator.getForViewport(vp)).to.be.undefined;
    });
  });

  it("toggles decorator", async () => {
    await testOnScreenViewport("0x80", hypermodel, 100, 100, async (vp) => {
      await SectionMarkerSetDecorator.showOrHide(vp, true);
      expect(SectionMarkerSetDecorator.getForViewport(vp)).not.to.be.undefined;
      await SectionMarkerSetDecorator.showOrHide(vp, false);
      expect(SectionMarkerSetDecorator.getForViewport(vp)).to.be.undefined;
      await SectionMarkerSetDecorator.showOrHide(vp);
      expect(SectionMarkerSetDecorator.getForViewport(vp)).not.to.be.undefined;
      await SectionMarkerSetDecorator.showOrHide(vp);
      expect(SectionMarkerSetDecorator.getForViewport(vp)).to.be.undefined;
    });
  });

  it("toggles 2d graphics", async () => {
    await testOnScreenViewport("0x80", hypermodel, 100, 100, async (vp) => {
      await SectionMarkerSetDecorator.showOrHide(vp, true);
      const dec = SectionMarkerSetDecorator.getForViewport(vp)!;
      const markers = Array.from((dec as any)._markers.markers as Set<SectionMarker>);
      expect(markers.length).to.equal(3);

      const countTileTrees = () => {
        let count = 0;
        vp.forEachTileTreeRef((_) => ++count);
        return count;
      };

      expect(countTileTrees()).to.equal(1);

      let marker = markers.find((x) => undefined !== x.state.viewAttachment)!;
      await (dec as any).toggleSection(marker);
      expect(countTileTrees()).to.equal(3);
      await (dec as any).toggleSection(marker);
      expect(countTileTrees()).to.equal(1);

      marker = markers.find((x) => undefined === x.state.viewAttachment)!;
      await (dec as any).toggleSection(marker);
      expect(countTileTrees()).to.equal(2);
      await (dec as any).toggleSection(marker);
      expect(countTileTrees()).to.equal(1);
    });
  });
});
