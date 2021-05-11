/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import {
  FrameStats, IModelApp,
  IModelConnection, SnapshotConnection,
  ViewRect,
} from "@bentley/imodeljs-frontend";
import { expect } from "chai";
import { testViewportsWithDpr } from "../TestViewport";

describe.only("FrameStats", () => {
  let imodel: IModelConnection;

  before(async () => {
    await IModelApp.startup();
    imodel = await SnapshotConnection.openFile("mirukuru.ibim");
  });

  after(async () => {
    if (imodel) await imodel.close();
    await IModelApp.shutdown();
  });

  it("should receive frame statistics from render loop when enabled", async () => {
    const rect = new ViewRect(0, 0, 100, 100);
    await testViewportsWithDpr(imodel, rect, async (vp) => {
      const numFramesToDraw = 9;
      let numFrameStats = 0;

      const callback = (_frameStats: FrameStats) => {
        numFrameStats++;
      };

      await vp.waitForAllTilesToRender();
      expect(vp.numRequestedTiles).to.equal(0);
      expect(vp.numSelectedTiles).to.equal(1);

      // make sure we receive frame stats for each rendered frame when enabled
      vp.enableFrameStatsCallback(callback);
      for (let i = 0; i < numFramesToDraw; i++) {
        vp.invalidateScene();
        await vp.drawFrame();
      }
      expect(numFrameStats).to.equal(numFramesToDraw);

      // make sure we do not receive frame stats for any rendered frames when disabled
      vp.enableFrameStatsCallback(undefined);
      numFrameStats = 0;
      for (let i = 0; i < numFramesToDraw; i++) {
        vp.invalidateScene();
        await vp.drawFrame();
      }
      expect(numFrameStats).to.equal(0);
    });
  });
});
