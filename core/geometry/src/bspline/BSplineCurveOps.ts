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
import { Geometry } from "../Geometry";
import { Point3d, Vector3d } from "../geometry3d/Point3dVector3d";
import { BandedSystem } from "../numerics/BandedSystem";
import { BSplineCurve3d } from "./BSplineCurve";
import { BSplineWrapMode, KnotVector } from "./KnotVector";
import { InterpolationCurve3dOptions, InterpolationCurve3dProps } from "./InterpolationCurve3d";
import { Point3dArray } from "../geometry3d/PointHelpers";

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
        rhs.push(points[basePointIndex].clone());
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
   * @param options curve definition, unmodified
   */
  public static createThroughPointsC2Cubic(options: InterpolationCurve3dOptions): BSplineCurve3d | undefined {
    // Work on a copy rather than installing computed knots/tangents that could become stale when fit points change
    // Knots/tangents that come in, however, are used without recomputation.
    const validatedOptions = options.clone();
    if (!this.C2CubicFit.validateOptions(validatedOptions))
      return undefined;

    const poles = this.C2CubicFit.constructPoles(validatedOptions);
    if (undefined === poles)
      return undefined;

    const fullKnots = this.C2CubicFit.convertFitParamsToCubicKnotVector(validatedOptions.knots, validatedOptions.closed);
    if (undefined === fullKnots)
      return undefined;

    const interpolant = BSplineCurve3d.create(poles, fullKnots, validatedOptions.order);

    if (validatedOptions.closed)
      interpolant?.setWrappable(BSplineWrapMode.OpenByAddingControlPoints);

    return interpolant;
  }
}

/**
 * Namespace for collecting curve fit API
 * @public
 */
export namespace BSplineCurveOps {
  /**
   * A helper class for creating C2 cubic fit curves.
   * Knots herein are understood to be *interior* knots (including the start/end knot),
   * so that there is one knot per fit point. In other words, the knots are fit parameters.
   * @private
   */
  export class C2CubicFit {
    /** Transform fit parameters to span [0,1]
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
    private static constructChordLengthParameters(fitPoints: Point3d[]): number[] | undefined {
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
    private static constructUniformParameters(numParams: number): number[] | undefined {
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
          newPts.push(options.fitPoints[iRead].clone());
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

    /** Construct fit parameters for the c2 cubic fit algorithm.
     * @param fitPoints validated fit points (should not contain duplicates)
     * @param isChordLength whether knots are computed using distances between successive fit points
     * @param closed whether curve is periodically defined
     * @return fit parameters, one per fit point
    */
     public static constructFitParametersFromPoints(fitPoints: Point3d[], isChordLength: number | undefined, closed: boolean | undefined): number[] | undefined {
      let params: number[] | undefined;
      if (isChordLength || !closed)
        params = this.constructChordLengthParameters(fitPoints);
      if (undefined === params)
        params = this.constructUniformParameters(fitPoints.length);
      return params;
    }

    /** Construct fit parameters for the c2 cubic fit algorithm, if they are missing.
     * @param options validated as per validateOptions, possibly modified
     * @return whether fit parameters are valid
     */
     public static constructFitParameters(options: InterpolationCurve3dOptions): boolean {
      if (undefined === options.knots)
        options.knots = this.constructFitParametersFromPoints(options.fitPoints, options.isChordLenKnots, options.closed);
      return options.knots?.length === options.fitPoints.length;
    }

    /** Compute a row of the tridiagonal system matrix from Farin.
     * @param alpha sub-diagonal, length = # fit points
     * @param beta diagonal, length = # fit points
     * @param gamma super-diagonal, length = # fit points
     * @param index 0-based row index to set
     */
    private static computeAlphaBetaGamma(alpha: number[], beta: number[], gamma: number[], index: number, deltaIPlus1: number, deltaI: number, deltaIMinus1: number, deltaIMinus2: number) {
      let denomReciprocal = 1.0 / (deltaIMinus2 + deltaIMinus1 + deltaI);
      alpha[index] = deltaI * deltaI * denomReciprocal;
      beta[index] = deltaI * (deltaIMinus2 + deltaIMinus1) * denomReciprocal;

      denomReciprocal = 1.0 / (deltaIMinus1 + deltaI + deltaIPlus1);
      beta[index] += deltaIMinus1 * (deltaI + deltaIPlus1) * denomReciprocal;
      gamma[index] = deltaIMinus1 * deltaIMinus1 * denomReciprocal;

      denomReciprocal = 1.0 / (deltaIMinus1 + deltaI);
      alpha[index] *= denomReciprocal;
      beta[index] *= denomReciprocal;
      gamma[index] *= denomReciprocal;
    }

