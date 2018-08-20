/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

import { Point3d, Vector3d } from "../PointVector";
import { Range1d } from "../Range";
import { RotMatrix, Transform } from "../Transform";

import { Arc3d } from "../curve/Arc3d";
import { Angle, AngleSweep } from "../Geometry";
import { Checker } from "./Checker";
import { expect } from "chai";

function exerciseArcSet(ck: Checker, arcA: Arc3d) {
  const arcB = Arc3d.createXY(Point3d.create(6, 5, 4), 1232.9, AngleSweep.createStartEndDegrees(1, 92));
  const arcC = arcB.clone();
  ck.testFalse(arcA.isAlmostEqual(arcC), "Verify distinct arcs before using set to match.");
  ck.testTrue(arcB.isAlmostEqual(arcC), "same arc after clone");
  arcC.setFrom(arcA);
  ck.testTrue(arcC.isAlmostEqual(arcA), "same after setFrom");    // but still not to confirm members where cloned.
  const transform = Transform.createOriginAndMatrix(Point3d.create(4, 23, 2),
    RotMatrix.createRotationAroundVector(Vector3d.create(1, 2, 2), Angle.createDegrees(12))!);
  arcC.tryTransformInPlace(transform);
  ck.testFalse(arcC.isAlmostEqual(arcA), "confirm cloned arc does not share pointers.");

  const myPoint = Point3d.create(4, 2, 1);
  const myMatrix = RotMatrix.createUniformScale(8.0);
  const mySweep = AngleSweep.createStartEndDegrees(9, 20);
  arcB.setRefs(myPoint, myMatrix, mySweep);

  const arcD = arcB.clone();
  arcD.set(myPoint, myMatrix, mySweep);
  ck.testTrue(arcD.isAlmostEqual(arcB));
  transform.multiplyPoint3d(myPoint, myPoint); // this indirectly modifies arcB, but not arcD
  ck.testFalse(arcD.isAlmostEqual(arcB));
}
function exerciseArc3d(ck: Checker, arc: Arc3d) {
  const vector0 = arc.vector0;
  const vector90 = arc.vector90;
  const vectorData = arc.toVectors();
  ck.testVector3d(vector0, vectorData.vector0);
  ck.testVector3d(vector90, vectorData.vector90);
  const a = 4.2;
  const scaleTransform = Transform.createFixedPointAndMatrix(Point3d.create(4, 3),
    RotMatrix.createScale(a, a, a));
  const arc1 = arc.cloneTransformed(scaleTransform) as Arc3d;
  ck.testFalse(arc.isAlmostEqual(arc1), "scale changes arc");
  ck.testPointer(arc1);
  ck.testBoolean(arc1.isCircular, arc.isCircular, "scaled clone retains circular");
  ck.testBoolean(
    arc.sweep.isFullCircle,
    arc.startPoint().isAlmostEqual(arc.endPoint()),
    "full circle start, end condition");

  const json = arc1.toJSON();
  const arc2 = Arc3d.createUnitCircle();
  arc2.setFromJSON(json);
  ck.testTrue(arc1.isAlmostEqual(arc2), "Tight json round trip");
  ck.testLE(arc.curveLength(),
    arc.sweep.sweepRadians * arc.maxVectorLength(),
    "arc length smaller than circle on max radius");
  const fA = 0.35;
  const fB = 0.51;
  const arc3A = arc.clonePartialCurve(fA, fB)!;
  const arc3B = arc.clonePartialCurve(fB, fA)!;
  ck.testCoordinate(arc3A.curveLength(), arc3B.curveLength(), "Reversed partials match length");
  const length1 = arc1.curveLength();
  const fuzzyLengthRange = Range1d.createXX(0.5 * length1, 2.0 * length1);
  ck.testTrue(fuzzyLengthRange.containsX(arc1.quickLength()), "Quick length within factor of 2");

  exerciseArcSet(ck, arc1);
}
describe("Arc3d", () => {
  it("HelloWorld", () => {
    const ck = new Checker();
    const arcA = Arc3d.createUnitCircle();
    ck.testTrue(arcA.isCircular);
    exerciseArc3d(ck, arcA);
    exerciseArc3d(ck,
      Arc3d.create(
        Point3d.create(1, 2, 5),
        Vector3d.create(1, 0, 0),
        Vector3d.create(0, 2, 0), AngleSweep.createStartEndDegrees(0, 90))!);
    ck.checkpoint("Arc3d.HelloWorld");
    expect(ck.getNumErrors()).equals(0);
  });
});
