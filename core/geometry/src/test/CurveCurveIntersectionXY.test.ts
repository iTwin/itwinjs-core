/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { Point3d, Vector3d, Point2d } from "../geometry3d/PointVector";
import { CurveCurve, CurveLocationDetailArrayPair } from "../curve/CurveCurveIntersectXY";
import { LineString3d } from "../curve/LineString3d";
import { LineSegment3d } from "../curve/LineSegment3d";
import { Checker } from "./Checker";
import { expect } from "chai";
import { Map4d } from "../geometry4d/Map4d";
import { Matrix4d } from "../geometry4d/Matrix4d";
import { Transform } from "../geometry3d/Transform";
import { Arc3d } from "../curve/Arc3d";
import { BSplineCurve3d } from "../bspline/BSplineCurve";
import { GeometryCoreTestIO } from "./GeometryCoreTestIO";
import { GeometryQuery } from "../curve/GeometryQuery";

function createSamplePerspectiveMaps(): Map4d[] {
  const origin = Point3d.create(-20, -20, -1);
  const vectorU = Vector3d.create(100, 0, 0);
  const vectorV = Vector3d.create(0, 100, 0);
  const vectorW = Vector3d.create(0, 0, 40);

  const transform1 = Transform.createOriginAndMatrixColumns(origin, vectorU, vectorV, vectorW);
  const inverse1 = transform1.inverse()!;
  return [
    Map4d.createIdentity(),
    Map4d.createTransform(inverse1, transform1)!,
    Map4d.createVectorFrustum(origin, vectorU, vectorV, vectorW, 0.4)!];
}
/** Create strokes from 2 points towards eye.
 * shift by dx,dy
 * save in allGeometry
 */
function captureEyeStroke(allGeometry: GeometryQuery[], map: Map4d, pointA: Point3d, pointB: Point3d, dzNpc: number, dx: number, dy: number) {
  for (const point0 of [pointA, pointB]) {
    const npcPoint0 = map.transform0.multiplyPoint3d(point0, 1);
    const point1 = map.transform1.multiplyXYZWQuietRenormalize(npcPoint0.x, npcPoint0.y, npcPoint0.z + dzNpc, npcPoint0.w);
    GeometryCoreTestIO.captureGeometry(allGeometry, LineSegment3d.create(point0, point1), dx, dy);
  }
}
/* tslint:disable:no-console */
function testIntersectionsXY(
  ck: Checker,
  worldToLocal: Matrix4d | undefined,
  intersections: CurveLocationDetailArrayPair, minExpected: number, maxExpected: number,
  testCoordinates: boolean = false) {
  if (ck.testExactNumber(intersections.dataA.length, intersections.dataB.length, "intersections A B match")) {
    const n = intersections.dataA.length;
    if (n < minExpected || n > maxExpected) {
      ck.announceError("intersction count out of range", n, minExpected, maxExpected);
      return;
    }
    if (testCoordinates) {
      for (let i = 0; i < n; i++) {
        if (worldToLocal) {
          const pointA = worldToLocal.multiplyPoint3d(intersections.dataA[i].point, 1);
          const pointB = worldToLocal.multiplyPoint3d(intersections.dataB[i].point, 1);
          ck.testCoordinate(0, pointA.realDistanceXY(pointB)!, "projected intersections match");
        } else {
          ck.testPoint3dXY(intersections.dataA[i].point, intersections.dataB[i].point, "CLD coordinate match");
        }
        const fA = intersections.dataA[i].fraction;
        const fB = intersections.dataB[i].fraction;
        const cpA = intersections.dataA[i].curve;
        const cpB = intersections.dataB[i].curve;
        if (ck.testPointer(cpA) && cpA
          && ck.testPointer(cpB) && cpB) {
          ck.testPoint3d(cpA.fractionToPoint(fA), intersections.dataA[i].point);
          ck.testPoint3d(cpB.fractionToPoint(fB), intersections.dataB[i].point);
        }
      }
    }
  }
}

