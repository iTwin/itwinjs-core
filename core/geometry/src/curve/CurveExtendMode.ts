/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Curve
 */

import { Geometry } from "../Geometry";
import { AngleSweep } from "../geometry3d/AngleSweep";

/** module Curve */
/** enumeration of condition for extending a curve beyond start or end point.
 * * Not all CurvePrimitives support these modes.
 * @public
 */
export enum CurveExtendMode {
  /** No extension allowed. */
  None = 0,
  /** Extend along continuation of the end tangent */
  OnTangent = 1,
  /** Extend along continuation of the curve. */
  OnCurve = 2,
}
/** Logic for deciding how a curve may be extended for closest point or intersection searches.
 * @public
 */
export class CurveExtendOptions {
  /** Given an ExtendParameter, isolate the particular CurveExtendOptions in effect at an end.
   * * Return undefined if `param === false`
   * * return the (strongly typed) pointer to the param if it is a single CurveExtendOptions.
   * * Return dereferenced array entry 0 or 1 if the param is an array of CurveExtendOptions.
   */
  public static resolveVariantCurveExtendParameterToCurveExtendMode(param: VariantCurveExtendParameter, endIndex: 0 | 1): CurveExtendMode {
    if (param === false)
      return CurveExtendMode.None;
    if (param === true)
      return CurveExtendMode.OnCurve;
    if (Array.isArray(param))
      return param[endIndex];
    return param;
  }
  /**
   *
   * * if fraction is between 0 and 1 return it unchanged.
   * * if fraction is less than 0 use the variant param to choose the fraction or 0
   * * if fraction is greater than 1 use the variant param to choose the fraction or 1
   *
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
   * Adjust a radians value to an angle sweep, allowing the extendParam to affect choice among periodic fractions.
   * * if radians is within the sweep, convert it to a fraction of the sweep.
   * * if radians is outside, use the extendParam to choose among:
   *    * fraction below 0
   *    * fraction above 1
   */
  public static resolveRadiansToSweepFraction(extendParam: VariantCurveExtendParameter, radians: number, sweep: AngleSweep): number {
    let fraction = sweep.radiansToSignedPeriodicFraction(radians);
    if (!sweep.isRadiansInSweep(radians)) {
      const fractionPeriod = sweep.fractionPeriod();
      const mode0 = CurveExtendOptions.resolveVariantCurveExtendParameterToCurveExtendMode(extendParam, 0);
      const mode1 = CurveExtendOptions.resolveVariantCurveExtendParameterToCurveExtendMode(extendParam, 1);
      if (mode0 !== CurveExtendMode.None) {
        if (mode1 !== CurveExtendMode.None) {
          // both extensions possible ... let the sweep resolve to the "closer" end
          fraction = sweep.radiansToSignedPeriodicFraction(radians);
        } else {
          // only extend to negative .....
          if (fraction > 1.0)
            fraction -= fractionPeriod;
        }
      } else if (mode1 !== CurveExtendMode.None) {
        if (fraction < 0.0)
          fraction += fractionPeriod;
      } else {    // both clamped !!!!
        fraction = Geometry.clamp(fraction, 0, 1);
      }
    }
    return fraction;
  }
}
/** Variants of a single parameter.
 * Use this type in a function signature where caller may want simple true, false, or same extend mode for both ends.
 * @public
 */
export type VariantCurveExtendParameter = boolean | CurveExtendMode | CurveExtendMode[];
