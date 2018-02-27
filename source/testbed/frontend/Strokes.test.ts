/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { assert, expect } from "chai";
import { Point3d } from "@bentley/geometry-core/lib/PointVector";
import { StrokesPointList, StrokesPointLists } from "../../frontend/render/primitives/Strokes";

describe("StrokesPointList", () => {
  it("StrokesPointList works as expected", () => {
    const a = new StrokesPointList();
    assert.isTrue(a.startDistance === 0, "startDistance set correctly when default constructor used");
    assert.isTrue(a.rangeCenter.isExactEqual(new Point3d(0, 0, 0)), "rangeCenter set correctly when default constructor used");
    assert.isTrue(a.points.length === 0, "points set correctly when default constructor used");

    const center = new Point3d(1, 2, 3);
    const b = new StrokesPointList(undefined, center);
    assert.isTrue(b.startDistance === 0, "startDistance set correctly when constructor with just rangeCenter param used");
    assert.isTrue(b.rangeCenter.isExactEqual(center), "rangeCenter set correctly when constructor with just rangeCenter param used");
    assert.isTrue(b.points.length === 0, "points set correctly when constructor with just rangeCenter param used");

    const points = [ new Point3d(1, 2, 3), new Point3d(2, 4, 5), new Point3d(6, 7, 8) ];
    const c = new StrokesPointList(undefined, center, points);
    assert.isTrue(c.startDistance === 0, "startDistance set correctly when constructor with just points param used");
    assert.isTrue(c.rangeCenter.isExactEqual(center), "rangeCenter set correctly when constructor with just points param used");
    expect(c.points).to.deep.equal(points);
  });
});

describe("StrokesPointLists", () => {
  it("StrokesPointLists works as expected", () => {
    const a = new StrokesPointList();

    const center = new Point3d(1, 2, 3);
    const b = new StrokesPointList(undefined, center);

    const points = [ new Point3d(1, 2, 3), new Point3d(2, 4, 5), new Point3d(6, 7, 8) ];
    const c = new StrokesPointList(undefined, center, points);

    const list = [ a, b, c ];
    const strokesLists = new StrokesPointLists(a, b, c);
    expect(strokesLists).to.deep.equal(list);
  });
});