    /** Setup tridiagonal system for 2 fit points
     * @param alpha sub-diagonal, length = 2
     * @param beta diagonal, length = 2
     * @param gamma super-diagonal, length = 2
     */
    private static setUpSystem2Points(alpha: number[], beta: number[], gamma: number[]): boolean {
      if (alpha.length !== 2 || beta.length !== 2 || gamma.length !== 2)
        return false;

      // identity matrix
      alpha[0] = alpha[1] = gamma[0] = gamma[1] = 0.0;
      beta[0] = beta[1] = 1.0;
      return true;
    }

    /** Setup tridiagonal system for 3 fit points
     * @param alpha sub-diagonal, length = 3
     * @param beta diagonal, length = 3
     * @param gamma super-diagonal, length = 3
     * @param options validated as per validateOptions, unmodified
     * @param useNaturalStartTangent whether to bake the natural end condition into the first row
     * @param useNaturalEndTangent whether to bake the natural end condition into the last row
     */
     private static setUpSystem3Points(alpha: number[], beta: number[], gamma: number[], options: InterpolationCurve3dOptions, useNaturalStartTangent: boolean, useNaturalEndTangent: boolean): boolean {
      if (undefined === options.knots)
        return false;
      if (alpha.length !== 3 || beta.length !== 3 || gamma.length !== 3)
        return false;
      if (options.knots.length !== 3 || options.fitPoints.length !== 3)
        return false;

      let deltaIPlus1 = 0, deltaI = 0, deltaIMinus1 = 0, deltaIMinus2 = 0, sum = 0, sumReciprocal = 0;

      // first row
      if (useNaturalStartTangent) {
        alpha[0] = 0.0;
        deltaI = options.knots[1] - options.knots[0];
        deltaIPlus1 = options.knots[2] - options.knots[1];
        sum = deltaI + deltaIPlus1;
        sumReciprocal = 1.0 / sum;
        beta[0] = (deltaI + sum) * sumReciprocal;
        gamma[0] = -deltaI * sumReciprocal;
      } else {
        alpha[0] = gamma[0] = 0.0;
        beta[0] = 1.0;
      }

      // middle row
      deltaIMinus1 = options.knots[1] - options.knots[0];
      deltaI = options.knots[2] - options.knots[1];
      sumReciprocal = 1.0 / (deltaIMinus1 + deltaI);
      sumReciprocal *= sumReciprocal;
      alpha[1] = deltaI * deltaI * sumReciprocal;
      beta[1]  = 2.0 * (deltaI * deltaIMinus1) * sumReciprocal;
      gamma[1] = deltaIMinus1 * deltaIMinus1 * sumReciprocal;

      // last row
      if (useNaturalEndTangent) {
        deltaIMinus1 = options.knots[2] - options.knots[1];
        deltaIMinus2 = options.knots[1] - options.knots[0];
        sum = deltaIMinus2 + deltaIMinus1;
        sumReciprocal = 1.0 / sum;
        alpha[2] = -deltaIMinus1 * sumReciprocal;
        beta[2] = (deltaIMinus1 + sum) * sumReciprocal;
        gamma[2] = 0.0;
      } else {
        alpha[2] = gamma[2] = 0.0;
        beta[2] = 1.0;
      }
      return true;
    }

