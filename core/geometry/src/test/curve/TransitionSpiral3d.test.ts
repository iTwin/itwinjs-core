/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

// import { Point3d, Vector3d } from "../PointVector";
// import { Range1d } from "../Range";
// import { Matrix3d, Transform } from "../geometry3d/Transform";

import { expect } from "chai";
import { StrokeOptions } from "../../curve/StrokeOptions";
import { TransitionConditionalProperties, TransitionSpiral3d } from "../../curve/TransitionSpiral";
import { Geometry } from "../../Geometry";
import { Angle } from "../../geometry3d/Angle";
import { AngleSweep } from "../../geometry3d/AngleSweep";
import { Matrix3d } from "../../geometry3d/Matrix3d";
import { Point3d } from "../../geometry3d/Point3dVector3d";
import { Segment1d } from "../../geometry3d/Segment1d";
import { Transform } from "../../geometry3d/Transform";
import { Checker } from "../Checker";
import { ClothoidSeriesRLEvaluator, ClothoidSeriesSpiral3d } from "../../curve/ClothoidSeries";
import { NormalizedBiQuadraticTransition, NormalizedBlossTransition, NormalizedClothoidTransition, NormalizedCosineTransition, NormalizedSineTransition } from "../../curve/NormalizedTransition";
import { LineString3d } from "../../curve/LineString3d";
import { GeometryCoreTestIO } from "../GeometryCoreTestIO";
import { GeometryQuery } from "../../curve/GeometryQuery";
import { Sample } from "../../serialization/GeometrySamples";

