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

});
