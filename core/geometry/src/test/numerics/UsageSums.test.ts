/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { UsageSums } from "../../numerics/UsageSums";
import { Checker } from "../Checker";

/* eslint-disable no-console */

describe("UsageSums", () => {
  it("HelloWorld", () => {
    const ck = new Checker();
    const a = 3.5;
    const usageSumsFrom0 = new UsageSums();
    const usageSumsFromA = new UsageSums(a);
    ck.testExactNumber(a, usageSumsFromA.origin, "origin property get");
    const data = [2, 4, 4, 4, 5, 5, 7, 9];
    usageSumsFrom0.accumulateArray(data);
    ck.testTrue(usageSumsFrom0.isAlmostEqual(usageSumsFrom0), "isAlmostEqual identity");
    usageSumsFromA.accumulateArray(data);
    ck.testFalse(usageSumsFrom0.isAlmostEqual(usageSumsFromA), "isAlmostEqual is false for shifted origin data.");
    // direct expected results per https://en.wikipedia.org/wiki/Standard_deviation
    ck.testCoordinate(5.0, usageSumsFrom0.mean, "mean");
    ck.testCoordinate(2.0, usageSumsFrom0.standardDeviation, "mean");

    const rangeFrom0 = usageSumsFrom0.minMax;
    const rangeFromA = usageSumsFromA.minMax;
    const shiftedRange = rangeFrom0.cloneTranslated(-a);
    ck.testRange1d(rangeFromA, shiftedRange);
    const cloneA0 = usageSumsFromA.clone(new UsageSums());
    ck.testTrue(usageSumsFromA.isAlmostEqual(cloneA0));
    const cloneA1 = usageSumsFromA.clone();
    const cloneA2 = usageSumsFromA.clone();
    cloneA0.accumulate(a);  // changes count, not sums, not minMax
    ck.testFalse(usageSumsFromA.isAlmostEqual(cloneA0));
    cloneA1.accumulate(a + 1);
    ck.testFalse(cloneA0.isAlmostEqual(cloneA1), "matched count, minMax, different sums");
    cloneA2.accumulate(100);
    ck.testFalse(cloneA2.isAlmostEqual(cloneA1));

    // shift usageSumsA back to simple origin ...
    usageSumsFromA.shiftOriginAndSums(0.0);
    ck.testTrue(usageSumsFrom0.isAlmostEqual(usageSumsFromA), "isAlmostEqual after origin shift");
    ck.testCoordinate(5.0, usageSumsFromA.mean, "mean");
    ck.testCoordinate(2.0, usageSumsFromA.standardDeviation, "mean");
    // confirm alternate formula ...
    const eXX = usageSumsFrom0.meanSquare;
    const aX = usageSumsFrom0.mean;
    ck.testCoordinate(usageSumsFromA.standardDeviation, Math.sqrt(eXX - aX * aX), " alternate formula for std deviation");
    usageSumsFromA.clearSums();
    ck.testExactNumber(0, usageSumsFromA.standardDeviation, "std dev with no data");
    ck.testExactNumber(0, usageSumsFromA.mean, "mean with no data");
    ck.testExactNumber(0, usageSumsFromA.count, "count with no data");
    ck.testExactNumber(0, usageSumsFromA.meanSquare, "meanSquare with no data");
    const origin = 5;
    usageSumsFromA.setOrigin(origin);
    usageSumsFromA.accumulateArray(data);
    ck.testCoordinate(usageSumsFromA.standardDeviation, usageSumsFrom0.standardDeviation, "recheck with different origin.");
    expect(ck.getNumErrors()).equals(0);
  });
});
