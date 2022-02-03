/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { IModelApp } from "../../IModelApp";
import type { IModelConnection } from "../../IModelConnection";
import { createBlankConnection } from "../createBlankConnection";
import type { ScreenViewport } from "../../Viewport";
import type { FrameStats } from "../../render/FrameStats";
import { openBlankViewport } from "../openBlankViewport";

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
    const vp = openBlankViewport({ width, height });
    vp.viewFlags = vp.viewFlags.copy({ acsTriad: false, grid: false });

    IModelApp.viewManager.addViewport(vp);

    try {
      callback(vp);
    } finally {
      vp.dispose();
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
