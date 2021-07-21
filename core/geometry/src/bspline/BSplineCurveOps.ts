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

    const knots = this.C2CubicFit.convertParamsToFullKnotVector(options);
    if (undefined === knots)
      return undefined;

    // START HERE: if periodic, need to wrap poles around:
    // - add first 3 poles to end, keep knots same
    // - set BSplineWrapMode.OpenByAddingControlPoints

    return BSplineCurve3d.create(poles, knots, 4);
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
      if (fitPoints.length < 2)
        return undefined;
      const params: number[] = [0.0];
      for (let i = 1; i < fitPoints.length; ++i)
        params[i] = params[i - 1] + fitPoints[i].distance(fitPoints[i - 1]);
      if (!this.normalizeKnots(params))
        return undefined;
      return params;
    }

    /** Compute uniform fit parameters for C2 cubic fit algorithm */
    private static constructUniformParams(numParams: number): number[] | undefined {
      if (numParams < 2)
        return undefined;
      const knots = KnotVector.createUniformClamped(numParams + 2, 3, 0.0, 1.0);
      const params: number[] = [];
      for (let i = knots.leftKnotIndex; i <= knots.rightKnotIndex; ++i)
        params.push(knots.knots[i]);
      return params;
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
     private static constructParams(options: InterpolationCurve3dOptions): boolean {
      if (undefined === options.knots) {
        if (options.isChordLenKnots || !options.closed)
          options.knots = this.constructChordLengthParams(options.fitPoints);
        if (undefined === options.knots)
          options.knots = this.constructUniformParams(options.fitPoints.length);
      }
      return options.knots?.length === options.fitPoints.length;
    }

    /** Set end conditions (2nd and penultimate dataPt) for the linear system.
     * @param options validated as per validateOptions, unmodified
     */
    public static setEndConditions(dataPts: Point3d[], options: InterpolationCurve3dOptions): boolean {
      // START HERE: dataPts.splice(1,0,pt)
      return false;
    }

    /** Adjust options by correcting invalid combinations
     * @param options curve definition, possibly modified
     */
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

      if (undefined !== options.startTangent && options.startTangent.isAlmostZero)
        options.startTangent = undefined;
      if (undefined !== options.endTangent && options.endTangent.isAlmostZero)
        options.endTangent = undefined;

      return true;
    }

    /** Convert fit parameters to modern full cubic knot vector.
     * @param options validated as per validateOptions, unmodified
     **/
    public static convertParamsToFullKnotVector(options: InterpolationCurve3dOptions): number[] | undefined {
      const knots = options.knots?.slice();
      if (undefined !== knots) {
        if (options.closed) { // 2 additional wraparound knots beyond start and end
          const iTail = knots.length - 2;
          for (let iHead = 2; iHead <= 4; iHead += 2) {
            knots.unshift(knots[iTail] - 1.0);  // index constant
            knots.push(1.0 + knots[iHead]);     // index increments by two
          }
        } else {  // clamped: multiplicity 3 start and end knots
          knots.unshift(0.0, 0.0);
          knots.push(1.0, 1.0);
        }
      }
      return knots;
    }

    /** Construct the control points for the c2 cubic fit algorithm
     * @param options validated as per validateOptions, possibly modified
     */
    public static constructPoles(options: InterpolationCurve3dOptions): Point3d[] | undefined {
      if (!this.constructParams(options))
        return undefined;

      const alpha: number[] = Array(options.fitPoints.length);
      const beta: number[] = Array(options.fitPoints.length);
      const gamma: number[] = Array(options.fitPoints.length);
      BandedSystem.Tridiagonal.setUpSystem(alpha, beta, gamma, options.knots!, options.closed, undefined !== options.startTangent, undefined != options.endTangent);

      let poles: Point3d[] | undefined = [];
      if (!options.closed) {
        const dataPts = options.fitPoints.slice();
        this.setEndConditions(dataPts, options);

        const triUp: number[] = Array(options.fitPoints.length);
        const triLow: number[] = Array(options.fitPoints.length);
        BandedSystem.Tridiagonal.decomposeLU(triUp, triLow, alpha, beta, gamma);

        poles = BandedSystem.Tridiagonal.solve(dataPts, triUp, triLow, alpha, beta, gamma);
      } else {
        poles = BandedSystem.Tridiagonal.solveNear(options.fitPoints, options.knots!, alpha, beta, gamma);

        if (undefined !== poles && poles.length > 1)
          poles.unshift(poles.pop()!);  // shift poles right by one position to line up with the knots
      }
      return poles;
    }
  }
}

// START HERE: when done, change BSplineCurve3d::createFromInterpolationCurve3dOptions to call C2Cubic variant