    /** Setup tridiagonal system for 4 fit points or more
     * @param alpha sub-diagonal, length = # fit points
     * @param beta diagonal, length = # fit points
     * @param gamma super-diagonal, length = # fit points
     * @param options validated as per validateOptions, unmodified
     * @param useNaturalStartTangent whether to bake the natural end condition into the first row
     * @param useNaturalEndTangent whether to bake the natural end condition into the last row
     */
    private static setUpSystem4PointsOrMore(alpha: number[], beta: number[], gamma: number[], options: InterpolationCurve3dOptions, useNaturalStartTangent: boolean, useNaturalEndTangent: boolean): boolean {
      if (undefined === options.knots)
        return false;
      if (alpha.length !== beta.length || alpha.length !== gamma.length || alpha.length !== options.knots.length)
        return false;
      if (options.knots.length !== options.fitPoints.length)
        return false;

      const numIntervals = options.fitPoints.length - 1;
      const numIntervalsMinus1 = numIntervals - 1;
      let deltaIPlus1 = 0, deltaI = 0, deltaIMinus1 = 0, deltaIMinus2 = 0, sum = 0, sumReciprocal = 0;

      if (options.closed) {
        // first row
        deltaI = options.knots[1] - options.knots[0];
        deltaIMinus2 = options.knots[numIntervalsMinus1] - options.knots[numIntervalsMinus1 - 1];
        deltaIMinus1 = options.knots[numIntervalsMinus1 + 1] - options.knots[numIntervalsMinus1];
        deltaIPlus1 = options.knots[2] - options.knots[1];
        this.computeAlphaBetaGamma(alpha, beta, gamma, 0, deltaIPlus1, deltaI, deltaIMinus1, deltaIMinus2);

        // second row
        deltaIMinus2 = deltaIMinus1;
        deltaIMinus1 = deltaI;
        deltaI = options.knots[2] - options.knots[1];
        deltaIPlus1 = options.knots[3] - options.knots[2];
        this.computeAlphaBetaGamma(alpha, beta, gamma, 1, deltaIPlus1, deltaI, deltaIMinus1, deltaIMinus2);

        // last row; there's one less equation than open case
        deltaIPlus1 = deltaIMinus1;
        deltaI = options.knots[numIntervalsMinus1 + 1] - options.knots[numIntervalsMinus1];
        deltaIMinus2 = options.knots[numIntervalsMinus1 - 1] - options.knots[numIntervalsMinus1 - 2];
        deltaIMinus1 = options.knots[numIntervalsMinus1] - options.knots[numIntervalsMinus1 - 1];
        this.computeAlphaBetaGamma(alpha, beta, gamma, numIntervalsMinus1, deltaIPlus1, deltaI, deltaIMinus1, deltaIMinus2);
      } else { // open
        // first row
        if (useNaturalStartTangent) {
          alpha[0] = 0.0;
          deltaI = options.knots[1] - options.knots[0];
          deltaIPlus1 = options.knots[2] - options.knots[1];
          sum = deltaI + deltaIPlus1;
          sumReciprocal = 1.0 / sum;
          beta[0] = (deltaI + sum) * sumReciprocal;
          gamma[0] = -deltaI * sumReciprocal;
        } else {
          alpha[0] = gamma[0] = 0.0;
          beta[0] = 1.0;
        }

        // second row
        deltaI = options.knots[2] - options.knots[1];
        deltaIMinus1 = options.knots[1] - options.knots[0];
        deltaIMinus2 = 0.0;
        deltaIPlus1 = options.knots[3] - options.knots[2];
        this.computeAlphaBetaGamma(alpha, beta, gamma, 1, deltaIPlus1, deltaI, deltaIMinus1, deltaIMinus2);

        // penultimate row
        deltaI = options.knots[numIntervalsMinus1 + 1] - options.knots[numIntervalsMinus1];
        deltaIMinus1 = options.knots[numIntervalsMinus1] - options.knots[numIntervalsMinus1 - 1];
        deltaIMinus2 = options.knots[numIntervalsMinus1 - 1] - options.knots[numIntervalsMinus1 - 2];
        deltaIPlus1 = 0.0;
        this.computeAlphaBetaGamma(alpha, beta, gamma, numIntervalsMinus1, deltaIPlus1, deltaI, deltaIMinus1, deltaIMinus2);

        // last row
        if (useNaturalEndTangent) {
          deltaIMinus1 = options.knots[numIntervals] - options.knots[numIntervals - 1];
          deltaIMinus2 = options.knots[numIntervals - 1] - options.knots[numIntervals - 2];
          sum = deltaIMinus2 + deltaIMinus1;
          sumReciprocal = 1.0 / sum;
          alpha[numIntervals] = -deltaIMinus1 * sumReciprocal;
          beta[numIntervals] = (deltaIMinus1 + sum) * sumReciprocal;
          gamma[numIntervals] = 0.0;
        } else {
          alpha[numIntervals] = gamma[numIntervals] = 0.0;
          beta[numIntervals] = 1.0;
        }
      }

      // middle rows
      for (let i = 2; i < numIntervalsMinus1; ++i) {
        deltaI = options.knots[i + 1] - options.knots[i];
        deltaIMinus2 = options.knots[i - 1] - options.knots[i - 2];
        deltaIMinus1 = options.knots[i] - options.knots[i - 1];
        deltaIPlus1 = options.knots[i + 2] - options.knots[i + 1];
        this.computeAlphaBetaGamma(alpha, beta, gamma, i, deltaIPlus1, deltaI, deltaIMinus1, deltaIMinus2);
      }
      return true;
    }

