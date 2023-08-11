/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { Arc3d } from "../../curve/Arc3d";
import { CurveCurve } from "../../curve/CurveCurve";
import { GeometryQuery } from "../../curve/GeometryQuery";
import { LineSegment3d } from "../../curve/LineSegment3d";
import { Point3d } from "../../geometry3d/Point3dVector3d";
import { Checker } from "../Checker";
import { GeometryCoreTestIO } from "../GeometryCoreTestIO";
import { CurvePrimitive } from "../../curve/CurvePrimitive";
import { LineString3d } from "../../curve/LineString3d";
import { BSplineCurve3d } from "../../bspline/BSplineCurve";
import { Path } from "../../curve/Path";
import { Loop } from "../../curve/Loop";
import { AnyCurve } from "../../core-geometry";

/**
 * Create line segments joining various fractional positions on two arcs.
 * Compute close approach for each.
 * @param _ck
 * @param allGeometry
 * @param geometryA
 */
function testVaryingLineSegments(
  _ck: Checker, allGeometry: GeometryQuery[], geometryA: AnyCurve,
  geometryAStart: Point3d, geometryAMid: Point3d, geometryAEnd: Point3d,
) {
  const path0 = Arc3d.createXY(geometryAMid, 4)!;
  const path1 = Arc3d.createCircularStartMiddleEnd(Point3d.create(0, 9), Point3d.create(6, 3), Point3d.create(3, -3))!;
  const fractions = [0.0, 0.1, 0.2, 0.3, 0.4, 0.6, 0.8, 0.9, 1.0];
  let x0 = 0;
  const maxDistance = 5;
  for (const f0 of fractions) {
    let y0 = 0;
    for (const f1 of fractions) {
      const lineB = LineSegment3d.create(path0.fractionToPoint(f0), path1.fractionToPoint(f1));
      const approaches = CurveCurve.closeApproachProjectedXYPairs(geometryA, lineB, maxDistance);
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryA, x0, y0);
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, lineB, x0, y0);
      if (approaches.length > 0) {
        for (const ap of approaches) {
          const start = ap.detailA.point;
          const end = ap.detailB.point;
          if (start.isAlmostEqual(end)) // intersection between geometries
            GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, start, 0.0625, x0, y0);
          else { // closest approach between geometries
            const approachSegment = LineSegment3d.create(start, end);
            const len = start.distanceSquaredXY(end);
            _ck.testLE(len, maxDistance * maxDistance, "approach length must be smaller than maxDistance");
            GeometryCoreTestIO.captureGeometry(allGeometry, approachSegment, x0, y0);
          }
        }
      } else {
        const circleA0 = Arc3d.createXY(geometryAStart, maxDistance);
        const circleA1 = Arc3d.createXY(geometryAEnd, maxDistance);
        const circleB0 = Arc3d.createXY(lineB.startPoint(), maxDistance);
        const circleB1 = Arc3d.createXY(lineB.endPoint(), maxDistance);
        // no intersection and no closest approach between geometries
        if (!(geometryA instanceof Arc3d)) { // due to the "NO NO NO" bug in testAndRecordProjection
          _ck.testCoordinate(
            0, CurveCurve.intersectionXYPairs(circleA0, false, lineB, false).length, "expect no intersection",
          );
          _ck.testCoordinate(
            0, CurveCurve.intersectionXYPairs(circleA1, false, lineB, false).length, "expect no intersection",
          );
          _ck.testCoordinate(
            0, CurveCurve.intersectionXYPairs(circleB0, false, geometryA, false).length, "expect no intersection",
          );
          _ck.testCoordinate(
            0, CurveCurve.intersectionXYPairs(circleB1, false, geometryA, false).length, "expect no intersection",
          );
        }
        GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, geometryAStart, maxDistance, x0, y0);
        GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, geometryAEnd, maxDistance, x0, y0);
        GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, lineB.startPoint(), maxDistance, x0, y0);
        GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, lineB.endPoint(), maxDistance, x0, y0);
      }
      y0 += 20;
    }
    x0 += 20;
  }
}

/**
 * Create partial curves in various fractional intervals of geometryB.
 * Compute close approach for each.
 * @param _ck
 * @param allGeometry
 * @param geometryA
 */
