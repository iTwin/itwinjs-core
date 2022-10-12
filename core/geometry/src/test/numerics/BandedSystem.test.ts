/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { BSplineCurveOps } from "../../bspline/BSplineCurveOps";
import { GeometryQuery } from "../../curve/GeometryQuery";
import { AngleSweep } from "../../geometry3d/AngleSweep";
import { GrowableXYZArray } from "../../geometry3d/GrowableXYZArray";
import { Point3d } from "../../geometry3d/Point3dVector3d";
import { BandedSystem } from "../../numerics/BandedSystem";
import { Sample } from "../../serialization/GeometrySamples";
import { Checker } from "../Checker";
import { GeometryCoreTestIO } from "../GeometryCoreTestIO";

/* eslint-disable no-console */
function maxDiff(arrayA: Float64Array, arrayB: Float64Array): number {
  let diff = 0.0;
  for (let i = 0; i < arrayA.length; i++) {
    const d = Math.abs(arrayA[i] - arrayB[i]);
    diff = Math.max(diff, d);
  }
  return diff;
}
/**
 * * "a" is expected to be a smallish fraction of the diagonal base so the system is diagonally dominant.
 * @param numRow number of rows
 * @param bw (full) bandwidth
 * @param diagonalBaseValue value for diagonals (varies with "a" effects)
 * @param a reference value for varying values, to be multiplied by cos(radians0 + i * radiansStep) with i advancing with each step across the rows.
 */
