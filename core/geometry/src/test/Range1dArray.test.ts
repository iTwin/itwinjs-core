/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { Geometry } from "../Geometry";
import { Range1d } from "../geometry3d/Range";
import { Range1dArray, compareRange1dLexicalLowHigh } from "../numerics/Range1dArray";
import { Checker } from "./Checker";
import { expect } from "chai";
import { GrowableFloat64Array } from "../geometry3d/GrowableFloat64Array";
// import { prettyPrint } from "./testFunctions";
/* tslint:disable:no-console */

/**
 * Return an array consisting of:
 * * an optional value to the left of data[0]
 * * an optional value within each pair of adjacent values in data
 * * an optional point to the right.
 * @param data array of values
 * @param leftDelta (optinoal) (signed) shift from data[0] to first output point.  Negative is to left !!!
 * @param interiorFraction (optional) internal interplation fraction to be used in each interval
 * @param rightDelta (optional) (signed) shfit from data[last] to last output point.   Poisitive is to the right!!!
 */
function constructGapPoints(data: GrowableFloat64Array, leftDelta: undefined | number, interiorFraction: undefined | number, rightDelta: undefined | number): GrowableFloat64Array {
  const result = new GrowableFloat64Array();
  if (data.length > 0) {
    let a = data.at(0);
    let b;
    if (leftDelta !== undefined)
      result.push(a + leftDelta);
    if (interiorFraction !== undefined) {
      for (let i = 1; i < data.length; i++ , a = b) {
        b = data.at(i);
        result.push(Geometry.interpolate(a, interiorFraction, b));
      }
      if (rightDelta !== undefined)
        result.push(a + rightDelta);
    }
  }
  return result;
}

function cloneRanges(data: Range1d[]): Range1d[] {
  const result = [];
  for (const range of data)
    result.push(range.clone());
  return result;
}

function testUnionSimplify(ck: Checker, dataA: Range1d[]): void {
  const dataB = cloneRanges(dataA);
  Range1dArray.simplifySortUnion(dataB, true);
  ck.testTrue(Range1dArray.isSorted(dataB), "Disjoint after Union fix");
  const breakDataB = Range1dArray.getBreaks(dataB, undefined, true, true);
  const testPointsB = constructGapPoints(breakDataB, -0.5, 0.4, 0.5);
  const breakDataA = Range1dArray.getBreaks(dataA, undefined, true, true);
  const testPointsA = constructGapPoints(breakDataA, -0.5, 0.4, 0.5);
  for (const testPoints of [testPointsA, testPointsB])
    for (let i = 0; i < testPoints.length; i++) {
      {
        const value = testPoints.at(i);
        const inA = Range1dArray.testUnion(dataA, value);
        const inB = Range1dArray.testUnion(dataB, value);
        ck.testBoolean(inA, inB, "Union simplification agrees");
      }
    }
}

/* test that the ranges in dataA are properly simplified by parity rules */
function testParitySimplify(ck: Checker, dataA: Range1d[]): void {
  const dataB = cloneRanges(dataA);
  Range1dArray.simplifySortParity(dataB, true);
  ck.testTrue(Range1dArray.isSorted(dataB), "Disjoint after Union fix");
  const breakDataB = Range1dArray.getBreaks(dataB, undefined, true, true);
  const testPointsB = constructGapPoints(breakDataB, -0.5, 0.4, 0.5);
  const breakDataA = Range1dArray.getBreaks(dataA, undefined, true, true);
  const testPointsA = constructGapPoints(breakDataA, -0.5, 0.4, 0.5);
  for (const testPoints of [testPointsA, testPointsB])
    for (let i = 0; i < testPoints.length; i++) {
      {
        const value = testPoints.at(i);
        const inA = Range1dArray.testParity(dataA, value);
        const inB = Range1dArray.testParity(dataB, value);
        ck.testBoolean(inA, inB, "Union simplification agrees");
      }
    }
}

/** Returns an array of values that fall inside both sorted range arrays.
 *  Note: n^2 complexity due to few # of entries and being test function
 */
