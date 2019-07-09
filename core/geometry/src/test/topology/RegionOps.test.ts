/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

/* tslint:disable: no-console */

import { expect } from "chai";
import { Checker } from "../Checker";

import { Sample } from "../../serialization/GeometrySamples";

import { GeometryCoreTestIO } from "../GeometryCoreTestIO";
import { GeometryQuery } from "../../curve/GeometryQuery";
import { LineString3d } from "../../curve/LineString3d";

import { RegionOps } from "../../curve/RegionOps";
import { Point3d } from "../../geometry3d/Point3dVector3d";

import { Range3d } from "../../geometry3d/Range";
import { PolygonWireOffsetContext } from "../../curve/PolygonOffsetContext";

describe("RegionOps", () => {

  it("AreaUnion", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const x0 = 0;
    let y0 = 0;
    const yStep = 10.0;
    const rectangle0 = Sample.createRectangleXY(0, 0, 5, 2);
    const rectangle1 = Sample.createRectangleXY(1, 1, 2, 3);
    GeometryCoreTestIO.captureGeometry(allGeometry, LineString3d.create(rectangle0), x0, y0);
    GeometryCoreTestIO.captureGeometry(allGeometry, LineString3d.create(rectangle1), x0, y0);
    y0 += yStep;

    const unionRegion = RegionOps.polygonXYAreaUnionLoopsToPolyface(rectangle0, rectangle1);
    if (ck.testPointer(unionRegion) && unionRegion)
      GeometryCoreTestIO.captureGeometry(allGeometry, unionRegion, x0, y0);
    y0 += yStep;

    const intersectionRegion = RegionOps.polygonXYAreaIntersectLoopsToPolyface(rectangle0, rectangle1);
    if (ck.testPointer(intersectionRegion) && intersectionRegion)
      GeometryCoreTestIO.captureGeometry(allGeometry, intersectionRegion, x0, y0);
    y0 += yStep;

    const differenceRegion = RegionOps.polygonXYAreaDifferenceLoopsToPolyface(rectangle0, rectangle1);
    if (ck.testPointer(differenceRegion) && differenceRegion)
      GeometryCoreTestIO.captureGeometry(allGeometry, differenceRegion, x0, y0);
    GeometryCoreTestIO.saveGeometry(allGeometry, "RegionOps", "AreaUnion");
    expect(ck.getNumErrors()).equals(0);
  });

});
/**
 * Exercise PolygonWireOffset and output to a file.
 * @param polygons polygons to offset
 * @param caseName name to use for output file
 * @param distances offset distances
 * @param distanceFactor factor to apply to distances.
 */
function testPolygonOffset(polygons: Point3d[][], caseName: string,
  distances: number[] = [-0.5, 0.5, 1.0, -1.0, -2.0],
  distanceFactor: number = 1) {
  const ck = new Checker();
  const allGeometry: GeometryQuery[] = [];
  let x0 = 0;
  let y0 = 0;
  const yStep = 20.0;

  const context = new PolygonWireOffsetContext();
  for (const points of polygons) {
    y0 = 0.0;
    for (const closed of [false, true]) {
      if (closed && !points[0].isAlmostEqualMetric(points[points.length - 1]))
        continue;
      GeometryCoreTestIO.captureGeometry(allGeometry, LineString3d.create(points), x0, y0, 0);
      for (const offsetDistance of distances) {
        const stickA = context.constructPolygonWireXYOffset(points, closed, offsetDistance * distanceFactor);
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, stickA!, x0, y0, 0);
      }
      y0 += yStep;
    }
    x0 += yStep;
  }

  GeometryCoreTestIO.saveGeometry(allGeometry, "PolygonOffset", caseName);
  expect(ck.getNumErrors()).equals(0);
}
describe("PolygonOffset", () => {

  it("TestA", () => {

    // const yStep = 10.0;
    const rectangle0 = Sample.createRectangleXY(0, 0, 5, 6);
    const wPoints = [
      Point3d.create(0, 5),
      Point3d.create(2, 0),
      Point3d.create(3.0),
      Point3d.create(4, 5),
      Point3d.create(5, 5),
      Point3d.create(5.5, 0),
      Point3d.create(6, 0),
      Point3d.create(6.6, 1)];
    const star1 = Sample.createStar(1, 1, 0, 4, 3, 3, true);
    const star2 = Sample.createStar(1, 1, 0, 5, 2, 5, true);
    testPolygonOffset([rectangle0, star1, star2, wPoints], "TestA");

  });

  it("TestSpikes", () => {
    const points = [];
    const dxA = 2.0;
    const dxB = 0.5;
    const dyC = 1.0;
    const dyD = 0.1;
    let x = 0.0;
    points.push(Point3d.create(0, 0, 0));
    for (let i = 2; i < 7; i++) {
      points.push(Point3d.create(x += dxA, 0));
      points.push(Point3d.create(x += dxB, dyC * i));
      points.push(Point3d.create(x += dxB, dyD));
    }
    // A problem part of mild fractal
    const pointsA = [];
    pointsA.push(Point3d.create(1432.1250000000005, 4889.2499999999964, 0.0));
    pointsA.push(Point3d.create(433.8750, 4720.50, 0.0));
    pointsA.push(Point3d.create(-442.8750, 5226.750, 0.0));
    pointsA.push(Point3d.create(-1350.0, 5564.250, 0.0));
    pointsA.push(Point3d.create(-675.0, 3750.0, 0.0));
    pointsA.push(Point3d.create(337.50, 1996.50, 0.0));
    // pointsA.push(Point3d.create(0.0, 0.0, 0.0));

    for (const p of pointsA) {
      p.scaleInPlace(0.001);
    }

    const offsetDistances = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.25, 1.5, 2.0, 2.5];
    //     const offsetDistances = [0.7];
    testPolygonOffset([pointsA, points], "SpikeInside", offsetDistances, -1);
    testPolygonOffset([pointsA, points], "SpikeOutside", offsetDistances, 1);
  });

  it("TestGouge", () => {
    const points = [];
    points.push(Point3d.create(0, 0, 0));
    points.push(Point3d.create(0, 1, 0));
    points.push(Point3d.create(2, 5, 0));
    points.push(Point3d.create(2.5, 5.0));
    points.push(Point3d.create(3, 1, 0));
    points.push(Point3d.create(3, -2, 0));
    const offsetDistances = [0.7];
    // testPolygonOffset([points], "SpikeOutside", offsetDistances, 1);
    testPolygonOffset([points], "TestGouge", offsetDistances, -1);

  });

  it("TestFractals", () => {
    const points = Sample.createFractalLMildConcavePatter(2, 0.9);
    let r = Range3d.createArray(points);
    let a = r.xLength() * 0.02;
    let offsetDistances = [2 * a, a, -a, -2 * a];
    testPolygonOffset([points], "MildConcaveFractal", offsetDistances, 1);
    const pointsB = Sample.createFractalHatReversingPattern(2, 0.9);
    r = Range3d.createArray(points);
    a = r.xLength() * 0.005;
    offsetDistances = [a, 2 * a, 4 * a];
    testPolygonOffset([pointsB], "FractalHatReverse", offsetDistances, 1);
  });

});