function createBandedTestSystem(numRow: number, bw: number, diagonalBaseValue = 1.0, a: number = 0.1, radians0: number = 0.0, radiansStep: number = 0.04): Float64Array {
  let radians = radians0;
  const matrix = new Float64Array(numRow * bw);
  const halfBand = Math.floor(bw / 2);
  let k = 0;
  for (let i = 0; i < numRow; i++) {
    for (let j = 0; j < bw; j++) {
      let q = a * Math.cos(radians);
      if (j === halfBand)
        q += diagonalBaseValue;
      radians += radiansStep;
      matrix[k++] = q;
    }
  }
  return matrix;
}
describe("BandedSystem", () => {
  it("HelloWorld", () => {
    const ck = new Checker();
    const numRow = 4;
    const bw = 3;
    const numRHS = 1;
    let a0 = 0;
    for (const a1 of [0, 0.1, 0.05]) {
      const bandedMatrix = new Float64Array([
        -3333, 2, a1,
        a0, 3, a1,
        a0, 4, a1,
        a0, 5, 1000]);
      if (Checker.noisy.bandedMatrix)
        console.log("bandedMatrix", bandedMatrix);
      // const solution0 = new Float64Array([1, 2, 3, 4, 5, 6, 7, 8]);
      const solution0 = new Float64Array([1, 2, 3, 4]);
      if (Checker.noisy.bandedMatrix)
        console.log("solution0", solution0);
      ck.testExactNumber(bandedMatrix.length, bw * numRow);
      ck.testExactNumber(solution0.length, numRHS * numRow);
      const rhs0 = BandedSystem.multiplyBandedTimesFull(numRow, bw, bandedMatrix, numRHS, solution0);
      if (Checker.noisy.bandedMatrix)
        console.log("rhs0", rhs0);
      const solution1 = BandedSystem.solveBandedSystemMultipleRHS(numRow, bw, bandedMatrix, numRHS, rhs0);
      if (ck.testDefined(solution1) && solution1) {
        const diff = maxDiff(solution0, solution1);
        ck.testLE(diff, 1.0e-10, " solution diff");
        if (Checker.noisy.bandedMatrix)
          console.log("solution1", solution1);
      }
      a0 = a1;
    }
    expect(ck.getNumErrors()).equals(0);
  });
  it("LargeSystem", () => {
    const ck = new Checker();
    const numRHS = 3;
    for (const bw of [3, 5, 7]) {
      for (const a of [0, 0.1, 0.05]) {
        const numRow = 10 + 2 * bw;
        const matrix = createBandedTestSystem(numRow, bw, 2.0, a);
        const solution0 = createBandedTestSystem(numRow, numRHS, 2.0, 0.2);
        ck.testExactNumber(matrix.length, bw * numRow);
        ck.testExactNumber(solution0.length, numRHS * numRow);
        const rhs0 = BandedSystem.multiplyBandedTimesFull(numRow, bw, matrix, numRHS, solution0);
        const solution1 = BandedSystem.solveBandedSystemMultipleRHS(numRow, bw, matrix, numRHS, rhs0);
        if (ck.testDefined(solution1) && solution1) {
          const diff = maxDiff(solution0, solution1);
          ck.testLE(diff, 1.0e-10, " solution diff");
        }
      }
    }
    expect(ck.getNumErrors()).equals(0);
  });

  it("LargeSystem", () => {
    const ck = new Checker();
    const numRHS = 3;
    for (const bw of [3, 5, 7]) {
      for (const a of [0, 0.1, 0.05]) {
        const numRow = 10 + 2 * bw;
        const matrix = createBandedTestSystem(numRow, bw, 2.0, a);
        const solution0 = createBandedTestSystem(numRow, numRHS, 2.0, 0.2);
        ck.testExactNumber(matrix.length, bw * numRow);
        ck.testExactNumber(solution0.length, numRHS * numRow);
        const rhs0 = BandedSystem.multiplyBandedTimesFull(numRow, bw, matrix, numRHS, solution0);
        const solution1 = BandedSystem.solveBandedSystemMultipleRHS(numRow, bw, matrix, numRHS, rhs0);
        if (ck.testDefined(solution1) && solution1) {
          const diff = maxDiff(solution0, solution1);
          ck.testLE(diff, 1.0e-10, " solution diff");
        }
      }
    }
    expect(ck.getNumErrors()).equals(0);
  });
  it("GrevilleBspline", () => {
    const ck = new Checker();
    const allGeometry: GeometryQuery[] = [];
    let x0 = 0;
    const allPoints: GrowableXYZArray[] = [];
    allPoints.push(GrowableXYZArray.create([Point3d.create(1, 0, 0), Point3d.create(2, 3, 0), Point3d.create(3, 6, 0), Point3d.create(4, 9, 0)]));
    for (const yFactor of [1, 1.5, 2]) {
      for (const yy of [1, 3, 5])
        allPoints.push(GrowableXYZArray.create([Point3d.create(0, 0, 0), Point3d.create(0, yy, 0), Point3d.create(4, yFactor * yy + 1, 0), Point3d.create(5, 0, 0)]));
    }
    allPoints.push(GrowableXYZArray.create([[0, 0], [0, 1], [1, 1], [1, 0], [2, 0], [2, 1], [3, 1]]));
    for (const count of [5, 6, 10])
      allPoints.push(Sample.createGrowableArrayCirclePoints(3, count, true, 0, 0));
    allPoints.push(GrowableXYZArray.create(
      Sample.createPointSineWave(undefined, 25, 6.25,
        2.0, AngleSweep.createStartEndDegrees(0, 300),
        0.5, AngleSweep.createStartEndDegrees(0, 200))));
    for (const points of allPoints) {
      let y0 = 0;
      const range = points.getRange();
      for (const order of [4, 3, 5, 7]) {
        if (points.length >= order) {
          for (const q of points.points) GeometryCoreTestIO.createAndCaptureXYCircle(allGeometry, q, 0.15, x0, y0);
          const curve = BSplineCurveOps.createThroughPoints(points, order);
          if (curve) {
            GeometryCoreTestIO.captureCloneGeometry(allGeometry, curve, x0, y0);
            for (const f of [0.25, 0.50, 0.75]) GeometryCoreTestIO.createAndCaptureXYMarker(allGeometry, 4, curve.fractionToPoint(f), 0.10, x0, y0);
          }
          y0 += 1.5 * range.yLength();
        }
      }
      x0 += 3.0 * range.xLength();
    }
    GeometryCoreTestIO.saveGeometry(allGeometry, "BandedSystem", "GrevilleBspline");
    expect(ck.getNumErrors()).equals(0);
  });

});
