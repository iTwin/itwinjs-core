/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { Checker } from "../Checker";
import { Transform } from "../../geometry3d/Transform";
import { AustralianRailCorpXYEvaluator } from "../../curve/spiral/AustralianRailCorpXYEvaluator";
import { DirectSpiral3d } from "../../curve/spiral/DirectSpiral3d";
import { Range1d } from "../../geometry3d/Range";
import { CzechSpiralEvaluator } from "../../curve/spiral/CzechSpiralEvaluator";
import { Quadrature } from "../../numerics/Quadrature";

/* eslint-disable no-console */
describe("AustralianRailCorpSpiral", () => {
  it("HelloWorld", () => {
    const ck = new Checker();
    const nominalLength1 = 100.0;
    for (const nominalRadius1 of [400, 1000]) {
      // const highPrecisionAxisLength1 = AustralianRailCorpXYEvaluator.radiusAndNominalLengthToAxisLength(nominalRadius1, nominalLength1, 1.0e-12, 3);
      for (const tol1 of [1.0e-4, 1.0e-5, 1.0e-8, 1.0e-12]) {
        const axisLength1 = AustralianRailCorpXYEvaluator.radiusAndNominalLengthToAxisLength(nominalRadius1, nominalLength1, tol1, 1);
        ck.testLE(axisLength1, nominalLength1);
      }

      // Demonstrate the scaling at creation time versus applied to clone have the same effect.
      const evaluator1 = AustralianRailCorpXYEvaluator.create(nominalRadius1, nominalLength1)!;
      for (const scaleFactor of [1.0, 2.0, 5.0]) {
        const evaluatorA = AustralianRailCorpXYEvaluator.create(nominalRadius1 * scaleFactor, nominalLength1 * scaleFactor)!;
        const evaluatorB = evaluator1.clone();
        evaluatorB.scaleInPlace(scaleFactor);
        for (const fraction of [0, 0.2, 0.8, 1.0]) {
          const x1 = evaluator1.fractionToX(fraction);
          const y1 = evaluator1.fractionToY(fraction);
          const xA = evaluatorA.fractionToX(fraction);
          const yA = evaluatorA.fractionToY(fraction);
          const xB = evaluatorB.fractionToX(fraction);
          const yB = evaluatorB.fractionToY(fraction);
          ck.testTightNumber(x1 * scaleFactor, xA, " x from scaled construction");
          ck.testTightNumber(y1 * scaleFactor, yA, " y from scaled construction");
          ck.testTightNumber(x1 * scaleFactor, xB, "x from scaled clone");
          ck.testTightNumber(y1 * scaleFactor, yB, "y from scaled clone");

        }
      }

      const spiral = DirectSpiral3d.createAustralianRail(Transform.createIdentity(), nominalLength1, nominalRadius1)!;
      const evaluator = spiral.evaluator as AustralianRailCorpXYEvaluator;
      const distanceRoundTripErrorRange = Range1d.createNull();
      for (const fractionOfDistance of [0, 0.2, 0.8, 1.0]) {
        const distanceA = fractionOfDistance * spiral.nominalL1;

        const xA = evaluator.distanceAlongSpiralToAustralianApproximateX(distanceA);
        const fractionOfX = evaluator.xToFraction(xA);
        const distanceB = spiral.curveLengthBetweenFractions(0, fractionOfX);
        distanceRoundTripErrorRange.extendX(distanceA - distanceB);
      }
      console.log(distanceRoundTripErrorRange);
    }
    ck.checkpoint("AustralianRailCorpSpiral.HelloWorld");
    expect(ck.getNumErrors()).equals(0);
  });

  it("CzechDistanceApproximation", () => {
    const ck = new Checker();
    const nominalLength1 = 100.0;
    const noisy = Checker.noisy.czechSpiralDistanceChecks;
    for (const nominalRadius1 of [400, 1000]) {
      const spiral = DirectSpiral3d.createCzechCubic(Transform.createIdentity(), nominalLength1, nominalRadius1)!;
      const evaluator = spiral.evaluator as CzechSpiralEvaluator;
      const gaussLength10 = Quadrature.doGaussIntegral(0, 1, (f1: number) => evaluator.fractionToTangentMagnitude(f1), 10);
      const gaussLength5 = Quadrature.doGaussIntegral(0, 1, (f2: number) => evaluator.fractionToTangentMagnitude(f2), 10);
      ck.testCoordinate(gaussLength10, gaussLength5, "gauss length comparison");
      const czechLength = evaluator.xToCzechApproximateDistance(nominalLength1);
      // crude test ...
      const e = gaussLength10 - nominalLength1;
      const f = Math.abs(czechLength - gaussLength10);
      ck.testLE(f, 0.01 * e, " confirm czech excess length within 1%");
      if (noisy)
        console.log({ czechLengthA: czechLength, gaussLengthA: gaussLength10, fOverE: f / e });
      const distanceRoundTripErrorRange = Range1d.createNull();
      for (const fractionOfX of [0, 0.2, 0.8, 1.0]) {
        const xA = fractionOfX * spiral.nominalL1;
        const distanceA = evaluator.xToCzechApproximateDistance(xA);
        const xB = evaluator.czechApproximateDistanceToX(distanceA);
        if (ck.testIsFinite(xB, "czech invert"))
          distanceRoundTripErrorRange.extendX(xA - xB);
      }
      if (noisy)
        console.log(distanceRoundTripErrorRange);
      ck.testLT(distanceRoundTripErrorRange.length(), 1.e-12);
    }
    expect(ck.getNumErrors()).equals(0);
  });
  it("Coverage", () => {
    const ck = new Checker();
    const r1 = 300;
    const l1 = 100;
    const spiral = DirectSpiral3d.createAustralianRail(Transform.createIdentity(), l1, r1)!;
    const evaluator = spiral.evaluator as AustralianRailCorpXYEvaluator;
    ck.testExactNumber(l1, evaluator.nominalLength1);
    ck.testExactNumber(r1, evaluator.nominalRadius1);
    const spiral1 = DirectSpiral3d.createAustralianRail(Transform.createIdentity(), 2 * r1, l1);
    const spiral2 = DirectSpiral3d.createAustralianRail(Transform.createIdentity(), r1, 2 * l1);
    ck.testTrue(spiral.isAlmostEqual(spiral));
    ck.testFalse(spiral.isAlmostEqual(spiral1));
    ck.testFalse(spiral.isAlmostEqual(spiral2));
    // force phi into an error branch for large expr2 ...
    const phiA0 = AustralianRailCorpXYEvaluator.radiusAndAxisLengthToPhi(1, 100);
    const phiA1 = AustralianRailCorpXYEvaluator.radiusAndAxisLengthToPhi(1, 110);
    ck.testExactNumber(phiA0, phiA1, "limit case phi");
    const phiB0 = AustralianRailCorpXYEvaluator.radiusAndAxisLengthToPhi(-1, 100);
    const phiB1 = AustralianRailCorpXYEvaluator.radiusAndAxisLengthToPhi(-1, 110);
    ck.testExactNumber(phiB0, phiB1, "limit case phi");

    // confirm unequal phi for reasonable sizing
    const phiC0 = AustralianRailCorpXYEvaluator.radiusAndAxisLengthToPhi(200, 10);
    const phiC1 = AustralianRailCorpXYEvaluator.radiusAndAxisLengthToPhi(200, 12);
    const phiC2 = AustralianRailCorpXYEvaluator.radiusAndAxisLengthToPhi(200, 14);
    ck.testTrue((phiC2 - phiC1) * (phiC1 - phiC0) > 0, "normal phi variation is monotone");
    ck.testFalse(evaluator.isAlmostEqual(undefined));
    expect(ck.getNumErrors()).equals(0);
});
});
