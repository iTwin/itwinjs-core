/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { IModelApp } from "../IModelApp";
import { IModelConnection } from "../IModelConnection";
import { createBlankConnection } from "./createBlankConnection";
import { Cartographic, EcefLocation } from "@itwin/core-common";
import { SpatialViewState } from "../SpatialViewState";
import { Point3d, Range3d, Vector3d } from "@itwin/core-geometry";
import { StandardViewId } from "../StandardView";
import { MarginOptions } from "../ViewAnimation";

describe("Look At", () => {
  let imodel: IModelConnection;

  before(async () => {
    await IModelApp.startup();
    imodel = createBlankConnection("look-at-test");
    imodel.ecefLocation = EcefLocation.createFromCartographicOrigin(Cartographic.fromDegrees({latitude: 39.144703, longitude: -75.703054}));
  });

  after(async () => {
    await imodel.close();
    await IModelApp.shutdown();
  });

  describe("lookAtGlobalLocation", () => {
    it("should change camera", async () => {
      const view3d = SpatialViewState.createBlank(imodel, new Point3d(), new Point3d());

      view3d.lookAt({
        viewDirection: {x: 0.0, y: 0.0, z: 1.0},
        eyePoint: {x: 0.0, y: 0.0, z: 0.0},
        upVector: new Vector3d(0.0, 0.0, 1.0),
      });

      const oldCam = view3d.camera.clone();
      view3d.lookAtGlobalLocation(1000.0, Math.PI / 4.0, {center: Cartographic.fromDegrees({latitude: 39.144703, longitude: -75.703054})});
      const newCam = view3d.camera;

      expect(oldCam.equals(newCam)).to.be.false;
    });
  });

  describe.only("lookAtViewAlignedVolume", () => {
    function createTopView(): SpatialViewState {
      const view = SpatialViewState.createBlank(imodel, new Point3d(), new Point3d());
      view.setStandardRotation(StandardViewId.Top);
      expect(view.isCameraOn).to.be.false;
      return view;
    }

    // [lowX, lowY, highX, highY
    type Range = [number, number, number, number];

    // volume is [lowX, lowY, highX, highY]
    function lookAtVolume(view: SpatialViewState, volume: Range, options?: MarginOptions): void {
      const range = new Range3d(volume[0], volume[1], -1, volume[2], volume[3], 1);
      view.lookAtViewAlignedVolume(range, 1.0, options);
    }

    function expectNumber(actual: number, expected: number): void {
      expect(Math.round(actual)).to.equal(Math.round(expected));
    }

    // volume is [lowX, lowY, highX, highY]
    function expectExtents(volume: Range, extents: Range, options?: MarginOptions, view?: SpatialViewState): void {
      view = view ?? createTopView();
      lookAtVolume(view, volume, options);

      const delta = view.getExtents();
      console.log(JSON.stringify(view.origin));
      console.log(JSON.stringify(delta));
      expectNumber(view.origin.x, extents[0]);
      expectNumber(view.origin.y, extents[1]);

      expectNumber(delta.x, extents[2]);
      expectNumber(delta.y, extents[3]);
    }

    it("ignores MarginOptions if camera is on", () => {
      // ###TODO need to turn camera on...
    });

    it("applies default dilation of 1.04", () => {
      expectExtents([0, 0, 100, 100], [-2, -2, 104, 104]);
    });

    it("applies MarginPercent", () => {
    });

    it("applies PaddingPercent", () => {
    });

    it("prioritizes PaddingPercent over MarginPercent", () => {
    });
  });
});