function getOverlapData(dataA: Range1d[], dataB: Range1d[]): number[] {
  const result: number[] = [];
  for (const rangeA of dataA) {
    for (const rangeB of dataB) {
      if (rangeA.low < rangeB.low && (rangeA.high - .02) > rangeB.low) {
        result.push(rangeA.high - .02);
      } else if (rangeB.low < rangeA.low && (rangeB.high - .02) > rangeA.low) {
        result.push(rangeB.high - .02);
      }
    }
  }

  return result;
}

/** Returns an array of values that fall inside one but not both arrays.
 *  Note: n^2 complexity due to few # of entries and being test function
 */
function getSingleArrayData(dataA: Range1d[], dataB: Range1d[]): number[] {
  const result: number[] = [];
  for (const rangeA of dataA) {
    let toCheck0: number | undefined = rangeA.low + Math.abs(rangeA.high - rangeA.low) * .25;
    let toCheck1: number | undefined = rangeA.low + Math.abs(rangeA.high - rangeA.low) * .50;
    let toCheck2: number | undefined = rangeA.low + Math.abs(rangeA.high - rangeA.low) * .75;

    for (const rangeB of dataB) {
      if (rangeB.containsX(toCheck0!)) toCheck0 = undefined;
      if (rangeB.containsX(toCheck1!)) toCheck1 = undefined;
      if (rangeB.containsX(toCheck2!)) toCheck2 = undefined;
    }

    if (toCheck0) result.push(toCheck0);
    if (toCheck1) result.push(toCheck1);
    if (toCheck2) result.push(toCheck2);
  }

  return result;
}

/**
 * Returns an object containing two arrays of data that should and should not fall
 * inside of a computed parity range array from the two arrays given.
 * Note: n^2 complexity due to few # of entries and being test function
 */
function getParityArrayData(dataA: Range1d[], dataB: Range1d[]): any {
  const inResult: number[] = [];
  const outResult: number[] = [];

  for (const rangeA of dataA) {
    let counter0 = 1;
    let counter1 = 1;
    let counter2 = 1;
    const toCheck0: number | undefined = rangeA.low + Math.abs(rangeA.high - rangeA.low) * .25;
    const toCheck1: number | undefined = rangeA.low + Math.abs(rangeA.high - rangeA.low) * .50;
    const toCheck2: number | undefined = rangeA.low + Math.abs(rangeA.high - rangeA.low) * .75;

    for (const rangeB of dataB) {
      if (rangeB.containsX(toCheck0!)) counter0++;
      if (rangeB.containsX(toCheck1!)) counter1++;
      if (rangeB.containsX(toCheck2!)) counter2++;
    }

    if (counter0 % 2 === 0)
      outResult.push(toCheck0);
    else
      inResult.push(toCheck0);

    if (counter1 % 2 === 0)
      outResult.push(toCheck1);
    else
      inResult.push(toCheck1);

    if (counter2 % 2 === 0)
      outResult.push(toCheck2);
    else
      inResult.push(toCheck2);
  }

  return { insideParity: inResult, outsideParity: outResult };
}

// return an array of ranges with each range
// {low: cos (omega * i), high: cos (omega * i * i + alpha)}
function range1dSamples(numRange: number, omega: number = 3.0, alpha: number = 0.2): Range1d[] {
  const result = [];
  for (let i = 0; i < numRange; i++) {
    const a = Math.cos(omega * i);
    const b = Math.cos(omega * i * i + alpha);
    result.push(Range1d.createXX(a, b));
  }
  return result;
}