describe("CurveCurve", () => {

  it("LineLineMapped", () => {
    const ck = new Checker();
    for (const map of createSamplePerspectiveMaps()) {
      const worldToLocal = map.transform0;    // that's world to local.  The perspective frustum forced that.  Seems backwards.
      const segment0 = LineSegment3d.createXYXY(1, 2, 4, 2);
      const segment1 = LineSegment3d.createXYXY(4, 1, 2, 3);
      const intersectionsAB = CurveCurve.IntersectionProjectedXY(worldToLocal, segment0, false, segment1, false);
      testIntersectionsXY(ck, worldToLocal, intersectionsAB, 1, 1);

      const intersectionsBA = CurveCurve.IntersectionProjectedXY(worldToLocal, segment1, false, segment0, false);
      testIntersectionsXY(ck, worldToLocal, intersectionsBA, 1, 1);

    }
    ck.checkpoint("CurveCurve.LineLine");
    expect(ck.getNumErrors()).equals(0);
  });

  it("LineArcMapped", () => {
    const ck = new Checker();
    for (const map of createSamplePerspectiveMaps()) {
      for (const dz of [0, 0.3]) {
        const worldToLocal = map.transform0;    // that's world to local.  The perspective frustum forced that.  Seems backwards.
        const arc1 = Arc3d.create(Point3d.create(3, 1, 1), Vector3d.create(5, 1, 1), Vector3d.create(-1, 7, 2));
        const f0 = 0.0;
        const f1 = 0.25;
        const pointA = arc1.fractionToPoint(f0);
        const pointB = arc1.fractionToPoint(f1);
        pointA.z += dz;
        pointB.z += 0.1 * dz;
        const segment0 = LineSegment3d.create(pointA, pointB);
        const intersectionsAB = CurveCurve.IntersectionProjectedXY(worldToLocal, segment0, true, arc1, true);
        testIntersectionsXY(ck, worldToLocal, intersectionsAB, 2, 2);

        const intersectionsBA = CurveCurve.IntersectionProjectedXY(worldToLocal, arc1, true, segment0, true);
        testIntersectionsXY(ck, worldToLocal, intersectionsBA, 2, 2);

      }
    }
    ck.checkpoint("CurveCurve.LineLine");
    expect(ck.getNumErrors()).equals(0);
  });

  it("LineLineString", () => {
    const ck = new Checker();
    for (const map of createSamplePerspectiveMaps()) {
      const worldToLocal = map.transform0;    // that's world to local.  The perspective frustum forced that.  Seems backwards.

      const segment0 = LineSegment3d.createXYXY(1, 2, 4, 2);
      const linestring0 = LineString3d.create(Point3d.create(1, 1), Point3d.create(3, 0), Point3d.create(3, 5));
      const linestring1 = LineString3d.create(Point3d.create(2, 4, 2), Point3d.create(4, 1, 0), Point3d.create(2, 5, 0));

      const intersections = CurveCurve.IntersectionProjectedXY(worldToLocal, segment0, false, linestring0, false);
      testIntersectionsXY(ck, worldToLocal, intersections, 1, 1);
      const intersections1 = CurveCurve.IntersectionProjectedXY(worldToLocal, linestring0, false, segment0, false);
      testIntersectionsXY(ck, worldToLocal, intersections1, 1, 1);

      const intersections2 = CurveCurve.IntersectionProjectedXY(worldToLocal, linestring0, false, linestring1, false);
      testIntersectionsXY(ck, worldToLocal, intersections2, 2, 2);

      const intersections2r = CurveCurve.IntersectionProjectedXY(worldToLocal, linestring1, false, linestring0, false);
      testIntersectionsXY(ck, worldToLocal, intersections2r, 2, 2);

      const intersectionsX = CurveCurve.IntersectionProjectedXY(worldToLocal, segment0, true, linestring0, true);
      testIntersectionsXY(ck, worldToLocal, intersectionsX, 2, 2);
    }
    expect(ck.getNumErrors()).equals(0);
  });

  it("ArcArc", () => {
    const ck = new Checker();
    for (const map of createSamplePerspectiveMaps()) {
      const worldToLocal = map.transform0;    // that's world to local.  The perspective frustum forced that.  Seems backwards.
      const arcA = Arc3d.create(Point3d.create(1, 2, 0), Vector3d.create(4, 0, 0), Vector3d.create(0, 1, 0));
      const arcB = Arc3d.create(Point3d.create(0, 1, 1), Vector3d.create(2, 0, 0), Vector3d.create(0, 4, 0));
      const intersectionsAB = CurveCurve.IntersectionProjectedXY(worldToLocal, arcA, true, arcB, true);
      testIntersectionsXY(ck, worldToLocal, intersectionsAB, 4, 4);

      const intersectionsBA = CurveCurve.IntersectionProjectedXY(worldToLocal, arcB, true, arcA, true);
      testIntersectionsXY(ck, worldToLocal, intersectionsBA, 4, 4);

    }
    ck.checkpoint("CurveCurve.LineLine");
    expect(ck.getNumErrors()).equals(0);
  });

  it("LineBsplineMapped", () => {
    const ck = new Checker();
    for (const map of createSamplePerspectiveMaps()) {
      const worldToLocal = map.transform0;    // that's world to local.  The perspective frustum forced that.  Seems backwards.
      const segment0 = LineSegment3d.createXYXY(0, 0, 4, 2);
      const bspline1 = BSplineCurve3d.createUniformKnots(
        [Point3d.create(1, 2, 0), Point3d.create(1, 1, 0), Point3d.create(1, 0, 0), Point3d.create(0, -1, 0), Point3d.create(0, -2, 0)], 3)!;

      const intersectionsAB = CurveCurve.IntersectionProjectedXY(worldToLocal, segment0, false, bspline1, false);
      testIntersectionsXY(ck, worldToLocal, intersectionsAB, 1, 1);

      const intersectionsBA = CurveCurve.IntersectionProjectedXY(worldToLocal, bspline1, false, segment0, false);
      testIntersectionsXY(ck, worldToLocal, intersectionsBA, 1, 1);

    }
    ck.checkpoint("CurveCurve.LineBsplineMapped");
    expect(ck.getNumErrors()).equals(0);
  });

  it("LineStringBsplineMapped", () => {
    const ck = new Checker();
    for (const map of createSamplePerspectiveMaps()) {
      const worldToLocal = map.transform0;    // that's world to local.  The perspective frustum forced that.  Seems backwards.
      const g0 = LineString3d.create(
        Point3d.create(0, 0, 0), Point3d.create(4, 2, 0), Point3d.create(5, 1, 0), Point3d.create(0, -1, 0));

      const bspline1 = BSplineCurve3d.createUniformKnots(
        [Point3d.create(1, 2, 0), Point3d.create(1, 1, 0), Point3d.create(1, 0, 0), Point3d.create(0, -1, 0), Point3d.create(0, -2, 0)], 3)!;

      const intersectionsAB = CurveCurve.IntersectionProjectedXY(worldToLocal, g0, false, bspline1, false);
      testIntersectionsXY(ck, worldToLocal, intersectionsAB, 2, 2);

      const intersectionsBA = CurveCurve.IntersectionProjectedXY(worldToLocal, bspline1, false, g0, false);
      testIntersectionsXY(ck, worldToLocal, intersectionsBA, 2, 2);

    }
    ck.checkpoint("CurveCurve.LineStringBsplineMapped");
    expect(ck.getNumErrors()).equals(0);
  });

  it("ArcBsplineMapped", () => {
    const ck = new Checker();
    for (const map of createSamplePerspectiveMaps()) {
      const worldToLocal = map.transform0;    // that's world to local.  The perspective frustum forced that.  Seems backwards.
      const z = 0.1;    // raise the arc a little so various view directions produce different intersections.
      const g0 = Arc3d.create(Point3d.create(0, 0, z), Vector3d.create(2, 0, 0), Vector3d.create(0, 2, 1));

      for (const order of [2, 3, 4]) {
        const bspline1 = BSplineCurve3d.createUniformKnots(
          [Point3d.create(-1, 1, 0), Point3d.create(0, 1, 0), Point3d.create(2, 2, 0), Point3d.create(3, 3, 0), Point3d.create(4, 3, 0)], order)!;

        const intersectionsAB = CurveCurve.IntersectionProjectedXY(worldToLocal, g0, false, bspline1, false);
        testIntersectionsXY(ck, worldToLocal, intersectionsAB, 1, 1);

        const intersectionsBA = CurveCurve.IntersectionProjectedXY(worldToLocal, bspline1, false, g0, false);
        testIntersectionsXY(ck, worldToLocal, intersectionsBA, 1, 1);
      }

    }
    ck.checkpoint("CurveCurve.LineStringBsplineMapped");
    expect(ck.getNumErrors()).equals(0);
  });

  it("BsplineBsplineMapped", () => {
    const ck = new Checker();
    let dx = 0.0;
    let dy = 0.0;
    let dyOuter = 0.0;

    const rA = 0.03;
    const rB = 0.05;
    const allGeometry: GeometryQuery[] = [];
    for (const map of createSamplePerspectiveMaps()) {
      const worldToLocal = map.transform0;    // that's world to local.  The perspective frustum forced that.  Seems backwards.
      dx = 0.0;
      for (const order0 of [2, 3, 4]) {
        const z0 = 0.3;    // raise the arc a little so various view directions produce different intersections.
        // bspline0 sweeps from high on y axis to low in 4 quadrant
        const bspline0 = BSplineCurve3d.createUniformKnots(
          [Point3d.create(0, 5, z0),
          Point3d.create(0, 2, z0),
          Point3d.create(4, -1, z0),
          Point3d.create(4, -4, z0)],
          order0)!;
        dy = dyOuter;
        for (const order1 of [2, 3, 4, 5]) {
          const bspline1 = BSplineCurve3d.createUniformKnots(
            [Point3d.create(-1, 2, 0),
            Point3d.create(0, 1, 0),
            Point3d.create(2, 2, 0),
            Point3d.create(3, 4, 0),
            Point3d.create(4, 4, 0),
            Point3d.create(6, 5, 0)],
            order1)!;
          GeometryCoreTestIO.captureGeometry(allGeometry, bspline0.clone(), dx, dy);

          // Inner loop moves bspline1 around to have specific intersections.
          // bspline1 and the computed intersections are drawn at each placement.
          for (const fraction0fraction1 of [
            Point2d.create(0.1, 0.45),
            Point2d.create(0.35, 0.521),
            Point2d.create(0.5, 0.672),
            Point2d.create(0.82, 0.1)]) {
            const fraction0 = fraction0fraction1.x;
            const fraction1 = fraction0fraction1.y;
            const point0 = bspline0.fractionToPoint(fraction0);
            const point1 = bspline1.fractionToPoint(fraction1);
            bspline1.tryTranslateInPlace(point0.x - point1.x, point0.y - point1.y);
            GeometryCoreTestIO.captureGeometry(allGeometry, bspline1.clone(), dx, dy);
            const intersectionsAB = CurveCurve.IntersectionProjectedXY(worldToLocal, bspline0, false, bspline1, false);
            testIntersectionsXY(ck, worldToLocal, intersectionsAB, 1, 1);
            for (let i = 0; i < intersectionsAB.dataA.length; i++) {
              GeometryCoreTestIO.captureGeometry(allGeometry, Arc3d.createXY(intersectionsAB.dataA[i].point, rA), dx, dy);
              GeometryCoreTestIO.captureGeometry(allGeometry, Arc3d.createXY(intersectionsAB.dataB[i].point, rB), dx, dy);
              captureEyeStroke(allGeometry, map, intersectionsAB.dataA[i].point, intersectionsAB.dataB[i].point, 2.0 * z0, dx, dy);
            }

            /* Reverse order test -- but skip it.  The loop does reversed order combinations.
                    const rA1 = 0.07;
                    const rB1 = 0.09;
                         const intersectionsBA = CurveCurve.IntersectionProjectedXY(worldToLocal, bspline1, false, bspline0, false);
                        testIntersectionsXY(ck, worldToLocal, intersectionsBA, 1, 1);
                        for (let i = 0; i < intersectionsBA.dataA.length; i++) {
                          GeometryCoreTestIO.captureGeometry(allGeometry, Arc3d.createXY(intersectionsBA.dataA[i].point, rA1), dx, dy);
                          GeometryCoreTestIO.captureGeometry(allGeometry, Arc3d.createXY(intersectionsBA.dataB[i].point, rB1), dx, dy);
                          captureEyeStroke(allGeometry, map, intersectionsBA.dataA[i].point, intersectionsBA.dataB[i].point, z, dx, dy);
                        }
            */
          }
          dy += 15;
        }
        dx += 30.0;
      }
      dyOuter += 100.0;
    }
    ck.checkpoint("CurveCurve.LineStringBsplineMapped");
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveIntersection", "BSplineBSpline");
    expect(ck.getNumErrors()).equals(0);
  });

});