/* tslint:disable:no-console */
describe("TransitionSpiral3d", () => {
  it("HelloWorldConditionalProperties", () => {
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
  it("CreateAndPokeTransitionProperties", () => {
    const ck = new Checker();
    const spiralA = TransitionSpiral3d.createRadiusRadiusBearingBearing(Segment1d.create(0, 1000), AngleSweep.createStartEndDegrees(0, 8), Segment1d.create(0, 1), Transform.createIdentity());
    const spiralB = TransitionSpiral3d.createRadiusRadiusBearingBearing(Segment1d.create(1000, 0), AngleSweep.createStartEndDegrees(10, 3), Segment1d.create(0, 1), Transform.createIdentity());
    if (ck.testType<TransitionSpiral3d>(spiralA) && ck.testType<TransitionSpiral3d>(spiralB)) {
      ck.testFalse(spiralB.isAlmostEqual(spiralA));
      spiralB.setFrom(spiralA);
      ck.testTrue(spiralA.isAlmostEqual(spiralB));
      console.log(TransitionSpiral3d.radiusRadiusLengthToSweepRadians(0, 10, 50));
    }
    expect(ck.getNumErrors()).equals(0);
  });

  it("CreateAndTransform", () => {
    // spiral transform is not as easy as you expect -- regenerated data has been wrong at times.
    const ck = new Checker();
    const spiralA = TransitionSpiral3d.createRadiusRadiusBearingBearing(Segment1d.create(0, 1000), AngleSweep.createStartEndDegrees(0, 8), Segment1d.create(0, 1), Transform.createIdentity())!;
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
    const spiralA = TransitionSpiral3d.createRadiusRadiusBearingBearing(Segment1d.create(0, 1000), AngleSweep.createStartEndDegrees(0, 8), Segment1d.create(0, 1), Transform.createIdentity())!;
    const f0 = 0.3;
    const f1 = 0.9;
    const spiralB = TransitionSpiral3d.createRadiusRadiusBearingBearing(Segment1d.create(0, 1000), AngleSweep.createStartEndDegrees(0, 8), Segment1d.create(f0, f1), Transform.createIdentity())!;
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
    const spiralA = TransitionSpiral3d.createRadiusRadiusBearingBearing(Segment1d.create(0, 1000), AngleSweep.createStartEndDegrees(0, 8), Segment1d.create(0, 1), Transform.createIdentity())!;
    const f0 = 0.3;
    const f1 = 0.9;
    const delta = f1 - f0;
    const spiralB = TransitionSpiral3d.createRadiusRadiusBearingBearing(Segment1d.create(0, 1000), AngleSweep.createStartEndDegrees(0, 8), Segment1d.create(f0, f1), Transform.createIdentity())!;
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

  it("ClothoidTerms", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    let x0 = 0;
    const distance1 = 100;
    for (const radius1 of [200, 400, 1000]) {
      const series = [];
      const linestrings = [];
      const fractions = [];
      const distances = [];
      console.log();
      console.log(" R/L = " + radius1 / distance1);
      let y0 = 0;
      const spiral = TransitionSpiral3d.create("clothoid", 0, radius1, Angle.createDegrees(0), undefined, distance1, undefined, Transform.createIdentity())!;
      const linestring0 = LineString3d.create();
      for (const d of [0, 10, 20, 30, 40, 50, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 80, 90, 100]) {
        distances.push(d);
        const f = d / distance1;
        fractions.push(f);
        linestring0.packedPoints.push(spiral.fractionToPoint(f));
      }

      GeometryCoreTestIO.captureCloneGeometry(allGeometry, spiral, x0, y0 += 1);
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, linestring0, x0, y0 += 1);
      const div2RL = 1.0 / (2.0 * radius1 * distance1);
      const y1 = 50.0;
      for (const numTerm of [1, 2, 3, 4, 5, 6, 8]) {
        const seriesEvaluator = new ClothoidSeriesRLEvaluator(div2RL, numTerm, numTerm);
        console.log(" numTerm " + numTerm);
        series.push(seriesEvaluator);
        const ls = LineString3d.create();
        for (const d of distances) {
          ls.packedPoints.pushXYZ(seriesEvaluator.pseudoDistanceToX(d), seriesEvaluator.pseudoDistanceToY(d), 0);
          if (d > 90) {
            const ux = seriesEvaluator.pseudoDistanceToDX(d);
            const uy = seriesEvaluator.pseudoDistanceToDY(d);
            const vx = seriesEvaluator.pseudoDistanceToDDX(d);
            const vy = seriesEvaluator.pseudoDistanceToDDY(d);
            const curvature = Geometry.curvatureMagnitude(ux, uy, 0, vx, vy, 0);
            console.log(xyString("D,R", d, Geometry.safeDivideFraction(1, curvature, 0)) + xyString("DU", ux, uy) + xyString("DV", vx, vy));
            const beta = d * d / (2.0 * radius1 * distance1);
            const wx = Math.cos(beta);
            const wy = Math.sin(beta);
            console.log("    true unit " + wx + " , " + wy + "   e(" + (ux - wx) + "," + (uy - wy) + ")");
          }
        }
        linestrings.push(ls);
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, ls, x0, y0 += 1);
        const extendedLineString = LineString3d.create();
        // Extended evaluation ..
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, linestring0, x0, y1);
        for (let d = distance1; d < 4 * distance1; d += distance1 / 10) {
          extendedLineString.packedPoints.pushXYZ(seriesEvaluator.pseudoDistanceToX(d), seriesEvaluator.pseudoDistanceToY(d), 0);
        }
        GeometryCoreTestIO.captureCloneGeometry(allGeometry, extendedLineString, x0, y1);
      }
      // We expect each series form to get closer to the real thing at each evaluation.
      for (let i = 0; i < distances.length; i++) {
        const d = distances[i];
        const integratedPoint = linestring0.packedPoints.getPoint3dAtUncheckedPointIndex(i);
        let error0 = 1.0;
        // console.log("d = " + d);
        for (let j = 0; j < linestrings.length; j++) {
          const pointJ = linestrings[j].packedPoints.getPoint3dAtUncheckedPointIndex(i);
          const errorJ = pointJ.distance(integratedPoint);
          const xReference = Geometry.maxXY(1, integratedPoint.x);
          // console.log("     E = " + errorJ + "   e = " + errorJ / xReference);
          ck.testLE(errorJ, error0 + 1.0e-15 * xReference, j, d, errorJ - error0);
          error0 = errorJ;
        }
      }
      x0 += 200;
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "TransitionSpiral3d", "ClothoidTerms");
    expect(ck.getNumErrors()).equals(0);
  });
  it("NamedApproximations", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const nominalL1 = 100;
    const nominalR1 = 400;
    const x0 = 0;
    let y0 = 0;
    const simpleCubic = ClothoidSeriesSpiral3d.createCubicY(Transform.createIdentity(), nominalL1, nominalR1)!;
    const aremaSpiral = ClothoidSeriesSpiral3d.createArema(Transform.createIdentity(), nominalL1, nominalR1)!;
    const spiral3 = ClothoidSeriesSpiral3d.create("ClothoidSeriesX3Y3",
      Transform.createIdentity(), 3, 3, undefined, nominalL1, nominalR1, undefined)!;
    const westernAustralianSpiral = ClothoidSeriesSpiral3d.create("WesternAustralian",
      Transform.createIdentity(), 2, 1, undefined, nominalL1, nominalR1, undefined)!;
    const spiral4 = ClothoidSeriesSpiral3d.create("ClothoidSeriesX3Y3",
      Transform.createIdentity(), 4, 4, undefined, nominalL1, nominalR1, undefined)!;
    for (const spiral of [simpleCubic, westernAustralianSpiral, aremaSpiral, spiral3, spiral4]) {
      const strokes = spiral.activeStrokes!;
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, strokes, x0, y0);
      /* 07/16 THIS TEST FAILS -- need better implementation of curveLengthBetweenFractions.
      if (strokes?.packedUVParams) {
        console.log("d,D", strokes.packedUVParams);
        const splitFraction = 3 / 7;
        const lengthA = spiral.curveLengthBetweenFractions(0.0, splitFraction);
        const lengthB = spiral.curveLengthBetweenFractions(splitFraction, 1.0);
        ck.testCoordinate(lengthA + lengthB, strokes.packedUVParams.back()!.y, splitFraction, lengthA, lengthB);
      }
      */
      y0 += 1;
    }
    expect(ck.getNumErrors()).equals(0);
    GeometryCoreTestIO.saveGeometry(allGeometry, "TransitionSpiral3d", "NamedApproximations");
  });
  it("SnapFunctions", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    let x0 = 0;
    const unitBox = Sample.createRectangle(0, 0, 1, 1, 0, true);
    const yDF = 0;
    const yF = 4;
    const yIF = 8;
    const snapFunctions = [
      new NormalizedClothoidTransition(),
      new NormalizedBlossTransition(),
      new NormalizedBiQuadraticTransition(),
      new NormalizedSineTransition(),
      new NormalizedCosineTransition()];
    for (const snap of snapFunctions) {
      console.log(" Snap Function ", snap);
      const lsF = LineString3d.create();
      const lsDF = LineString3d.create();
      const lsIF = LineString3d.create();
      ck.testCoordinate(0.5, snap.fractionToArea(1.0));
      const e0 = 1.0e-12;
      // verify approach at 0.5
      ck.testCoordinate(snap.fractionToCurvatureFraction(0.5 - e0), snap.fractionToCurvatureFraction(0.5 + e0), "continuous at 0.5");
      ck.testCoordinate(0.5, snap.fractionToArea(1.0));
      const df = 1.0 / 31.0;
      const derivativeTolerance = 1.0e-5;
      const e = 1.0e-3;
      let maxDerivativeError = 0;
      let trueDerivative;
      for (let f = 0.0; f <= 1.0; f += df) {
        lsF.packedPoints.pushXYZ(f, snap.fractionToCurvatureFraction(f), 0);
        lsDF.packedPoints.pushXYZ(f, (trueDerivative = snap.fractionToCurvatureFractionDerivative(f)), 0);
        lsIF.packedPoints.pushXYZ(f, snap.fractionToArea(f), 0);
        // if cleanly inside the interval and NOT bracketing 0.5, do a central-difference derivative check ...
        if (f - e >= 0 && f + e <= 1.0 && (f + e - 0.5) * (f - e - 0.5) > 0) {
          const approximateDerivative = (snap.fractionToCurvatureFraction(f + e) - snap.fractionToCurvatureFraction(f - e)) / (2 * e);
          const derivativeError = Math.abs(approximateDerivative - trueDerivative);
          maxDerivativeError = Math.max(derivativeError, maxDerivativeError);
          ck.testLE(Math.abs(approximateDerivative - trueDerivative), derivativeTolerance, "approximate derivative");
        }
        // verify symmetry ...
        ck.testCoordinate(snap.fractionToCurvatureFraction(f), 1 - snap.fractionToCurvatureFraction(1 - f));
      }
      console.log("    maxDerivativeError " + maxDerivativeError);
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, lsF, x0, yF);
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, lsDF, x0, yDF);
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, lsIF, x0, yIF);

      GeometryCoreTestIO.captureCloneGeometry(allGeometry, unitBox, x0, yF);
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, unitBox, x0, yDF);
      GeometryCoreTestIO.captureCloneGeometry(allGeometry, unitBox, x0, yIF);
      x0 += 5.0;
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "TransitionSpiral3d", "SnapFunctions");
    expect(ck.getNumErrors()).equals(0);
  });
  it("Types", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    const x0 = 0;
    let y0 = 0;
    const dyA = 0.5;
    const bearingChange = Angle.createDegrees(8);
    const r1 = 500;
    const length = bearingChange.radians / Geometry.meanCurvatureOfRadii(0, r1);
    const dxB = length;
    for (const spiralType of ["clothoid", "bloss", "biquadratic", "sine", "cosine"]) {
      let y1 = y0;
      for (const activeInterval of [Segment1d.create(0, 1), Segment1d.create(0.35, 0.75)]) {
        const spiralA = TransitionSpiral3d.createRadiusRadiusBearingBearing(
          Segment1d.create(0, 500), AngleSweep.createStartEndDegrees(0, 8),
          activeInterval, Transform.createIdentity(), spiralType);
        if (ck.testType<TransitionSpiral3d>(spiralA)) {
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, spiralA.activeStrokes, x0, y1);
          GeometryCoreTestIO.captureCloneGeometry(allGeometry, spiralA, x0 + dxB, y1);
        }
        y1 += dyA;
      }
      y0 += 2;
    }
    expect(ck.getNumErrors()).equals(0);
    GeometryCoreTestIO.saveGeometry(allGeometry, "TransitionSpiral3d", "Types");
  });

});
function xyString(name: string, x: number, y: number): string {
  return ("  (" + name + "  " + x + "  " + y + ")");
}
