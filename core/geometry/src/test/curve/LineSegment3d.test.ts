/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { CoordinateXYZ } from "../../curve/CoordinateXYZ";
import { LineSegment3d } from "../../curve/LineSegment3d";
import { Geometry } from "../../Geometry";
import { Matrix3d } from "../../geometry3d/Matrix3d";
import { Point3d } from "../../geometry3d/Point3dVector3d";
import { Transform } from "../../geometry3d/Transform";
import { Checker } from "../Checker";
import { GeometryQuery } from "../../curve/GeometryQuery";
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
});
