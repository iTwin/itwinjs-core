/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { describe, expect, it } from "vitest";
import { compareSimpleArrays, Dictionary } from "@itwin/core-bentley";
import { BSplineCurve3d } from "../../bspline/BSplineCurve";
import { Arc3d } from "../../curve/Arc3d";
import { CurveChainWithDistanceIndex } from "../../curve/CurveChainWithDistanceIndex";
import { BagOfCurves } from "../../curve/CurveCollection";
import { CurveCurve } from "../../curve/CurveCurve";
import { CurveLocationDetailPair } from "../../curve/CurveLocationDetail";
import { CurvePrimitive } from "../../curve/CurvePrimitive";
import { AnyCurve } from "../../curve/CurveTypes";
import { GeometryQuery } from "../../curve/GeometryQuery";
import { LineSegment3d } from "../../curve/LineSegment3d";
import { LineString3d } from "../../curve/LineString3d";
import { Loop } from "../../curve/Loop";
import { ParityRegion } from "../../curve/ParityRegion";
import { Path } from "../../curve/Path";
import { DirectSpiral3d } from "../../curve/spiral/DirectSpiral3d";
import { IntegratedSpiral3d } from "../../curve/spiral/IntegratedSpiral3d";
import { TransitionSpiral3d } from "../../curve/spiral/TransitionSpiral3d";
import { UnionRegion } from "../../curve/UnionRegion";
import { Geometry } from "../../Geometry";
import { Angle } from "../../geometry3d/Angle";
import { AngleSweep } from "../../geometry3d/AngleSweep";
import { Matrix3d } from "../../geometry3d/Matrix3d";
import { Point3d, Vector3d } from "../../geometry3d/Point3dVector3d";
import { Segment1d } from "../../geometry3d/Segment1d";
import { Transform } from "../../geometry3d/Transform";
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
  const arc0 = Arc3d.createXY(geometryAMid, 4);
  const arc1 = Arc3d.createCircularStartMiddleEnd(Point3d.create(0, 9), Point3d.create(6, 3), Point3d.create(3, -3));
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

function test2Ellipses(
  ck: Checker,
  allGeometry: GeometryQuery[],
  geometryA: Arc3d,
  geometryB: Arc3d,
  numExpectedIntersections: number,
  numExpectedPerpCloseApproach: number,
) {
  const existsInIntersectionSetWithTolerance = (set: Set<Point3d>, point: Point3d, tolerance: number = 1e-6): boolean => {
    for (const pt of set)
      if (pt.isAlmostEqual(point, tolerance))
        return true;
    return false;
  };
  const existsInApproachSetWithTolerance = (
    set: Set<[Point3d, Point3d]>, point0: Point3d, point1: Point3d, tolerance: number = 1e-6,
  ): boolean => {
    for (const startEnd of set) {
      const start = startEnd[0];
      const end = startEnd[1];
      if ((start.isAlmostEqual(point0, tolerance) && end.isAlmostEqual(point1, tolerance)) ||
        (start.isAlmostEqual(point1, tolerance) && end.isAlmostEqual(point0, tolerance)))
        return true;
    }
    return false;
  };
  const maxDistance = 50;
  let dy = 0;
  for (let angle = 0; angle < 360; angle += 10) {
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryA, 0, dy);
    const rotationAxis: Vector3d = Vector3d.create(0, 0, 1);
    const rotationMatrix = Matrix3d.createRotationAroundVector(rotationAxis, Angle.createDegrees(angle))!;
    const rotationTransform = Transform.createFixedPointAndMatrix(Point3d.create(0, 0, 0), rotationMatrix);
    geometryB.tryTransformInPlace(rotationTransform);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryB, 0, dy);
    const approaches = CurveCurve.closeApproachProjectedXYPairs(geometryA, geometryB, maxDistance);
    let numUniqueIntersections = 0;
    let numUniquePerpCloseApproach = 0;
    const intersectionSet = new Set<Point3d>();
    const approachSet = new Set<[Point3d, Point3d]>();
    const approachLen = approaches.length;
    ck.testLE(0, approachLen);
    if (approachLen > 0) {
      for (const ap of approaches) {
        const start = ap.detailA.point;
        const end = ap.detailB.point;
        if (start.isAlmostEqual(end)) { // intersection between geometries
          GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, start, 0.0625, 0, dy);
          if (!existsInIntersectionSetWithTolerance(intersectionSet, start, 1e-6)) {
            intersectionSet.add(start); // add unique intersections to set
            numUniqueIntersections++;
          }
        } else { // closest approach between geometries
          const approachSegment = LineSegment3d.create(start, end);
          const lenSqr = start.distanceSquaredXY(end);
          ck.testLE(
            Math.sqrt(lenSqr), maxDistance, undefined, undefined, "approach length must be smaller than maxDistance",
          );
          const vec1 = Vector3d.createStartEnd(start, end);
          const vec2 = geometryA.fractionToPointAndDerivative(ap.detailA.fraction).direction;
          const vec3 = geometryB.fractionToPointAndDerivative(ap.detailB.fraction).direction;
          GeometryCoreTestIO.captureGeometry(allGeometry, approachSegment, 0, dy);
          if (vec1.isPerpendicularTo(vec2) && vec1.isPerpendicularTo(vec3) &&
            !existsInApproachSetWithTolerance(approachSet, start, end, 1e-6)) {
            approachSet.add([start, end]); // add unique close approach to set
            numUniquePerpCloseApproach++;
          }
        }
      }
    }
    ck.testExactNumber(numExpectedIntersections, numUniqueIntersections);
    ck.testExactNumber(numExpectedPerpCloseApproach, numUniquePerpCloseApproach);
    dy += 25;
  }
}

function captureCloseApproaches(
  allGeometry: GeometryQuery[], approaches: CurveLocationDetailPair[], dx: number = 0, dy: number = 0, dz: number = 0) {
  if (approaches.length > 0) {
    for (const ap of approaches) {
      const start = ap.detailA.point;
      const end = ap.detailB.point;
      if (start.isAlmostEqual(end)) // intersection between geometries
        GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, start, 5, dx, dy, dz);
      else { // close approach between geometries
        const approachSegment = LineSegment3d.create(start, end);
        GeometryCoreTestIO.captureGeometry(allGeometry, approachSegment, dx, dy, dz);
      }
    }
  }
}