describe("Range1dArray", () => {

  it("compareRange1dLexicalLowHigh", () => {
    const ck = new Checker();
    ck.testExactNumber(-1, compareRange1dLexicalLowHigh(Range1d.createXX(0, 1), Range1d.createXX(0, 2)));
    ck.testExactNumber(1, compareRange1dLexicalLowHigh(Range1d.createXX(0, 3), Range1d.createXX(0, 2)));

    ck.testExactNumber(-1, compareRange1dLexicalLowHigh(Range1d.createXX(-1, 1), Range1d.createXX(0, 1)));
    ck.testExactNumber(1, compareRange1dLexicalLowHigh(Range1d.createXX(2, 3), Range1d.createXX(0, 2)));
    ck.testExactNumber(0, compareRange1dLexicalLowHigh(Range1d.createXX(2, 3), Range1d.createXX(2, 3)));
    expect(ck.getNumErrors()).equals(0);

  });

  it("UnionParitySimplification", () => {
    const ck = new Checker();
    const range0 = [Range1d.createXX(0, 0), Range1d.createXX(0, 4), Range1d.createXX(2, 7), Range1d.createXX(8, 10), Range1d.createXX(9, 10)];
    const range1 = [Range1d.createXX(0, 0), Range1d.createXX(0, 4), Range1d.createXX(2, 7), Range1d.createXX(8, 10), Range1d.createXX(9, 10)];
    const range2 = [Range1d.createXX(0, 5), Range1d.createXX(3, 6), Range1d.createXX(7, 20), Range1d.createXX(8, 21)];
    const range3 = range1dSamples(10, 3.0, 0.2);
    const range4 = [Range1d.createXX(0, 4), Range1d.createXX(0, 3), Range1d.createXX(2, 7), Range1d.createXX(2, 10)];

    for (const ranges of [range0, range1, range2, range3, range4]) {
      ck.testFalse(Range1dArray.isSorted(ranges), "Expect messy input", ranges);
      const workA = cloneRanges(ranges);
      const workB = cloneRanges(ranges);
      testParitySimplify(ck, workA);
      testUnionSimplify(ck, workB);
    }

    ck.checkpoint("Range1dArray.UnionParitySimplification");
    expect(ck.getNumErrors()).equals(0);
  });

  it("IntersectDifferenceUnionParity", () => {
    const ck = new Checker();
    // Set up the arrays
    const range0 = range1dSamples(10, 3.0, 0.2);
    Range1dArray.simplifySortParity(range0);
    const range1 = [Range1d.createXX(-.9, -.75), Range1d.createXX(-.5, -.3), Range1d.createXX(0, .4), Range1d.createXX(.8, 1)];

    // Grab the expected data
    const overlapData = getOverlapData(range0, range1);
    const singleData = getSingleArrayData(range0, range1);

    // Call the four types of sort methods
    const diffResult = Range1dArray.differenceSorted(range0, range1);
    const intersectResult = Range1dArray.intersectSorted(range0, range1);
    const unionResult = Range1dArray.unionSorted(range0, range1);
    const parityResult = Range1dArray.paritySorted(range0, range1);

    for (const i of overlapData) {
      ck.testFalse(Range1dArray.testUnion(diffResult, i));
      ck.testTrue(Range1dArray.testUnion(intersectResult, i));
      ck.testTrue(Range1dArray.testUnion(unionResult, i));
    }
    for (const i of singleData) {
      ck.testTrue(Range1dArray.testUnion(diffResult, i));
      ck.testFalse(Range1dArray.testUnion(intersectResult, i));
      ck.testTrue(Range1dArray.testUnion(unionResult, i));
      ck.testTrue(Range1dArray.testUnion(parityResult, i));
    }

    // Test parity results a little more harshly in terms of multiple overlaps
    const parityExpectations = getParityArrayData(range0, range1);
    for (const i of parityExpectations.insideParity)
      ck.testTrue(Range1dArray.testUnion(parityResult, i));
    for (const i of parityExpectations.outsideParity)
      ck.testFalse(Range1dArray.testUnion(parityResult, i));

    ck.testFalse(Range1dArray.testUnion([Range1d.createXX(-1.02, -1.01)], 0));
    ck.testFalse(Range1dArray.testUnion([Range1d.createXX(1.01, 1.02)], 0));

    // Test the length and breaks of a given range array
    ck.testCoordinate(.95, Range1dArray.sumLengths(range1), "Hard coded range array has length of expected value");
    ck.testTrue(Range1dArray.isSorted(range0, false), "Generated range array is reported as sorted.");

    ck.checkpoint("Range1dArray.IntersectDifferenceUnionParity");
    expect(ck.getNumErrors()).equals(0);
  });

  it("UnionParitySimplificationA", () => {
    const ck = new Checker();
    for (const allRanges of [
      range1dSamples(3, 2.0, 0.5),
      range1dSamples(20, 2.94, 0.34234),
    ]) {
      testUnionSimplify(ck, allRanges);
      testParitySimplify(ck, allRanges);
    }
    expect(ck.getNumErrors()).equals(0);
  });

});
