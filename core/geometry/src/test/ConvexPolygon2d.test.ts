/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { Checker } from "./Checker";
import { Geometry } from "../Geometry";
import { Point2d, Vector2d } from "../geometry3d/PointVector";
import { Ray2d, ConvexPolygon2d } from "../numerics/ConvexPolygon2d";
import { PolygonOps } from "../geometry3d/PointHelpers";

/* tslint:disable:no-console no-trailing-whitespace */

// Form rays from centroid to each point.
// Compute points fractionally on the chord.
// Evaluate in/out
function checkHullRaysFromCentroid(hull: ConvexPolygon2d, ck: Checker) {
  const hullPoints = hull.points;
  const centroid = new Point2d();
  ck.testTrue(PolygonOps.centroidAndArea(hullPoints, centroid) !== undefined, "CentroidAndArea call is not undefined");

  const fractions: number[] = [0.0, 0.43, 0.96, 1.08, 2.5];
  for (const i of hullPoints) {
    for (const f of fractions) {
      const xy = centroid.interpolate(f, i);
      ck.testBoolean(f <= 1.0, hull.containsPoint(xy), "If fraction is <= 1, hull should contain point xy");
    }
  }
}

// For each hullPoints[i], form chord to hullPoints[i+step].
// Compute points fractionally on the chord.
// Evaluate
function checkHullChords(hull: ConvexPolygon2d, step: number, ck: Checker) {
  const hullPoints = hull.points;
  const fractions: number[] = [-0.2, -0.01, 0.43, 0.96, 1.08];
  for (let i = 0; i < hullPoints.length; i++) {
    const j = (i + step) % hullPoints.length;
    if (i !== j) {
      for (const f of fractions) {
        const xy = hullPoints[i].interpolate(f, hullPoints[j]);
        const isIn01 = Geometry.isIn01(f);
        ck.testBoolean(isIn01, hull.containsPoint(xy), "Point interpolated from 0 <= fraction <= 1 is in hull");
        const distanceOutside = hull.distanceOutside(xy);
        ck.testBoolean(distanceOutside <= 0, isIn01, "distanceOutside sign");
        const ray = Ray2d.createOriginAndTarget(hullPoints[i], hullPoints[j]);
        const range = hull.rangeAlongRay(ray);
        const ray1 = Ray2d.createOriginAndDirectionCapture(
          ray.fractionToPoint(range.low),
          ray.direction.scale(range.high - range.low));
        const range1 = hull.rangeAlongRay(ray1);

        ck.testCoordinate(range1.low, 0.0, "Vertex chord extent low");
        ck.testCoordinate(range1.high, 1.0, "Vertex chord extent high");
      }
    }
  }
}

function lisajoue(theta: number, a: number): Point2d {
  const r = Math.cos(a * theta);
  return Point2d.create(r * Math.cos(theta), r * Math.sin(theta));
}

function countPointsInHull(hull: ConvexPolygon2d, points: Point2d[]): number {
  let n = 0;
  for (const xy of points) {
    if (hull.containsPoint(xy))
      n++;
  }
  return n;
}

