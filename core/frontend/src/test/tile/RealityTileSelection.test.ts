/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { BeTimePoint } from "@itwin/core-bentley";
import { Angle, Geometry, Point3d, Range3d, Transform, Vector3d } from "@itwin/core-geometry";
import { IModelApp } from "../../IModelApp";
import { IModelConnection } from "../../IModelConnection";
import { MockRender } from "../../internal/render/MockRender";
import { RealityTile, TileDrawArgs } from "../../tile/internal";
import { SceneContext } from "../../ViewContext";
import { createBlankConnection } from "../createBlankConnection";
import { openBlankViewport } from "../openBlankViewport";
import { ScriptedTree, selectScripted } from "./ScriptedRealityTiles";

describe("RealityTile selection", () => {
  let imodel: IModelConnection;

  beforeEach(async () => {
    await MockRender.App.startup();
    IModelApp.stopEventLoop();
    imodel = createBlankConnection("reality-tile-selection");
  });

  afterEach(async () => {
    await imodel.close();
    await MockRender.App.shutdown();
  });

  it("measures screen-space error to the bounding box, without the near-plane shortcut of a bounding sphere", () => {
    using viewport = openBlankViewport({ width: 200, height: 100, iModel: imodel as never });
    const eye = Point3d.createZero(), target = Point3d.create(0, 0, -100);
    const view = viewport.view;
    if (!view.is3d())
      throw new Error("3d view expected");

    view.lookAt({ eyePoint: eye, targetPoint: target, upVector: Vector3d.unitY(), lensAngle: Angle.createDegrees(60), frontDistance: 1, backDistance: 1000 });
    viewport.setupFromView();
    const tree = new ScriptedTree(imodel);
    const args = new TileDrawArgs({
      context: new SceneContext(viewport), tree, location: Transform.createIdentity(), now: BeTimePoint.now(), viewFlagOverrides: {},
      parentsAndChildrenExclusive: false, symbologyOverrides: undefined, maximumScreenSpaceError: 16,
    });
    // A wide box beside the view axis: its bounding sphere crosses the near plane, but the box itself is about 102 m away.
    const geometricError = 4;
    const tile = new RealityTile({ contentId: "t", range: Range3d.createXYZXYZ(30, -1, -102, 230, 1, -98), maximumSize: 1, geometricError }, tree);

    // The visibility factor compares the error with the tolerance.
    const sse = args.maximumScreenSpaceError / tile.computeVisibilityFactor(args);

    const pixelSizePerDistance = viewport.getPixelSizeAtPoint(target) / eye.distance(target);
    expect(sse).toBeCloseTo(geometricError / (Geometry.hypotenuseXY(30, 98) * pixelSizePerDistance), 6);
    // Measured as before, with the pixel size at the near plane, the error would refine the tile.
    const nearPlaneSse = geometricError / args.computePixelSizeInMetersAtClosestPoint(args.getTileCenter(tile), args.getTileRadius(tile));
    expect(nearPlaneSse).toBeGreaterThan(16);
    expect(sse).toBeLessThan(16);
  });

  it("keeps a tile displayed until all its children are ready, including those outside the view, and requests them at once", () => {
    const root = new ScriptedTree(imodel).root({ sse: 40 });
    const a = root.add("a", { sse: 20, ready: false }, false);
    a.add("a1", { sse: 5 });
    const a2 = a.add("a2", { sse: 5, ready: false });
    const offScreen = root.add("b", { sse: 10, culled: true, ready: false });

    let result = selectScripted(root);
    expect(result.selected).toEqual(["r"]);
    expect(result.missing).toEqual(["a", "a2", "b"]);
    expect(result.complete).toBe(true);

    // Root refines to a (b is outside the view); a stays until a2 is ready.
    a.setIsReady();
    offScreen.setIsReady();
    result = selectScripted(root);
    expect(result.selected).toEqual(["a"]);
    expect(result.missing).toEqual(["a2"]);

    a2.setIsReady();
    result = selectScripted(root);
    expect(result.selected).toEqual(["a1", "a2"]);
    expect(result.missing).toEqual([]);
  });

  it("treats a tile whose content was not found as covered, does not request it, and never refines into it", () => {
    const tree = new ScriptedTree(imodel);
    const root = tree.root({ sse: 10, ready: false });
    root.add("a", { sse: 5 });
    root.add("b", { sse: 5, notFound: true });
    root.loadScriptedChildren();

    // The missing root's loaded children stand in for it; the child whose content was not found leaves no hole.
    const result = selectScripted(root);
    expect(result.selected).toEqual(["a"]);
    expect(result.missing).toEqual(["r"]);
    expect(result.complete).toBe(true);

    const parent = tree.root({ sse: 40 }, "p");
    parent.add("x", { sse: 5 });
    parent.add("y", { sse: 5, notFound: true });
    const refined = selectScripted(parent);
    expect(refined.selected).toEqual(["p"]);
    expect(refined.missing).toEqual([]);
  });
});