    /** Setup tridiagonal system
     * @param alpha sub-diagonal, length = # fitPoints
     * @param beta diagonal, length = # fitPoints
     * @param gamma super-diagonal, length = # fitPoints
     * @param options validated as per validateOptions, unmodified
     */
    private static setUpSystem(alpha: number[], beta: number[], gamma: number[], options: InterpolationCurve3dOptions): boolean {
      let useNaturalStartTangent = false;
      let useNaturalEndTangent = false;
      if (options.isNaturalTangents && !options.closed) {
        useNaturalStartTangent = (undefined === options.startTangent);
        useNaturalEndTangent = (undefined === options.endTangent);
      }

      let succeeded = false;
      if (2 === options.fitPoints.length)
        succeeded = this.setUpSystem2Points(alpha, beta, gamma);
      else if (3 === options.fitPoints.length)
        succeeded = this.setUpSystem3Points(alpha, beta, gamma, options, useNaturalStartTangent, useNaturalEndTangent);
      else if (4 <= options.fitPoints.length)
        succeeded = this.setUpSystem4PointsOrMore(alpha, beta, gamma, options, useNaturalStartTangent, useNaturalEndTangent);

      return succeeded;
    }

    /** Set the Bessel end condition for the linear system.
     * @param dataPts array whose middle is the system rhs (augmented with first/last fitPoint at beginning/end);
     *                2nd or penultimate point is set by this function.
     * @param options validated as per validateOptions, unmodified
     * @param atStart whether end condition is for start of curve (false: end of curve)
     */
    private static setBesselEndCondition(dataPts: Point3d[], options: InterpolationCurve3dOptions, atStart: boolean): boolean {
      if (dataPts.length !== options.fitPoints.length + 2)
        return false;
      if (undefined === options.knots)
        return false;

      const scale = 1.0/3.0;
      const numIntervals = options.fitPoints.length - 1;

      if (1 === numIntervals) { // linear Bezier
        if (atStart)
          dataPts[0].interpolate(scale, dataPts[3], dataPts[1]);
        else
          dataPts[3].interpolate(scale, dataPts[0], dataPts[2]);
        return true;
      }

      if (2 === numIntervals) {
        const alpha = (options.knots[2] - options.knots[1]) / (options.knots[2] - options.knots[0]);
        const beta = 1.0 - alpha;
        const temp = dataPts[2].plus2Scaled(dataPts[0], -alpha * alpha, dataPts[4], -beta * beta);
        if (atStart)
          Point3d.createAdd2Scaled(temp, 1.0 / (2.0 * alpha), dataPts[0], alpha).interpolate(scale, dataPts[0], dataPts[1]);
        else
          Point3d.createAdd2Scaled(temp, 1.0 / (2.0 * beta), dataPts[4], beta).interpolate(scale, dataPts[4], dataPts[3]);
        return true;
      }

      // numIntervals > 2
      if (atStart) {
          const alpha = (options.knots[2] - options.knots[1]) / (options.knots[2] - options.knots[0]);
          const beta = 1.0 - alpha;
          const temp = dataPts[2].plus2Scaled(dataPts[0], -alpha * alpha, dataPts[3], -beta * beta);
          Point3d.createAdd2Scaled(temp, 1.0 / (2.0 * alpha), dataPts[0], alpha).interpolate(scale, dataPts[0], dataPts[1]);
      } else {
          const alpha = (options.knots[numIntervals] - options.knots[numIntervals - 1]) / (options.knots[numIntervals] - options.knots[numIntervals - 2]);
          const beta = 1.0 - alpha;
          const temp = dataPts[numIntervals].plus2Scaled(dataPts[numIntervals - 1], -alpha * alpha, dataPts[numIntervals + 2], -beta * beta);
          Point3d.createAdd2Scaled(temp, 1.0 / (2.0 * beta), dataPts[numIntervals + 2], beta).interpolate(scale, dataPts[numIntervals + 2], dataPts[numIntervals + 1]);
      }
      return true;
    }