describe("ConvexPolygon2d", () => {

  it("ConvexHullQueries", () => {
    const ck = new Checker();
    const points: Point2d[] = [
      Point2d.create(0, 0),
      Point2d.create(10, 0),
      Point2d.create(20, 10),
      Point2d.create(10, 20),
      Point2d.create(0, 10),
    ];

    const hull = ConvexPolygon2d.createHull(points);
    checkHullRaysFromCentroid(hull, ck);

    const rayA = Ray2d.createOriginAndDirection(Point2d.create(0, 5), Vector2d.create(2, 0));
    ck.testTrue(rayA.normalizeDirectionInPlace(), "Normalized direction in place should be true");

    const skip = 3;
    for (let i = 0; i < points.length; i++) {
      const pointA = points[i];
      const pointB = points[(i + skip) % points.length];
      const rayAB = Ray2d.createOriginAndTarget(pointA, pointB);
      let pointA1: Point2d;
      let pointB1: Point2d;
      let range = hull.clipRay(rayAB);
      ck.testFalse(range.isNull, "Clip interior segment");

      pointA1 = rayAB.fractionToPoint(range.low);
      pointB1 = rayAB.fractionToPoint(range.high);
      const dAB = pointA.distance(pointB);
      const d1 = pointA1.distance(pointB1);
      ck.testCoordinate(dAB, d1, "Clipped chord length");
      ck.testTrue(pointA1.isAlmostEqual(pointA), "Clipped chord start");
      ck.testTrue(pointB1.isAlmostEqual(pointB), "Clipped chord end");

      const pointC0 = pointA.interpolate(-0.5, pointB);
      const pointC1 = pointA.interpolate(-0.1, pointB);
      const pointD = pointA.interpolate(1.5, pointB);
      const pointM = pointA.interpolate(0.323, pointB);
      // point order (C,A,M,B,D)
      ck.testTrue(hull.containsPoint(pointM), "Known interior point");
      ck.testFalse(hull.containsPoint(pointC0), "Known exterior point");
      ck.testFalse(hull.containsPoint(pointC1), "Known exterior point");
      ck.testFalse(hull.containsPoint(pointD), "Known exterior point");

      const rayC0C1 = Ray2d.createOriginAndTarget(pointC0, pointC1);
      ck.testTrue(rayC0C1.normalizeDirectionInPlace());
      range = hull.clipRay(rayC0C1);
      ck.testFalse(range.isNull, "Clip exterior segment");

      const rayC1M = Ray2d.createOriginAndTarget(pointC1, pointM);
      ck.testTrue(rayC1M.normalizeDirectionInPlace());
      range = hull.clipRay(rayC1M);
      ck.testFalse(range.isNull, "Clip mixed segment");
      ck.testCoordinate(range.length(), pointA.distance(pointB), "Clipped segment length");

    }

    // Construct known exterior rays
    for (let i = 0; i < points.length; i++) {
      const pointA = points[i];
      const pointB = points[(i + 1) % points.length];
      const pointA1 = pointA.forwardLeftInterpolate(0.0, -0.1, pointB);
      const pointB1 = pointA.forwardLeftInterpolate(1.0, -0.1, pointB);
      const ray = Ray2d.createOriginAndTarget(pointA1, pointB1);

      const range = hull.clipRay(ray);
      ck.testTrue(range.isNull, "Clip exterior segment");
    }

    // Construct a grid of parallel segments ...
    const scanBase = Ray2d.createOriginAndDirection(Point2d.create(1, 4), Vector2d.create(1, 2));
    scanBase.normalizeDirectionInPlace();
    const hullRange = hull.rangePerpendicularToRay(scanBase);
    const parallelDistance = 2.25;
    const epsilon = 0.01;
    for (let a = hullRange.low + epsilon; a + epsilon <= hullRange.high; a += parallelDistance) {
      const scanRay = scanBase.parallelRay(a);
      // a is strictly within -- expect an interior segment ..
      const range = hull.clipRay(scanRay);
      ck.testFalse(range.isNull, "Clip scan segment");
    }

    ck.checkpoint("ConvexHullQueries");
    expect(ck.getNumErrors()).equals(0);
  });

  // ---------------------------------------------------------------------------------------------------------

  it("ConvexHullQueriesConstruction", () => {
    const ck = new Checker();
    const points: Point2d[] = [
      // These are the hull (CW)
      Point2d.create(0, 0),
      Point2d.create(10, 0),
      Point2d.create(20, 10),
      Point2d.create(10, 20),
      Point2d.create(15, 3),
      Point2d.create(0, 10),
      // These are inside
      Point2d.create(5, 5),
      Point2d.create(2, 4),
      Point2d.create(12, 4),
      Point2d.create(13, 5),
    ];
    const insideBase = 5;
    const hull = ConvexPolygon2d.createHull(points);

    for (let i = insideBase; i < points.length; i++) {
      ck.testTrue(hull.containsPoint(points[i]), "Point inside hull");
    }

    checkHullChords(hull, 3, ck);
    checkHullChords(hull, 2, ck);

    ck.checkpoint("ConvexHullQueriesConstruction");
    expect(ck.getNumErrors()).equals(0);
  });

  // ---------------------------------------------------------------------------------------------------------

  it("ConvexHullManyPoints", () => {
    const ck = new Checker();
    const points: Point2d[] = [];
    const a = 3.29;
    const dtheta = 0.34;
    const numPoints = 1000;
    for (let theta = 0.01; points.length < numPoints; theta += dtheta) {
      points.push(lisajoue(theta * theta, a));
    }

    const hull = ConvexPolygon2d.createHull(points);

    for (const i of points) {
      ck.testTrue(hull.containsPoint(i), "Point inside hull");
    }

    // CheckHullChords (hull, hull.Points().size () / 3);   // This has nasty tolerance problems -- short edges, near-zero cross products
    checkHullRaysFromCentroid(hull, ck);
    const offsetDistance = 1.0;
    const hull1 = ConvexPolygon2d.createHullIsValidCheck(hull.points);
    hull1.offsetInPlace(offsetDistance);
    const hull2 = ConvexPolygon2d.createHullIsValidCheck(hull1.points);
    hull2.offsetInPlace(0.01 * offsetDistance);
    const n = hull.points.length;
    ck.testExactNumber(n, countPointsInHull(hull1, hull.points));
    ck.testExactNumber(0, countPointsInHull(hull, hull1.points));
    ck.testExactNumber(0, countPointsInHull(hull1, hull2.points));

    ck.checkpoint("ConvexHullManyPoints");
    expect(ck.getNumErrors()).equals(0);
  });

  it("Ray2d", () => {
    const ck = new Checker();
    const ray0 = Ray2d.createOriginAndDirection(Point2d.create(2, 3), Vector2d.create(1, 4));
    const perp0 = ray0.CCWPerpendicularRay();
    const perp1 = ray0.CWPerpendicularRay();
    ck.testCoordinate(ray0.direction.magnitude(), perp0.direction.magnitude());
    ck.testCoordinate(ray0.direction.magnitude(), perp1.direction.magnitude());
    ck.testPerpendicular2d(perp0.direction, ray0.direction, "CCW rotate");
    ck.testPerpendicular2d(perp1.direction, ray0.direction, "CW rotate");
    ck.testLT(0, ray0.direction.crossProduct(perp0.direction));
    ck.testLT(ray0.direction.crossProduct(perp1.direction), 0, "CW rotate sense");
    ck.checkpoint("Ray2d");
    expect(ck.getNumErrors()).equals(0);

    for (const f0 of [-0.3, 0.5, 0.2]) {
      const point0 = ray0.fractionToPoint(f0);
      const f1 = ray0.projectionFraction(point0);
      ck.testCoordinate(f0, f1, "projection fraction");
    }
  });

});