function testVaryingSubsets(
  _ck: Checker, allGeometry: GeometryQuery[],
  geometryA: CurvePrimitive,
  geometryB: CurvePrimitive,
  maxDistance: number = 0.25,
  fractions: number[] = [1.0, 0.9, 0.0, 0.2, 0.3, 0.4, 0.6, 0.8],
) {
  let x0 = 0;
  GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, Point3d.create(x0, 0), maxDistance, x0, 0);
  for (const f0 of fractions) {
    let y0 = 0;
    for (const f1 of fractions) {
      if (f0 !== f1) {
        let partialB: CurvePrimitive | undefined;
        if (f0 === 0 && f1 === 1) {
          partialB = geometryB.clone();
        } else {
          partialB = geometryB.clonePartialCurve(f0, f1);
        }
        if (!partialB)
          continue;
        const approaches = CurveCurve.closeApproachProjectedXYPairs(geometryA, partialB, maxDistance);
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryA, x0, y0);
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, partialB, x0, y0);
        if (approaches.length > 0) {
          for (const p of approaches)
            if (p.detailA.point.isAlmostEqual(p.detailB.point))
              GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, p.detailA.point, maxDistance / 5, x0, y0);
            else
              GeometryCoreTestIO.captureGeometry(allGeometry, LineSegment3d.create(p.detailA.point, p.detailB.point), x0, y0);
        } else {
          GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, geometryA.startPoint(), maxDistance, x0, y0);
          GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, geometryA.endPoint(), maxDistance, x0, y0);
          GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, partialB.startPoint(), maxDistance, x0, y0);
          GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, partialB.endPoint(), maxDistance, x0, y0);
        }
      }
      y0 += 20;
    }
    x0 += 20;
  }
}

