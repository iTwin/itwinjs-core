/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { CoordinateXYZ } from "../../curve/CoordinateXYZ";
import { LineSegment3d } from "../../curve/LineSegment3d";
import { Geometry } from "../../Geometry";
import { Matrix3d } from "../../geometry3d/Matrix3d";
import { Point3d, Vector3d } from "../../geometry3d/Point3dVector3d";
import { Transform } from "../../geometry3d/Transform";
import { Checker } from "../Checker";
import { GeometryQuery } from "../../curve/GeometryQuery";
import { GeometryCoreTestIO } from "../GeometryCoreTestIO";
import { Sample } from "../../serialization/GeometrySamples";
import { CurveLocationDetail } from "../../core-geometry";

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
    const segmentA = LineSegment3d.createXYXY(1, 2, 6, 3, 1);

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
  it("HelloWorld", () => {
    const ck = new Checker();
    const segmentA = LineSegment3d.createXYXY(1, 2, 6, 3, 1);

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

    ck.checkpoint("LineSegment3d.HelloWorld");
    expect(ck.getNumErrors()).equals(0);
  });

  it("PointsAlongLine", () => {
    const allGeometry: GeometryQuery[] = [];
    const ck = new Checker(true, true);
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
      ck.testLE(dot, 0);
    else if (detailA.fraction >= 1.0)
      ck.testLE(0.0, dot);
    else ck.testCoordinate(dot, 0, "Expect interior fraction to be perpendicular");
    // And confirm simple endpoint distances . . .
    const d = detailA.point.distance(detailB.point);
    for (const fractionA of [0, 1]) {
      for (const fractionB of [0, 1]) {
        ck.testLE(d, curveA.fractionToPoint(fractionA).distance(detailB.curve!.fractionToPoint(fractionB)));
      }
    }

  }
}
