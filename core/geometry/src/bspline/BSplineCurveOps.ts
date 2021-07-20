/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Bspline
 */

/* eslint-disable @typescript-eslint/naming-convention, no-empty, no-console*/

import { GrowableXYZArray } from "../geometry3d/GrowableXYZArray";
import { IndexedXYZCollection } from "../geometry3d/IndexedXYZCollection";
import { Point3d } from "../geometry3d/Point3dVector3d";
import { BandedSystem } from "../numerics/BandedSystem";
import { BSplineCurve3d } from "./BSplineCurve";
import { KnotVector } from "./KnotVector";
import { InterpolationCurve3dOptions } from "./InterpolationCurve3d";
import { create } from "domain";

/**
 * A class with static methods for creating B-spline curves.
 * @public
 */
export class BSplineCurveOps {
  /**
   * Greville knot algorithm: alternative to traditional c2 cubic algorithm allowing for any order, but no end conditions or periodicity.
   * @param points pass-through points.
   * @param order bspline order (1 more than degree)
   */
  public static createThroughPoints(points: IndexedXYZCollection | Point3d[], order: number): BSplineCurve3d | undefined {
    const numPoints = points.length;
    if (order > numPoints || order < 2)
      return undefined;
    const degree = order - 1;
    const bw = 1 + 2 * degree;    // probably less than that . . just zeros at fringe.
    const matrix = new Float64Array(bw * numPoints);
    const basisFunctions = new Float64Array(order);
    const rhs = new GrowableXYZArray();
    const knots = KnotVector.createUniformClamped(numPoints, order - 1, 0.0, 1.0);
    const xyz = Point3d.create();
    for (let basePointIndex = 0; basePointIndex < numPoints; basePointIndex++) {
      const u = knots.grevilleKnot(basePointIndex);
      const spanIndex = knots.knotToLeftKnotIndex(u);
      knots.evaluateBasisFunctions(spanIndex, u, basisFunctions);
      // puzzlement .. how do the max points shift within the order spots?
      let maxIndex = 0;
      for (let i = 1; i < order; i++)
        if (basisFunctions[i] > basisFunctions[maxIndex])
          maxIndex = i;
      const basisFunctionStartWithinRow = degree - maxIndex;
      const rowStart = basePointIndex * bw;
      for (let i = 0; i < order; i++) {
        const realColumn = basePointIndex - degree + basisFunctionStartWithinRow + i;
        if (rowStart + realColumn >= 0 && realColumn < numPoints)
          matrix[rowStart + basisFunctionStartWithinRow + i] = basisFunctions[i];
      }
      if (points instanceof IndexedXYZCollection) {
        rhs.push(points.getPoint3dAtUncheckedPointIndex(basePointIndex, xyz));
      } else {
        rhs.push(points[basePointIndex]);
      }
    }
    const poles = BandedSystem.solveBandedSystemMultipleRHS(numPoints, bw, matrix, 3, rhs.float64Data());
    if (poles) {
      return BSplineCurve3d.create(poles, knots.knots, order);
    }
    return undefined;
  }

  /**
   * Construct BSplineCurve3d that fit points using the C2 cubic algorithm.
   * @param options curve definition, possibly modified
   */
  public static createThroughPointsC2Cubic(options: InterpolationCurve3dOptions): BSplineCurve3d | undefined {
    if (!this.C2CubicFit.validateOptions(options))
      return undefined;

    const poles = this.C2CubicFit.constructPoles(options);
    if (undefined === poles)
      return undefined;

    const knots = this.C2CubicFit.getFullKnotVector(options);

    return BSplineCurve3d.create(poles, knots, 4);
    // TODO: construct as per native code, forcing order = 4, ignoring weights
    // TODO: remove first/last (wraparound) knot per new convention
    // TODO: if periodic, need to wrap poles around:
    //    - add first 3 poles to end, keep knots same
    //    - set BSplineWrapMode.OpenByAddingControlPoints
  }
}

export namespace BSplineCurveOps {
  /**
   * A helper class for creating C2 cubic fit curves.
   * @private
   */
  export class C2CubicFit {
    /** Transform knots to span [0,1]
     * @param knots fit parameters, normalized in place
     */
    private static normalizeKnots(knots: number[] | undefined): boolean {
      if (undefined === knots || knots.length < 2) {
        knots = undefined;
        return false;
      }
      const myKnots = KnotVector.create(knots, 1, false);
      if (myKnots.knotLength01 < KnotVector.knotTolerance) {
        knots = undefined;
        return false;
      }
      for (let i = 0; i < myKnots.numSpans; ++i) {
        knots[i] = myKnots.spanFractionToFraction(i, 0.0);
      }
      knots[knots.length - 1] = 1.0;
      return true;
    }

    /** Compute chord-length fit parameters for C2 cubic fit algorithm */
    private static constructChordLengthParams(fitPoints: Point3d[]): number[] | undefined {

    }

