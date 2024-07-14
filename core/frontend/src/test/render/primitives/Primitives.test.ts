/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { LineString3d, Loop, Point3d, Range3d, Sample, Transform, Vector3d } from "@itwin/core-geometry";
import { GraphicParams } from "@itwin/core-common";
import { DisplayParams } from "../../../common/internal/render/DisplayParams";
import { GeometryList } from "../../../common/internal/render/GeometryList";
import { Geometry } from "../../../common/internal/render/GeometryPrimitives";
import { ToleranceRatio } from "../../../common/internal/render/Primitives";

function verifyGeometryQueries(g: Geometry, doDecimate: boolean = false, doVertexCluster: boolean = true, hasPart: boolean = false) {
  assert.equal(doDecimate, g.doDecimate());
  assert.equal(doVertexCluster, g.doVertexCluster());
  assert.equal(hasPart, g.part() !== undefined);
}
describe("ToleranceRatio", () => {
  it("ToleranceRatio works as expected", () => {
    assert.isTrue(ToleranceRatio.vertex === 0.1, "pos is correct");
    assert.isTrue(ToleranceRatio.facetArea === 0.1, "normal is correct");
  });
});

describe("GeometryList", () => {
  it("LineStringPointString", () => {
    const glist0 = new GeometryList();
    assert.isTrue(glist0.isEmpty);
    const gp = new GraphicParams();
    const dp = DisplayParams.createForLinear(gp);
    const g0 = Geometry.createFromLineString([Point3d.create(0, 0, 0), Point3d.create(1, 0, 0), Point3d.create(1, 1, 0)],
      Transform.createIdentity(),
      Range3d.createXYZXYZ(0, 0, 0, 1, 1, 1),
      dp, undefined);
    assert.isUndefined(g0.getPolyfaces(0.001));

    const g1 = Geometry.createFromPointString([Point3d.create(0, 0, 0), Point3d.create(1, 0, 0), Point3d.create(1, 1, 0)],
      Transform.createIdentity(),
      Range3d.createXYZXYZ(0, 0, 0, 1, 1, 1),
      dp, undefined);

    glist0.push(g0);
    assert.equal(g0, glist0.first);
    assert.equal(1, glist0.length);
    glist0.push(g1);
    assert.isUndefined(g1.getPolyfaces(0.001));

    const glist1 = new GeometryList();
    for (const y0 of [1, 2, 3]) {
      glist1.push(Geometry.createFromLineString([Point3d.create(0, y0, 0), Point3d.create(1, y0, 0)],
        Transform.createIdentity(),
        Range3d.createXYZXYZ(0, y0, 0, 1, y0, 0),
        dp, undefined));
    }
    const length00 = glist0.length;
    const length1 = glist1.length;
    glist0.append(glist1);
    assert.equal(glist0.length, length00 + length1);
    let count = 0;
    const rangeA = Range3d.createNull();
    for (const g of glist0) {
      rangeA.extendRange(g.tileRange);
      count++;
      const strokeList = g.getStrokes(0.01);
      assert.isDefined(strokeList);
      verifyGeometryQueries(g, false, true, false); // maybe this has to change someday?
    }
    const rangeB = glist0.computeRange();
    assert.isTrue(rangeA.isAlmostEqual(rangeB));
    assert.equal(count, length00 + length1);

    glist0.clear();
    assert.isTrue(glist0.isEmpty);

  });
  it("Polyface", () => {
    const glist0 = new GeometryList();
    assert.isTrue(glist0.isEmpty);
    const gp = new GraphicParams();
    const dp = DisplayParams.createForLinear(gp);
    const origin = Point3d.create(1, 2, 3);
    const polyface = Sample.createTriangularUnitGridPolyface(origin,
      Vector3d.create(1, 0, 0), Vector3d.create(0, 2, 0), 4, 5, true, true, false);
    const polyfaceG0 = Geometry.createFromPolyface(polyface, Transform.createIdentity(), polyface.range(), dp, undefined);
    glist0.push(polyfaceG0);
    verifyGeometryQueries(polyfaceG0, false, true, false); // maybe this has to change someday?
    const polyfaces = polyfaceG0.getPolyfaces(0.001);
    assert.isDefined(polyfaces);
    assert.isUndefined(polyfaceG0.getStrokes(0.001));
  });

  it("Loop", () => {
    const glist0 = new GeometryList();
    assert.isTrue(glist0.isEmpty);
    const gp = new GraphicParams();
    const dp = DisplayParams.createForLinear(gp);
    const loop = Loop.create(LineString3d.create(Sample.createUnitCircle(5)));
    const loopG0 = Geometry.createFromLoop(loop, Transform.createIdentity(), loop.range(), dp, false, undefined);
    glist0.push(loopG0);
    verifyGeometryQueries(loopG0, false, true, false); // maybe this has to change someday?
    const strokes = loopG0.getStrokes(0.001);
    if (strokes)
      assert.isDefined(strokes);
    assert.isDefined(loopG0.getPolyfaces(0.001));
  });
});
