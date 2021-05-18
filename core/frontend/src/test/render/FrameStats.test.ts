/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { Point3d, Vector3d } from "@bentley/geometry-core";
import { IModelApp } from "../../IModelApp";
import { IModelConnection } from "../../IModelConnection";
import { createBlankConnection } from "../createBlankConnection";
import { ScreenViewport } from "../../Viewport";
import { SpatialViewState } from "../../SpatialViewState";
import { FrameStats } from "../../render/FrameStats";

describe("FrameStats", () => {
  let imodel: IModelConnection;

  before(async () => {
    await IModelApp.startup();
    imodel = createBlankConnection("frame-stats");
  });

  after(async () => {
    await imodel.close();
    await IModelApp.shutdown();
  });

  function testViewport(width: number, height: number, callback: (vp: ScreenViewport) => void): void {
    const div = document.createElement("div");
    div.style.width = `${width}px`;
    div.style.height = `${height}px`;
    div.style.position = "absolute";
    div.style.top = div.style.left = "0px";
    document.body.appendChild(div);

    const view = SpatialViewState.createBlank(imodel, new Point3d(), new Vector3d(1, 1, 1));
    view.viewFlags.acsTriad = view.viewFlags.grid = false;

    const vp = ScreenViewport.create(div, view);
    IModelApp.viewManager.addViewport(vp);

    try {
      callback(vp);
    } finally {
      vp.dispose();
      document.body.removeChild(div);
    }
  }

  it("should receive frame statistics from render loop when enabled", async () => {
    testViewport(20, 20, (vp) => {
      const numFramesToDraw = 9;
      let numFrameStats = 0;

      vp.onFrameStats.addListener((_frameStats: Readonly<FrameStats>) => {
        numFrameStats++;
      });

      // make sure we receive frame stats for each rendered frame when enabled
      for (let i = 0; i < numFramesToDraw; i++) {
        vp.invalidateScene();
        vp.renderFrame();
      }
      expect(numFrameStats).to.equal(numFramesToDraw);

      // make sure we do not receive frame stats for any rendered frames when disabled
      vp.onFrameStats.clear();
      numFrameStats = 0;
      for (let i = 0; i < numFramesToDraw; i++) {
        vp.invalidateScene();
        vp.renderFrame();
      }
      expect(numFrameStats).to.equal(0);
    });
  });
});