    /** Set the natural end condition for the linear system.
     *  This is the end condition used by ADSK for fit-splines with a given zero tangent.
     * @param dataPts array whose middle is the system rhs (augmented with first/last fitPoint at beginning/end);
     *                2nd or penultimate point is set by this function.
     * @param options validated as per validateOptions, unmodified
     * @param atStart whether end condition is for start of curve (false: end of curve)
     */
    private static setNaturalEndCondition(dataPts: Point3d[], options: InterpolationCurve3dOptions, atStart: boolean): boolean {
      if (dataPts.length !== options.fitPoints.length + 2)
        return false;

      const numIntervals = options.fitPoints.length - 1;
      if (1 === numIntervals)
        return this.setBesselEndCondition(dataPts, options, atStart);

      if (atStart)
        dataPts[1] = dataPts[0];
      else
        dataPts[dataPts.length - 2] = dataPts[dataPts.length - 1];
      return true;
    }

    /** Set the end condition for the linear system to the given tangent, scaled by chord length.
     *  This is the end condition used by ADSK for fit-splines with a given nonzero tangent.
     * @param dataPts array whose middle is the system rhs (augmented with first/last fitPoint at beginning/end);
     *                2nd or penultimate point is set by this function.
     * @param options validated as per validateOptions, unmodified
     * @param atStart whether end condition is for start of curve (false: end of curve)
     */
    private static setChordLengthScaledEndCondition(dataPts: Point3d[], options: InterpolationCurve3dOptions, atStart: boolean): boolean {
      if (dataPts.length !== options.fitPoints.length + 2)
        return false;

      const tangent = atStart ? options.startTangent : options.endTangent;
      if (undefined === tangent)
        return false;

      let iExt = 0; // index of first/last fitPoint
      let iSet = 0; // index of 2nd/penultimate Bezier point to set (determines start/end tangent of the curve)
      let iInt = 0; // index of 2nd/penultimate fitPoint

      const numIntervals = options.fitPoints.length - 1;
      if (1 === numIntervals) { // no interior fit points
        if (atStart) {
          iExt = 0;
          iSet = 1;
          iInt = 3;
        } else {
          iExt = 3;
          iSet = 2;
          iInt = 0;
        }
      } else {
        if (atStart) {
          iExt = 0;
          iSet = 1;
          iInt = 2;
        } else {
          iExt = numIntervals + 2;
          iSet = numIntervals + 1;
          iInt = numIntervals;
        }
      }

      // NOTE: tangent points INTO curve
      const chordLength = dataPts[iInt].distance(dataPts[iExt]);
      dataPts[iExt].plusScaled(tangent, chordLength / 3.0, dataPts[iSet]);
      return true;
    }

    /** Set the end condition for the linear system to the given tangent, scaled by bessel length.
     * @param dataPts array whose middle is the system rhs (augmented with first/last fitPoint at beginning/end);
     *                2nd or penultimate point is set by this function.
     * @param options validated as per validateOptions, unmodified
     * @param atStart whether end condition is for start of curve (false: end of curve)
     */
    private static setBesselLengthScaledEndCondition(dataPts: Point3d[], options: InterpolationCurve3dOptions, atStart: boolean): boolean {
      if (dataPts.length !== options.fitPoints.length + 2)
        return false;

      const tangent = atStart ? options.startTangent : options.endTangent;
      if (undefined === tangent)
        return false;

      // temporarily set bessel end condition
      if (!this.setBesselEndCondition(dataPts, options, atStart))
        return false;

      const numIntervals = options.fitPoints.length - 1;
      const iExt = atStart ? 0 : numIntervals + 2; // index of first/last fitPoint
      const iSet = atStart ? 1 : numIntervals + 1; // index of 2nd/penultimate Bezier point to set (determines start/end tangent of the curve)

      // reset end condition with our tangent, but scaled to the bessel tangent's length
      dataPts[iExt].plusScaled(tangent, dataPts[iExt].distance(dataPts[iSet]), dataPts[iSet]);
      return true;
    }

