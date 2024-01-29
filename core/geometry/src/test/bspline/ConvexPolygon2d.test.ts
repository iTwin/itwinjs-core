/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { CurveLocationDetail } from "../../curve/CurveLocationDetail";
import { GeometryQuery } from "../../curve/GeometryQuery";
import { LineSegment3d } from "../../curve/LineSegment3d";
import { Geometry } from "../../Geometry";
import { GrowableXYZArray } from "../../geometry3d/GrowableXYZArray";
import { Point2d, Vector2d } from "../../geometry3d/Point2dVector2d";
import { Point3d } from "../../geometry3d/Point3dVector3d";
import { PolygonOps } from "../../geometry3d/PolygonOps";
import { Ray2d } from "../../geometry3d/Ray2d";
import { ConvexPolygon2d } from "../../numerics/ConvexPolygon2d";
import { Sample } from "../../serialization/GeometrySamples";
import { Checker } from "../Checker";
import { GeometryCoreTestIO } from "../GeometryCoreTestIO";

// Form rays from centroid to each point.
// Compute points fractionally on the chord.
// Evaluate in/out
function checkHullRaysFromCentroid(hull: ConvexPolygon2d, ck: Checker) {
  const hullPoints = hull.points;
  const centroid = new Point2d();
  ck.testTrue(PolygonOps.centroidAndAreaXY(hullPoints, centroid) !== undefined, "CentroidAndArea call is not undefined");

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

    const hull = ConvexPolygon2d.createHull(points)!;
    checkHullRaysFromCentroid(hull, ck);

    const rayA = Ray2d.createOriginAndDirection(Point2d.create(0, 5), Vector2d.create(2, 0));
    ck.testTrue(rayA.normalizeDirectionInPlace(), "Normalized direction in place should be true");

    const skip = 3;
    for (let i = 0; i < points.length; i++) {
      const pointA = points[i];
      const pointB = points[(i + skip) % points.length];
      const rayAB = Ray2d.createOriginAndTarget(pointA, pointB);
      let range = hull.clipRay(rayAB);
      ck.testFalse(range.isNull, "Clip interior segment");

      const pointA1: Point2d = rayAB.fractionToPoint(range.low);
      const pointB1: Point2d = rayAB.fractionToPoint(range.high);
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
    const hull = ConvexPolygon2d.createHull(points)!;

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
    const dTheta = 0.34;
    const numPoints = 1000;
    for (let theta = 0.01; points.length < numPoints; theta += dTheta) {
      points.push(Sample.createRosePoint2d(theta * theta, a));
    }

    const hull = ConvexPolygon2d.createHull(points)!;

    for (const i of points) {
      ck.testTrue(hull.containsPoint(i), "Point inside hull");
    }

    // CheckHullChords (hull, hull.Points().size () / 3);   // This has nasty tolerance problems -- short edges, near-zero cross products
    checkHullRaysFromCentroid(hull, ck);
    const offsetDistance = 1.0;
    const hull1 = ConvexPolygon2d.createHullIsValidCheck(hull.points)!;
    hull1.offsetInPlace(offsetDistance);
    const hull2 = ConvexPolygon2d.createHullIsValidCheck(hull1.points)!;
    hull2.offsetInPlace(0.01 * offsetDistance);
    const n = hull.points.length;
    ck.testExactNumber(n, countPointsInHull(hull1, hull.points));
    ck.testExactNumber(0, countPointsInHull(hull, hull1.points));
    ck.testExactNumber(0, countPointsInHull(hull1, hull2.points));

    ck.checkpoint("ConvexHullManyPoints");

    const offsetDistance1 = 0.01 * offsetDistance;
    const innerMidPt = Point2d.createZero();
    const innerMidPt3d = Point3d.createZero();
    const outerEdge = LineSegment3d.createXYXY(0, 0, 0, 0);
    const detail = new CurveLocationDetail();
    let i0 = n - 1;
    for (let i1 = 0; i1 < n; i0 = i1++) {
      // verify hull1 offsetDistance from hull
      let innerPt0 = hull.points[i0];
      let innerPt1 = hull.points[i1];
      innerPt0.interpolate(0.5, innerPt1, innerMidPt);
      outerEdge.point0Ref.setFrom(hull1.points[i0]);
      outerEdge.point1Ref.setFrom(hull1.points[i1]);
      outerEdge.closestPoint(Point3d.createFrom(innerMidPt, innerMidPt3d), false, detail);
      ck.testCoordinate(offsetDistance, detail.a, "hull1 has expected offsetDistance from hull");
      // verify hull2 offsetDistance1 from hull1
      innerPt0 = hull1.points[i0];
      innerPt1 = hull1.points[i1];
      innerPt0.interpolate(0.5, innerPt1, innerMidPt);
      outerEdge.point0Ref.setFrom(hull2.points[i0]);
      outerEdge.point1Ref.setFrom(hull2.points[i1]);
      outerEdge.closestPoint(Point3d.createFrom(innerMidPt, innerMidPt3d), false, detail);
      ck.testCoordinate(offsetDistance1, detail.a, "hull2 has expected offsetDistance1 from hull1");
    }
    const allGeometry: GeometryQuery[] = [];
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, [GrowableXYZArray.create(hull.points), GrowableXYZArray.create(hull1.points), GrowableXYZArray.create(hull2.points)]);
    GeometryCoreTestIO.saveGeometry(allGeometry, "ConvexPolygon2d", "OffsetInPlace");

    expect(ck.getNumErrors()).equals(0);
  });

  it("Ray2d", () => {
    const ck = new Checker();
    const origin = Point2d.create(2, 3);
    const direction = Vector2d.create(1, 4);
    const ray0 = Ray2d.createOriginAndDirection(origin, direction);
    const pointA = Point2d.create(1, 2);
    const ray1 = Ray2d.createOriginAndTarget(pointA, pointA);
    ck.testFalse(ray1.normalizeDirectionInPlace());
    const perp0 = ray0.ccwPerpendicularRay();
    const perp1 = ray0.cwPerpendicularRay();
    ck.testCoordinate(ray0.direction.magnitude(), perp0.direction.magnitude());
    ck.testCoordinate(ray0.direction.magnitude(), perp1.direction.magnitude());
    ck.testPerpendicular2d(perp0.direction, ray0.direction, "CCW rotate");
    ck.testPerpendicular2d(perp1.direction, ray0.direction, "CW rotate");
    ck.testLT(0, ray0.direction.crossProduct(perp0.direction));
    ck.testLT(ray0.direction.crossProduct(perp1.direction), 0, "CW rotate sense");
    for (const f0 of [-0.3, 0.5, 0.2]) {
      const point0 = ray0.fractionToPoint(f0);
      const f1 = ray0.projectionFraction(point0);
      ck.testCoordinate(f0, f1, "projection fraction");
    }
    const ray2 = Ray2d.createOriginAndDirection(Point2d.createZero(), Vector2d.createZero());
    ray2.set(ray0.origin, ray0.direction);
    ck.testPoint2d(ray0.origin, ray2.origin, "Ray2d.set sets expected origin");
    ck.testVector2d(ray0.direction, ray2.direction, "Ray2d.set sets expected direction");
    // cover optional result args
    const checkResultArgIsUsed = (functionName: string, resultArg: Ray2d, returnVal: Ray2d, expectedOrigin: Point2d, expectedDirection: Vector2d) => {
      ck.testPoint2d(expectedOrigin, resultArg.origin, `Ray2d.${functionName} sets expected origin`);
      ck.testVector2d(expectedDirection, resultArg.direction, `Ray2d.${functionName} sets expected direction`);
      ck.testTrue(returnVal.origin === resultArg.origin, `Ray2d.${functionName} uses result.origin`);
      ck.testTrue(returnVal.direction === resultArg.direction, `Ray2d.${functionName} uses result.direction`);
    };
    let ray3 = Ray2d.createOriginAndTarget(ray0.origin, pointA, ray1);
    checkResultArgIsUsed("createOriginAndTarget", ray1, ray3, ray0.origin, Vector2d.createStartEnd(ray0.origin, pointA));
    ray3 = Ray2d.createOriginAndDirection(pointA, ray0.direction, ray1);
    checkResultArgIsUsed("createOriginAndDirection", ray1, ray3, pointA, ray0.direction);
    const pt = Point2d.create(7, 11);
    const vec = Vector2d.create(4, -5);
    ray3 = Ray2d.createOriginAndDirectionCapture(pt, vec, ray1);
    ck.testTrue(pt === ray3.origin, "Ray2d.createOriginAndDirectionCapture captures origin");
    ck.testTrue(vec === ray3.direction, "Ray2d.createOriginAndDirectionCapture captures direction");
    checkResultArgIsUsed("createOriginAndDirectionCapture", ray1, ray3, pt, vec);
    ray3 = ray0.parallelRay(1.0, ray1);
    checkResultArgIsUsed("parallelRay", ray1, ray3, Point2d.create(-2, 4), ray0.direction);
    ray3 = ray0.ccwPerpendicularRay(ray1);
    checkResultArgIsUsed("ccwPerpendicularRay", ray1, ray3, ray0.origin, Vector2d.create(-4, 1));
    ray3 = ray0.cwPerpendicularRay(ray1);
    checkResultArgIsUsed("cwPerpendicularRay", ray1, ray3, ray0.origin, Vector2d.create(4, -1));
    ck.checkpoint("Ray2d");
    expect(ck.getNumErrors()).equals(0);
  });

  it("ConvexPolygon2dEmptyCases", () => {
    const ck = new Checker();
    const sawPoints = [];
    const highRay = Ray2d.createOriginAndDirection(Point2d.create(0, 2), Vector2d.create(1, 0));
    for (let k = 0; k < 3; k++) {
      sawPoints.push(Point2d.create(2 * k, 0));
      sawPoints.push(Point2d.create(2 * k + 1, 1));
      const hull1 = ConvexPolygon2d.createHullIsValidCheck(sawPoints);
      ck.testDefined(hull1);
      // first pass has insufficient points.
      // all later ones are zig-zag
      ck.testFalse(ConvexPolygon2d.isValidConvexHull(sawPoints));
      const rayRange = hull1.clipRay(highRay);
      ck.testTrue(rayRange.isNull);
    }
    expect(ck.getNumErrors()).equals(0);
  });
});
