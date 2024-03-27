/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { CoordinateXYZ } from "../../curve/CoordinateXYZ";
import { CurveLocationDetail, CurveLocationDetailPair } from "../../curve/CurveLocationDetail";
import { CurvePrimitive } from "../../curve/CurvePrimitive";
import { GeometryQuery } from "../../curve/GeometryQuery";
import { LineSegment3d } from "../../curve/LineSegment3d";
import { AxisOrder, Geometry } from "../../Geometry";
import { Matrix3d } from "../../geometry3d/Matrix3d";
import { Point3d, Vector3d } from "../../geometry3d/Point3dVector3d";
import { Range1d, Range3d } from "../../geometry3d/Range";
import { Transform } from "../../geometry3d/Transform";
import { Sample } from "../../serialization/GeometrySamples";
import { Checker } from "../Checker";
import { GeometryCoreTestIO } from "../GeometryCoreTestIO";

function exerciseLineSegment3d(ck: Checker, segmentA: LineSegment3d) {
  const a = 4.2;
  const scaleTransform = Transform.createFixedPointAndMatrix(Point3d.create(4, 3),
    Matrix3d.createScale(a, a, a));

  const segment0 = LineSegment3d.create(Point3d.create(), Point3d.create());
  const segmentB = segment0.clone(); // zeros!!
  const segmentC = segment0.clone(); // zeros!!
  const segmentD = segment0.clone(); // zeros!!
  ck.testFalse(segment0.isAlmostEqual(segmentA));
  ck.testTrue(segment0.isAlmostEqual(segmentB));
  ck.testTrue(segment0.isAlmostEqual(segmentC));
  ck.testTrue(segment0.isAlmostEqual(segmentD));

  segmentB.setFrom(segmentA);
  segmentC.set(segmentA.startPoint(), segmentA.endPoint());

  ck.testTrue(segmentA.isAlmostEqual(segmentB));
  ck.testTrue(segmentA.isAlmostEqual(segmentC));

  segmentD.setRefs(segmentB.point0Ref, segmentB.point1Ref);
  // now segment B and segment D share points!!!  Confirm that transformInPlace affects both
  segmentB.tryTransformInPlace(scaleTransform);
  ck.testTrue(segmentB.isAlmostEqual(segmentD), "shared pointers are transformed together");
  ck.testCoordinate(segmentB.curveLength(), a * segmentA.curveLength());
  // we expect quickLength to match curveLength ...
  ck.testCoordinate(segmentA.quickLength(), segmentA.curveLength(), "LineSegment quickLength is true curveLength");

  segmentC.setFrom(segmentA);
  segmentC.reverseInPlace();
  const xyz0 = Point3d.create();
  const xyz1 = Point3d.create();
  ck.testPoint3d(segmentC.startPoint(xyz0), segmentA.endPoint(xyz1));
  ck.testPoint3d(segmentC.endPoint(xyz0), segmentA.startPoint(xyz1));

  for (const f of [-1, 0, 0.5, 1, 1.5]) {
    const spacePoint = segmentA.fractionToPoint(f);
    const detailT = segmentA.closestPoint(spacePoint, true);
    const detailF = segmentA.closestPoint(spacePoint, false);
    if (Geometry.isIn01(f)) {
      ck.testTrue(Geometry.isSameCoordinate(detailT.fraction, detailF.fraction));
    } else {
      ck.testFalse(Geometry.isSameCoordinate(detailT.fraction, detailF.fraction));
    }
  }
}
describe("LineSegment3d", () => {
  it("HelloWorld", () => {
    const ck = new Checker();
    const result = LineSegment3d.createXYXY(0, 0, 0, 0);  // cover result arg in next line
    const segmentA = LineSegment3d.createXYXY(1, 2, 6, 3, 1, result);

    exerciseLineSegment3d(ck, segmentA);

    const segmentB = LineSegment3d.fromJSON({ startPoint: [1, 2, 3], endPoint: [4, 2, -1] });
    const segmentC = LineSegment3d.fromJSON(false);
    ck.testFalse(segmentB.isAlmostEqual(segmentC));
    ck.testPointer(segmentB, "LineSegment3d.fromJSON");
    const coordinate = CoordinateXYZ.create(segmentB.startPoint());
    ck.testFalse(segmentB.isAlmostEqual(coordinate));
    ck.testFalse(coordinate.isAlmostEqual(segmentB));

    const segmentD = LineSegment3d.createXYZXYZ(1, 2, 3, 4, 5, 6);
    const segmentE = LineSegment3d.createXYZXYZ(1, 2, 3, 4, 5, 6, segmentC);  // overwrite the default segmentC.
    ck.testPointer(segmentE, segmentC, "reuse of optional arg");
    ck.testTrue(segmentD.isAlmostEqual(segmentE));

    const segmentF = LineSegment3d.create(segmentA.endPoint(), segmentA.startPoint(), segmentD);  // another optional
    ck.testFalse(segmentF.isAlmostEqual(segmentA));
    segmentF.reverseInPlace();
    ck.testTrue(segmentF.isAlmostEqual(segmentA));

    const fraction = 0.27;
    const worldToLocal = Transform.createRigidFromOriginAndColumns(segmentA.point0Ref, Vector3d.createStartEnd(segmentA.point0Ref, segmentA.point1Ref), Vector3d.createFrom([0,1,0]), AxisOrder.XYZ);
    const localRangeFirstHalf = segmentA.rangeBetweenFractions(0, fraction, worldToLocal?.inverse());
    ck.testRange3d(localRangeFirstHalf, Range3d.createXYZXYZ(0, 0, 0, fraction * segmentA.curveLength(), 0, 0), "rangeBetweenFractions with Transform");

    const xRange = segmentA.projectedParameterRange(Vector3d.create(1,0,0));
    if (ck.testType(xRange, Range1d, "projectedParameterRange returns a range"))
      ck.testRange1d(xRange, Range1d.createXX(1, 6), "projectedParameterRange returns the expected range");

    ck.checkpoint("LineSegment3d.HelloWorld");
    expect(ck.getNumErrors()).equals(0);
  });

  it("PointsAlongLine", () => {
    const allGeometry: GeometryQuery[] = [];
    const circleRadius = 0.05;
    const pointA = Point3d.create(1, 2);
    const pointB = Point3d.create(4, 3);
    const myLine = LineSegment3d.create(pointA, pointB);
    // A draw a line from pointA to pointB ...
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, myLine);
    // draw circles at some fractional coordinates along the line (and one beyond the end )
    for (const fractionAlongLine of [0.0, 0.1, 0.15, 0.2, 0.25, 0.5, 0.9, 1.0, 1.1]) {
      const pointAlongLine = myLine.fractionToPoint(fractionAlongLine);
      GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, pointAlongLine, circleRadius);
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "LineSegment3d", "PointsAlongLine");
  });

  it("ClosestApproachParallelSegments", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const pointsA: Point3d[] = [];
    const x0 = 0;
    const y0 = 0;
    const z0 = 0;
    for (let x = -4; x < 12; x += 3) {
      pointsA.push(Point3d.create(x, 1, 0));
    }
    const forwardSegments = [];
    const reverseSegments = [];
    for (let i0 = 0; i0 + 1 < pointsA.length; i0++) {
      const point1 = pointsA[i0 + 1].clone();
      const point0 = pointsA[i0];
      point1.x -= 0.25;
      forwardSegments.push(LineSegment3d.create(point0, point1));
      reverseSegments.push(LineSegment3d.create(
        Point3d.create(point1.x, -1, 0),
        Point3d.create(point0.x, -1, 0),
      ));
    }
    const segmentRange = Range1d.createXX(0, 6);
    const xSegment = LineSegment3d.createXYZXYZ(segmentRange.low, 0, 0, segmentRange.high, 0, 0);

    GeometryCoreTestIO.captureCloneGeometry(allGeometry, xSegment, x0, y0, z0);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, forwardSegments, x0, y0, z0);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, reverseSegments, x0, y0, z0);
    const y1 = 4;
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, xSegment, x0, y1, z0);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, forwardSegments, x0, y1, z0);
    GeometryCoreTestIO.captureCloneGeometry(allGeometry, reverseSegments, x0, y1, z0);
    // xSegment sits on the x axis.
    // forwardSegments are parallel and at y=1, always oriented left to right.
    // the 5 forwardSegments are all shorter than xSegment, with x range entirely left, partially in at left, entirely in, partially in at right, and entirely out to right.
    // the reverseSegments are the same x ranges but with orientation reversed and at negated y.
    //
    for (const segments of [forwardSegments, reverseSegments]) {
      for (const s of segments) {
        const sRange = s.range();
        const approachAB = LineSegment3d.closestApproach(xSegment, false, s, false);
        if (ck.testDefined(approachAB) && approachAB) {
          const fA = approachAB.detailA.fraction;
          const fB = approachAB.detailB.fraction;
          if (ck.testType(approachAB.detailA.curve, CurvePrimitive, "closestApproach set detail.curveA"))
            ck.testPoint3d(approachAB.detailA.point, approachAB.detailA.curve.fractionToPoint(fA));
          if (ck.testType(approachAB.detailB.curve, CurvePrimitive, "closestApproach set detail.curveB"))
            ck.testPoint3d(approachAB.detailB.point, approachAB.detailB.curve.fractionToPoint(fB));
          // const fB = approach.detailB.fraction;
          if (fA <= 0.0001) {
            ck.testLE(sRange.high.x, segmentRange.low, "closest approach off the start of xSegment");
          } else if (fA > 0.9999) {
            ck.testLE(segmentRange.high, sRange.low.x, "closest approach off the end of xSegment");
          } else {
            ck.testTrue(segmentRange.containsX(approachAB.detailB.point.x), "closest approach x in range");
          }
          // test with call in reverse order.
          const approachBA = LineSegment3d.closestApproach(s, false, xSegment, false);
          if (ck.testDefined(approachBA) && approachBA) {
            GeometryCoreTestIO.captureCloneGeometry(allGeometry, [approachBA.detailA.point, approachBA.detailB.point], x0, 4, z0);
            // Skip these tests - the reversal flips some cases around because of order inspected.
            // ck.testPoint3d(approachAB.detailA.point, approachBA.detailB.point);
            // ck.testPoint3d(approachAB.detailB.point, approachBA.detailA.point);
          }
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, [approachAB.detailA.point, approachAB.detailB.point], x0, y0, z0);
        }
      }
    }

    // cover the remaining uncovered case
    const seg0 = LineSegment3d.createXYXY(0, -Geometry.smallMetricDistanceSquared, 1, 0);
    const seg1 = LineSegment3d.createXYXY(2, 1, 3, 1);
    const approach = LineSegment3d.closestApproach(seg0, false, seg1, true);
    if (ck.testType(approach, CurveLocationDetailPair, "closestApproach returns a pair of details")) {
      ck.testCoordinate(approach.detailA.a, 1.0, "closestApproach returns expected distance on detailA");
      ck.testCoordinate(approach.detailB.a, 1.0, "closestApproach returns expected distance on detailB");
      ck.testPoint3d(approach.detailA.point, seg0.point1Ref, "closestApproach returns expected point on seg0");
      ck.testPoint3d(approach.detailB.point, Point3d.create(1, 1), "closestApproach returns expected point on extended seg1");
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "LineSegment3d", "ClosestApproachParallelSegments");
    expect(ck.getNumErrors()).equals(0);
  });

  it("ClosestApproach", () => {
    const allGeometry: GeometryQuery[] = [];
    const ck = new Checker();
    let x0 = 0;
    let y0 = 0;
    let x00 = 0;
    const zA = -0.4;
    const pointA0 = Point3d.create(0.2, 0.2, zA);
    const pointA1 = Point3d.create(0.8, 0.7234233, zA);
    const segmentA0 = LineSegment3d.create(pointA0, pointA1);
    const segmentA1 = LineSegment3d.createXYZXYZ(-2, -1, zA, -0.2, 0, zA);
    const numX = 5;
    const numY = 4;
    const gridB = Sample.createXYGrid(numX, numY, 1.2 / numX, 1.0 / numY);
    let numSimple = 0;
    const interiorFractionTrigger = 0.4999;
    let numNonParallel = 0;

    const processSegments = (segmentA: LineSegment3d, segmentB: LineSegment3d): void => {
      const approach = LineSegment3d.closestApproach(segmentA, false, segmentB, false);
      const reversedApproach = LineSegment3d.closestApproach(segmentB, false, segmentA, false);
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, segmentA, x0, y0);
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, segmentB, x0, y0);
      if (approach) {
        numNonParallel++;
        if (Math.abs(approach.detailA.fraction - 0.5) < interiorFractionTrigger
          && Math.abs(approach.detailB.fraction - 0.5) < interiorFractionTrigger)
          numSimple++;
        verifyAVectorsAtA(ck, approach.detailA, approach.detailB);
        verifyAVectorsAtA(ck, approach.detailB, approach.detailA);
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, [approach.detailA.point, approach.detailB.point], x0, y0);
        if (ck.testDefined(reversedApproach) && reversedApproach !== undefined) {
          ck.testPoint3d(approach.detailA.point, reversedApproach.detailB.point);
          ck.testPoint3d(approach.detailB.point, reversedApproach.detailA.point);
        }
      }
    };
    for (const segmentA of [segmentA0, segmentA1]) {
      y0 = 0;
      for (const pointB0 of gridB) {
        x0 = x00;
        for (const pointB1 of gridB) {
          const segmentB = LineSegment3d.create(pointB0, pointB1);
          processSegments(segmentA, segmentB);
          x0 += 5;
        }
        y0 += 5;
      }
      x00 += 150;
    }
    const zP = 0;
    const segmentP = LineSegment3d.createXYZXYZ(0, 0, zP, 1, 0, zP);
    const segmentQ = LineSegment3d.createXYZXYZ(-0.2, 0, 0, 1.1, 1, 0);
    y0 = 0;
    for (let fractionQ = 0.01; fractionQ < 2.0; fractionQ += 0.0625) {
      const segmentR = LineSegment3d.create(segmentQ.fractionToPoint(fractionQ), segmentQ.endPoint());
      processSegments(segmentP, segmentR);
      y0 += 5;
    }
    ck.show({ numSimple, numNonParallel });
    GeometryCoreTestIO.saveGeometry(allGeometry, "LineSegment3d", "ClosestApproach");
    expect(ck.getNumErrors()).equals(0);
  });
});