    /** Set the end condition for a physically closed (non-periodic) interpolant.
     * @param dataPts array whose middle is the system rhs (augmented with first/last fitPoint at beginning/end);
     *                2nd or penultimate point is set by this function.
     * @param options validated as per validateOptions, unmodified
     */
    private static setPhysicallyClosedEndCondition(dataPts: Point3d[], options: InterpolationCurve3dOptions): boolean {
      const numIntervals = options.fitPoints.length - 1;
      if (!options.isColinearTangents
          || numIntervals <= 2
          || (undefined !== options.startTangent && undefined !== options.endTangent)
          || options.isNaturalTangents
          || !dataPts[0].isAlmostEqual(dataPts[numIntervals + 2])) {
        return true;
        }
      // force parallel start/end tangents, using chord length scale for undefined tangents
      if (undefined !== options.startTangent) { // start tangent is supplied; compute a parallel end tangent
        const outwardStartTangent = Vector3d.createStartEnd(dataPts[1], dataPts[0]).normalize();
        if (undefined !== outwardStartTangent) {
          const endTangentMag = dataPts[numIntervals + 2].distance(dataPts[numIntervals + 1]);
          dataPts[numIntervals + 2].plusScaled(outwardStartTangent, endTangentMag, dataPts[numIntervals + 1]);
        }
      } else if (undefined !== options.endTangent) {  // end tangent is supplied; compute a parallel start tangent
        const outwardEndTangent = Vector3d.createStartEnd(dataPts[numIntervals + 1], dataPts[numIntervals + 2]).normalize();
        if (undefined !== outwardEndTangent) {
          const startTangentMag = dataPts[0].distance(dataPts[1]);
          dataPts[0].plusScaled(outwardEndTangent, startTangentMag, dataPts[1]);
        }
      } else {  // neither tangent is supplied, compute both along same vector
        const commonTangent = Vector3d.createStartEnd(dataPts[numIntervals + 1], dataPts[1]).normalize();
        if (undefined !== commonTangent) {
          const startTangentMag = dataPts[0].distance(dataPts[1]);
          dataPts[0].plusScaled(commonTangent, startTangentMag, dataPts[1]);
          const endTangentMag = dataPts[numIntervals + 2].distance(dataPts[numIntervals + 1]);
          dataPts[numIntervals + 2].plusScaled(commonTangent, -endTangentMag, dataPts[numIntervals + 1]);
        }
      }
      return true;
    }

    /** Set end conditions for the linear system to solve for the poles of the open interpolant, as per Farin 3e/4e.
     * @param dataPts array whose interior is the system rhs and whose first/last entries are the first/last fitPoints;
     *                points are inserted to become the 2nd and penultimate dataPts, the first/last rows of the system rhs.
     * @param options validated as per validateOptions, unmodified
     */
    private static setEndConditions(dataPts: Point3d[], options: InterpolationCurve3dOptions): boolean {
      if (dataPts.length !== options.fitPoints.length)
        return false;

      // insert dummy points to be computed below
      const dummy0 = Point3d.createZero();
      const dummy1 = Point3d.createZero();
      dataPts.splice(1, 0, dummy0);
      dataPts.splice(dataPts.length - 1, 0, dummy1);

      let succeeded = false;
      if (undefined === options.startTangent) {
        if (options.isNaturalTangents)
          succeeded = this.setNaturalEndCondition(dataPts, options, true);
        else
          succeeded = this.setBesselEndCondition(dataPts, options, true);
      } else { // scale startTangent
        if (options.isChordLenTangents)
          succeeded = this.setChordLengthScaledEndCondition(dataPts, options, true);
        else
          succeeded = this.setBesselLengthScaledEndCondition(dataPts, options, true);
      }

      if (undefined === options.endTangent) {
        if (options.isNaturalTangents)
          succeeded = this.setNaturalEndCondition(dataPts, options, false);
        else
          succeeded = this.setBesselEndCondition(dataPts, options, false);
      } else { // scale endTangent
        if (options.isChordLenTangents)
          succeeded = this.setChordLengthScaledEndCondition(dataPts, options, false);
        else
          succeeded = this.setBesselLengthScaledEndCondition(dataPts, options, false);
      }

      if (succeeded)
        succeeded = this.setPhysicallyClosedEndCondition(dataPts, options);

      return succeeded;
    }

