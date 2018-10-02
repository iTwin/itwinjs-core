/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { Geometry } from "../Geometry";
import { } from "../geometry3d/PointVector";
import { Range1d } from "../geometry3d/Range";
import { Range1dArray } from "../numerics/Range1dArray";
import { Checker } from "./Checker";
import { expect } from "chai";
import { GrowableFloat64Array } from "../geometry3d/GrowableArray";
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
  const breakData = Range1dArray.getBreaks(dataB);
  const interiorData = constructGapPoints(breakData, -0.5, 0.4, 0.5);
  for (let i = 0; i < interiorData.length; i++) {
    const value = interiorData.at(i);
    const inA = Range1dArray.testUnion(dataA, value);
    const inB = Range1dArray.testUnion(dataB, value);
    ck.testBoolean(inA, inB, "Union simplification agrees");
  }
}

/* test that the ranges in dataA are properly simplified by parity rules */
function testParitySimplify(ck: Checker, dataA: Range1d[]): void {
  const dataB = cloneRanges(dataA);
  Range1dArray.simplifySortParity(dataB, true);
  // simplified array should be sorted ....
  ck.testTrue(Range1dArray.isSorted(dataB), "Disjoint after Parity fix");
  const breakData = Range1dArray.getBreaks(dataB);
  const interiorData = constructGapPoints(breakData, -0.5, 0.4, 0.5);
  // all points should get same parity evaluation whether in sorted or unsorted array ....
  for (let i = 0; i < interiorData.length; i++) {
    const value = interiorData.at(i);
    const inA = Range1dArray.testParity(dataA, value);
    const inB = Range1dArray.testParity(dataB, value);
    ck.testBoolean(inA, inB, "Parity simplification agrees");
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

describe("Range1dArray", () => {
  let ck: Checker;
  let rangeArr: Range1d[];

  before (() => {
    ck = new Checker();
    rangeArr = [];
    const omega = 3.0;
    const alpha = 0.2;
    for (let i = 0; i < 10; i++) {
      const a = Math.cos(omega * i);
      const b = Math.cos(omega * i * i + alpha);
      rangeArr.push(Range1d.createXX(a, b));
    }
  });

  it("UnionParitySimplification", () => {
    const range0 = [Range1d.createXX(0, 0), Range1d.createXX(0, 4), Range1d.createXX(2, 7), Range1d.createXX(8, 10), Range1d.createXX(9, 10)];
    const range1 = [Range1d.createXX(0, 0), Range1d.createXX(0, 4), Range1d.createXX(2, 7), Range1d.createXX(8, 10), Range1d.createXX(9, 10)];
    const range2 = [Range1d.createXX(0, 5), Range1d.createXX(3, 6), Range1d.createXX(7, 20), Range1d.createXX(8, 21)];
    const range3 = cloneRanges(rangeArr);

    // confirm that all of these are messy to start ....
    ck.testFalse(Range1dArray.isSorted(range0), "Expect messy input", range0);
    ck.testFalse(Range1dArray.isSorted(range1), "Expect messy input", range1);
    ck.testFalse(Range1dArray.isSorted(range2), "Expect messy input", range2);
    ck.testFalse(Range1dArray.isSorted(range3), "Expect messy input", range3);

    testParitySimplify(ck, range0);
    testParitySimplify(ck, range1);
    testParitySimplify(ck, range2);
    testParitySimplify(ck, range3);

    testUnionSimplify(ck, range0);
    testUnionSimplify(ck, range1);
    testUnionSimplify(ck, range2);
    testUnionSimplify(ck, range3);

    ck.checkpoint("Range1dArray.UnionParitySimplification");
    expect(ck.getNumErrors()).equals(0);
  });

  it("IntersectDifferenceUnionParity", () => {
    // Set up the arrays
    const range0 = cloneRanges(rangeArr);
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
});
