/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

// import { Point3d, Vector3d } from "../PointVector";
// import { Range1d } from "../Range";
// import { Matrix3d, Transform } from "../geometry3d/Transform";

import { TransitionConditionalProperties, TransitionSpiral3d } from "../../curve/TransitionSpiral";
import { Angle } from "../../geometry3d/Angle";
import { Checker } from "../Checker";
import { expect } from "chai";
import { AngleSweep } from "../../geometry3d/AngleSweep";
import { Transform } from "../../geometry3d/Transform";
import { Segment1d } from "../../geometry3d/Segment1d";
import { Matrix3d } from "../../geometry3d/Matrix3d";
import { Point3d } from "../../geometry3d/Point3dVector3d";
import { Geometry } from "../../Geometry";
import { StrokeOptions } from "../../curve/StrokeOptions";
/* tslint:disable:no-console */
describe("TransitionSpiralProperties", () => {
  it("HelloWorld", () => {
    const ck = new Checker();
    const b0 = Angle.createDegrees(10);
    const b1 = Angle.createDegrees(25);
    const r0 = 0.0;
    const r1 = 1000.0;
    const dataA = new TransitionConditionalProperties(r0, r1, b0.clone(), b1.clone(), undefined);
    ck.testTrue(dataA.tryResolveAnySingleUnknown(), "resolve length");
    ck.testTrue(dataA.curveLength !== undefined);
    const lengthA = dataA.curveLength as number;
    const dataB = new TransitionConditionalProperties(undefined, r1, b0.clone(), b1.clone(), lengthA);
    const dataC = new TransitionConditionalProperties(r0, undefined, b0.clone(), b1.clone(), lengthA);
    const dataD = new TransitionConditionalProperties(r0, r1, undefined, b1.clone(), lengthA);
    const dataE = new TransitionConditionalProperties(r0, r1, b0.clone(), undefined, lengthA);

    ck.testFalse(dataA.isAlmostEqual(dataB), "A B");
    ck.testFalse(dataA.isAlmostEqual(dataC), "A C");
    ck.testFalse(dataA.isAlmostEqual(dataD), "A D");
    ck.testFalse(dataA.isAlmostEqual(dataE), "A E");
    ck.testFalse(dataD.isAlmostEqual(dataE), "D E");

    ck.testTrue(dataB.tryResolveAnySingleUnknown(), "resolve r0");
    ck.testTrue(dataC.tryResolveAnySingleUnknown(), "resolve r1");
    ck.testTrue(dataD.tryResolveAnySingleUnknown(), "resolve bearing0");
    ck.testTrue(dataE.tryResolveAnySingleUnknown(), "resolve bearing1");

    ck.testTrue(dataA.isAlmostEqual(dataB), "dataB");
    ck.testTrue(dataA.isAlmostEqual(dataC), "dataC");
    ck.testTrue(dataA.isAlmostEqual(dataD), "dataD");
    ck.testTrue(dataA.isAlmostEqual(dataE), "dataE");

  });
  it("CreateAndPoke", () => {
    const ck = new Checker();
    const spiralA = TransitionSpiral3d.createRadiusRadiusBearingBearing(Segment1d.create(0, 1000), AngleSweep.createStartEndDegrees(0, 8), Segment1d.create(0, 1), Transform.createIdentity());
    const spiralB = TransitionSpiral3d.createRadiusRadiusBearingBearing(Segment1d.create(1000, 0), AngleSweep.createStartEndDegrees(10, 3), Segment1d.create(0, 1), Transform.createIdentity());
    ck.testFalse(spiralB.isAlmostEqual(spiralA));
    spiralB.setFrom(spiralA);
    ck.testTrue(spiralA.isAlmostEqual(spiralB));
    console.log(TransitionSpiral3d.radiusRadiusLengthToSweepRadians(0, 10, 50));
    expect(ck.getNumErrors()).equals(0);
  });

  it("CreateAndTransform", () => {
    // spiral transform is not as easy as you expect -- regenerated data has been wrong at times.
    const ck = new Checker();
    const spiralA = TransitionSpiral3d.createRadiusRadiusBearingBearing(Segment1d.create(0, 1000), AngleSweep.createStartEndDegrees(0, 8), Segment1d.create(0, 1), Transform.createIdentity());
    for (const transform of [
      Transform.createTranslationXYZ(2, 3, 1),
      Transform.createFixedPointAndMatrix(Point3d.create(3, 2, 5), Matrix3d.createRotationAroundAxisIndex(2, Angle.createDegrees(10))),
      Transform.createFixedPointAndMatrix(Point3d.create(3, 2, 5), Matrix3d.createUniformScale(2.0))]) {
      const spiralB = spiralA.cloneTransformed(transform);
      ck.testTransformedPoint3d(transform, spiralA.startPoint(), spiralB.startPoint(), "spiral.startPoint ()");
      ck.testTransformedPoint3d(transform, spiralA.endPoint(), spiralB.endPoint(), "spiral.endPoint ()");
      for (const f of [0.25, 0.35, 0.98])
        ck.testTransformedPoint3d(transform, spiralA.fractionToPoint(f), spiralB.fractionToPoint(f), "spiral.fractionToPoint ()");
    }

    const options = StrokeOptions.createForCurves();
    options.maxEdgeLength = 3.0;
    const numStroke = spiralA.computeStrokeCountForOptions(options);
    ck.testBetween((numStroke - 1) * options.maxEdgeLength, spiralA.quickLength(), (numStroke + 1) * options.maxEdgeLength);

    expect(ck.getNumErrors()).equals(0);
  });
  it("PartialSpiralPoints", () => {
    const ck = new Checker();
    const spiralA = TransitionSpiral3d.createRadiusRadiusBearingBearing(Segment1d.create(0, 1000), AngleSweep.createStartEndDegrees(0, 8), Segment1d.create(0, 1), Transform.createIdentity());
    const f0 = 0.3;
    const f1 = 0.9;
    const spiralB = TransitionSpiral3d.createRadiusRadiusBearingBearing(Segment1d.create(0, 1000), AngleSweep.createStartEndDegrees(0, 8), Segment1d.create(f0, f1), Transform.createIdentity());
    for (const f of [0.25, 0.35, 0.98]) {
      const pointA = spiralA.fractionToPoint(Geometry.interpolate(f0, f, f1));
      const pointB = spiralB.fractionToPoint(f);
      ck.testPoint3d(pointA, pointB, "spiral.fractionToPoint () in partial spiral at partial fraction" + f);
    }

    const bearingA = spiralA.fractionToBearingRadians(f0);
    const bearingB = spiralB.fractionToBearingRadians(0.0);
    ck.testCoordinate(bearingA, bearingB, "spiral bearing at fraction " + [f0, 0.0]);
    const curvatureA = spiralA.fractionToCurvature(f0);
    const curvatureB = spiralB.fractionToCurvature(0.0);
    ck.testCoordinate(curvatureA, curvatureB, "spiral curvature at fraction " + [f0, 0.0]);

    expect(ck.getNumErrors()).equals(0);
  });
  it("PartialSpiralDerivatives", () => {
    const ck = new Checker();
    const spiralA = TransitionSpiral3d.createRadiusRadiusBearingBearing(Segment1d.create(0, 1000), AngleSweep.createStartEndDegrees(0, 8), Segment1d.create(0, 1), Transform.createIdentity());
    const f0 = 0.3;
    const f1 = 0.9;
    const delta = f1 - f0;
    const spiralB = TransitionSpiral3d.createRadiusRadiusBearingBearing(Segment1d.create(0, 1000), AngleSweep.createStartEndDegrees(0, 8), Segment1d.create(f0, f1), Transform.createIdentity());
    for (const f of [0.25, 0.35, 0.98]) {
      const tangentA = spiralA.fractionToPointAndDerivative(Geometry.interpolate(f0, f, f1));
      const tangentB = spiralB.fractionToPointAndDerivative(f);
      ck.testPoint3d(tangentA.origin, tangentB.origin, "spiral.fractionToPoint () in partial spiral at partial fraction" + f);
      ck.testVector3d(tangentA.direction.scale(delta), tangentB.direction, "spiral.fractionToPointAndDerivatives in partial spiral at partial fraction");

      const planeA = spiralA.fractionToPointAnd2Derivatives(Geometry.interpolate(f0, f, f1))!;
      const planeB = spiralB.fractionToPointAnd2Derivatives(f)!;
      ck.testPoint3d(planeA.origin, planeB.origin, "spiral.fractionToPoint () in partial spiral at partial fraction" + f);
      ck.testVector3d(planeA.vectorU.scale(delta), planeB.vectorU, "spiral.fractionToPointAnd2Derivatives in partial spiral at partial fraction");
      ck.testVector3d(planeA.vectorV.scale(delta * delta), planeB.vectorV, "spiral.fractionToPointAnd2Derivatives in partial spiral at partial fraction");
    }
    expect(ck.getNumErrors()).equals(0);
  });

});
