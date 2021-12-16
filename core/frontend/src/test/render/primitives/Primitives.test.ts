/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { LineString3d, Loop, Point3d, Range3d, Sample, Transform, Vector3d } from "@itwin/core-geometry";
import { GraphicParams } from "@itwin/core-common";
import { DisplayParams } from "../../../render/primitives/DisplayParams";
import { GeometryList } from "../../../render/primitives/geometry/GeometryList";
import { Geometry } from "../../../render/primitives/geometry/GeometryPrimitives";
import { GenerateEdges, GeometryOptions, NormalMode, PreserveOrder, SurfacesOnly, ToleranceRatio } from "../../../render/primitives/Primitives";

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

describe("GeometryOptions", () => {
  it("GeometryOptions works as expected", () => {
    const a = new GeometryOptions(GenerateEdges.Yes);
    assert.isTrue(a.normals === NormalMode.Always, "default normals correct");
    assert.isTrue(a.surfaces === SurfacesOnly.No, "default surfaces correct");
    assert.isTrue(a.preserveOrder === PreserveOrder.No, "default preserveOrder correct");
    assert.isTrue(a.edges === GenerateEdges.Yes, "default edges correct");

    assert.isTrue(a.wantSurfacesOnly === false, "default wantSurfacesOnly correct");
    assert.isTrue(a.wantPreserveOrder === false, "default wantPreserveOrder correct");
    assert.isTrue(a.wantEdges === true, "default wantEdges correct");

    const b = new GeometryOptions(GenerateEdges.No, NormalMode.Never, SurfacesOnly.Yes, PreserveOrder.Yes);
    assert.isTrue(b.normals === NormalMode.Never, "normals correct");
    assert.isTrue(b.surfaces === SurfacesOnly.Yes, "surfaces correct");
    assert.isTrue(b.preserveOrder === PreserveOrder.Yes, "preserveOrder correct");
    assert.isTrue(b.edges === GenerateEdges.No, "edges correct");

    // const gbcp = new GraphicBuilderCreateParams(Transform.createIdentity(), GraphicType.ViewOverlay);
    // const c = GeometryOptions.createForGraphicBuilder(gbcp);
    // assert.isTrue(c.normals === NormalMode.Always, "fromGraphicBuilderCreateParams normals correct");
    // assert.isTrue(c.surfaces === SurfacesOnly.No, "fromGraphicBuilderCreateParams surfaces correct");
    // assert.isTrue(c.preserveOrder === PreserveOrder.Yes, "fromGraphicBuilderCreateParams preserveOrder correct");
    // assert.isTrue(c.edges === GenerateEdges.No, "fromGraphicBuilderCreateParams edges correct");

    // const gbcp2 = new GraphicBuilderCreateParams(Transform.createIdentity(), GraphicType.Scene);
    // const d = GeometryOptions.createForGraphicBuilder(gbcp2, NormalMode.Never);
    // assert.isTrue(d.normals === NormalMode.Never, "fromGraphicBuilderCreateParams normals correct - 2");
    // assert.isTrue(d.surfaces === SurfacesOnly.No, "fromGraphicBuilderCreateParams surfaces correct - 2");
    // assert.isTrue(d.preserveOrder === PreserveOrder.No, "fromGraphicBuilderCreateParams preserveOrder correct - 2");
    // assert.isTrue(d.edges === GenerateEdges.Yes, "fromGraphicBuilderCreateParams edges correct - 2");

    // const gbcp3 = new GraphicBuilderCreateParams(Transform.createIdentity(), GraphicType.ViewBackground);
    // const e = GeometryOptions.createForGraphicBuilder(gbcp3, NormalMode.Never, SurfacesOnly.Yes);
    // assert.isTrue(e.normals === NormalMode.Never, "fromGraphicBuilderCreateParams normals correct - 3");
    // assert.isTrue(e.surfaces === SurfacesOnly.Yes, "fromGraphicBuilderCreateParams surfaces correct - 3");
    // assert.isTrue(e.preserveOrder === PreserveOrder.Yes, "fromGraphicBuilderCreateParams preserveOrder correct - 3");
    // assert.isTrue(e.edges === GenerateEdges.No, "fromGraphicBuilderCreateParams edges correct - 3");
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
      dp);
    assert.isUndefined(g0.getPolyfaces(0.001));

    const g1 = Geometry.createFromPointString([Point3d.create(0, 0, 0), Point3d.create(1, 0, 0), Point3d.create(1, 1, 0)],
      Transform.createIdentity(),
      Range3d.createXYZXYZ(0, 0, 0, 1, 1, 1),
      dp);

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
        dp));
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
    const polyfaceG0 = Geometry.createFromPolyface(polyface, Transform.createIdentity(), polyface.range(), dp);
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
    const loopG0 = Geometry.createFromLoop(loop, Transform.createIdentity(), loop.range(), dp, false);
    glist0.push(loopG0);
    verifyGeometryQueries(loopG0, false, true, false); // maybe this has to change someday?
    const strokes = loopG0.getStrokes(0.001);
    if (strokes)
      assert.isDefined(strokes);
    assert.isDefined(loopG0.getPolyfaces(0.001));
  });
});
