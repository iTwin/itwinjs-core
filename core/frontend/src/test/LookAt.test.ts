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
import {MarginPercent, PaddingPercent} from "../MarginPercent";

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

  describe("lookAtViewAlignedVolume", () => {
    function createTopView(): SpatialViewState {
      const view = SpatialViewState.createBlank(imodel, new Point3d(), new Point3d());
      view.setStandardRotation(StandardViewId.Top);
      expect(view.isCameraOn).to.be.false;
      return view;
    }

    // [lowX, lowY, highX, highY]
    type Range = [number, number, number, number];

    function expectExtents(volume: Range, expected: Range, options?: MarginOptions, aspect = 1.0): void {
      const view = createTopView();
      const range = new Range3d(volume[0], volume[1], -1, volume[2], volume[3], 1);
      view.lookAtViewAlignedVolume(range, aspect, options);

      const delta = view.getExtents();
      const actual = [Math.round(view.origin.x), Math.round(view.origin.y), Math.round(delta.x), Math.round(delta.y)];
      expect(actual).to.deep.equal(expected);
    }

    it("applies default dilation of 1.04", () => {
      expectExtents([0, 0, 100, 100], [-2, -2, 104, 104]);
      expectExtents([0, 0, 100, 100], [-2, -54, 104, 208], undefined, 0.5);
      expectExtents([0, 0, 100, 100], [-54, -2, 208, 104], undefined, 2.0);
    });

    it("applies MarginPercent", () => {
      function marginPercent(percent: number | Partial<MarginPercent>): MarginOptions {
        if (typeof percent === "number")
          return { marginPercent: { left: percent, right: percent, top: percent, bottom: percent } };

        return {
          marginPercent: {
            left: percent.left ?? 0, right: percent.right ?? 0, top: percent.top ?? 0, bottom: percent.bottom ?? 0,
          },
        };
      }

      // Note: MarginPercent "percentages" are not accurate. For example: a percentage of 0.25 per side actually adds 50% to each side.
      expectExtents([0, 0, 100, 100], [-50, -50, 200, 200], marginPercent(0.25));
      expectExtents([0, 0, 100, 100], [-33, 0, 133, 133], marginPercent({left: 0.25, top: 0.25}));
      expectExtents([0, 0, 100, 100], [-33, -33, 133, 133], marginPercent({left: 0.25, bottom: 0.25}));
      expectExtents([0, 0, 100, 100], [0, 0, 133, 133], marginPercent({ right: 0.25, top: 0.25}));
    });

    it("applies PaddingPercent", () => {
      function padding(percent: number | PaddingPercent): MarginOptions {
        return { paddingPercent: percent };
      }

      expectExtents([0, 0, 100, 100], [-50, -50, 200, 200], padding(0.5));
      expectExtents([0, 0, 100, 100], [-25, -25, 150, 150], padding(0.25));
      expectExtents([0, 0, 100, 100], [-25, -25, 125, 125], padding({left: 0.25, bottom: 0.25}));
      expectExtents([0, 0, 100, 100], [0, -25, 150, 150], padding({right: 0.5}));
      expectExtents([0, 0, 100, 100], [-100, -50, 200, 200], padding({left: 1}));
      expectExtents([0, 0, 100, 100], [-100, 0, 200, 100], padding({left: 1}), 2);

      expectExtents([0, 0, 100, 100], [25, 25, 50, 50], padding(-0.25));
      expectExtents([0, 0, 100, 100], [25, 25, 75, 75], padding({left: -0.25, bottom: -0.25}));
      expectExtents([0, 0, 100, 100], [0, 0, 25, 25], padding({right: -0.75, top: -0.75}));
      expectExtents([0, 0, 100, 100], [100, 0, 100, 100], padding({left: -1, right: 1}));
    });

    it("prioritizes PaddingPercent over MarginPercent", () => {
      expectExtents([0, 0, 100, 100], [-50, -50, 200, 200], {paddingPercent: 0.5, marginPercent: {left: 0, right: 0.25, top: 0.125, bottom: 0.2}});
      expectExtents([0, 0, 100, 100], [-50, -50, 200, 200], {paddingPercent: undefined, marginPercent: {left: 0.25, right: 0.25, top: 0.25, bottom: 0.25}});
    });
  });
});