    /** Solve the near tridiagonal system for a periodic C2 cubic interpolant.
     * Alpha, beta, gamma are computed by setUpSystem, have same length as fitPts, and are overwritten.
     */
    private static solveNearTridiagonal(fitPts: Point3d[], alpha: number[], beta: number[], gamma: number[]): Point3d[] | undefined {
      if (alpha.length !== beta.length || alpha.length !== gamma.length || alpha.length !== fitPts.length)
        return undefined;
      const poles: Point3d[] = [];
      const numIntervals = fitPts.length - 1;
      const leftPts = fitPts.slice(0, -1);  // last fitPt is ignored
      let tmp: number | undefined = 0.0;

      // first forward substitution
      for (let i = 1; i < numIntervals; ++i) {
        if (undefined === (tmp = Geometry.conditionalDivideFraction(- alpha[i], beta[i - 1])))
          return undefined;
        beta[i] += tmp * gamma[i - 1];
        alpha[i] = tmp * alpha[i - 1];
        leftPts[i].addScaledInPlace(leftPts[i - 1], tmp);
      }

      // first backward substitution
      if (undefined === (tmp = Geometry.conditionalDivideFraction(1.0, beta[numIntervals - 1] + alpha[numIntervals - 1])))
        return undefined;
      gamma[numIntervals - 1] *= tmp;
      leftPts[numIntervals - 1].scaleInPlace(tmp);
      for (let i = numIntervals - 2; i >= 0; --i) {
        if (undefined === (tmp = Geometry.conditionalDivideFraction(1.0, beta[i])))
          return undefined;
        Point3d.createScale(leftPts[i].plus2Scaled(leftPts[i + 1], - gamma[i], leftPts[numIntervals - 1], - alpha[i]), tmp, leftPts[i]);
        gamma[i] = - (gamma[i] * gamma[i + 1] + alpha[i] * gamma[numIntervals - 1]) * tmp;
      }

      // second forward substitution
      if (undefined === (tmp = Geometry.conditionalDivideFraction(1.0, 1.0 + gamma[0])))
        return undefined;
      poles.push(Point3d.createScale(leftPts[0], tmp));
      for (let i = 1; i < numIntervals; ++i) {
        poles.push(leftPts[i].plusScaled(poles[0], - gamma[i]));
      }
      return poles;
    }

    /** Adjust options by correcting invalid combinations
     * @param options curve definition, possibly modified
     */
    public static validateOptions(options: InterpolationCurve3dOptions): boolean {
      options.order = 4;

      // remove relevant exterior knots so knots and fit points align *before* we start compressing fit points.
      options.knots = this.convertCubicKnotVectorToFitParams(options.knots, options.fitPoints.length, true);

        // compress out duplicate fit points (and their corresponding knots)
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
          options.fitPoints.push(options.fitPoints[0].clone());
          if (undefined !== options.knots) {  // best guess: uniform knots
            options.knots.push(options.knots[options.knots.length - 1] + (options.knots[options.knots.length - 1] - options.knots[0]) / (options.knots.length - 1));
          }
        }
        if (options.fitPoints.length <= 4)
          options.closed = false; // can't fit cubic closed curve to 3 unique points
      }

      if (options.fitPoints.length < 2)
        return false;

      // ASSUME: tangents point INTO curve
      if (undefined !== options.startTangent) {
        if (options.startTangent.isAlmostZero)
          options.startTangent = undefined;
        else
          options.startTangent.normalizeInPlace();
      }
      if (undefined !== options.endTangent) {
        if (options.endTangent.isAlmostZero)
          options.endTangent = undefined;
        else
          options.endTangent.normalizeInPlace();
      }

