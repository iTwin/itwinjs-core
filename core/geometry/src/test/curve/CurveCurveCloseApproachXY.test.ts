/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { BSplineCurve3d } from "../../bspline/BSplineCurve";
import { Arc3d } from "../../curve/Arc3d";
import { BagOfCurves } from "../../curve/CurveCollection";
import { CurveCurve } from "../../curve/CurveCurve";
import { CurvePrimitive } from "../../curve/CurvePrimitive";
import { AnyCurve } from "../../curve/CurveTypes";
import { GeometryQuery } from "../../curve/GeometryQuery";
import { LineSegment3d } from "../../curve/LineSegment3d";
import { LineString3d } from "../../curve/LineString3d";
import { Loop } from "../../curve/Loop";
import { ParityRegion } from "../../curve/ParityRegion";
import { Path } from "../../curve/Path";
import { UnionRegion } from "../../curve/UnionRegion";
import { AngleSweep } from "../../geometry3d/AngleSweep";
import { Point3d, Vector3d } from "../../geometry3d/Point3dVector3d";
import { Checker } from "../Checker";
import { GeometryCoreTestIO } from "../GeometryCoreTestIO";

/** Create line segments joining various fractional positions on two arcs. Compute close approach for each. */
function testVaryingLineSegments(
  _ck: Checker,
  allGeometry: GeometryQuery[],
  geometryA: AnyCurve,
  geometryAStart: Point3d,
  geometryAMid: Point3d,
  geometryAEnd: Point3d,
) {
  const arc0 = Arc3d.createXY(geometryAMid, 4)!;
  const arc1 = Arc3d.createCircularStartMiddleEnd(Point3d.create(0, 9), Point3d.create(6, 3), Point3d.create(3, -3))!;
  const fractions = [0.0, 0.1, 0.2, 0.3, 0.4, 0.6, 0.8, 0.9, 1.0];
  let x0 = 0;
  const maxDistance = 5;
  for (const f0 of fractions) {
    let y0 = 0;
    for (const f1 of fractions) {
      const lineB = LineSegment3d.create(arc0.fractionToPoint(f0), arc1.fractionToPoint(f1));
      const approaches = CurveCurve.closeApproachProjectedXYPairs(lineB, geometryA, maxDistance);
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
            const lenSqr = start.distanceSquaredXY(end);
            _ck.testLE(
              Math.sqrt(lenSqr), maxDistance, undefined, "approach length must be smaller than maxDistance",
            );
            GeometryCoreTestIO.captureGeometry(allGeometry, approachSegment, x0, y0);
          }
        }
      } else {  // no intersection and no closest approach between geometries
        const circleA0 = Arc3d.createXY(geometryAStart, maxDistance);
        const circleA1 = Arc3d.createXY(geometryAEnd, maxDistance);
        const circleB0 = Arc3d.createXY(lineB.startPoint(), maxDistance);
        const circleB1 = Arc3d.createXY(lineB.endPoint(), maxDistance);
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

/** Create partial curves in various fractional intervals of geometryB. Compute close approach for each. */
function testVaryingSubsets(
  _ck: Checker,
  allGeometry: GeometryQuery[],
  geometryA: CurvePrimitive,
  geometryB: CurvePrimitive,
  maxDistance: number = 0.5,
  fractions: number[] = [1.0, 0.9, 0.0, 0.2, 0.3, 0.4, 0.6, 0.8],
) {
  let x0 = 0;
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
            if (p.detailA.point.isAlmostEqual(p.detailB.point)) // intersection between geometries
              GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, p.detailA.point, 0.0625, x0, y0);
            else // closest approach between geometries
              GeometryCoreTestIO.captureGeometry(
                allGeometry, LineSegment3d.create(p.detailA.point, p.detailB.point), x0, y0,
              );
        } else {
          const circleA0 = Arc3d.createXY(geometryA.startPoint(), maxDistance);
          const circleA1 = Arc3d.createXY(geometryA.endPoint(), maxDistance);
          const circleB0 = Arc3d.createXY(partialB.startPoint(), maxDistance);
          const circleB1 = Arc3d.createXY(partialB.endPoint(), maxDistance);
          _ck.testCoordinate(
            0, CurveCurve.intersectionXYPairs(circleA0, false, partialB, false).length, "expect no intersection",
          );
          _ck.testCoordinate(
            0, CurveCurve.intersectionXYPairs(circleA1, false, partialB, false).length, "expect no intersection",
          );
          _ck.testCoordinate(
            0, CurveCurve.intersectionXYPairs(circleB0, false, geometryA, false).length, "expect no intersection",
          );
          _ck.testCoordinate(
            0, CurveCurve.intersectionXYPairs(circleB1, false, geometryA, false).length, "expect no intersection",
          );
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
  it("SingleLineLine1", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const maxDistance = 2;
    const geometryA = LineSegment3d.createXYZXYZ(1, 2, 1, 6, 5, 2);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryA);
    const geometryB = LineSegment3d.createXYZXYZ(6, 2, -1, 1, 7, -2);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryB);
    const approaches = CurveCurve.closeApproachProjectedXYPairs(geometryA, geometryB, maxDistance);
    ck.testExactNumber(approaches.length, 1);
    const start = approaches.at(0)!.detailA.point;
    const end = approaches.at(0)!.detailB.point;
    const approachSegment = LineSegment3d.create(start, end);
    const lenSqr = start.distanceSquaredXY(end);
    const expectedLenSqr = 0;
    ck.testLE(
      Math.sqrt(lenSqr), maxDistance, undefined, "approach length must be smaller than maxDistance",
    );
    ck.testCoordinate(lenSqr, expectedLenSqr);
    GeometryCoreTestIO.captureGeometry(allGeometry, approachSegment);
    // test the convenience method
    const closestApproach = CurveCurve.closestApproachProjectedXYPair(geometryA, geometryB);
    ck.testDefined(closestApproach);
    const minLenSqr = closestApproach!.detailA.point.distanceSquaredXY(closestApproach!.detailB.point);
    const expectedMinLenSqr = 0;
    ck.testLE(
      Math.sqrt(minLenSqr), maxDistance, undefined, "closest approach length must be smaller than maxDistance",
    );
    ck.testCoordinate(minLenSqr, expectedMinLenSqr);
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveCloseApproachXY", "SingleLineLine1");
    expect(ck.getNumErrors()).equals(0);
  });
  it("SingleLineLine2", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const maxDistance = 2;
    const geometryA = LineSegment3d.createXYXY(1, 2, 5, 2);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryA);
    const geometryB = LineSegment3d.createXYXY(6, 2, 1, 7);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryB);
    const approaches = CurveCurve.closeApproachProjectedXYPairs(geometryA, geometryB, maxDistance);
    const start = approaches.at(0)!.detailA.point;
    const end = approaches.at(0)!.detailB.point;
    const approachSegment = LineSegment3d.create(start, end);
    const lenSqr = start.distanceSquaredXY(end);
    const expectedLenSqr = 0.5; // (sqrt(2)/2)*(sqrt(2)/2)
    ck.testLE(
      Math.sqrt(lenSqr), maxDistance, undefined, "approach length must be smaller than maxDistance",
    );
    ck.testCoordinate(lenSqr, expectedLenSqr, "closest approach has expected length");
    ck.testCoordinate(approaches[0].detailA.fraction, 1.0, "closest approach has expected fraction on curveA");
    ck.testCoordinate(approaches[0].detailB.fraction, 0.1, "closest approach has expected fraction on curveB");
    GeometryCoreTestIO.captureGeometry(allGeometry, approachSegment);
    // test the convenience method
    const closestApproach = CurveCurve.closestApproachProjectedXYPair(geometryA, geometryB);
    ck.testDefined(closestApproach);
    const detailA = closestApproach!.detailA;
    const detailB = closestApproach!.detailB;
    ck.testCoordinate(detailA.fraction, 1);
    ck.testCoordinate(detailB.fraction, 0.1);
    const minLenSqr = detailA.point.distanceSquaredXY(detailB.point);
    const expectedMinLenSqr = 0.5; // (sqrt(2)/2)*(sqrt(2)/2)
    ck.testLE(
      Math.sqrt(minLenSqr), maxDistance, undefined, "closest approach length must be smaller than maxDistance",
    );
    ck.testCoordinate(minLenSqr, expectedMinLenSqr);
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveCloseApproachXY", "SingleLineLine2");
    expect(ck.getNumErrors()).equals(0);
  });
  it("LineLineString", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const geometryA = LineString3d.create([1, 2], [3, 4], [4, 3]);
    testVaryingLineSegments(
      ck, allGeometry, geometryA, geometryA.startPoint(), geometryA.fractionToPoint(0.5), geometryA.endPoint(),
    );
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveCloseApproachXY", "LineLineString");
    expect(ck.getNumErrors()).equals(0);
  });
  it("SingleLineLineString1", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const maxDistance = 5;
    const geometryA = LineSegment3d.createXYZXYZ(5, 4, 3, 7, 4, 5);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryA);
    const geometryB = LineString3d.create([1, 0, 1], [2, 3, 1], [3, 0, 1], [4, 2, 1], [5, 0, 1], [6, 3, -2], [7, 0, 1]);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryB);
    const approaches = CurveCurve.closeApproachProjectedXYPairs(geometryA, geometryB, maxDistance);
    ck.testLE(0, approaches.length);
    if (approaches.length > 0) {
      for (const ap of approaches) {
        const start = ap.detailA.point;
        const end = ap.detailB.point;
        if (start.isAlmostEqual(end)) // intersection between geometries
          GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, start, 0.0625);
        else { // closest approach between geometries
          const approachSegment = LineSegment3d.create(start, end);
          const lenSqr = start.distanceSquaredXY(end);
          ck.testLE(
            Math.sqrt(lenSqr), maxDistance, undefined, "approach length must be smaller than maxDistance",
          );
          GeometryCoreTestIO.captureGeometry(allGeometry, approachSegment);
        }
      }
    }
    // test the convenience method
    const closestApproach = CurveCurve.closestApproachProjectedXYPair(geometryA, geometryB);
    ck.testDefined(closestApproach);
    const detailA = closestApproach!.detailA;
    const detailB = closestApproach!.detailB;
    ck.testCoordinate(detailA.fraction, 0.5);
    ck.testCoordinate(detailB.fraction, 5 / 6);
    const minLenSqr = detailA.point.distanceSquaredXY(detailB.point);
    const expectedMinLenSqr = 1;
    ck.testLE(
      Math.sqrt(minLenSqr), maxDistance, undefined, "closest approach length must be smaller than maxDistance",
    );
    ck.testCoordinate(minLenSqr, expectedMinLenSqr);

    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveCloseApproachXY", "SingleLineLineString1");
    expect(ck.getNumErrors()).equals(0);
  });
  it("SingleLineLineString2", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const maxDistance = 5;
    const geometryA = LineSegment3d.createXYXY(-1, 3, 1, 1);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryA);
    const geometryB = LineString3d.create([1, 0], [2, 1], [3, 0]);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryB);
    const approaches = CurveCurve.closeApproachProjectedXYPairs(geometryA, geometryB, maxDistance);
    ck.testLE(0, approaches.length);
    if (approaches.length > 0) {
      for (const ap of approaches) {
        const start = ap.detailA.point;
        const end = ap.detailB.point;
        if (start.isAlmostEqual(end)) // intersection between geometries
          GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, start, 0.0625);
        else { // closest approach between geometries
          const approachSegment = LineSegment3d.create(start, end);
          const lenSqr = start.distanceSquaredXY(end);
          ck.testLE(
            Math.sqrt(lenSqr), maxDistance, undefined, "approach length must be smaller than maxDistance",
          );
          GeometryCoreTestIO.captureGeometry(allGeometry, approachSegment);
        }
      }
    }
    // test the convenience method
    const closestApproach = CurveCurve.closestApproachProjectedXYPair(geometryA, geometryB);
    ck.testDefined(closestApproach);
    const detailA = closestApproach!.detailA;
    const detailB = closestApproach!.detailB;
    ck.testCoordinate(detailA.fraction, 1);
    ck.testCoordinate(detailB.fraction, 0.25);
    const minLenSqr = detailA.point.distanceSquaredXY(detailB.point);
    const expectedMinLenSqr = 0.5;
    ck.testLE(
      Math.sqrt(minLenSqr), maxDistance, undefined, "closest approach length must be smaller than maxDistance",
    );
    ck.testCoordinate(minLenSqr, expectedMinLenSqr);
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveCloseApproachXY", "SingleLineLineString2");
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
  it("SingleLineArc1", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const maxDistance = 2.5;
    const geometryA = Arc3d.createCircularStartMiddleEnd(
      Point3d.create(-2, 0), Point3d.create(0, 2), Point3d.create(2, 0),
    )!;
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryA);
    const geometryB = LineSegment3d.createXYXY(-5, 4, 5, 4);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryB);
    const approaches = CurveCurve.closeApproachProjectedXYPairs(geometryA, geometryB, maxDistance);
    const start = approaches.at(0)!.detailA.point;
    const end = approaches.at(0)!.detailB.point;
    const approachSegment = LineSegment3d.create(start, end);
    const lenSqr = start.distanceSquaredXY(end);
    ck.testLE(
      Math.sqrt(lenSqr), maxDistance, undefined, "approach length must be smaller than maxDistance",
    );
    GeometryCoreTestIO.captureGeometry(allGeometry, approachSegment);
    // test the convenience method
    const closestApproach = CurveCurve.closestApproachProjectedXYPair(geometryA, geometryB);
    ck.testDefined(closestApproach);
    const detailA = closestApproach!.detailA;
    const detailB = closestApproach!.detailB;
    ck.testCoordinate(detailA.fraction, 0.5);
    ck.testCoordinate(detailB.fraction, 0.5);
    const minLenSqr = detailA.point.distanceSquaredXY(detailB.point);
    const expectedMinLenSqr = 4;
    ck.testLE(
      Math.sqrt(minLenSqr), maxDistance, undefined, "closest approach length must be smaller than maxDistance",
    );
    ck.testCoordinate(minLenSqr, expectedMinLenSqr);
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveCloseApproachXY", "SingleLineArc1");
    expect(ck.getNumErrors()).equals(0);
  });
  it("SingleLineArc2", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const maxDistance = 4;
    const geometryA = Arc3d.createCircularStartMiddleEnd(
      Point3d.create(-2, 0, 0), Point3d.create(0, 2, -2), Point3d.create(2, 0, -4),
    )!;
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryA);
    const geometryB = LineSegment3d.createXYZXYZ(0, 3, -3, 0, 6, 3);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryB);
    const approaches = CurveCurve.closeApproachProjectedXYPairs(geometryA, geometryB, maxDistance);
    if (approaches.length > 0) {
      for (const ap of approaches) {
        const start = ap.detailA.point;
        const end = ap.detailB.point;
        if (start.isAlmostEqual(end)) // intersection between geometries
          GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, start, 0.0625);
        else { // closest approach between geometries
          const approachSegment = LineSegment3d.create(start, end);
          const lenSqr = start.distanceSquaredXY(end);
          ck.testLE(
            Math.sqrt(lenSqr), maxDistance, undefined, "approach length must be smaller than maxDistance",
          );
          GeometryCoreTestIO.captureGeometry(allGeometry, approachSegment);
        }
      }
    }
    // test the convenience method
    const closestApproach = CurveCurve.closestApproachProjectedXYPair(geometryA, geometryB);
    ck.testDefined(closestApproach);
    const minLenSqr = closestApproach!.detailA.point.distanceSquaredXY(closestApproach!.detailB.point);
    ck.testLE(
      Math.sqrt(minLenSqr), maxDistance, undefined, "closest approach length must be smaller than maxDistance",
    );
    const expectedMinLenSqr = 1;
    ck.testCoordinate(minLenSqr, expectedMinLenSqr);
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveCloseApproachXY", "SingleLineArc2");
    expect(ck.getNumErrors()).equals(0);
  });
  it("SingleLineArc3", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const maxDistance = 2.5;
    const geometryA = Arc3d.create(
      Point3d.create(0, 0), Vector3d.create(2, 0), Vector3d.create(0, 3), AngleSweep.createStartEndRadians(0, Math.PI),
    )!;
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryA);
    const geometryB = LineSegment3d.createXYXY(-5, 3, 5, 3);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryB);
    const approaches = CurveCurve.closeApproachProjectedXYPairs(geometryA, geometryB, maxDistance);
    const start = approaches.at(0)!.detailA.point;
    const end = approaches.at(0)!.detailB.point;
    const lenSqr = start.distanceSquaredXY(end);
    if (start.isAlmostEqual(end)) // intersection between geometries
      GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, start, 0.0625);
    else { // closest approach between geometries
      const approachSegment = LineSegment3d.create(start, end);
      ck.testLE(
        Math.sqrt(lenSqr), maxDistance, undefined, "approach length must be smaller than maxDistance",
      );
      GeometryCoreTestIO.captureGeometry(allGeometry, approachSegment);
    }
    const expectedLenSqr = 0;
    ck.testCoordinate(lenSqr, expectedLenSqr);
    // test the convenience method
    const closestApproach = CurveCurve.closestApproachProjectedXYPair(geometryA, geometryB);
    ck.testDefined(closestApproach);
    const detailA = closestApproach!.detailA;
    const detailB = closestApproach!.detailB;
    ck.testCoordinate(detailA.fraction, 0.5);
    ck.testCoordinate(detailB.fraction, 0.5);
    const minLenSqr = detailA.point.distanceSquaredXY(detailB.point);
    const expectedMinLenSqr = 0;
    ck.testLE(
      Math.sqrt(minLenSqr), maxDistance, undefined, "closest approach length must be smaller than maxDistance",
    );
    ck.testCoordinate(minLenSqr, expectedMinLenSqr);
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveCloseApproachXY", "SingleLineArc3");
    expect(ck.getNumErrors()).equals(0);
  });
  it("SingleLineArc4", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const maxDistance = 3;
    const geometryA = Arc3d.createCircularStartMiddleEnd(Point3d.create(1, 2), Point3d.create(3, 3.5), Point3d.create(5, 2))!;
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryA);
    const geometryB = LineSegment3d.createXYXY(3, 3, 4, 1);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryB);
    // find approaches
    const approaches = CurveCurve.closeApproachProjectedXYPairs(geometryA, geometryB, maxDistance);
    const approachLen = approaches.length;
    ck.testLE(0, approachLen);
    if (approachLen > 0) {
      for (const ap of approaches) {
        const start = ap.detailA.point;
        const end = ap.detailB.point;
        if (start.isAlmostEqual(end)) // intersection between geometries
          GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, start, 0.0625);
        else { // closest approach between geometries
          const approachSegment = LineSegment3d.create(start, end);
          const lenSqr = start.distanceSquaredXY(end);
          ck.testLE(
            Math.sqrt(lenSqr), maxDistance, undefined, "approach length must be smaller than maxDistance",
          );
          GeometryCoreTestIO.captureGeometry(allGeometry, approachSegment);
        }
      }
    }
    // test the convenience method
    const closestApproach = CurveCurve.closestApproachProjectedXYPair(geometryA, geometryB);
    ck.testDefined(closestApproach);
    const minLenSqr = closestApproach!.detailA.point.distanceSquaredXY(closestApproach!.detailB.point);
    ck.testLE(
      Math.sqrt(minLenSqr), maxDistance, undefined, "closest approach length must be smaller than maxDistance",
    );
    const expectedMinLenSqr = 0.25; // 0.5 * 0.5
    ck.testCoordinate(minLenSqr, expectedMinLenSqr);
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveCloseApproachXY", "SingleLineArc4");
    expect(ck.getNumErrors()).equals(0);
  });
  it("LinePath1", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const arc = Arc3d.createCircularStartMiddleEnd(Point3d.create(1, 2), Point3d.create(3, 3.5), Point3d.create(5, 2))!;
    const lineString = LineString3d.create([5, 2], [6, 0], [7, 2]);
    const lineSegment = LineSegment3d.create(Point3d.create(7, 2), Point3d.create(10, 0));
    const geometryA = Path.create();
    geometryA.tryAddChild(arc);
    geometryA.tryAddChild(lineString);
    geometryA.tryAddChild(lineSegment);
    testVaryingLineSegments(
      ck, allGeometry, geometryA, Point3d.create(1, 2), Point3d.create(5, 2), Point3d.create(10, 0),
    );
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveCloseApproachXY", "LinePath1");
    expect(ck.getNumErrors()).equals(0);
  });
  it("LinePath2", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const shift = 10;
    const maxDistance = 5;
    const geometryA = LineSegment3d.createXYZXYZ(4, 4, 3, 7, 4, 5);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryA);
    // line string
    const geometryB1 = LineString3d.create([1, 0, 1], [2, 3, 1], [3, 0, 1], [4, 2, 1], [5, 0, 1], [6, 3, -2], [7, 0, 1]);
    const approaches1 = CurveCurve.closeApproachProjectedXYPairs(geometryA, geometryB1, maxDistance);
    // same line string create as path of line segments
    const geometryB2 = Path.create();
    const lineSegment1 = LineSegment3d.create(Point3d.create(1, 0, 1), Point3d.create(2, 3, 1));
    const lineSegment2 = LineSegment3d.create(Point3d.create(2, 3, 1), Point3d.create(3, 0, 1));
    const lineSegment3 = LineSegment3d.create(Point3d.create(3, 0, 1), Point3d.create(4, 2, 1));
    const lineSegment4 = LineSegment3d.create(Point3d.create(4, 2, 1), Point3d.create(5, 0, 1));
    const lineSegment5 = LineSegment3d.create(Point3d.create(5, 0, 1), Point3d.create(6, 3, -2));
    const lineSegment6 = LineSegment3d.create(Point3d.create(6, 3, -2), Point3d.create(7, 0, 1));
    geometryB2.tryAddChild(lineSegment1);
    geometryB2.tryAddChild(lineSegment2);
    geometryB2.tryAddChild(lineSegment3);
    geometryB2.tryAddChild(lineSegment4);
    geometryB2.tryAddChild(lineSegment5);
    geometryB2.tryAddChild(lineSegment6);
    // find approaches
    const approaches2 = CurveCurve.closeApproachProjectedXYPairs(geometryA, geometryB2, maxDistance);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryB1);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryA, shift, 0);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryB2, shift, 0);
    const approach1Len = approaches1.length;
    ck.testLE(0, approach1Len);
    if (approach1Len > 0) {
      for (const ap of approaches1) {
        const start = ap.detailA.point;
        const end = ap.detailB.point;
        if (start.isAlmostEqual(end)) // intersection between geometries
          GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, start, 0.0625);
        else { // closest approach between geometries
          const approachSegment = LineSegment3d.create(start, end);
          const lenSqr = start.distanceSquaredXY(end);
          ck.testLE(
            Math.sqrt(lenSqr), maxDistance, undefined, "approach length must be smaller than maxDistance",
          );
          GeometryCoreTestIO.captureGeometry(allGeometry, approachSegment);
        }
      }
    }
    const approach2Len = approaches2.length;
    ck.testLE(0, approach2Len);
    if (approach2Len > 0) {
      for (const ap of approaches2) {
        const start = ap.detailA.point;
        const end = ap.detailB.point;
        if (start.isAlmostEqual(end)) // intersection between geometries
          GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, start, 0.0625);
        else { // closest approach between geometries
          const approachSegment = LineSegment3d.create(start, end);
          const lenSqr = start.distanceSquaredXY(end);
          ck.testLE(
            Math.sqrt(lenSqr), maxDistance, undefined, "approach length must be smaller than maxDistance",
          );
          GeometryCoreTestIO.captureGeometry(allGeometry, approachSegment, shift, 0);
        }
      }
    }
    for (let i = 0; i < approach1Len; i++) {
      ck.testPoint3d(approaches1[i].detailA.point, approaches2[i * 2].detailA.point, ["failed for approach1 index: ", i]);
      ck.testPoint3d(approaches1[i].detailB.point, approaches2[i * 2].detailB.point, ["failed for approach2 index: ", i]);
    }
    // test the convenience method
    const closestApproach1 = CurveCurve.closestApproachProjectedXYPair(geometryA, geometryB1);
    const closestApproach2 = CurveCurve.closestApproachProjectedXYPair(geometryA, geometryB2);
    ck.testDefined(closestApproach1);
    ck.testDefined(closestApproach2);
    const detailA1 = closestApproach1!.detailA;
    const detailB1 = closestApproach1!.detailB;
    const detailA2 = closestApproach2!.detailA;
    const detailB2 = closestApproach2!.detailB;
    ck.testCoordinate(detailA1.fraction, 2 / 3);
    ck.testCoordinate(detailB1.fraction, 5 / 6); // fraction on line string
    ck.testCoordinate(detailA2.fraction, 2 / 3);
    ck.testCoordinate(detailB2.fraction, 1);  // fraction on line segment
    const minLenSqr1 = detailA1.point.distanceSquaredXY(detailB1.point);
    const minLenSqr2 = detailA2.point.distanceSquaredXY(detailB2.point);
    const expectedMinLenSqr = 1;
    ck.testLE(
      Math.sqrt(minLenSqr1), maxDistance, undefined, "closest approach length must be smaller than maxDistance",
    );
    ck.testLE(
      Math.sqrt(minLenSqr2), maxDistance, undefined, "closest approach length must be smaller than maxDistance",
    );
    ck.testCoordinate(minLenSqr1, expectedMinLenSqr);
    ck.testCoordinate(minLenSqr2, expectedMinLenSqr);
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveCloseApproachXY", "LinePath2");
    expect(ck.getNumErrors()).equals(0);
  });
  it("LineLoop1", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const arc = Arc3d.createCircularStartMiddleEnd(Point3d.create(1, 2), Point3d.create(3, 3.5), Point3d.create(5, 2))!;
    const lineString = LineString3d.create([5, 2], [6, 0], [7, 2]);
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
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveCloseApproachXY", "LineLoop1");
    expect(ck.getNumErrors()).equals(0);
  });
  it("LineLoop2", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const shift = 10;
    const maxDistance = 10;
    const geometryA = LineSegment3d.createXYZXYZ(4, 5, 3, 7, 5, 5);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryA);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryA, shift, 0);
    // line string
    const geometryB1 = LineString3d.create([
      [1, 0], [2, 3], [3, 0], [4, 2], [5, 0], [6, 3], [7, -2], [1, 0],
    ]);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryB1);
    // same line string create as loop of line segments
    const geometryB2 = Loop.create();
    const lineSegment1 = LineSegment3d.create(Point3d.create(1, 0), Point3d.create(2, 3));
    const lineSegment2 = LineSegment3d.create(Point3d.create(2, 3), Point3d.create(3, 0));
    const lineSegment3 = LineSegment3d.create(Point3d.create(3, 0), Point3d.create(4, 2));
    const lineSegment4 = LineSegment3d.create(Point3d.create(4, 2), Point3d.create(5, 0));
    const lineSegment5 = LineSegment3d.create(Point3d.create(5, 0), Point3d.create(6, 3));
    const lineSegment6 = LineSegment3d.create(Point3d.create(6, 3), Point3d.create(7, -2));
    const lineSegment7 = LineSegment3d.create(Point3d.create(7, -2), Point3d.create(1, 0));
    geometryB2.tryAddChild(lineSegment1);
    geometryB2.tryAddChild(lineSegment2);
    geometryB2.tryAddChild(lineSegment3);
    geometryB2.tryAddChild(lineSegment4);
    geometryB2.tryAddChild(lineSegment5);
    geometryB2.tryAddChild(lineSegment6);
    geometryB2.tryAddChild(lineSegment7);
    // find approaches
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryB2, shift, 0);
    const approaches1 = CurveCurve.closeApproachProjectedXYPairs(geometryA, geometryB1, maxDistance);
    const approaches2 = CurveCurve.closeApproachProjectedXYPairs(geometryA, geometryB2, maxDistance);
    const approach1Len = approaches1.length;
    ck.testLE(0, approach1Len);
    if (approach1Len > 0) {
      for (const ap of approaches1) {
        const start = ap.detailA.point;
        const end = ap.detailB.point;
        if (start.isAlmostEqual(end)) // intersection between geometries
          GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, start, 0.0625);
        else { // closest approach between geometries
          const approachSegment = LineSegment3d.create(start, end);
          const lenSqr = start.distanceSquaredXY(end);
          ck.testLE(
            Math.sqrt(lenSqr), maxDistance, undefined, "approach length must be smaller than maxDistance",
          );
          GeometryCoreTestIO.captureGeometry(allGeometry, approachSegment);
        }
      }
    }
    const approach2Len = approaches2.length;
    ck.testLE(0, approach2Len);
    if (approach2Len > 0) {
      for (const ap of approaches2) {
        const start = ap.detailA.point;
        const end = ap.detailB.point;
        if (start.isAlmostEqual(end)) // intersection between geometries
          GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, start, 0.0625);
        else { // closest approach between geometries
          const approachSegment = LineSegment3d.create(start, end);
          const lenSqr = start.distanceSquaredXY(end);
          ck.testLE(
            Math.sqrt(lenSqr), maxDistance, undefined, "approach length must be smaller than maxDistance",
          );
          GeometryCoreTestIO.captureGeometry(allGeometry, approachSegment, shift, 0);
        }
      }
    }
    for (let i = 0; i < approach1Len; i++) {
      ck.testPoint3d(approaches1[i].detailA.point, approaches2[i * 2].detailA.point, ["failed for approach1 index: ", i]);
      ck.testPoint3d(approaches1[i].detailB.point, approaches2[i * 2].detailB.point, ["failed for approach2 index: ", i]);
    }
    // test the convenience method
    const closestApproach1 = CurveCurve.closestApproachProjectedXYPair(geometryA, geometryB1);
    const closestApproach2 = CurveCurve.closestApproachProjectedXYPair(geometryA, geometryB2);
    ck.testDefined(closestApproach1);
    ck.testDefined(closestApproach2);
    const minLenSqr1 = closestApproach1!.detailA.point.distanceSquaredXY(closestApproach1!.detailB.point);
    const minLenSqr2 = closestApproach2!.detailA.point.distanceSquaredXY(closestApproach2!.detailB.point);
    const expectedMinLenSqr = 4;
    ck.testLE(
      Math.sqrt(minLenSqr1), maxDistance, undefined, "closest approach length must be smaller than maxDistance",
    );
    ck.testLE(
      Math.sqrt(minLenSqr2), maxDistance, undefined, "closest approach length must be smaller than maxDistance",
    );
    ck.testCoordinate(minLenSqr1, expectedMinLenSqr);
    ck.testCoordinate(minLenSqr2, expectedMinLenSqr);
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveCloseApproachXY", "LineLoop2");
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
    testVaryingSubsets(ck, allGeometry, arcA, arcB, 1);
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveCloseApproachXY", "ArcArcFar");
    expect(ck.getNumErrors()).equals(0);
  });
  it("ArcArcInside", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const maxDistance = 2;
    const arcA = Arc3d.createXY(Point3d.create(1, 1), 5);
    const arcB = Arc3d.createXY(Point3d.create(2, 3), 2);
    testVaryingSubsets(ck, allGeometry, arcA, arcB, maxDistance);
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveCloseApproachXY", "ArcArcInside");
    expect(ck.getNumErrors()).equals(0);
  });
  it("SingleArcArc1", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const maxDistance = 2;
    const geometryA = Arc3d.create(
      Point3d.create(0, 0), Vector3d.create(1, 0), Vector3d.create(0, 1),
    ); // circular arc
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryA);
    const geometryB = Arc3d.create(
      Point3d.create(1, 0), Vector3d.create(1, 0), Vector3d.create(0, 3),
    ); // non-circular arc
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryB);
    const approaches = CurveCurve.closeApproachProjectedXYPairs(geometryA, geometryB, maxDistance);
    const numExpectedIntersections = 1;
    let numIntersectionsFound = 0;
    const approachLen = approaches.length;
    ck.testLE(0, approachLen);
    if (approachLen > 0) {
      for (const ap of approaches) {
        const start = ap.detailA.point;
        const end = ap.detailB.point;
        if (start.isAlmostEqual(end)) { // intersection between geometries
          GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, start, 0.0625);
          numIntersectionsFound++;
        } else { // closest approach between geometries
          const approachSegment = LineSegment3d.create(start, end);
          const lenSqr = start.distanceSquaredXY(end);
          ck.testLE(
            Math.sqrt(lenSqr), maxDistance, undefined, undefined, "approach length must be smaller than maxDistance",
          );
          GeometryCoreTestIO.captureGeometry(allGeometry, approachSegment);
        }
      }
    }
    ck.testLE(numExpectedIntersections, numIntersectionsFound);
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveCloseApproachXY", "SingleArcArc1");
    expect(ck.getNumErrors()).equals(0);
  });
  it("SingleArcArc2", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const maxDistance = 2;
    const geometryA = Arc3d.create(
      Point3d.create(0, 0), Vector3d.create(1, 0), Vector3d.create(0, 1),
    ); // circular arc
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryA);
    const geometryB = Arc3d.create(
      Point3d.create(6, 0), Vector3d.create(2, 0), Vector3d.create(0, 3),
    ); // non-circular arc
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryB);
    const approaches = CurveCurve.closeApproachProjectedXYPairs(geometryA, geometryB, maxDistance);
    ck.testExactNumber(0, approaches.length); // distance between circles is more than max distance
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveCloseApproachXY", "SingleArcArc2");
    expect(ck.getNumErrors()).equals(0);
  });
  it("SingleArcArc3", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const maxDistance = 5;
    const geometryA = Arc3d.create(
      Point3d.create(-1, 0), Vector3d.create(2, 0), Vector3d.create(0, 1),
    ); // non-circular arc
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryA);
    const geometryB = Arc3d.create(
      Point3d.create(4, 0), Vector3d.create(2, 0), Vector3d.create(0, 2),
    ); // circular arc
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryB);
    const approaches = CurveCurve.closeApproachProjectedXYPairs(geometryA, geometryB, maxDistance);
    const start = approaches.at(0)!.detailA.point;
    const end = approaches.at(0)!.detailB.point;
    const approachSegment = LineSegment3d.create(start, end);
    const lenSqr = start.distanceSquaredXY(end);
    ck.testLE(
      Math.sqrt(lenSqr), maxDistance, undefined, "approach length must be smaller than maxDistance",
    );
    GeometryCoreTestIO.captureGeometry(allGeometry, approachSegment);
    // test the convenience method
    const closestApproach = CurveCurve.closestApproachProjectedXYPair(geometryA, geometryB);
    ck.testDefined(closestApproach);
    const detailA = closestApproach!.detailA;
    const detailB = closestApproach!.detailB;
    ck.testCoordinate(detailA.fraction, 0);
    ck.testCoordinate(detailB.fraction, 0.5);
    const minLenSqr = detailA.point.distanceSquaredXY(detailB.point);
    const expectedMinLenSqr = 1;
    ck.testLE(
      Math.sqrt(minLenSqr), maxDistance, undefined, "closest approach length must be smaller than maxDistance",
    );
    ck.testCoordinate(minLenSqr, expectedMinLenSqr);
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveCloseApproachXY", "SingleArcArc3");
    expect(ck.getNumErrors()).equals(0);
  });
  it("SingleArcArc4", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const maxDistance = 5;
    const geometryA = Arc3d.create(
      Point3d.create(0, 0, 1),
      Vector3d.create(1, 0, 2),
      Vector3d.create(0, 1, -2),
      AngleSweep.createStartEndRadians(-Math.PI / 2, Math.PI / 2),
    ); // circular arc
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryA);
    const geometryB = Arc3d.create(
      Point3d.create(4, 0),
      Vector3d.create(2, 0, 1),
      Vector3d.create(0, 2, 3),
      AngleSweep.createStartEndRadians(Math.PI / 2, 5 * Math.PI / 4),
    ); // circular arc
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryB);
    const approaches = CurveCurve.closeApproachProjectedXYPairs(geometryA, geometryB, maxDistance);
    const approachLen = approaches.length;
    ck.testLE(0, approachLen);
    if (approachLen > 0) {
      for (const ap of approaches) {
        const start = ap.detailA.point;
        const end = ap.detailB.point;
        if (start.isAlmostEqual(end)) // intersection between geometries
          GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, start, 0.0625);
        else { // closest approach between geometries
          const approachSegment = LineSegment3d.create(start, end);
          const lenSqr = start.distanceSquaredXY(end);
          ck.testLE(
            Math.sqrt(lenSqr), maxDistance, undefined, undefined, "approach length must be smaller than maxDistance",
          );
          GeometryCoreTestIO.captureGeometry(allGeometry, approachSegment);
        }
      }
    }
    // test the convenience method
    const closestApproach = CurveCurve.closestApproachProjectedXYPair(geometryA, geometryB);
    ck.testDefined(closestApproach);
    const detailA = closestApproach!.detailA;
    const detailB = closestApproach!.detailB;
    ck.testCoordinate(detailA.fraction, 0.5);
    ck.testCoordinate(detailB.fraction, 2 / 3);
    const minLenSqr = detailA.point.distanceSquaredXY(detailB.point);
    const expectedMinLenSqr = 1;
    ck.testLE(
      Math.sqrt(minLenSqr), maxDistance, undefined, "closest approach length must be smaller than maxDistance",
    );
    ck.testCoordinate(minLenSqr, expectedMinLenSqr);
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveCloseApproachXY", "SingleArcArc4");
    expect(ck.getNumErrors()).equals(0);
  });
  it("CoPlanarArcArcIntersection1", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const maxDistance = 2;
    const geometryA = Arc3d.create(
      Point3d.create(1, 0), Vector3d.create(1, 0), Vector3d.create(0, 1),
    ); // circular arc
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryA);
    const geometryB = Arc3d.create(
      Point3d.create(4, 0), Vector3d.create(2, 0), Vector3d.create(0, 4),
    ); // non-circular arc
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryB);
    const approaches = CurveCurve.closeApproachProjectedXYPairs(geometryA, geometryB, maxDistance);
    const numExpectedIntersections = 1;
    let numIntersectionsFound = 0;
    const expectedIntersectionPoint = Point3d.create(2, 0);
    for (const p of approaches) {
      const detailA = p.detailA.point;
      const detailB = p.detailB.point;
      if (detailA.isAlmostEqualXY(detailB)) { // intersection between arcs
        numIntersectionsFound++;
        ck.testPoint3d(detailA, expectedIntersectionPoint);
        GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, detailA, 0.0625);
      }
    }
    ck.testLE(numExpectedIntersections, numIntersectionsFound);
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveCloseApproachXY", "CoPlanarArcArcIntersection1");
    expect(ck.getNumErrors()).equals(0);
  });
  it("CoPlanarArcArcIntersection2", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const maxDistance = 2;
    const geometryA = Arc3d.create(
      Point3d.create(0, 0), Vector3d.create(1, 0), Vector3d.create(0, 1),
    ); // circular arc
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryA);
    const geometryB = Arc3d.create(
      Point3d.create(-0.75, 0), Vector3d.create(1.25, 0), Vector3d.create(0, 1.25),
    ); // circular arc
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryB);
    const approaches = CurveCurve.closeApproachProjectedXYPairs(geometryA, geometryB, maxDistance);
    const numExpectedIntersections = 2;
    let numIntersectionsFound = 0;
    const expectedIntersectionPoint1 = Point3d.create(0, 1);
    const expectedIntersectionPoint2 = Point3d.create(0, -1);
    for (const p of approaches) {
      const detailA = p.detailA.point;
      const detailB = p.detailB.point;
      if (detailA.isAlmostEqualXY(detailB)) { // intersection between arcs
        numIntersectionsFound++;
        if (!detailA.isAlmostEqualXY(expectedIntersectionPoint1) && !detailA.isAlmostEqualXY(expectedIntersectionPoint2))
          ck.announceError("found an unexpected intersection!");
        GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, detailA, 0.0625);
      }
    }
    ck.testLE(numExpectedIntersections, numIntersectionsFound);
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveCloseApproachXY", "CoPlanarArcArcIntersection2");
    expect(ck.getNumErrors()).equals(0);
  });
  it("NonCoPlanarArcArcIntersection1", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const maxDistance = 2;
    const geometryA = Arc3d.create(
      Point3d.create(0, 0), Vector3d.create(1, 0), Vector3d.create(0, 1),
    ); // circular arc
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryA);
    const geometryB = Arc3d.create(
      Point3d.create(-1, 0, 2), Vector3d.create(0, 1, 0), Vector3d.create(0, 0, 2),
    ); // circular arc
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryB);
    const approaches = CurveCurve.closeApproachProjectedXYPairs(geometryA, geometryB, maxDistance);
    const numExpectedIntersections = 1;
    let numIntersectionsFound = 0;
    const expectedIntersectionPoint = Point3d.create(-1, 0);
    for (const p of approaches) {
      const detailA = p.detailA.point;
      const detailB = p.detailB.point;
      if (detailA.isAlmostEqualXY(detailB)) { // intersection between arcs
        numIntersectionsFound++;
        ck.testPoint3d(detailA, expectedIntersectionPoint);
        GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, detailA, 0.0625);
      }
    }
    ck.testLE(numExpectedIntersections, numIntersectionsFound);
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveCloseApproachXY", "NonCoPlanarArcArcIntersection1");
    expect(ck.getNumErrors()).equals(0);
  });
  it("NonCoPlanarArcArcIntersection2", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const maxDistance = 2;
    const geometryA = Arc3d.create(
      Point3d.create(0, 0), Vector3d.create(1, 0), Vector3d.create(0, 1),
    ); // circular arc
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryA);
    const geometryB = Arc3d.create(
      Point3d.create(0, 0, 0), Vector3d.create(0, 1, 0), Vector3d.create(0, 0, 2),
    ); // circular arc
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryB);
    const approaches = CurveCurve.closeApproachProjectedXYPairs(geometryA, geometryB, maxDistance);
    const numExpectedIntersections = 2;
    let numIntersectionsFound = 0;
    const expectedIntersectionPoint1 = Point3d.create(0, 1);
    const expectedIntersectionPoint2 = Point3d.create(0, -1);
    for (const p of approaches) {
      const detailA = p.detailA.point;
      const detailB = p.detailB.point;
      if (detailA.isAlmostEqualXY(detailB)) { // intersection between arcs
        numIntersectionsFound++;
        if (!detailA.isAlmostEqualXY(expectedIntersectionPoint1) && !detailA.isAlmostEqualXY(expectedIntersectionPoint2))
          ck.announceError("found an unexpected intersection!");
        GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, detailA, 0.0625);
      }
    }
    ck.testLE(numExpectedIntersections, numIntersectionsFound);
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveCloseApproachXY", "NonCoPlanarArcArcIntersection2");
    expect(ck.getNumErrors()).equals(0);
  });
  it("LineStringLineString", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const cpA = LineString3d.create([1, 2], [5, 2], [3, 5]);
    const cpB = LineString3d.create([1, 3], [4, 2.5], [6, 4]);
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
  it("SingleLineStringLineString", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const maxDistance = 2;
    const geometryA = LineString3d.create([-1, 1], [0, 0], [1, 1], [2, 0], [3, 1], [4, 0.5], [5, 1]);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryA);
    const geometryB = LineString3d.create([-2, -1], [-1, -2], [0, -1], [1, -2], [2, -1], [3, -2], [4, -1], [5, -2]);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryB);
    // find approaches
    const approaches = CurveCurve.closeApproachProjectedXYPairs(geometryA, geometryB, maxDistance);
    const approachLen = approaches.length;
    ck.testLE(0, approachLen);
    if (approachLen > 0) {
      for (const ap of approaches) {
        const start = ap.detailA.point;
        const end = ap.detailB.point;
        if (start.isAlmostEqual(end)) // intersection between geometries
          GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, start, 0.0625);
        else { // closest approach between geometries
          const approachSegment = LineSegment3d.create(start, end);
          const lenSqr = start.distanceSquaredXY(end);
          ck.testLE(
            Math.sqrt(lenSqr), maxDistance, undefined, undefined, "approach length must be smaller than maxDistance",
          );
          GeometryCoreTestIO.captureGeometry(allGeometry, approachSegment);
        }
      }
    }
    // test the convenience method
    const closestApproach = CurveCurve.closestApproachProjectedXYPair(geometryA, geometryB);
    ck.testDefined(closestApproach);
    const detailA = closestApproach!.detailA;
    const detailB = closestApproach!.detailB;
    ck.testCoordinate(detailA.fraction, 1 / 6);
    ck.testCoordinate(detailB.fraction, 2 / 7);
    const minLenSqr = detailA.point.distanceSquaredXY(detailB.point);
    const expectedMinLenSqr = 1;
    ck.testLE(
      Math.sqrt(minLenSqr), maxDistance, undefined, "closest approach length must be smaller than maxDistance",
    );
    ck.testCoordinate(minLenSqr, expectedMinLenSqr);
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveCloseApproachXY", "SingleLineStringLineString");
    expect(ck.getNumErrors()).equals(0);
  });
  it("ArcLineString", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const cpA = Arc3d.createCircularStartMiddleEnd(Point3d.create(1, 2), Point3d.create(3, 3.5), Point3d.create(5, 2))!;
    const cpB = LineString3d.create([1, 3], [4, 2.5], [6, 4]);
    testVaryingSubsets(ck, allGeometry, cpA, cpB, 2);
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveCloseApproachXY", "ArcLineString");
    expect(ck.getNumErrors()).equals(0);
  });
  it("SingleArcLineString", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const maxDistance = 3;
    const geometryA = Arc3d.createCircularStartMiddleEnd(Point3d.create(1, 2), Point3d.create(3, 3.5), Point3d.create(5, 2))!;
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryA);
    const geometryB = LineString3d.create([0, -2], [2, 0], [3, 3], [4, 1], [6, 0]);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryB);
    // find approaches
    const approaches = CurveCurve.closeApproachProjectedXYPairs(geometryA, geometryB, maxDistance);
    const approachLen = approaches.length;
    ck.testLE(0, approachLen);
    if (approachLen > 0) {
      for (const ap of approaches) {
        const start = ap.detailA.point;
        const end = ap.detailB.point;
        if (start.isAlmostEqual(end)) // intersection between geometries
          GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, start, 0.0625);
        else { // closest approach between geometries
          const approachSegment = LineSegment3d.create(start, end);
          const lenSqr = start.distanceSquaredXY(end);
          ck.testLE(
            Math.sqrt(lenSqr), maxDistance, undefined, "approach length must be smaller than maxDistance",
          );
          GeometryCoreTestIO.captureGeometry(allGeometry, approachSegment);
        }
      }
    }
    // test the convenience method
    const closestApproach = CurveCurve.closestApproachProjectedXYPair(geometryA, geometryB);
    ck.testDefined(closestApproach);
    const minLenSqr = closestApproach!.detailA.point.distanceSquaredXY(closestApproach!.detailB.point);
    ck.testLE(
      Math.sqrt(minLenSqr), maxDistance, undefined, "closest approach length must be smaller than maxDistance",
    );
    const expectedMinLenSqr = 0.25; // 0.5 * 0.5
    ck.testCoordinate(minLenSqr, expectedMinLenSqr);
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveCloseApproachXY", "SingleArcLineString");
    expect(ck.getNumErrors()).equals(0);
  });
  it("BsplineLineString", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const cpA = BSplineCurve3d.createUniformKnots(
      [
        Point3d.create(0, 0, 0),
        Point3d.create(1, 0.5, 0),
        Point3d.create(2, 0, 0),
        Point3d.create(3, 2, 0),
        Point3d.create(4, 0, 0),
      ],
      4,
    )!;
    const cpB = LineString3d.create([1, 3], [4, 2.5], [6, 3]);
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
    const cpA = BSplineCurve3d.createUniformKnots(
      [
        Point3d.create(0, 3, 0),
        Point3d.create(1, 0.5, 0),
        Point3d.create(2, 0, 0),
        Point3d.create(5, 2, 0),
        Point3d.create(6, 4, 0),
      ],
      4,
    )!;
    const cpB = Arc3d.createCircularStartMiddleEnd(
      Point3d.create(1, 3), Point3d.create(4, 2.5), Point3d.create(6, 2),
    )!;
    testVaryingSubsets(ck, allGeometry, cpA, cpB, 2, [0, 1]);
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveCloseApproachXY", "BsplineArc");
    allGeometry.length = 0;
    testVaryingSubsets(ck, allGeometry, cpB, cpA, 2, [0, 1]);
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveCloseApproachXY", "ArcBspline");
    allGeometry.length = 0;
    const cpB1 = Arc3d.createCircularStartMiddleEnd(
      Point3d.create(1, -1), Point3d.create(4, 0), Point3d.create(6, -1),
    )!;
    testVaryingSubsets(ck, allGeometry, cpA, cpB1, 2, [0, 1]);
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveCloseApproachXY", "BsplineArcB");
    expect(ck.getNumErrors()).equals(0);
  });
  it("BsplineLine", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const cpA = BSplineCurve3d.createUniformKnots(
      [
        Point3d.create(0, 3, 0),
        Point3d.create(1, 0.5, 0),
        Point3d.create(2, 0, 0),
        Point3d.create(5, 2, 0),
        Point3d.create(6, 4, 0),
      ],
      4,
    )!;
    const cpB2 = LineSegment3d.create(Point3d.create(1, -1), Point3d.create(6, -1));
    testVaryingSubsets(ck, allGeometry, cpA, cpB2, 2, [0, 1]);
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveCloseApproachXY", "BsplineLine");
    expect(ck.getNumErrors()).equals(0);
  });
  it("PathPath", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const maxDistance = 5;
    // path1
    const arc1 = Arc3d.createCircularStartMiddleEnd(Point3d.create(1, 5), Point3d.create(3, 6.5), Point3d.create(5, 5))!;
    const lineString1 = LineString3d.create([5, 5], [6, 3], [7, 5], [10, 3]);
    const lineSegment1 = LineSegment3d.create(Point3d.create(10, 3), Point3d.create(1, 5));
    const geometryA = Path.create();
    geometryA.tryAddChild(arc1);
    geometryA.tryAddChild(lineString1);
    geometryA.tryAddChild(lineSegment1);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryA);
    // path2
    const arc2 = Arc3d.createCircularStartMiddleEnd(Point3d.create(0, -2), Point3d.create(2, -3.5), Point3d.create(4, -2))!;
    const lineString2 = LineString3d.create([4, -2], [6, -1], [8, -2], [10, 2]);
    const lineSegment2 = LineSegment3d.create(Point3d.create(10, 2), Point3d.create(0, -2));
    const geometryB = Path.create();
    geometryB.tryAddChild(arc2);
    geometryB.tryAddChild(lineString2);
    geometryB.tryAddChild(lineSegment2);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryB);
    // find approaches
    const approaches = CurveCurve.closeApproachProjectedXYPairs(geometryA, geometryB, maxDistance);
    const approachLen = approaches.length;
    ck.testLE(0, approachLen);
    if (approachLen > 0) {
      for (const ap of approaches) {
        const start = ap.detailA.point;
        const end = ap.detailB.point;
        if (start.isAlmostEqual(end)) // intersection between geometries
          GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, start, 0.0625);
        else { // closest approach between geometries
          const approachSegment = LineSegment3d.create(start, end);
          const lenSqr = start.distanceSquaredXY(end);
          ck.testLE(
            Math.sqrt(lenSqr), maxDistance, undefined, "approach length must be smaller than maxDistance",
          );
          GeometryCoreTestIO.captureGeometry(allGeometry, approachSegment);
        }
      }
    }
    // test the convenience method
    const closestApproach = CurveCurve.closestApproachProjectedXYPair(geometryA, geometryB);
    ck.testDefined(closestApproach);
    const minLenSqr = closestApproach!.detailA.point.distanceSquaredXY(closestApproach!.detailB.point);
    const expectedMinLenSqr = 1;
    ck.testLE(
      Math.sqrt(minLenSqr), maxDistance, undefined, "closest approach length must be smaller than maxDistance",
    );
    ck.testCoordinate(minLenSqr, expectedMinLenSqr);
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveCloseApproachXY", "PathPath");
    expect(ck.getNumErrors()).equals(0);
  });
  it("LoopLoop", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const maxDistance = 5;
    // loop1
    const arc1 = Arc3d.createCircularStartMiddleEnd(Point3d.create(1, 5), Point3d.create(3, 6.5), Point3d.create(5, 5))!;
    const lineString1 = LineString3d.create([5, 5], [6, 3], [7, 5], [10, 3]);
    const lineSegment1 = LineSegment3d.create(Point3d.create(10, 3), Point3d.create(1, 5));
    const geometryA = Loop.create();
    geometryA.tryAddChild(arc1);
    geometryA.tryAddChild(lineString1);
    geometryA.tryAddChild(lineSegment1);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryA);
    // loop2
    const arc2 = Arc3d.createCircularStartMiddleEnd(Point3d.create(0, -2), Point3d.create(2, -3.5), Point3d.create(4, -2))!;
    const lineString2 = LineString3d.create([4, -2], [6, -1], [8, -2], [10, 2]);
    const lineSegment2 = LineSegment3d.create(Point3d.create(10, 2), Point3d.create(0, -2));
    const geometryB = Loop.create();
    geometryB.tryAddChild(arc2);
    geometryB.tryAddChild(lineString2);
    geometryB.tryAddChild(lineSegment2);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryB);
    // find approaches
    const approaches = CurveCurve.closeApproachProjectedXYPairs(geometryA, geometryB, maxDistance);
    const approachLen = approaches.length;
    ck.testLE(0, approachLen);
    if (approachLen > 0) {
      for (const ap of approaches) {
        const start = ap.detailA.point;
        const end = ap.detailB.point;
        if (start.isAlmostEqual(end)) // intersection between geometries
          GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, start, 0.0625);
        else { // closest approach between geometries
          const approachSegment = LineSegment3d.create(start, end);
          const lenSqr = start.distanceSquaredXY(end);
          ck.testLE(
            Math.sqrt(lenSqr), maxDistance, undefined, "approach length must be smaller than maxDistance",
          );
          GeometryCoreTestIO.captureGeometry(allGeometry, approachSegment);
        }
      }
    }
    // test the convenience method
    const closestApproach = CurveCurve.closestApproachProjectedXYPair(geometryA, geometryB);
    ck.testDefined(closestApproach);
    const minLenSqr = closestApproach!.detailA.point.distanceSquaredXY(closestApproach!.detailB.point);
    const expectedMinLenSqr = 1;
    ck.testLE(
      Math.sqrt(minLenSqr), maxDistance, undefined, "closest approach length must be smaller than maxDistance",
    );
    ck.testCoordinate(minLenSqr, expectedMinLenSqr);
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveCloseApproachXY", "LoopLoop");
    expect(ck.getNumErrors()).equals(0);
  });
  it("LineUnionRegion", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const maxDistance = 25;
    const geometryA = LineSegment3d.createXYZXYZ(6, 14, 0, 10, 16, 0);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryA);
    // union region
    const arc1 = Arc3d.createXY(Point3d.create(6, 0), 8, AngleSweep.createStartEndDegrees(-180, 180));
    const loop1 = Loop.create();
    loop1.tryAddChild(arc1);
    const arc2 = Arc3d.createXY(Point3d.create(-6, 0), 8, AngleSweep.createStartEndDegrees(-180, 180));
    const loop2 = Loop.create();
    loop2.tryAddChild(arc2);
    const geometryB = UnionRegion.create();
    geometryB.tryAddChild(loop1);
    geometryB.tryAddChild(loop2);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryB);
    const approaches = CurveCurve.closeApproachProjectedXYPairs(geometryA, geometryB, maxDistance);
    const approachLen = approaches.length;
    ck.testLE(0, approachLen);
    if (approachLen > 0) {
      for (const ap of approaches) {
        const start = ap.detailA.point;
        const end = ap.detailB.point;
        if (start.isAlmostEqual(end)) // intersection between geometries
          GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, start, 0.0625);
        else { // closest approach between geometries
          const approachSegment = LineSegment3d.create(start, end);
          const lenSqr = start.distanceSquaredXY(end);
          ck.testLE(
            Math.sqrt(lenSqr), maxDistance, undefined, "approach length must be smaller than maxDistance",
          );
          GeometryCoreTestIO.captureGeometry(allGeometry, approachSegment);
        }
      }
    }
    // test the convenience method
    const closestApproach = CurveCurve.closestApproachProjectedXYPair(geometryA, geometryB);
    ck.testDefined(closestApproach);
    const minLenSqr = closestApproach!.detailA.point.distanceSquaredXY(closestApproach!.detailB.point);
    ck.testLE(
      Math.sqrt(minLenSqr), maxDistance, undefined, "closest approach length must be smaller than maxDistance",
    );
    const expectedMinLenSqr = 36; // 6 * 6
    ck.testCoordinate(minLenSqr, expectedMinLenSqr);
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveCloseApproachXY", "LineUnionRegion");
    expect(ck.getNumErrors()).equals(0);
  });
  it("LineParityRegion", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const maxDistance = 25;
    const geometryA = LineSegment3d.createXYZXYZ(6, 14, 0, 10, 16, 0);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryA);
    // parity region
    const arc1 = Arc3d.createXY(Point3d.create(6, 0), 8, AngleSweep.createStartEndDegrees(-180, 180));
    const loop1 = Loop.create();
    loop1.tryAddChild(arc1);
    const arc2 = Arc3d.createXY(Point3d.create(-6, 0), 8, AngleSweep.createStartEndDegrees(-180, 180));
    const loop2 = Loop.create();
    loop2.tryAddChild(arc2);
    const geometryB = ParityRegion.create();
    geometryB.tryAddChild(loop1);
    geometryB.tryAddChild(loop2);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryB);
    const approaches = CurveCurve.closeApproachProjectedXYPairs(geometryA, geometryB, maxDistance);
    const approachLen = approaches.length;
    ck.testLE(0, approachLen);
    if (approachLen > 0) {
      for (const ap of approaches) {
        const start = ap.detailA.point;
        const end = ap.detailB.point;
        if (start.isAlmostEqual(end)) // intersection between geometries
          GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, start, 0.0625);
        else { // closest approach between geometries
          const approachSegment = LineSegment3d.create(start, end);
          const lenSqr = start.distanceSquaredXY(end);
          ck.testLE(
            Math.sqrt(lenSqr), maxDistance, undefined, "approach length must be smaller than maxDistance",
          );
          GeometryCoreTestIO.captureGeometry(allGeometry, approachSegment);
        }
      }
    }
    // test the convenience method
    const closestApproach = CurveCurve.closestApproachProjectedXYPair(geometryA, geometryB);
    ck.testDefined(closestApproach);
    const minLenSqr = closestApproach!.detailA.point.distanceSquaredXY(closestApproach!.detailB.point);
    ck.testLE(
      Math.sqrt(minLenSqr), maxDistance, undefined, "closest approach length must be smaller than maxDistance",
    );
    const expectedMinLenSqr = 36; // 6 * 6
    ck.testCoordinate(minLenSqr, expectedMinLenSqr);
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveCloseApproachXY", "LineParityRegion");
    expect(ck.getNumErrors()).equals(0);
  });
  it("LineBagOfCurves", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const maxDistance = 5;
    const geometryA = LineSegment3d.createXYZXYZ(7, 6, 0, 12, 7, 0);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryA);
    // bag of curves
    const arc1 = Arc3d.createCircularStartMiddleEnd(Point3d.create(1, 5), Point3d.create(3, 6.5), Point3d.create(5, 5))!;
    const lineString1 = LineString3d.create([5, 5], [6, 3], [7, 5], [10, 3]);
    const path = Path.create();
    path.tryAddChild(arc1);
    path.tryAddChild(lineString1);
    const lineString2 = LineString3d.create([10, 3], [12, 5], [14, -1]);
    const geometryB = BagOfCurves.create(path, lineString2);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryB);
    const approaches = CurveCurve.closeApproachProjectedXYPairs(geometryA, geometryB, maxDistance);
    const approachLen = approaches.length;
    ck.testLE(0, approachLen);
    if (approachLen > 0) {
      for (const ap of approaches) {
        const start = ap.detailA.point;
        const end = ap.detailB.point;
        if (start.isAlmostEqual(end)) // intersection between geometries
          GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, start, 0.0625);
        else { // closest approach between geometries
          const approachSegment = LineSegment3d.create(start, end);
          const lenSqr = start.distanceSquaredXY(end);
          ck.testLE(
            Math.sqrt(lenSqr), maxDistance, undefined, "approach length must be smaller than maxDistance",
          );
          GeometryCoreTestIO.captureGeometry(allGeometry, approachSegment);
        }
      }
    }
    // test the convenience method
    const closestApproach = CurveCurve.closestApproachProjectedXYPair(geometryA, geometryB);
    ck.testDefined(closestApproach);
    const minLenSqr = closestApproach!.detailA.point.distanceSquaredXY(closestApproach!.detailB.point);
    const expectedMinLenSqr = 1;
    ck.testLE(
      Math.sqrt(minLenSqr), maxDistance, undefined, "closest approach length must be smaller than maxDistance",
    );
    ck.testCoordinate(minLenSqr, expectedMinLenSqr);
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveCloseApproachXY", "LineBagOfCurves");
    expect(ck.getNumErrors()).equals(0);
  });
});
