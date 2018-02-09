/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { Point3d } from "@bentley/geometry-core/lib/PointVector";
import { PolylineParamVertex } from "../../frontend/render/Graphic";

function withinTol(x: number, y: number): boolean {
  return Math.abs(x - y) < 0.0000000000001;
}

describe("Graphic", () => {
  it("PolilineParamVertex works as expected", () => {
    const points: Point3d[] = [Point3d.create (0, 0, 0), Point3d.create (1, 0, 0), Point3d.create (1, 1, 0), Point3d.create (2, 2, 0)];
    let ppv = new PolylineParamVertex (true, true, points[1], points[0], points[2], 0xffffff, 0, 1.0);
    let dot = ppv.DotProduct();
    assert.isTrue (0.0 === dot, "DotProduct of vertex at point 1 should be 0");
    ppv = new PolylineParamVertex (true, true, points[2], points[1], points[3], 0xffffff, 0, 1.0);
    dot = ppv.DotProduct();
    assert.isTrue (withinTol(-0.7071067811865475, dot), "DotProduct of vertex at point 2 should be -0.7071067811865475 but was " + dot);
  });
});