describe("CurveCurveCloseApproachXY", () => {

  it("LineLine", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const geometryA = LineSegment3d.createXYXY(1, 2, 5, 2);
    testVaryingLineSegments(
      ck, allGeometry, geometryA, geometryA.startPoint(), geometryA.fractionToPoint(0.5), geometryA.endPoint(),
    );
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveCloseApproachXY", "LineLine");
    expect(ck.getNumErrors()).equals(0);
  });

  it("SingleLineLine", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const maxDistance = 5;
    const geometryA = LineSegment3d.createXYZXYZ(1, 2, 1, 6, 5, 2);
    const geometryB = LineSegment3d.createXYZXYZ(6, 2, -1, 1, 7, -2);
    const approaches = CurveCurve.closeApproachProjectedXYPairs(geometryA, geometryB, maxDistance);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryA);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryB);
    const start = approaches.at(0)!.detailA.point;
    const end = approaches.at(0)!.detailB.point;
    const approachSegment = LineSegment3d.create(start, end);
    const len = start.distanceSquaredXY(end);
    const expectedLen = 0;
    ck.testLE(len, maxDistance * maxDistance, "approach length must be smaller than maxDistance");
    ck.testCoordinate(len, expectedLen);
    GeometryCoreTestIO.captureGeometry(allGeometry, approachSegment);
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveCloseApproachXY", "SingleLineLine");
    expect(ck.getNumErrors()).equals(0);
  });

  it("LineLineString", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const geometryA = LineString3d.create([[1, 2], [3, 4], [4, 3]]);
    testVaryingLineSegments(
      ck, allGeometry, geometryA, geometryA.startPoint(), geometryA.fractionToPoint(0.5), geometryA.endPoint(),
    );
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveCloseApproachXY", "LineLineString");
    expect(ck.getNumErrors()).equals(0);
  });

  it("SingleLineLineString", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const maxDistance = 10;
    const geometryA = LineSegment3d.createXYZXYZ(4, 4, 3, 7, 3, 5);
    const geometryB = LineString3d.create([[1, 0, 1], [2, 3, 1], [3, 0, 1], [4, 2, 1], [5, 0, 1], [6, 3, -2], [7, 0, 1]]);
    const approaches = CurveCurve.closeApproachProjectedXYPairs(geometryA, geometryB, maxDistance);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryA);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryB);
    ck.testLE(0, approaches.length);
    if (approaches.length > 0) {
      for (const ap of approaches)
        if (ap.detailA.point.isAlmostEqual(ap.detailB.point)) // intersection between geometries
          GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, ap.detailA.point, 0.0625);
        else { // closest approach between geometries
          const approachSegment = LineSegment3d.create(ap.detailA.point, ap.detailB.point);
          const len = approachSegment.curveLength();
          ck.testLE(len, maxDistance);
          GeometryCoreTestIO.captureGeometry(allGeometry, approachSegment);
        }
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveCloseApproachXY", "SingleLineLineString");
    expect(ck.getNumErrors()).equals(0);
  });

  it("LineArc", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const geometryA = Arc3d.createCircularStartMiddleEnd(
      Point3d.create(1, 2), Point3d.create(3, 3.5), Point3d.create(5, 2),
    )!;
    testVaryingLineSegments(
      ck, allGeometry, geometryA, geometryA.startPoint(), geometryA.fractionToPoint(0.5), geometryA.endPoint(),
    );
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveCloseApproachXY", "LineArc");
    expect(ck.getNumErrors()).equals(0);
  });

  it("LinePath", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const arc = Arc3d.createCircularStartMiddleEnd(Point3d.create(1, 2), Point3d.create(3, 3.5), Point3d.create(5, 2))!;
    const lineString = LineString3d.create([[5, 2], [6, 0], [7, 2]]);
    const lineSegment = LineSegment3d.create(Point3d.create(7, 2), Point3d.create(10, 0));
    const geometryA = Path.create();
    geometryA.tryAddChild(arc);
    geometryA.tryAddChild(lineString);
    geometryA.tryAddChild(lineSegment);
    testVaryingLineSegments(
      ck, allGeometry, geometryA, Point3d.create(1, 2), Point3d.create(5, 2), Point3d.create(10, 0),
    );
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveCloseApproachXY", "LinePath");
    expect(ck.getNumErrors()).equals(0);
  });

  it("LineLoop", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const arc = Arc3d.createCircularStartMiddleEnd(Point3d.create(1, 2), Point3d.create(3, 3.5), Point3d.create(5, 2))!;
    const lineString = LineString3d.create([[5, 2], [6, 0], [7, 2]]);
    const lineSegment1 = LineSegment3d.create(Point3d.create(7, 2), Point3d.create(10, 0));
    const lineSegment2 = LineSegment3d.create(Point3d.create(10, 0), Point3d.create(1, 2));
    const geometryA = Loop.create();
    geometryA.tryAddChild(arc);
    geometryA.tryAddChild(lineString);
    geometryA.tryAddChild(lineSegment1);
    geometryA.tryAddChild(lineSegment2);
    testVaryingLineSegments(
      ck, allGeometry, geometryA, Point3d.create(1, 2), Point3d.create(5, 2), Point3d.create(10, 0),
    );
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveCloseApproachXY", "LineLoop");
    expect(ck.getNumErrors()).equals(0);
  });

  it("ArcArc", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const arcA = Arc3d.createCircularStartMiddleEnd(Point3d.create(1, 2), Point3d.create(3, 3.5), Point3d.create(5, 2))!;
    const arcB = Arc3d.createCircularStartMiddleEnd(Point3d.create(3, 2), Point3d.create(-1, 1.5), Point3d.create(0, -2))!;
    testVaryingSubsets(ck, allGeometry, arcA, arcB);
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveCloseApproachXY", "ArcArc");
    expect(ck.getNumErrors()).equals(0);
  });

  it("ArcArcFar", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const arcA = Arc3d.createXY(Point3d.create(1, 1), 1.5);
    const arcB = Arc3d.createXY(Point3d.create(5, 2), 2);
    testVaryingSubsets(ck, allGeometry, arcA, arcB);
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveCloseApproachXY", "ArcArcFar");
    expect(ck.getNumErrors()).equals(0);
  });

  it("ArcArcInside", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const arcA = Arc3d.createXY(Point3d.create(1, 1), 5);
    const arcB = Arc3d.createXY(Point3d.create(2, 3), 2);
    testVaryingSubsets(ck, allGeometry, arcA, arcB);
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveCloseApproachXY", "ArcArcInside");
    expect(ck.getNumErrors()).equals(0);
  });

  it("LineStringLineString", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const cpA = LineString3d.create([[1, 2], [5, 2], [3, 5]]);
    const cpB = LineString3d.create([[1, 3], [4, 2.5], [6, 4]]);
    testVaryingSubsets(ck, allGeometry, cpA, cpB);
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveCloseApproachXY", "LineStringLineString");
    expect(ck.getNumErrors()).equals(0);
  });

  it("LineStringLineStringLong", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const cpA = LineString3d.create();
    const cpB = LineString3d.create();
    for (let x = 0; x <= 10; x += 1) {
      const f = x / 10;
      cpA.addPointXYZ(x, 0, 0);
      cpA.addPointXYZ(x + 0.5, 0.5, 0);
      cpB.addPointXYZ(x + 0.125, 1, 0);
      cpB.addPointXYZ(x + 0.6, 0.8 - f * f * 0.4, 0);
    }
    testVaryingSubsets(ck, allGeometry, cpA, cpB, 0.6);
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveCloseApproachXY", "LineStringLineStringLong06");
    allGeometry.length = 0;
    testVaryingSubsets(ck, allGeometry, cpA, cpB, 0.3);
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveCloseApproachXY", "LineStringLineStringLong03");
    expect(ck.getNumErrors()).equals(0);
  });

  it("ArcLineString", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const cpA = Arc3d.createCircularStartMiddleEnd(Point3d.create(1, 2), Point3d.create(3, 3.5), Point3d.create(5, 2))!;
    const cpB = LineString3d.create([[1, 3], [4, 2.5], [6, 4]]);
    testVaryingSubsets(ck, allGeometry, cpA, cpB);
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveCloseApproachXY", "ArcLineString");
    expect(ck.getNumErrors()).equals(0);
  });

  it("BsplineLineString", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const cpA = BSplineCurve3d.createUniformKnots([Point3d.create(0, 0, 0), Point3d.create(1, 0.5, 0), Point3d.create(2, 0, 0), Point3d.create(3, 2, 0), Point3d.create(4, 0, 0)], 4)!;
    const cpB = LineString3d.create([[1, 3], [4, 2.5], [6, 3]]);
    testVaryingSubsets(ck, allGeometry, cpA, cpB, 1, [0, 1]);
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveCloseApproachXY", "BsplineLineString1");
    allGeometry.length = 0;
    testVaryingSubsets(ck, allGeometry, cpA, cpB, 2, [0, 1]);
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveCloseApproachXY", "BsplineLineString2");
    expect(ck.getNumErrors()).equals(0);
  });

  it("BsplineArc", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const cpA = BSplineCurve3d.createUniformKnots([Point3d.create(0, 3, 0), Point3d.create(1, 0.5, 0), Point3d.create(2, 0, 0), Point3d.create(5, 2, 0), Point3d.create(6, 4, 0)], 4)!;
    const cpB = Arc3d.createCircularStartMiddleEnd(Point3d.create(1, 3), Point3d.create(4, 2.5), Point3d.create(6, 2))!;
    testVaryingSubsets(ck, allGeometry, cpA, cpB, 2, [0, 1]);
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveCloseApproachXY", "BsplineArc");

    allGeometry.length = 0;
    const cpB1 = Arc3d.createCircularStartMiddleEnd(Point3d.create(1, -1), Point3d.create(4, 0), Point3d.create(6, -1))!;
    testVaryingSubsets(ck, allGeometry, cpA, cpB1, 2, [0, 1]);
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveCloseApproachXY", "BsplineArcB");

    allGeometry.length = 0;
    testVaryingSubsets(ck, allGeometry, cpB, cpA, 2, [0, 1]);
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveCloseApproachXY", "ArcBspline");

    allGeometry.length = 0;
    const cpB2 = LineSegment3d.create(Point3d.create(1, -1), Point3d.create(6, -1));
    testVaryingSubsets(ck, allGeometry, cpA, cpB2, 2, [0, 1]);
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveCloseApproachXY", "BsplineLine");

    expect(ck.getNumErrors()).equals(0);
  });

});
