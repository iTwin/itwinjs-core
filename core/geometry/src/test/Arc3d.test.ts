/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { Point3d, Vector3d } from "../geometry3d/Point3dVector3d";
import { Range1d } from "../geometry3d/Range";
import { Transform } from "../geometry3d/Transform";
import { Matrix3d } from "../geometry3d/Matrix3d";

import { Arc3d } from "../curve/Arc3d";
import { AngleSweep } from "../geometry3d/AngleSweep";
import { Angle } from "../geometry3d/Angle";
import { prettyPrint } from "./testFunctions";
import { Checker } from "./Checker";
import { expect } from "chai";
import { Sample } from "../serialization/GeometrySamples";
/* tslint:disable:no-console */

function exerciseArcSet(ck: Checker, arcA: Arc3d) {
  const arcB = Arc3d.createXY(Point3d.create(6, 5, 4), 1232.9, AngleSweep.createStartEndDegrees(1, 92));
  const arcC = arcB.clone();
  ck.testFalse(arcA.isAlmostEqual(arcC), "Verify distinct arcs before using set to match.");
  ck.testTrue(arcB.isAlmostEqual(arcC), "same arc after clone");
  arcC.setFrom(arcA);
  ck.testTrue(arcC.isAlmostEqual(arcA), "same after setFrom");    // but still not to confirm members where cloned.
  const transform = Transform.createOriginAndMatrix(Point3d.create(4, 23, 2),
    Matrix3d.createRotationAroundVector(Vector3d.create(1, 2, 2), Angle.createDegrees(12))!);
  arcC.tryTransformInPlace(transform);
  ck.testFalse(arcC.isAlmostEqual(arcA), "confirm cloned arc does not share pointers.");

  const myPoint = Point3d.create(4, 2, 1);
  const myMatrix = Matrix3d.createUniformScale(8.0);
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
    Matrix3d.createScale(a, a, a));
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
  it("QuickLength", () => {
    const ck = new Checker();
    const origin = Point3d.create();
    const factorRange = Range1d.createNull();
    for (const sweep of [AngleSweep.create360(),
    AngleSweep.createStartEndDegrees(0, 40),
    AngleSweep.createStartEndDegrees(0, 2),
    AngleSweep.createStartEndDegrees(-1, 3),
    AngleSweep.createStartEndDegrees(88, 91),
    AngleSweep.createStartEndDegrees(0, 18),
    AngleSweep.createStartEndDegrees(-10, 10),
    AngleSweep.createStartEndDegrees(80, 100),
    AngleSweep.createStartEndDegrees(90, 108),
    AngleSweep.createStartEndDegrees(30, 45),
    AngleSweep.createStartEndDegrees(80, 110),
    AngleSweep.createStartEndDegrees(-10, 110),
    AngleSweep.createStartEndDegrees(-10, 320),
    AngleSweep.createStartEndDegrees(0, 88),
    AngleSweep.createStartEndDegrees(45, 132),
    AngleSweep.createStartEndDegrees(-10, 278),
    AngleSweep.createStartEndDegrees(30, 80)]) {
      const factorRange1 = Range1d.createNull();
      for (const arc of [
        Arc3d.createXY(origin, 4.0, sweep),
        Arc3d.createXYEllipse(origin, 4, 2, sweep),
        Arc3d.createXYEllipse(origin, 8, 2, sweep),
        Arc3d.createXYEllipse(origin, 5, 4, sweep),
        Arc3d.createXYEllipse(origin, 20, 2, sweep),
        Arc3d.create(origin,
          Vector3d.create(4, 0, 0), Vector3d.create(1, 2, 0), sweep),
        Arc3d.create(origin,
          Vector3d.create(8, 7, 0), Vector3d.create(7, 8, 0), sweep)]) {
        const arcLength = arc.curveLength();
        const quickLength = arc.quickLength();
        if (arc.isCircular) {
          ck.testCoordinate(quickLength, arcLength);
        } else {
          const factor = quickLength / arcLength;
          factorRange.extendX(factor);
          factorRange1.extendX(factor);
          //        const scale = arc.getFractionToDistanceScale();
          if (!ck.testLE(arcLength, 1.1 * quickLength, "arc length .LE.  1.1 * quickLength")) {
            console.log(prettyPrint(arc));
          }
        }
      }
      // console.log(prettyPrint(sweep) + prettyPrint(factorRange1));
    }
    // console.log("Arc3d QuickLength FactorRange" + prettyPrint(factorRange));
    ck.testLT(0.95, factorRange.low, "QuickLength FactorRange Low");
    ck.testLT(factorRange.high, 1.05, "QuickLength FactorRange Low");

    ck.checkpoint("Arc3d.QuickLength");
    expect(ck.getNumErrors()).equals(0);
  });
  it("EccentricEllipseLengthAccuracyTable", () => {
    const noisy = false;
    const ck = new Checker();
    // Construct 90 degree elliptic arcs of varying eccentricity.
    // Integrate with 4,8,16... gauss intervals until the results settle.
    // record factor = N/e
    // By trial and error, we observe the factor is 8 or less.
    for (const numGauss of [1, 2, 3, 4, 5]) {
      let maxFactor = 0;
      if (noisy)
        console.log("\n\n  ******************* numGauss" + numGauss);
      for (let e2 = 1.0; e2 < 1000.0; e2 *= 2.0) {
        const e = Math.sqrt(e2);
        const arc = Arc3d.create(Point3d.createZero(),
          Vector3d.create(e, 0, 0),
          Vector3d.create(0, 1, 0), AngleSweep.createStartEndDegrees(0, 90));
        const lengths = [];
        const deltas = [];
        const counts = [];
        let lastNumInterval = 0;
        let done = false;
        for (let baseNumInterval = 4; baseNumInterval < 600; baseNumInterval *= 2) {
          for (const numInterval of [baseNumInterval, 1.25 * baseNumInterval, 1.5 * baseNumInterval, 1.75 * baseNumInterval]) {
            lengths.push(arc.curveLengthWithFixedIntervalCountQuadrature(0.0, 1.0, numInterval, numGauss));
            counts.push(numInterval);
            lastNumInterval = numInterval;
            const k = lengths.length - 1;
            if (k >= 1) {
              const q = (lengths[k] - lengths[k - 1]) / lengths[k];
              deltas.push(q);
              if (Math.abs(q) < 4.0e-15) { done = true; break; }
            }
          }
          if (done)
            break;
        }
        const factor = lastNumInterval / e;
        if (noisy) {
          console.log("---");
          console.log(" eccentricity " + e + "   "
            + lengths.toString()
            + "  (n " + lastNumInterval + ") (n/(fe) " + factor + ")");
          console.log(" deltas                             " + deltas.toString());
        }
        maxFactor = Math.max(factor, maxFactor);
      }
      if (noisy)
        console.log("Eccentric ellipse integration  (numGauss " + numGauss + ")   (maxFactor  " + maxFactor + ")");
      if (numGauss === 5)
        ck.testLE(maxFactor, 20.0, "Eccentric Ellipse integraton factor");
    }
    ck.checkpoint("Arc3d.EccentricEllipseLengthAccuracyTable");
    expect(ck.getNumErrors()).equals(0);
  });
  it("ValidateEllipseIntegrationHeuristic", () => {
    const ck = new Checker();
    const degreesInterval = 10.0;
    const numGauss = 5;
    // Construct elliptic arcs of varying eccentricity and angles
    // Integrate with 5 gauss points in intervals of 10 degrees.
    // By trial and error, we have concluded that this should be accurate.
    // Compare to integral with twice as many points.
    for (const sweepDegrees of [30, 90, 135, 180, 239, 360]) {
      for (let e2 = 1.0; e2 < 1000.0; e2 *= 2.0) {
        const e = Math.sqrt(e2);
        const arc = Arc3d.create(Point3d.createZero(),
          Vector3d.create(e, 0, 0),
          Vector3d.create(0, 1, 0), AngleSweep.createStartEndDegrees(0, sweepDegrees));
        const numA = Math.ceil(arc.sweep.sweepDegrees * e / degreesInterval);
        const lengthA = arc.curveLengthWithFixedIntervalCountQuadrature(0.0, 1.0, numA, numGauss);
        const lengthB = arc.curveLengthWithFixedIntervalCountQuadrature(0.0, 1.0, 2 * numA, numGauss);
        const lengthC = arc.curveLength();
        ck.testLE(Math.abs(lengthB - lengthA) / lengthA, 5.0e-15, "direct quadrature", e, numA);
        ck.testLE(Math.abs(lengthB - lengthC) / lengthA, 5.0e-15, "compare to method", e, numA);
      }
    }
    ck.checkpoint("Arc3d.ValidateEllipseIntegrationHeuristic");
    expect(ck.getNumErrors()).equals(0);
  });

  it("ScaledForm", () => {
    const ck = new Checker();
    const arcs = Sample.createManyArcs([0.2, -0.25]);
    for (const arc of arcs) {
      const scaledForm = arc.toScaledMatrix3d();
      const arc1 = Arc3d.createScaledXYColumns(
        scaledForm.center,
        scaledForm.axes,
        scaledForm.r0,
        scaledForm.r90,
        scaledForm.sweep);
      for (const fraction of [0.0, 0.2, 0.4, 0.6, 0.8]) {
        ck.testPoint3d(arc.fractionToPoint(fraction), arc1.fractionToPoint(fraction));
      }
    }
    ck.checkpoint("Arc3d.ScaledForm");
    expect(ck.getNumErrors()).equals(0);
  });
});
