/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { describe, expect, it } from "vitest";
import { GraphicParams } from "@itwin/core-common";
import { Geometry as Geom, IndexedPolyface, LineString3d, Loop, Point3d, Range3d, Transform, Vector3d } from "@itwin/core-geometry";
import { DisplayParams } from "../../../common/internal/render/DisplayParams";
import { GeometryList } from "../../../common/internal/render/GeometryList";
import { Geometry } from "../../../common/internal/render/GeometryPrimitives";
import { ToleranceRatio } from "../../../common/internal/render/Primitives";

function verifyGeometryQueries(g: Geometry, doDecimate: boolean = false, doVertexCluster: boolean = true, hasPart: boolean = false) {
  expect(g.doDecimate()).toBe(doDecimate);
  expect(g.doVertexCluster()).toBe(doVertexCluster);
  expect(g.part() !== undefined).toBe(hasPart);
}
function createUnitCircle(numPoints: number): Point3d[] {
  const points: Point3d[] = [];
  const dTheta = Geom.safeDivideFraction(Math.PI * 2, numPoints - 1, 0.0);
  for (let i = 0; i + 1 < numPoints; i++) {
    const theta = i * dTheta;
    points.push(Point3d.create(Math.cos(theta), Math.sin(theta), 0.0));
  }
  points.push(points[0].clone());
  return points;
}
function createTriangularUnitGridPolyface(
  origin: Point3d, vectorX: Vector3d, vectorY: Vector3d,
  numXVertices: number, numYVertices: number, createParams: boolean = false, createNormals: boolean = false,
): IndexedPolyface {
  const mesh = IndexedPolyface.create(createNormals, createParams);
  const normal = vectorX.crossProduct(vectorY);
  if (createNormals) {
    normal.normalizeInPlace();
    mesh.addNormalXYZ(normal.x, normal.y, normal.z); // use XYZ to help coverage count
  }
  // push to coordinate arrays
  for (let j = 0; j < numYVertices; j++) {
    for (let i = 0; i < numXVertices; i++) {
      mesh.addPoint(origin.plus2Scaled(vectorX, i, vectorY, j));
      if (createParams)
        mesh.addParamUV(i, j);
    }
  }
  for (let j = 0; j + 1 < numYVertices; j++) {
    for (let i = 0; i + 1 < numXVertices; i++) {
      const vertex00 = numXVertices * j + i;
      const vertex10 = vertex00 + 1;
      const vertex01 = vertex00 + numXVertices;
      const vertex11 = vertex01 + 1;
      // push quad
      mesh.addPointIndex(vertex00, true);
      mesh.addPointIndex(vertex10, true);
      mesh.addPointIndex(vertex11, true);
      mesh.addPointIndex(vertex01, true);
      // param indexing matches points
      if (createParams) {
        mesh.addParamIndex(vertex00);
        mesh.addParamIndex(vertex10);
        mesh.addParamIndex(vertex11);
        mesh.addParamIndex(vertex01);
      }
      if (createNormals) {
        mesh.addNormalIndex(0);
        mesh.addNormalIndex(0);
        mesh.addNormalIndex(0);
        mesh.addNormalIndex(0);
      }
      mesh.terminateFacet(false);
    }
  }
  return mesh;
}

describe("ToleranceRatio", () => {
  it("ToleranceRatio works as expected", () => {
    expect(ToleranceRatio.vertex).toBe(0.1);
    expect(ToleranceRatio.facetArea).toBe(0.1);
  });
});

describe("GeometryList", () => {
  it("LineStringPointString", () => {
    const glist0 = new GeometryList();
    expect(glist0.isEmpty).toBe(true);
    const gp = new GraphicParams();
    const dp = DisplayParams.createForLinear(gp);
    const g0 = Geometry.createFromLineString([Point3d.create(0, 0, 0), Point3d.create(1, 0, 0), Point3d.create(1, 1, 0)],
      Transform.createIdentity(),
      Range3d.createXYZXYZ(0, 0, 0, 1, 1, 1),
      dp, undefined);
    expect(g0.getPolyfaces(0.001)).toBeUndefined();

    const g1 = Geometry.createFromPointString([Point3d.create(0, 0, 0), Point3d.create(1, 0, 0), Point3d.create(1, 1, 0)],
      Transform.createIdentity(),
      Range3d.createXYZXYZ(0, 0, 0, 1, 1, 1),
      dp, undefined);

    glist0.push(g0);
    expect(g0).toBe(glist0.first);
    expect(glist0.length).toBe(1);
    glist0.push(g1);
    expect(g1.getPolyfaces(0.001)).toBeUndefined();

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
    expect(glist0.length).toBe(length00 + length1);
    let count = 0;
    const rangeA = Range3d.createNull();
    for (const g of glist0) {
      rangeA.extendRange(g.tileRange);
      count++;
      const strokeList = g.getStrokes(0.01);
      expect(strokeList).toBeDefined();
      verifyGeometryQueries(g, false, true, false); // maybe this has to change someday?
    }
    const rangeB = glist0.computeRange();
    expect(rangeA.isAlmostEqual(rangeB)).toBe(true);
    expect(count).toBe(length00 + length1);

    glist0.clear();
    expect(glist0.isEmpty).toBe(true);
  });
  it("Polyface", () => {
    const glist0 = new GeometryList();
    expect(glist0.isEmpty).toBe(true);
    const gp = new GraphicParams();
    const dp = DisplayParams.createForLinear(gp);
    const origin = Point3d.create(1, 2, 3);
    const polyface = createTriangularUnitGridPolyface(origin,
      Vector3d.create(1, 0, 0), Vector3d.create(0, 2, 0), 4, 5, true, true);
    const polyfaceG0 = Geometry.createFromPolyface(polyface, Transform.createIdentity(), polyface.range(), dp, undefined);
    glist0.push(polyfaceG0);
    verifyGeometryQueries(polyfaceG0, false, true, false); // maybe this has to change someday?
    const polyfaces = polyfaceG0.getPolyfaces(0.001);
    expect(polyfaces).toBeDefined();
    expect(polyfaceG0.getStrokes(0.001)).toBeUndefined();
  });

  it("Loop", () => {
    const glist0 = new GeometryList();
    expect(glist0.isEmpty).toBe(true);
    const gp = new GraphicParams();
    const dp = DisplayParams.createForLinear(gp);
    const loop = Loop.create(LineString3d.create(createUnitCircle(5)));
    const loopG0 = Geometry.createFromLoop(loop, Transform.createIdentity(), loop.range(), dp, false, undefined);
    glist0.push(loopG0);
    verifyGeometryQueries(loopG0, false, true, false); // maybe this has to change someday?
    const strokes = loopG0.getStrokes(0.001);
    if (strokes)
      expect(strokes).toBeDefined();
    expect(loopG0.getPolyfaces(0.001)).toBeDefined();
  });
});
