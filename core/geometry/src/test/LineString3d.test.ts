/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { Point3d } from "../PointVector";
import { Transform } from "../Transform";
import { Matrix3d } from "../Transform";
import { LineString3d } from "../curve/LineString3d";
import { Checker } from "./Checker";
import { expect } from "chai";

function exerciseLineString3d(ck: Checker, lsA: LineString3d) {
  const expectValidResults = lsA.numPoints() > 1;
  const a = 4.2;
  const scaleTransform = Transform.createFixedPointAndMatrix(Point3d.create(4, 3),
    Matrix3d.createScale(a, a, a));
  const lsB = lsA.clone();
  lsB.reverseInPlace();
  const lsC = lsA.clone()!;
  ck.testTrue(lsC.tryTransformInPlace(scaleTransform));
  // exercise evaluation logic within each segment.
  // force evaluations in zero segment linestring
  for (let segmentIndex = 0; segmentIndex === 0 || segmentIndex + 1 < lsA.numPoints(); segmentIndex++) {
    for (const localFraction of [0.1, 0.1, 0.6, 0.6]) {
      const globalFraction = lsA.segmentIndexAndLocalFractionToGlobalFraction(segmentIndex, localFraction);
      const frame = lsA.fractionToFrenetFrame(globalFraction);
      const xyz = lsA.fractionToPoint(globalFraction);
      const ray = lsA.fractionToPointAndDerivative(globalFraction);
      const closestPointDetail = lsA.closestPoint(xyz, false);
      if (expectValidResults) {
        ck.testTrue(frame.matrix.isRigid());
        ck.testPoint3d(xyz, ray.origin);
        ck.testPoint3d(xyz, frame.getOrigin(), "frenet vs fractionToPoint", lsA, segmentIndex, localFraction, globalFraction);
        ck.testCoordinate(globalFraction, closestPointDetail.fraction);
      }
    }
  }
  const splitFraction = 0.4203;
  const partA = lsA.clonePartialCurve(0.0, splitFraction);
  const partB = lsA.clonePartialCurve(1.0, splitFraction);  // reversed to exercise more code.  But length is absolute so it will add.
  if (expectValidResults
    && ck.testPointer(partA, "forward partial") && partA
    && ck.testPointer(partA, "forward partial") && partB) {
    ck.testCoordinate(lsA.curveLength(), partA.curveLength() + partB.curveLength(), "Partial curves sum to length", lsA, partA, partB);
  }
}
describe("LineString3d", () => {
  it("HelloWorld", () => {
    const ck = new Checker();
    const ls0 = LineString3d.create();
    exerciseLineString3d(ck, ls0);
    ls0.addPoint(Point3d.create(4, 3, 2));
    exerciseLineString3d(ck, ls0);

    const lsA = LineString3d.create([
      Point3d.create(1, 0, 0),
      Point3d.create(4, 2, 0),
      Point3d.create(4, 5, 0),
      Point3d.create(1, 5, 0)]);
    exerciseLineString3d(ck, lsA);
    const lsB = LineString3d.createRectangleXY(
      Point3d.create(1, 1),
      3, 2, true);
    exerciseLineString3d(ck, lsB);
    ck.checkpoint("LineString3d.HelloWorld");
    expect(ck.getNumErrors()).equals(0);
  });
});