function visualizeAndTestSpiralCloseApproaches(
  ck: Checker, allGeometry: GeometryQuery[], testIndex: number,
  curve0: AnyCurve, curve1: AnyCurve, maxDistance: number,
  numExpected: number, dx: number, dy: number,
) {
  GeometryCoreTestIO.captureCloneGeometry(allGeometry, curve0, dx, dy);
  GeometryCoreTestIO.captureCloneGeometry(allGeometry, curve1, dx, dy);
  if (curve0 instanceof TransitionSpiral3d)
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, curve0.activeStrokes, dx, dy);
  if (curve1 instanceof TransitionSpiral3d)
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, curve1.activeStrokes, dx, dy);

  const testSpiralIntersection = (intersections: CurveLocationDetailPair[], lift: boolean = false): void => {
    captureCloseApproaches(allGeometry, intersections, dx, dy, lift ? 20 : 0);
    const curveName0 = curve0 instanceof TransitionSpiral3d ? curve0.spiralType : curve0.constructor.name;
    const curveName1 = curve1 instanceof TransitionSpiral3d ? curve1.spiralType : curve1.constructor.name;
    ck.testExactNumber(
      numExpected,
      intersections.length,
      `test #${testIndex}: expect ${numExpected} close approach(es) between ${curveName0} and ${curveName1}`,
    );
  };

  const closeApproachesAB = CurveCurve.closeApproachProjectedXYPairs(curve0, curve1, maxDistance);
  testSpiralIntersection(closeApproachesAB);
  const closeApproachesBA = CurveCurve.closeApproachProjectedXYPairs(curve1, curve0, maxDistance);
  testSpiralIntersection(closeApproachesBA, true);

  if (ck.testExactNumber(closeApproachesAB.length, closeApproachesBA.length, "close approach count should be the same regardless of order")) {
    closeApproachesAB.sort(CurveLocationDetailPair.comparePairsByPoints(undefined, true));
    closeApproachesBA.forEach((pair) => pair.swapDetails());
    closeApproachesBA.sort(CurveLocationDetailPair.comparePairsByPoints(undefined, true));
    for (let i = 0; i < closeApproachesAB.length; i++) {
      ck.testPoint3d(closeApproachesAB[i].detailA.point, closeApproachesBA[i].detailA.point, "detailA points are the same");
      ck.testPoint3d(closeApproachesAB[i].detailB.point, closeApproachesBA[i].detailB.point, "detailB points are the same");
    }
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
    expect(ck.getNumErrors()).toBe(0);
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
    expect(ck.getNumErrors()).toBe(0);
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
    expect(ck.getNumErrors()).toBe(0);
  });
  it("LineLineString", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const geometryA = LineString3d.create([1, 2], [3, 4], [4, 3]);
    testVaryingLineSegments(
      ck, allGeometry, geometryA, geometryA.startPoint(), geometryA.fractionToPoint(0.5), geometryA.endPoint(),
    );
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveCloseApproachXY", "LineLineString");
    expect(ck.getNumErrors()).toBe(0);
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
    expect(ck.getNumErrors()).toBe(0);
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
    expect(ck.getNumErrors()).toBe(0);
  });
  it("LineArc", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const geometryA = Arc3d.createCircularStartMiddleEnd(
      Point3d.create(1, 2), Point3d.create(3, 3.5), Point3d.create(5, 2),
    );
    testVaryingLineSegments(
      ck, allGeometry, geometryA, geometryA.startPoint(), geometryA.fractionToPoint(0.5), geometryA.endPoint(),
    );
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveCloseApproachXY", "LineArc");
    expect(ck.getNumErrors()).toBe(0);
  });
  it("SingleLineArc1", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const maxDistance = 2.5;
    const geometryA = Arc3d.createCircularStartMiddleEnd(
      Point3d.create(-2, 0), Point3d.create(0, 2), Point3d.create(2, 0),
    );
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
    expect(ck.getNumErrors()).toBe(0);
  });
  it("SingleLineArc2", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const maxDistance = 4;
    const geometryA = Arc3d.createCircularStartMiddleEnd(
      Point3d.create(-2, 0, 0), Point3d.create(0, 2, -2), Point3d.create(2, 0, -4),
    );
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
    expect(ck.getNumErrors()).toBe(0);
  });
  it("SingleLineArc3", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const maxDistance = 2.5;
    const geometryA = Arc3d.create(
      Point3d.create(0, 0), Vector3d.create(2, 0), Vector3d.create(0, 3), AngleSweep.createStartEndRadians(0, Math.PI),
    );
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
    expect(ck.getNumErrors()).toBe(0);
  });
  it("SingleLineArc4", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const maxDistance = 3;
    const geometryA = Arc3d.createCircularStartMiddleEnd(Point3d.create(1, 2), Point3d.create(3, 3.5), Point3d.create(5, 2));
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
    expect(ck.getNumErrors()).toBe(0);
  });
  it("LinePath1", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const arc = Arc3d.createCircularStartMiddleEnd(Point3d.create(1, 2), Point3d.create(3, 3.5), Point3d.create(5, 2));
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
    expect(ck.getNumErrors()).toBe(0);
  });
  it("LinePath2", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const shift = 10;
    const maxDistance = 5;
    const geometryA = LineSegment3d.createXYZXYZ(4, 4, 3, 7, 4, 5);
    // line string
    const geometryB1 = LineString3d.create([1, 0, 1], [2, 3, 1], [3, 0, 1], [4, 2, 1], [5, 0, 1], [6, 3, -2], [7, 0, 1]);
    // same line string as path of segments
    const geometryB2 = Path.create(...geometryB1.collectCurvePrimitives(undefined, false, true));
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, [geometryA, geometryB1]);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, [geometryA, geometryB2], shift, 0);

    const approaches1 = CurveCurve.closeApproachProjectedXYPairs(geometryA, geometryB1, maxDistance);
    const approaches2 = CurveCurve.closeApproachProjectedXYPairs(geometryA, geometryB2, maxDistance);
    const approach1Len = approaches1.length;
    if (ck.testLE(3, approach1Len, "expect at least 3 approaches between line and line string")) {
      for (const ap of approaches1) {
        const start = ap.detailA.point;
        const end = ap.detailB.point;
        if (start.isAlmostEqual(end)) // intersection
          GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, start, 0.0625);
        else {
          ck.testLE(start.distanceXY(end), maxDistance, "approach length must be smaller than maxDistance");
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, [start, end]);
        }
      }
    }
    const approach2Len = approaches2.length;
    if (ck.testLE(3, approach2Len, "expect at least 3 approaches between line and path of segments")) {
      for (const ap of approaches2) {
        const start = ap.detailA.point;
        const end = ap.detailB.point;
        if (start.isAlmostEqual(end)) // intersection
          GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, start, 0.0625);
        else {
          ck.testLE(start.distanceXY(end), maxDistance, "approach length must be smaller than maxDistance");
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, [start, end], shift, 0);
        }
      }
    }
    // NOTE: we know the approach arrays are sorted by points, so we can compare the points in pair order
    if (ck.testExactNumber(approach1Len, approach2Len, "approach count for line string and path of segments should be the same")) {
      for (let i = 0; i < approach1Len; i++) {
        ck.testPoint3d(approaches1[i].detailA.point, approaches2[i].detailA.point, ["failed for approach1 index: ", i]);
        ck.testPoint3d(approaches1[i].detailB.point, approaches2[i].detailB.point, ["failed for approach2 index: ", i]);
      }
    }
    // test the convenience method
    const closestApproach1 = CurveCurve.closestApproachProjectedXYPair(geometryA, geometryB1);
    const closestApproach2 = CurveCurve.closestApproachProjectedXYPair(geometryA, geometryB2);
    ck.testDefined(closestApproach1, "found the closest approach between line and line string");
    ck.testDefined(closestApproach2, "found the closest approach between line and path of segments");
    const detailA1 = closestApproach1!.detailA;
    const detailB1 = closestApproach1!.detailB;
    const detailA2 = closestApproach2!.detailA;
    const detailB2 = closestApproach2!.detailB;
    ck.testCoordinate(detailA1.fraction, 2 / 3, "found expected fraction of closest approach on the line (to B1)");
    ck.testCoordinate(detailB1.fraction, 5 / 6, "found expected fraction of closest approach on the line string");
    ck.testCoordinate(detailA2.fraction, 2 / 3, "found expected fraction of closest approach on the line (to B2)");
    ck.testCoordinate(detailB2.fraction, 1, "found expected fraction of closest approach on a segment of the path");
    const minLen1 = detailA1.point.distanceXY(detailB1.point);
    const minLen2 = detailA2.point.distanceXY(detailB2.point);
    const expectedMinLen = 1;
    ck.testLE(minLen1, maxDistance, "closest approach length (to B1) must be smaller than maxDistance");
    ck.testLE(minLen2, maxDistance, "closest approach length (to B2) must be smaller than maxDistance");
    ck.testCoordinate(minLen1, expectedMinLen, "closest approach length (to B1) as expected");
    ck.testCoordinate(minLen2, expectedMinLen, "closest approach length (to B2) as expected");
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveCloseApproachXY", "LinePath2");
    expect(ck.getNumErrors()).toBe(0);
  });
  it("LineLoop1", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const arc = Arc3d.createCircularStartMiddleEnd(Point3d.create(1, 2), Point3d.create(3, 3.5), Point3d.create(5, 2));
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
    expect(ck.getNumErrors()).toBe(0);
  });
  it("LineLoop2", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const shift = 10;
    const maxDistance = 10;
    const geometryA = LineSegment3d.createXYZXYZ(4, 5, 3, 7, 5, 5);
    // line string
    const geometryB1 = LineString3d.create([[1, 0], [2, 3], [3, 0], [4, 2], [5, 0], [6, 3], [7, -2], [1, 0]]);
    // same line string as loop of line segments
    const geometryB2 = Loop.create(...geometryB1.collectCurvePrimitives(undefined, false, true));
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, [geometryA, geometryB1]);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, [geometryA, geometryB2], shift, 0);

    const approaches1 = CurveCurve.closeApproachProjectedXYPairs(geometryA, geometryB1, maxDistance);
    const approaches2 = CurveCurve.closeApproachProjectedXYPairs(geometryA, geometryB2, maxDistance);
    const approach1Len = approaches1.length;
    if (ck.testLE(4, approach1Len, "expect at least 4 approaches between line and line string")) {
      for (const ap of approaches1) {
        const start = ap.detailA.point;
        const end = ap.detailB.point;
        if (start.isAlmostEqual(end)) // intersection
          GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, start, 0.0625);
        else {
          ck.testLE(start.distanceXY(end), maxDistance, "approach length must be smaller than maxDistance");
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, [start, end]);
        }
      }
    }
    const approach2Len = approaches2.length;
    if (ck.testLE(4, approach2Len, "expect at least 4 approaches between line and path of segments")) {
      for (const ap of approaches2) {
        const start = ap.detailA.point;
        const end = ap.detailB.point;
        if (start.isAlmostEqual(end)) // intersection
          GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, start, 0.0625);
        else {
          ck.testLE(start.distanceXY(end), maxDistance, "approach length must be smaller than maxDistance");
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, [start, end], shift, 0);
        }
      }
    }
    // NOTE: we know the approach arrays are sorted by points, so we can compare the points in pair order
    if (ck.testExactNumber(approach1Len, approach2Len, "approach count for line string and path of segments should be the same")) {
      for (let i = 0; i < approach1Len; i++) {
        ck.testPoint3d(approaches1[i].detailA.point, approaches2[i].detailA.point, ["failed for approach1 index: ", i]);
        ck.testPoint3d(approaches1[i].detailB.point, approaches2[i].detailB.point, ["failed for approach2 index: ", i]);
      }
    }
    // test the convenience method
    const closestApproach1 = CurveCurve.closestApproachProjectedXYPair(geometryA, geometryB1);
    const closestApproach2 = CurveCurve.closestApproachProjectedXYPair(geometryA, geometryB2);
    ck.testDefined(closestApproach1, "found the closest approach between line and line string");
    ck.testDefined(closestApproach2, "found the closest approach between line and path of segments");
    const detailA1 = closestApproach1!.detailA;
    const detailB1 = closestApproach1!.detailB;
    const detailA2 = closestApproach2!.detailA;
    const detailB2 = closestApproach2!.detailB;
    ck.testCoordinate(detailA1.fraction, 2 / 3, "found expected fraction of closest approach on the line (to B1)");
    ck.testCoordinate(detailB1.fraction, 5 / 7, "found expected fraction of closest approach on the line string");
    ck.testCoordinate(detailA2.fraction, 2 / 3, "found expected fraction of closest approach on the line (to B2)");
    ck.testCoordinate(detailB2.fraction, 1, "found expected fraction of closest approach on a segment of the path");
    const minLen1 = detailA1.point.distanceXY(detailB1.point);
    const minLen2 = detailA2.point.distanceXY(detailB2.point);
    const expectedMinLen = 2;
    ck.testLE(minLen1, maxDistance, "closest approach length (to B1) must be smaller than maxDistance");
    ck.testLE(minLen2, maxDistance, "closest approach length (to B2) must be smaller than maxDistance");
    ck.testCoordinate(minLen1, expectedMinLen, "closest approach length (to B1) as expected");
    ck.testCoordinate(minLen2, expectedMinLen, "closest approach length (to B2) as expected");
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveCloseApproachXY", "LineLoop2");
    expect(ck.getNumErrors()).toBe(0);
  });
  it("ArcArc", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const arcA = Arc3d.createCircularStartMiddleEnd(Point3d.create(1, 2), Point3d.create(3, 3.5), Point3d.create(5, 2));
    const arcB = Arc3d.createCircularStartMiddleEnd(Point3d.create(3, 2), Point3d.create(-1, 1.5), Point3d.create(0, -2));
    testVaryingSubsets(ck, allGeometry, arcA, arcB);
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveCloseApproachXY", "ArcArc");
    expect(ck.getNumErrors()).toBe(0);
  });
  it("ArcArcFar", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const arcA = Arc3d.createXY(Point3d.create(1, 1), 1.5);
    const arcB = Arc3d.createXY(Point3d.create(5, 2), 2);
    testVaryingSubsets(ck, allGeometry, arcA, arcB, 1);
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveCloseApproachXY", "ArcArcFar");
    expect(ck.getNumErrors()).toBe(0);
  });
  it("ArcArcInside", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const maxDistance = 2;
    const arcA = Arc3d.createXY(Point3d.create(1, 1), 5);
    const arcB = Arc3d.createXY(Point3d.create(2, 3), 2);
    testVaryingSubsets(ck, allGeometry, arcA, arcB, maxDistance);
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveCloseApproachXY", "ArcArcInside");
    expect(ck.getNumErrors()).toBe(0);
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
    expect(ck.getNumErrors()).toBe(0);
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
    expect(ck.getNumErrors()).toBe(0);
  });
  it("SingleArcArc3", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const maxDistance = 6;
    const geometryA = Arc3d.create(Point3d.create(-1, 0), Vector3d.create(2, 0), Vector3d.create(0, 1)); // non-circular arc
    const geometryB = Arc3d.create(Point3d.create(4, 0), Vector3d.create(2, 0), Vector3d.create(0, 2)); // circular arc
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, [geometryA, geometryB]);

    const approaches = CurveCurve.closeApproachProjectedXYPairs(geometryA, geometryB, maxDistance);
    ck.testExactNumber(3, approaches.length, "expect 3 close approaches between the ellipses");
    for (const approach of approaches) {
      const approachSegment = LineSegment3d.create(approach.detailA.point, approach.detailB.point);
      const approachDistance = approachSegment.curveLength(); // same as xy-length since geometry is in a horizontal plane
      ck.testLE(approachDistance, maxDistance, undefined, "approach length must not exceed maxDistance");
      GeometryCoreTestIO.captureGeometry(allGeometry, approachSegment);
    }
    // test the convenience method
    const closestApproach = CurveCurve.closestApproachProjectedXYPair(geometryA, geometryB);
    ck.testDefined(closestApproach);
    const detailA = closestApproach!.detailA;
    const detailB = closestApproach!.detailB;
    ck.testCoordinate(detailA.fraction, 0);
    ck.testCoordinate(detailB.fraction, 0.5);
    ck.testCoordinate(detailA.a, 1, "closest approach is 1.0");
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveCloseApproachXY", "SingleArcArc3");
    expect(ck.getNumErrors()).toBe(0);
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
    expect(ck.getNumErrors()).toBe(0);
  });
  it("2EllipsesWithIntersection", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const geometryA = Arc3d.create(Point3d.create(0, 0), Vector3d.create(15, 0), Vector3d.create(0, 5));
    const geometryB = Arc3d.create(Point3d.create(0, 0), Vector3d.create(7, 0), Vector3d.create(0, 10));
    const numExpectedIntersections = 4;
    const numExpectedPerpCloseApproach = 8;
    test2Ellipses(ck, allGeometry, geometryA, geometryB, numExpectedIntersections, numExpectedPerpCloseApproach);
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveCloseApproachXY", "2EllipsesWithIntersection");
    expect(ck.getNumErrors()).toBe(0);
  });
  it("2EllipsesWithoutIntersection", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const geometryA = Arc3d.create(Point3d.create(0, 0), Vector3d.create(15, 0), Vector3d.create(0, 10));
    const geometryB = Arc3d.create(Point3d.create(0, 0), Vector3d.create(5, 0), Vector3d.create(0, 8));
    const numExpectedIntersections = 0;
    const numExpectedPerpCloseApproach = 8;
    test2Ellipses(ck, allGeometry, geometryA, geometryB, numExpectedIntersections, numExpectedPerpCloseApproach);
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveCloseApproachXY", "2EllipsesWithoutIntersection");
    expect(ck.getNumErrors()).toBe(0);
  });
  it("2EllipsesWithDifferentCenters", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const geometryA = Arc3d.create(Point3d.create(0, 0), Vector3d.create(3, 0), Vector3d.create(0, 5));
    const geometryB = Arc3d.create(Point3d.create(0, 1), Vector3d.create(15, 0), Vector3d.create(0, 1));
    const numExpectedIntersections = 4;
    const numExpectedPerpCloseApproach = 8;
    test2Ellipses(ck, allGeometry, geometryA, geometryB, numExpectedIntersections, numExpectedPerpCloseApproach);
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveCloseApproachXY", "2EllipsesWithDifferentCenters");
    expect(ck.getNumErrors()).toBe(0);
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
    expect(ck.getNumErrors()).toBe(0);
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
    expect(ck.getNumErrors()).toBe(0);
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
    expect(ck.getNumErrors()).toBe(0);
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
    expect(ck.getNumErrors()).toBe(0);
  });
  it("LineStringLineString", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const cpA = LineString3d.create([1, 2], [5, 2], [3, 5]);
    const cpB = LineString3d.create([1, 3], [4, 2.5], [6, 4]);
    testVaryingSubsets(ck, allGeometry, cpA, cpB);
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveCloseApproachXY", "LineStringLineString");
    expect(ck.getNumErrors()).toBe(0);
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
    expect(ck.getNumErrors()).toBe(0);
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
    expect(ck.getNumErrors()).toBe(0);
  });
  it("ArcLineString", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const cpA = Arc3d.createCircularStartMiddleEnd(Point3d.create(1, 2), Point3d.create(3, 3.5), Point3d.create(5, 2));
    const cpB = LineString3d.create([1, 3], [4, 2.5], [6, 4]);
    testVaryingSubsets(ck, allGeometry, cpA, cpB, 2);
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveCloseApproachXY", "ArcLineString");
    expect(ck.getNumErrors()).toBe(0);
  });
  it("SingleArcLineString", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const maxDistance = 3;
    const geometryA = Arc3d.createCircularStartMiddleEnd(Point3d.create(1, 2), Point3d.create(3, 3.5), Point3d.create(5, 2));
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
    expect(ck.getNumErrors()).toBe(0);
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
    expect(ck.getNumErrors()).toBe(0);
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
    );
    testVaryingSubsets(ck, allGeometry, cpA, cpB, 2, [0, 1]);
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveCloseApproachXY", "BsplineArc");
    allGeometry.length = 0;
    testVaryingSubsets(ck, allGeometry, cpB, cpA, 2, [0, 1]);
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveCloseApproachXY", "ArcBspline");
    allGeometry.length = 0;
    const cpB1 = Arc3d.createCircularStartMiddleEnd(
      Point3d.create(1, -1), Point3d.create(4, 0), Point3d.create(6, -1),
    );
    testVaryingSubsets(ck, allGeometry, cpA, cpB1, 2, [0, 1]);
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveCloseApproachXY", "BsplineArcB");
    expect(ck.getNumErrors()).toBe(0);
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
    expect(ck.getNumErrors()).toBe(0);
  });
  it("PathPath", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const maxDistance = 5;
    // path1
    const arc1 = Arc3d.createCircularStartMiddleEnd(Point3d.create(1, 5), Point3d.create(3, 6.5), Point3d.create(5, 5));
    const lineString1 = LineString3d.create([5, 5], [6, 3], [7, 5], [10, 3]);
    const lineSegment1 = LineSegment3d.create(Point3d.create(10, 3), Point3d.create(1, 5));
    const geometryA = Path.create();
    geometryA.tryAddChild(arc1);
    geometryA.tryAddChild(lineString1);
    geometryA.tryAddChild(lineSegment1);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryA);
    // path2
    const arc2 = Arc3d.createCircularStartMiddleEnd(Point3d.create(0, -2), Point3d.create(2, -3.5), Point3d.create(4, -2));
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
    expect(ck.getNumErrors()).toBe(0);
  });
  it("LoopLoop", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const maxDistance = 5;
    // loop1
    const arc1 = Arc3d.createCircularStartMiddleEnd(Point3d.create(1, 5), Point3d.create(3, 6.5), Point3d.create(5, 5));
    const lineSegment1 = LineSegment3d.create(Point3d.create(5, 5), Point3d.create(7, 7));
    const lineString1 = LineString3d.create([7, 7], [5, 3], [1, 5]);
    const geometryA = Loop.create();
    geometryA.tryAddChild(arc1);
    geometryA.tryAddChild(lineSegment1);
    geometryA.tryAddChild(lineString1);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryA);
    // loop2
    const arc2 = Arc3d.createCircularStartMiddleEnd(Point3d.create(0, -2), Point3d.create(2, -3.5), Point3d.create(4, -2));
    const lineString2 = LineString3d.create([4, -2], [6, -3], [8, -2], [10, 2]);
    const lineSegment2 = LineSegment3d.create(Point3d.create(10, 2), Point3d.create(0, -2));
    const geometryB = Loop.create();
    geometryB.tryAddChild(arc2);
    geometryB.tryAddChild(lineString2);
    geometryB.tryAddChild(lineSegment2);
    geometryB.tryTranslateInPlace(-3, 12, 5);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryB);
    // find approaches
    const approaches = CurveCurve.closeApproachProjectedXYPairs(geometryA, geometryB, maxDistance);
    ck.testTrue(0 < approaches.length, "found at least one close approach");
    for (const ap of approaches) {
      const approachSegment = LineSegment3d.create(ap.detailA.point, ap.detailB.point);
      const trueDist = approachSegment.curveLength();
      const xyDist = approachSegment.point0Ref.distanceXY(approachSegment.point1Ref);
      ck.testTrue(xyDist > Geometry.smallMetricDistance, "geometries do not intersect");
      ck.testLE(xyDist, trueDist, "approach distance ignores z");
      ck.testLE(xyDist, maxDistance, "approach distance is no more than maxDistance");
      GeometryCoreTestIO.captureGeometry(allGeometry, approachSegment);
    }
    // test the convenience method
    const closestApproach = CurveCurve.closestApproachProjectedXYPair(geometryA, geometryB);
    if (ck.testDefined(closestApproach, "found closest approach")) {
      GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, closestApproach.detailA.point, 0.06);
      GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, closestApproach.detailB.point, 0.06);
      const xyDist = closestApproach.detailA.point.distanceXY(closestApproach.detailB.point);
      ck.testLE(xyDist, maxDistance, "closest approach distance is no more than maxDistance");
      ck.testCoordinate(xyDist, 2.5, "found expected closest approach distance");
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveCloseApproachXY", "LoopLoop");
    expect(ck.getNumErrors()).toBe(0);
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
    expect(ck.getNumErrors()).toBe(0);
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
    expect(ck.getNumErrors()).toBe(0);
  });
  it("LineBagOfCurves", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const maxDistance = 5;
    const geometryA = LineSegment3d.createXYZXYZ(7, 6, 0, 12, 7, 0);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, geometryA);
    // bag of curves
    const arc1 = Arc3d.createCircularStartMiddleEnd(Point3d.create(1, 5), Point3d.create(3, 6.5), Point3d.create(5, 5));
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
    expect(ck.getNumErrors()).toBe(0);
  });
  it("SpiralCloseApproach", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    let dx = 0;
    let dy = 0;

    const rotationTransform0 = Transform.createFixedPointAndMatrix(
      Point3d.create(70, 0),
      Matrix3d.createRotationAroundVector(Vector3d.create(0, 0, 1), Angle.createDegrees(180))!,
    );
    const rotationTransform1 = Transform.createFixedPointAndMatrix(
      Point3d.create(0, 0),
      Matrix3d.createRotationAroundVector(Vector3d.create(0, 1, 0), Angle.createDegrees(45))!,
    );
    const moveTransform = Transform.createTranslationXYZ(0, 0, 10);
    const compositeTransform = Transform.createZero();
    compositeTransform.setMultiplyTransformTransform(rotationTransform0, moveTransform);
    compositeTransform.setMultiplyTransformTransform(rotationTransform1, compositeTransform);
    // integrated spirals
    const integratedSpirals: TransitionSpiral3d[] = [];
    const integratedSpiralsTransformed: TransitionSpiral3d[] = [];
    const r0 = 0;
    const r1 = 50;
    const activeInterval = Segment1d.create(0, 1);
    for (const integratedSpiralType of ["clothoid", "bloss", "biquadratic", "sine", "cosine"]) {
      for (const transform of [
        Transform.createIdentity(),
        rotationTransform0, // indices (n*i)+1
        compositeTransform, // indices (n*i)+2
      ]) {
        const spiral = IntegratedSpiral3d.createRadiusRadiusBearingBearing(
          Segment1d.create(r0, r1),
          AngleSweep.createStartEndDegrees(0, 120),
          activeInterval,
          transform,
          integratedSpiralType,
        );
        if (ck.testDefined(spiral, "successfully created integrated spiral")) {
          if (transform.isIdentity)
            integratedSpirals.push(spiral);
          else
            integratedSpiralsTransformed.push(spiral);
        }
      }
    }
    // direct spirals
    const directSpirals: TransitionSpiral3d[] = [];
    const directSpiralsTransformed: TransitionSpiral3d[] = [];
    const length = 100;
    for (const directSpiralType of [
      "Arema",
      "JapaneseCubic",
      "ChineseCubic",
      "WesternAustralian",
      "HalfCosine",
      "AustralianRailCorp",
      // TODO: enable below lines after https://github.com/iTwin/itwinjs-backlog/issues/1693 is resolved
      // "Czech",
      // "Italian",
      // "MXCubicAlongArc",
      // "Polish",
    ]) {
      for (const transform of [
        Transform.createIdentity(),
        rotationTransform0, // indices (n*i)+1
        compositeTransform, // indices (n*i)+2
      ]) {
        const spiral = DirectSpiral3d.createFromLengthAndRadius(
          directSpiralType, r0, r1, undefined, undefined, length, activeInterval, transform,
        );
        if (ck.testDefined(spiral, "successfully created direct spiral")) {
          if (transform.isIdentity)
            directSpirals.push(spiral);
          else
            directSpiralsTransformed.push(spiral);
        }
      }
    }
    // curve primitives
    const lineSegment0 = LineSegment3d.create(Point3d.create(70, 30), Point3d.create(70, -30));
    const lineSegment1 = LineSegment3d.create(Point3d.create(20, -40), Point3d.create(130, 30));
    const lineSegment2 = LineSegment3d.create(Point3d.create(-20, 0), Point3d.create(100, 0));
    const lineString0 = LineString3d.create(
      Point3d.create(10, -80), Point3d.create(40, -20), Point3d.create(100, -5),
      Point3d.create(80, 10), Point3d.create(150, -10),
    );
    const arc0 = Arc3d.createXY(Point3d.create(50, 50), 25);
    const arc1 = Arc3d.createXY(Point3d.create(0, -30), 30);
    const bspline0 = BSplineCurve3d.createUniformKnots(
      [
        Point3d.create(0, -20, 0),
        Point3d.create(20, -20, 0),
        Point3d.create(50, -10, 0),
        Point3d.create(80, 0, 0),
        Point3d.create(100, 0, 0),
      ],
      3,
    )!;
    // curve collection (path-loop), curve chain, and bag of curves
    const lineString1 = LineString3d.create(Point3d.create(50, -30.95), Point3d.create(50, 10), Point3d.create(37.58770483, 6.31919427));
    const arc2 = Arc3d.create(
      Point3d.create(0, 20), Vector3d.create(40, 0), Vector3d.create(0, 40), AngleSweep.createStartEndDegrees(340, 0),
    );
    const arc3 = Arc3d.create(
      Point3d.create(70, -40), Vector3d.create(20, 0), Vector3d.create(0, 20), AngleSweep.createStartEndDegrees(0, -180),
    );
    const lineString3 = LineString3d.create(Point3d.create(50, -40), Point3d.create(0, -40), Point3d.create(0, 0));
    const lineString2 = LineString3d.create(Point3d.create(40, 20), Point3d.create(50, 20), Point3d.create(58, 26));
    const lineSegment3 = LineSegment3d.create(Point3d.create(58, 26), Point3d.create(140, 0));
    const lineSegment4 = LineSegment3d.create(Point3d.create(60, -50), Point3d.create(90, -40));
    const path0 = Path.create(arc2, lineString2, lineSegment3, directSpiralsTransformed[0]);
    const path1 = Path.create(lineSegment4, arc3, lineString3, directSpirals[0]);
    const loop = Loop.create(lineString1, arc2, lineString2, lineSegment3, directSpiralsTransformed[0]);
    const curveChain0 = CurveChainWithDistanceIndex.createCapture(path0);
    const curveChain1 = CurveChainWithDistanceIndex.createCapture(path1);
    const bagOfCurves = BagOfCurves.create(path0, arc0, lineString0);

    const curves: AnyCurve[] = [
      path0,
      loop,
      curveChain0,
      bagOfCurves,
      lineSegment0,
      lineSegment1,
      lineSegment2,
      lineString0,
      arc0,
      arc1,
      bspline0,
      ...integratedSpiralsTransformed,
      ...directSpiralsTransformed,
    ];

    // each spiral-curve close approach test has its own expected # close approaches. One size does not fit all.
    const maxDistance = 23;
    // in integratedData and directData triples, the first two numbers are indices and the third number is
    // the expected number of close approaches between the curve at those indices.
    const integratedData = new Dictionary<[number, number], number>(compareSimpleArrays);
    const directData = new Dictionary<[number, number], number>(compareSimpleArrays);
    for (const triple of [
      [0, 0, 8], [0, 1, 10], [0, 2, 8], [0, 3, 15], [0, 4, 1], [0, 5, 2], [0, 6, 3], [0, 7, 6], [0, 8, 1], [0, 9, 1], [0, 10, 3],
      [0, 11, 1], [0, 12, 2], [0, 13, 1], [0, 14, 2], [0, 15, 1], [0, 16, 2], [0, 17, 2], [0, 18, 2], [0, 19, 1], [0, 20, 2],
      [0, 21, 1], [0, 22, 2], [0, 23, 1], [0, 24, 2], [0, 25, 1], [0, 26, 2], [0, 27, 1], [0, 28, 2], [0, 29, 1], [0, 30, 2], [0, 31, 1], [0, 32, 2],
      [1, 0, 7], [1, 1, 9], [1, 2, 7], [1, 3, 13], [1, 4, 1], [1, 5, 2], [1, 6, 3], [1, 7, 6], [1, 8, 0], [1, 9, 1], [1, 10, 3],
      [1, 11, 1], [1, 12, 2], [1, 13, 1], [1, 14, 2], [1, 15, 1], [1, 16, 2], [1, 17, 2], [1, 18, 2], [1, 19, 1], [1, 20, 2],
      [1, 21, 1], [1, 22, 2], [1, 23, 1], [1, 24, 2], [1, 25, 1], [1, 26, 2], [1, 27, 1], [1, 28, 2], [1, 29, 1], [1, 30, 2], [1, 31, 2], [1, 32, 3],
      [2, 0, 7], [2, 1, 9], [2, 2, 7], [2, 3, 13], [2, 4, 1], [2, 5, 3], [2, 6, 3], [2, 7, 6], [2, 8, 0], [2, 9, 1], [2, 10, 3],
      [2, 11, 1], [2, 12, 2], [2, 13, 1], [2, 14, 2], [2, 15, 1], [2, 16, 2], [2, 17, 2], [2, 18, 2], [2, 19, 1], [2, 20, 2],
      [2, 21, 1], [2, 22, 2], [2, 23, 1], [2, 24, 2], [2, 25, 1], [2, 26, 2], [2, 27, 1], [2, 28, 2], [2, 29, 1], [2, 30, 2], [2, 31, 2], [2, 32, 3],
      [3, 0, 8], [3, 1, 10], [3, 2, 8], [3, 3, 14], [3, 4, 1], [3, 5, 3], [3, 6, 4 /* double intersection */], [3, 7, 6], [3, 8, 0], [3, 9, 1], [3, 10, 3],
      [3, 11, 2], [3, 12, 2], [3, 13, 2], [3, 14, 2], [3, 15, 2], [3, 16, 2], [3, 17, 3], [3, 18, 2], [3, 19, 2], [3, 20, 2],
      [3, 21, 2], [3, 22, 2], [3, 23, 2], [3, 24, 2], [3, 25, 2], [3, 26, 2], [3, 27, 2], [3, 28, 2], [3, 29, 2], [3, 30, 2], [3, 31, 3], [3, 32, 3],
      [4, 0, 7], [4, 1, 9], [4, 2, 7], [4, 3, 13], [4, 4, 1], [4, 5, 3], [4, 6, 4 /* double intersection */], [4, 7, 6], [4, 8, 0], [4, 9, 1], [4, 10, 3],
      [4, 11, 1], [4, 12, 2], [4, 13, 1], [4, 14, 2], [4, 15, 1], [4, 16, 2], [4, 17, 2], [4, 18, 2], [4, 19, 1], [4, 20, 2],
      [4, 21, 1], [4, 22, 2], [4, 23, 1], [4, 24, 2], [4, 25, 1], [4, 26, 2], [4, 27, 1], [4, 28, 2], [4, 29, 1], [4, 30, 2], [4, 31, 2], [4, 32, 3],
    ])
      integratedData.set([triple[0], triple[1]], triple[2]);
    for (const triple of [
      [0, 0, 9], [0, 1, 11], [0, 2, 9], [0, 3, 15], [0, 4, 3], [0, 5, 2], [0, 6, 2], [0, 7, 4], [0, 8, 2], [0, 9, 1], [0, 10, 2],
      [0, 11, 1], [0, 12, 1], [0, 13, 1], [0, 14, 1], [0, 15, 1], [0, 16, 1], [0, 17, 2], [0, 18, 1], [0, 19, 1], [0, 20, 1],
      [0, 21, 1], [0, 22, 1], [0, 23, 1], [0, 24, 1], [0, 25, 1], [0, 26, 1], [0, 27, 1], [0, 28, 1], [0, 29, 1], [0, 30, 1], [0, 31, 1], [0, 32, 1],
      [1, 0, 9], [1, 1, 11], [1, 2, 9], [1, 3, 13], [1, 4, 2], [1, 5, 2], [1, 6, 2], [1, 7, 3], [1, 8, 1], [1, 9, 1], [1, 10, 2],
      [1, 11, 1], [1, 12, 1], [1, 13, 1], [1, 14, 1], [1, 15, 1], [1, 16, 1], [1, 17, 2], [1, 18, 1], [1, 19, 1], [1, 20, 1],
      [1, 21, 1], [1, 22, 1], [1, 23, 1], [1, 24, 1], [1, 25, 1], [1, 26, 1], [1, 27, 1], [1, 28, 1], [1, 29, 1], [1, 30, 1], [1, 31, 1], [1, 32, 1],
      [2, 0, 9], [2, 1, 11], [2, 2, 9], [2, 3, 15], [2, 4, 3], [2, 5, 2], [2, 6, 2], [2, 7, 4], [2, 8, 2], [2, 9, 1], [2, 10, 2],
      [2, 11, 1], [2, 12, 1], [2, 13, 1], [2, 14, 1], [2, 15, 1], [2, 16, 1], [2, 17, 2], [2, 18, 1], [2, 19, 1], [2, 20, 1],
      [2, 21, 1], [2, 22, 1], [2, 23, 1], [2, 24, 1], [2, 25, 1], [2, 26, 1], [2, 27, 1], [2, 28, 1], [2, 29, 1], [2, 30, 1], [2, 31, 1], [2, 32, 1],
      [3, 0, 9], [3, 1, 11], [3, 2, 9], [3, 3, 14], [3, 4, 3], [3, 5, 1], [3, 6, 2], [3, 7, 3], [3, 8, 2], [3, 9, 1], [3, 10, 2],
      [3, 11, 1], [3, 12, 1], [3, 13, 1], [3, 14, 1], [3, 15, 1], [3, 16, 1], [3, 17, 2], [3, 18, 1], [3, 19, 1], [3, 20, 1],
      [3, 21, 1], [3, 22, 1], [3, 23, 1], [3, 24, 1], [3, 25, 1], [3, 26, 1], [3, 27, 1], [3, 28, 1], [3, 29, 1], [3, 30, 1], [3, 31, 1], [3, 32, 1],
      [4, 0, 9], [4, 1, 11], [4, 2, 9], [4, 3, 13], [4, 4, 2], [4, 5, 2], [4, 6, 5 /* triple intersection */], [4, 7, 3], [4, 8, 1], [4, 9, 1], [4, 10, 3],
      [4, 11, 1], [4, 12, 1], [4, 13, 1], [4, 14, 1], [4, 15, 1], [4, 16, 1], [4, 17, 2], [4, 18, 1], [4, 19, 1], [4, 20, 1],
      [4, 21, 1], [4, 22, 1], [4, 23, 1], [4, 24, 1], [4, 25, 1], [4, 26, 1], [4, 27, 1], [4, 28, 1], [4, 29, 1], [4, 30, 1], [4, 31, 1], [4, 32, 1],
      [5, 0, 9], [5, 1, 11], [5, 2, 9], [5, 3, 14], [5, 4, 2], [5, 5, 2], [5, 6, 4], [5, 7, 4], [5, 8, 1], [5, 9, 1], [5, 10, 4],
      [5, 11, 1], [5, 12, 2], [5, 13, 2], [5, 14, 2], [5, 15, 2], [5, 16, 2], [5, 17, 3], [5, 18, 2], [5, 19, 2], [5, 20, 2],
      [5, 21, 1], [5, 22, 2], [5, 23, 1], [5, 24, 2], [5, 25, 1], [5, 26, 2], [5, 27, 1], [5, 28, 2], [5, 29, 1], [5, 30, 2], [5, 31, 1], [5, 32, 2],
    ])
      directData.set([triple[0], triple[1]], triple[2]);
    ck.testCoordinate(integratedSpirals.length * curves.length, integratedData.size, "matching integrated arrays");
    ck.testCoordinate(directSpirals.length * curves.length, directData.size, "matching direct arrays");

    let testIndex = 0;
    const testCloseApproachSpiralCurve = (spirals: TransitionSpiral3d[], data: Dictionary<[number, number], number>) => {
      for (let i = 0; i < spirals.length; i++) {
        for (let j = 0; j < curves.length; j++) {
          const numExpected = data.get([i, j]);
          if (ck.testDefined(numExpected, "found data for spiral-curve pair"))
            visualizeAndTestSpiralCloseApproaches(ck, allGeometry, testIndex++, spirals[i], curves[j], maxDistance, numExpected, dx, dy);
          dy += 200;
        }
        dy = 0;
        dx += 200;
      }
    };
    testCloseApproachSpiralCurve(integratedSpirals, integratedData);
    dx += 250;
    testCloseApproachSpiralCurve(directSpirals, directData);

    dx = 0;
    dy = 7000;
    for (const pair of [[curveChain0, curveChain1], [path0, path1], [curveChain0, path1], [curveChain1, path0]]) {
      visualizeAndTestSpiralCloseApproaches(ck, allGeometry, testIndex++, pair[0], pair[1], maxDistance, 13, dx, dy);
      dy += 200;
    }

    // make sure closest approach can find spiral tangency intersections
    const testTangencyAtSpiralInterior = (spiral: TransitionSpiral3d) => {
      const ray = spiral.fractionToPointAndDerivative(0.55); // stroked spiral has a vertex at 0.5, so move slightly off to make Newton work harder
      const seg = LineString3d.create(ray.origin.plusScaled(ray.direction.normalize()!, 50), ray.origin.plusScaled(ray.direction.normalize()!, -50));
      const tangency = CurveCurve.closestApproachProjectedXYPair(spiral, seg);
      if (ck.testDefined(tangency, `found closest points between the ${spiral.spiralType} spiral and the line`)) {
        ck.testSmallRelative(tangency.detailA.a, `${spiral.spiralType} closest point is an intersection`);
        // spiral math is not exact, so we expect more slop than usual
        ck.testPoint3d(ray.origin, tangency.detailA.point, 10 * Geometry.smallMetricDistance, `${spiral.spiralType} closest point is at the tangency`);
      }
    };
    for (const spiral of integratedSpirals)
      testTangencyAtSpiralInterior(spiral);
    for (const spiral of directSpirals)
      testTangencyAtSpiralInterior(spiral);

    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveCloseApproachXY", "SpiralCloseApproach");
    expect(ck.getNumErrors()).toBe(0);
  });
  it("SpiralKnownCloseApproach", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];

    let x0 = 0;
    const seg = LineSegment3d.create(Point3d.create(20, -40), Point3d.create(130, 30));
    const spiral0 = IntegratedSpiral3d.createRadiusRadiusBearingBearing(Segment1d.create(0, 50), AngleSweep.createStartEndDegrees(0, 120), Segment1d.create(0, 1), Transform.createIdentity(), "clothoid");
    if (ck.testDefined(spiral0, "created spiral")) {
      const transforms = [Transform.createIdentity(), Transform.createTranslationXYZ(0, -9)];
      const numMinima = [1, 2];
      const minDist = [4.8129491110127436, 0]; // test against known minima
      const maxDist = [5, 2];
      const numTests = Math.min(transforms.length, numMinima.length, minDist.length, maxDist.length);
      for (let i = 0; i < numTests; ++i) {
        const spiral = spiral0.cloneTransformed(transforms[i]);
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, [seg, spiral], x0);
        const approaches = CurveCurve.closeApproachProjectedXYPairs(spiral, seg, maxDist[i]);
        captureCloseApproaches(allGeometry, approaches, x0);
        ck.testExactNumber(numMinima[i], approaches.length, "returned expected unique close approaches <= maxLength");
        for (const approach of approaches)
          ck.testCoordinate(minDist[i], approach.detailA.a, "all close approaches converged on the expected distance");
        x0 += 1.1 * spiral.curveLength();
      }
    }

    GeometryCoreTestIO.saveGeometry(allGeometry, "CurveCurveCloseApproachXY", "SpiralKnownCloseApproach");
    expect(ck.getNumErrors()).toBe(0);
  });
});