      return true;
    }

    /** Converts a full cubic knot vector of expected length into fit parameters, by removing extraneous exterior knots.
     * @param knots cubic knot vector, unmodified
     * @param numFitPoints number of fit points
     * @return fit parameters, or undefined if unexpected input
     **/
    public static convertCubicKnotVectorToFitParams(knots: number[] | undefined, numFitPoints: number, normalize?: boolean): number[] | undefined {
      let params = knots?.slice();
      if (undefined !== params) {
        const numExtraKnots = params.length - numFitPoints;
        switch (numExtraKnots) {
          case 0: {   // ASSUME caller passed in interior knots
            break;
          }
          case 4:     // modern full cubic knots
          case 6: {   // legacy full cubic knots
            for (let i = 0; i < numExtraKnots / 2; ++i) {
              params.pop();
              params.shift();
            }
            break;
          }
          default: {  // other knot configurations are unusable
            params = undefined;
            break;
          }
        }
        if (normalize && !this.normalizeKnots(params))
          params = undefined;
      }
      return params;
    }

    /** Return fit parameters augmented to a full cubic knot vector.
     * @param params fit parameters, unmodified
     * @param legacy whether to create a legacy (DGN) full knot vector, or modern vector with two less knots
     **/
    public static convertFitParamsToCubicKnotVector(params: number[] | undefined, closed?: boolean, legacy?: boolean): number[] | undefined {
      const knots = params?.slice();
      if (undefined !== knots) {
        const numExtraKnots = legacy ? 6 : 4;
        if (closed) {
          const iTail = knots.length - 2;
          for (let iHead = 2; iHead <= numExtraKnots; iHead += 2) {
            knots.unshift(knots[iTail] - 1.0);  // index is constant
            knots.push(1.0 + knots[iHead]);     // index increments by two
          }
        } else {
          for (let i = 0; i < numExtraKnots / 2; ++i) {
            knots.unshift(0.0);
            knots.push(1.0);
          }
        }
      }
      return knots;
    }

    /** Ensure full legacy knot vector for JSON export **/
    public static convertToJsonKnots(props: InterpolationCurve3dProps) {
      if (undefined !== props.knots) {
        props.knots = this.convertCubicKnotVectorToFitParams(props.knots, props.fitPoints.length, false);
        props.knots = this.convertFitParamsToCubicKnotVector(props.knots, props.closed, true);
      } else {
        props.knots = this.constructFitParametersFromPoints(Point3dArray.clonePoint3dArray(props.fitPoints), props.isChordLenKnots, props.closed);
        props.knots = this.convertFitParamsToCubicKnotVector(props.knots, props.closed, true);
      }
    }

    /** Construct the control points for the c2 cubic fit algorithm
     * @param options validated as per validateOptions, possibly modified
     */
    public static constructPoles(options: InterpolationCurve3dOptions): Point3d[] | Float64Array | undefined {
      if (!this.constructFitParameters(options) || (undefined === options.knots))
        return undefined;

      const numRow = options.fitPoints.length;
      const alpha: number[] = Array(numRow);
      const beta: number[] = Array(numRow);
      const gamma: number[] = Array(numRow);
      if (!this.setUpSystem(alpha, beta, gamma, options))
        return undefined;

      let poles: Point3d[] | Float64Array | undefined = [];
      if (!options.closed) {
        const dataPts = options.fitPoints.slice();
        if (!this.setEndConditions(dataPts, options))
          return undefined;
        if (dataPts.length !== numRow + 2)
          return undefined; // sanity check: we added 2nd/penultimate points, rhs is middle numRow entries.

        // construct tridiagonal banded system components
        const matrix = new Float64Array(numRow * 3);
        const rhs = new Float64Array(numRow * 3);
        for (let iRow = 0, iMatrixRead = 0, iRhsRead = 0; iRow < numRow; ++iRow) {
          matrix[iMatrixRead++] = alpha[iRow];
          matrix[iMatrixRead++] = beta[iRow];
          matrix[iMatrixRead++] = gamma[iRow];
          rhs[iRhsRead++] = dataPts[iRow+1].x;
          rhs[iRhsRead++] = dataPts[iRow+1].y;
          rhs[iRhsRead++] = dataPts[iRow+1].z;
        }

        const solution = BandedSystem.solveBandedSystemMultipleRHS(numRow, 3, matrix, 3, rhs);
        if (undefined === solution)
          return undefined;

        // pre/append first/last poles/fitPoints
        poles = new Float64Array(3 + solution.length + 3);
        let iWrite = 0;
        poles[iWrite++] = options.fitPoints[0].x;
        poles[iWrite++] = options.fitPoints[0].y;
        poles[iWrite++] = options.fitPoints[0].z;
        for (let iRead = 0; iRead < solution.length; ) {
          poles[iWrite++] = solution[iRead++];
        }
        poles[iWrite++] = options.fitPoints[options.fitPoints.length - 1].x;
        poles[iWrite++] = options.fitPoints[options.fitPoints.length - 1].y;
        poles[iWrite++] = options.fitPoints[options.fitPoints.length - 1].z;
      } else { // closed
        if (undefined !== (poles = this.solveNearTridiagonal(options.fitPoints, alpha, beta, gamma))) {
          if (poles.length > 2) {
            poles.unshift(poles.pop()!);  // shift poles right to line up with the knots
            for (let i = 0; i < options.order - 1; ++i)
              poles.push(poles[i].clone()); // periodically extend (the modern way)
          }
        }
      }
      return poles;
    }
  }
}
