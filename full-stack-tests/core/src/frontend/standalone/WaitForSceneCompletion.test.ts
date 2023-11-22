/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { ColorDef, RenderMode } from "@itwin/core-common";
import { IModelConnection, SnapshotConnection, ViewRect } from "@itwin/core-frontend";
import { TestUtility } from "../TestUtility.js";
import { Color, TestViewport, testViewportsWithDpr } from "../TestViewport.js";

describe("Wait for scene completion", () => {
  let imodel: IModelConnection;

  before(async () => {
    await TestUtility.startFrontend();
    imodel = await SnapshotConnection.openFile("mirukuru.ibim");
  });

  after(async () => {
    await imodel?.close();
    await TestUtility.shutdownFrontend();
  });

  function expectColors(vp: TestViewport, expected: ColorDef[]): void {
    const actual = vp.readUniqueColors();
    expect(actual.length).to.equal(expected.length);
    for (const color of expected) {
      expect(actual.contains(Color.fromColorDef(color))).to.be.true;
    }
  }

  it("should successfully wait for scene completion", async () => {
    const rect = new ViewRect(0, 0, 100, 100);
    await testViewportsWithDpr(imodel, rect, async (vp) => {
      expect(vp.view.is3d());

      vp.viewFlags = vp.viewFlags.copy({ visibleEdges: false, lighting: false, renderMode: RenderMode.SmoothShade });

      vp.invalidateScene();
      await vp.waitForSceneCompletion();
      expect(vp.numRequestedTiles).to.equal(0);
      expect(vp.numSelectedTiles).to.equal(1);

      const white = ColorDef.white;
      const black = ColorDef.black;
      expectColors(vp, [white, black]);
    });
  });
});