    /** Compute uniform fit parameters for C2 cubic fit algorithm */
    private static constructUniformParams(numParams: number): number[] {
      const knots = KnotVector.createUniformClamped(numParams + 2, 3, 0.0, 1.0);
      return knots.knots.slice(knots.leftKnotIndex, knots.rightKnotIndex));
    }

    /** Return number of computed poles */
    private static getNumPoles(numFitPoints: number, closed: boolean): number {
      return closed ? numFitPoints - 1 : numFitPoints + 2;
    }

    /** Return number of intervals between fit points */
    private static getNumIntervals(numFitPoints: number): number {
      return numFitPoints - 1;
    }

    /** Remove duplicate fit points, and their given knots in parallel */
    private static removeDuplicateFitPoints(options: InterpolationCurve3dOptions): boolean {
      if (undefined !== options.knots && options.knots.length !== options.fitPoints.length)
        options.knots = undefined;

      // get indices of duplicate points to be removed
      const newPts = GrowableXYZArray.create(options.fitPoints);
      const indices = newPts.findOrderedDuplicates();
      newPts.clear();

      // remove duplicate fit points
      for (let iRead = 0, iIndex = 0; iRead < options.fitPoints.length; ++iRead) {
        if (iRead === indices[iIndex])
          ++iIndex; // skip the duplicate
        else
          newPts.push(options.fitPoints[iRead]);
      }
      options.fitPoints = newPts.getPoint3dArray();

      // remove params corresponding to removed fit points
      if (undefined !== options.knots) {
        const newKnots: number[] = [];
        for (let iRead = 0, iIndex = 0; iRead < options.knots.length; ++iRead) {
          if (iRead === indices[iIndex])
            ++iIndex; // skip
          else
            newKnots.push(options.knots[iRead]);
        }
        options.knots = newKnots.slice();
      }
      return true;
    }

    /** Construct the fit parameters for the c2 cubic fit algorithm
     * @param options validated as per validateOptions, possibly modified
     */
     private static constructParams(options: InterpolationCurve3dOptions) {
      if (undefined === options.knots) {
        if (options.isChordLenKnots || !options.closed)
          this.constructChordLengthParams(options);
        else  // uniform
          this.constructUniformParams(options);
      }
    }

    /** Adjust options by correcting invalid combinations */
    public static validateOptions(options: InterpolationCurve3dOptions): boolean {
      if (!this.removeDuplicateFitPoints(options))
        return false;

      // if only 2 unique points, then must create open curve
      let hasClosurePoint = options.fitPoints[0].isAlmostEqual(options.fitPoints[options.fitPoints.length - 1]);
      if (3 === options.fitPoints.length && hasClosurePoint) {
        options.fitPoints.pop();
        if (undefined !== options.knots)
          options.knots.pop();
        hasClosurePoint = options.fitPoints[0].isAlmostEqual(options.fitPoints[options.fitPoints.length - 1]);
      }
      if (options.fitPoints.length <= 2) {
        if (hasClosurePoint)
          return false;
        options.closed = false;
      }

      // append closure point if missing
      if (options.closed) {
        if (!hasClosurePoint) {
          options.fitPoints.push(options.fitPoints[0]);
          if (undefined !== options.knots) {  // best guess: uniform knots
            options.knots.push(options.knots[options.knots.length - 1] + (options.knots[options.knots.length - 1] - options.knots[0]) / (options.knots.length - 1));
          }
        }
        if (options.fitPoints.length <= 4)
          options.closed = false; // can't fit cubic closed curve to 3 unique points
      }

      if (options.fitPoints.length < 2)
        return false;

      this.normalizeKnots(options.knots);

      if (undefined !== options.knots)
        return options.fitPoints.length === options.knots.length; // sanity check

      return true;
    }

    /** Convert fit parameters to classic full knot vector.
     * @param options validated as per validateOptions, unmodified
     **/
    public static convertParamsToFullKnotVector(options: InterpolationCurve3dOptions): number[] | undefined {
      const knots = options.knots?.slice();
      if (undefined !== knots) {
        if (options.closed) { // wraparound
          const iTail = knots.length - 2;
          for (let iHead = 2; iHead <= 6; iHead += 2) {
            knots.unshift(knots[iTail] - 1.0);  // index constant
            knots.push(1.0 + knots[iHead]);     // index increments by two
          }
        } else {  // over-clamped
          knots.unshift(0.0, 0.0, 0.0);
          knots.push(1.0, 1.0, 1.0);
        }
      }
      return knots;
    }

    /** Construct the pole vector using the c2 cubic fit algorithm and computed knots
     * @param options validated as per validateOptions, possibly modified
     */
    public static constructPoles(options: InterpolationCurve3dOptions): Point3d[] | undefined {
      this.constructParams(options);

      return poles;
    }
  }
}

// START HERE: when done, change BSplineCurve3d::createFromInterpolationCurve3dOptions to call C2Cubic variant