// Verify perpendicular or forward or reverse properties of approach segment "at the A segment"
// for reverse=true, segmentsP and Q match
function verifyAVectorsAtA(ck: Checker, detailA: CurveLocationDetail, detailB: CurveLocationDetail) {
  const vectorAB = Vector3d.createStartEnd(detailA.point, detailB.point);
  const curveA = detailA.curve;
  const curveB = detailB.curve;
  if (ck.testDefined(curveA, "Expect curve in detailA") && curveA !== undefined
    && ck.testDefined(curveB, "Expect curve in detailB") && curveB !== undefined) {
    const rayA = curveA.fractionToPointAndDerivative(0.0);
    const dot = vectorAB.dotProduct(rayA?.direction);
    if (detailA.fraction <= 0.0)
      ck.testLE(dot, 0.0, "projection vector angle to tangent is at least 90deg");
    else if (detailA.fraction >= 1.0)
      ck.testLE(0.0, dot, "projection angle to tangent is at most 90deg");
    else
      ck.testCoordinate(dot, 0, "Expect interior fraction to be perpendicular");
    // And confirm simple endpoint distances . . .
    const d = detailA.point.distance(detailB.point);
    for (const fractionA of [0, 1]) {
      for (const fractionB of [0, 1]) {
        ck.testLE(d, curveA.fractionToPoint(fractionA).distance(detailB.curve!.fractionToPoint(fractionB)));
      }
    }

  }
}
