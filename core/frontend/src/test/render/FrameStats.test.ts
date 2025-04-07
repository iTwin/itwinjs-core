/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { IModelApp } from "../../IModelApp.js";
import { IModelConnection } from "../../IModelConnection.js";
import { createBlankConnection } from "../createBlankConnection.js";
import { ScreenViewport } from "../../Viewport.js";
import { FrameStats } from "../../render/FrameStats.js";
import { openBlankViewport } from "../openBlankViewport.js";
import { EmptyLocalization } from "@itwin/core-common";

describe("FrameStats", () => {
  let imodel: IModelConnection;

  beforeAll(async () => {
    await IModelApp.startup({ localization: new EmptyLocalization() });
    imodel = createBlankConnection("frame-stats");
  });

  afterAll(async () => {
    await imodel.close();
    await IModelApp.shutdown();
  });

  function testViewport(width: number, height: number, callback: (vp: ScreenViewport) => void): void {
    using vp = openBlankViewport({ width, height });
    vp.viewFlags = vp.viewFlags.copy({ acsTriad: false, grid: false });

    IModelApp.viewManager.addViewport(vp);

    callback(vp);
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
      expect(numFrameStats).toEqual(numFramesToDraw);

      // make sure we do not receive frame stats for any rendered frames when disabled
      vp.onFrameStats.clear();
      numFrameStats = 0;
      for (let i = 0; i < numFramesToDraw; i++) {
        vp.invalidateScene();
        vp.renderFrame();
      }
      expect(numFrameStats).toEqual(0);
    });
  });
});
