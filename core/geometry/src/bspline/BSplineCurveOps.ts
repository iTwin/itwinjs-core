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
   * @param props curve definition, possibly modified
   */
  private static c2CubicValidateProps(options: InterpolationCurve3dOptions) {
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
      options.knots = newKnots;
    }

    // START HERE: num fit pts validation, if necessary append first fitpt if closed

  }

  /**
   * C2 cubic algorithm
   * @param options curve definition, possibly modified
   */
  public static createThroughPointsC2Cubic(options: InterpolationCurve3dOptions): BSplineCurve3d | undefined {
    if (undefined === this.c2CubicValidateProps(options))
      return undefined;


    // TODO: construct as per native code, forcing order = 4, ignoring weights
    // TODO: remove first/last (wraparound) knot per new convention
    // TODO: if periodic, need to wrap poles around:
    //    - add first 3 poles to end, keep knots same
    //    - set BSplineWrapMode.OpenByAddingControlPoints
    return undefined;
  }

  /**
   * @param options collection of point, knot and end condition data.
   */
  public static createFromInterpolationCurve3dProps(options: InterpolationCurve3dOptions): BSplineCurve3d | undefined {
    return this.createThroughPointsC2Cubic(options);
  }

}
