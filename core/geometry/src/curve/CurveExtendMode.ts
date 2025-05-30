/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Curve
 */

import { Geometry } from "../Geometry";
import { AngleSweep } from "../geometry3d/AngleSweep";

/**
 * Enumeration of condition for extending a curve beyond start or end point.
 * * Not all CurvePrimitives support these modes.
 * @public
 */
export enum CurveExtendMode {
  /** No extension allowed. */
  None = 0,
  /** Extend along continuation of the end tangent. */
  OnTangent = 1,
  /** Extend along continuation of the curve. */
  OnCurve = 2,
}
/**
 * Logic for deciding how a curve may be extended for closest point or intersection searches.
 * @public
 */
export class CurveExtendOptions {
  /**
   * Given a `VariantCurveExtendParameter`, isolate the particular CurveExtendMode in effect at an end.
   * * Return `CurveExtendMode.None` if `param === false`.
   * * Return `CurveExtendMode.OnCurve` if `param === true`.
   * * Return the param if it is a single CurveExtendMode.
   * * Return dereferenced array at entry `endIndex` if the param is an array of CurveExtendMode.
   */
  public static resolveVariantCurveExtendParameterToCurveExtendMode(
    param: VariantCurveExtendParameter, endIndex: 0 | 1,
  ): CurveExtendMode {
    if (param === false)
      return CurveExtendMode.None;
    if (param === true)
      return CurveExtendMode.OnCurve;
    if (Array.isArray(param))
      return param.length > endIndex ? param[endIndex] : CurveExtendMode.None;
    return param;
  }
  /**
   * Correct fraction to be within [0,1].
   * * If fraction is in [0,1] return it unchanged.
   * * If fraction is less than 0 use `extendParam` to decide whether to return it unchanged, or to return 0.
   * * If fraction is greater than 1 use `extendParam` to decide whether to return it unchanged, or to return 1.
   */
  public static correctFraction(extendParam: VariantCurveExtendParameter, fraction: number): number {
    if (fraction < 0) {
      const mode = CurveExtendOptions.resolveVariantCurveExtendParameterToCurveExtendMode(extendParam, 0);
      if (mode === CurveExtendMode.None)
        fraction = 0.0;
    } else if (fraction > 1.0) {
      const mode = CurveExtendOptions.resolveVariantCurveExtendParameterToCurveExtendMode(extendParam, 1);
      if (mode === CurveExtendMode.None)
        fraction = 1.0;
    }
    return fraction;
  }
  /**
   * Adjust a radians value to an angle sweep, extending beyond or clamping to [0,1] according to `extendParam`:
   * * If `radians` is within the sweep, convert it to a fraction of the sweep.
   * * If `radians` is outside the sweep and `extendParam` does not allow extension at both ends, adjust the fraction:
   *   * fraction below 0 if `extendParam` allows extension only at start
   *   * fraction above 1 if `extendParam` allows extension only at end
   *   * fraction clamped to [0,1] if `extendParam` disallows extension at both ends
   * @returns adjusted fraction of sweep, and a boolean indicating whether it is valid, i.e. whether `radians` lies in
   * the sweep extended per `extendParam`.
   */
  public static resolveRadiansToValidSweepFraction(
    extendParam: VariantCurveExtendParameter, radians: number, sweep: AngleSweep,
  ): { fraction: number, isValid: boolean } {
    let fraction = sweep.radiansToSignedPeriodicFraction(radians);
    let isValid = true;
    if (!sweep.isRadiansInSweep(radians)) {
      const fractionPeriod = sweep.fractionPeriod();
      const mode0 = CurveExtendOptions.resolveVariantCurveExtendParameterToCurveExtendMode(extendParam, 0);
      const mode1 = CurveExtendOptions.resolveVariantCurveExtendParameterToCurveExtendMode(extendParam, 1);
      if (mode0 !== CurveExtendMode.None) {
        if (mode1 === CurveExtendMode.None) { // only extend to negative
          if (fraction > 1.0)
            fraction -= fractionPeriod;
        }
      } else if (mode1 !== CurveExtendMode.None) { // only extend to positive
        if (fraction < 0.0)
          fraction += fractionPeriod;
      } else { // no extension allowed
        fraction = Geometry.clamp(fraction, 0, 1);
        isValid = false;
      }
    }
    return { fraction, isValid };
  }

  /** Call [[resolveRadiansToValidSweepFraction]] and return only the fraction. */
  public static resolveRadiansToSweepFraction(
    extendParam: VariantCurveExtendParameter, radians: number, sweep: AngleSweep,
  ): number {
    return this.resolveRadiansToValidSweepFraction(extendParam, radians, sweep).fraction;
  }
}
/**
 * Variant options for extending a curve.
 * * Useful for specifying either a single boolean/`CurveExtendMode` option applicable to both ends of the curve,
 * or an array of options, the first entry of which applies to the curve start; the second, to curve end.
 * @public
 */
export type VariantCurveExtendParameter = boolean | CurveExtendMode | CurveExtendMode[];
