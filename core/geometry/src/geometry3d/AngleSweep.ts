/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module CartesianGeometry
 */

import { AngleSweepProps, BeJSONFunctions, Geometry } from "../Geometry";
import { Angle } from "./Angle";
import { GrowableFloat64Array } from "./GrowableFloat64Array";

/**
 * An `AngleSweep` is a pair of angles at start and end of an interval.
 *
 * *  For stroking purposes, the "included interval" is all angles numerically reached
 * by theta = start + f*(end-start), where f is between 0 and 1.
 * *  This stroking formula is simple numbers -- 2PI shifts are not involved.
 * *  2PI shifts do become important in the reverse mapping of an angle to a fraction.
 * *  If "start < end" the angle proceeds CCW around the unit circle.
 * *  If "end < start" the angle proceeds CW around the unit circle.
 * *  Angles beyond 360 are fine as endpoints.
 * *  (350,370) covers the same unit angles as (-10,10).
 * *  (370,350) covers the same unit angles as (10,-10).
 * *  math details related fraction API can be found at docs/learning/geometry/Angle.md
 *  * Visualization can be found at https://www.itwinjs.org/sandbox/SaeedTorabi/AngleSweep
 * @public
 */
export class AngleSweep implements BeJSONFunctions {
  private _radians0: number;
  private _radians1: number;
  /** Read-property for degrees at the start of this AngleSweep. */
  public get startDegrees() {
    return Angle.radiansToDegrees(this._radians0);
  }
  /** Read-property for degrees at the end of this AngleSweep. */
  public get endDegrees() {
    return Angle.radiansToDegrees(this._radians1);
  }
  /** Read-property for signed start-to-end sweep in degrees. */
  public get sweepDegrees() {
    return Angle.radiansToDegrees(this._radians1 - this._radians0);
  }
  /** Read-property for degrees at the start of this AngleSweep. */
  public get startRadians() {
    return this._radians0;
  }
  /** Read-property for degrees at the end of this AngleSweep. */
  public get endRadians() {
    return this._radians1;
  }
  /** Read-property for signed start-to-end sweep in radians. */
  public get sweepRadians() {
    return this._radians1 - this._radians0;
  }
  /** Whether the sweep angles are within smallAngle tolerance, without period shift. */
  public get isEmpty() {
    return Angle.isAlmostEqualRadiansNoPeriodShift(0, this.sweepRadians);
  }
  /** Return the (strongly typed) start angle */
  public get startAngle() {
    return Angle.createRadians(this._radians0);
  }
  /** Return the (strongly typed) end angle */
  public get endAngle() {
    return Angle.createRadians(this._radians1);
  }
  /**
   * Create a sweep as one of
   * * A clone of a given sweep
   * * 0 to given angle
   * * full circle if no arg given (sweep 0 to 360 degrees)
   */
  public static create(data?: AngleSweep | Angle): AngleSweep {
    if (data instanceof AngleSweep)
      return data.clone();
    if (data instanceof Angle)
      return new AngleSweep(0, data.radians);
    return AngleSweep.create360();
  }
  /**
   * (private) constructor with start and end angles in radians.
   * * Use explicitly named static methods to clarify intent and units of inputs:
   *
   * * createStartEndRadians (startRadians:number, endRadians:number)
   * * createStartEndDegrees (startDegrees:number, endDegrees:number)
   * * createStartEnd (startAngle:Angle, endAngle:Angle)
   * * createStartSweepRadians (startRadians:number, sweepRadians:number)
   * * createStartSweepDegrees (startDegrees:number, sweepDegrees:number)
   * * createStartSweep (startAngle:Angle, sweepAngle:Angle)
   */
  private constructor(startRadians: number = 0, endRadians: number = 0) {
    this._radians0 = startRadians;
    this._radians1 = endRadians;
  }
  /**
   * Directly set the start and end angles in radians
   * * If the difference between startRadians and endRadians is greater than 360, the function limits the angle sweep to 360.
   */
  public setStartEndRadians(startRadians: number = 0, endRadians: number = 2.0 * Math.PI) {
    const delta = endRadians - startRadians;
    if (Angle.isFullCircleRadians(delta)) {
      endRadians = startRadians + (delta > 0 ? 2.0 : -2.0) * Math.PI;
    }
    this._radians0 = startRadians;
    this._radians1 = endRadians;
  }
  /** Directly set the start and end angles in degrees */
  public setStartEndDegrees(startDegrees: number = 0, endDegrees: number = 360.0) {
    this.setStartEndRadians(Angle.degreesToRadians(startDegrees), Angle.degreesToRadians(endDegrees));
  }
  /**
   * Create an AngleSweep from start and end angles given in radians.
   * * If the difference between startRadians and endRadians is greater than 360, the function limits the angle sweep to 360.
   */
  public static createStartEndRadians(startRadians: number = 0, endRadians: number = 2.0 * Math.PI, result?: AngleSweep): AngleSweep {
    result = result ? result : new AngleSweep();
    result.setStartEndRadians(startRadians, endRadians);
    return result;
  }
  /** Return the angle obtained by subtracting radians from this angle. */
  public cloneMinusRadians(radians: number): AngleSweep {
    return new AngleSweep(this._radians0 - radians, this._radians1 - radians);
  }
  /** Create an AngleSweep from start and end angles given in degrees. */
  public static createStartEndDegrees(startDegrees: number = 0, endDegrees: number = 360, result?: AngleSweep): AngleSweep {
    return AngleSweep.createStartEndRadians(Angle.degreesToRadians(startDegrees), Angle.degreesToRadians(endDegrees), result);
  }
  /** Create an angle sweep from strongly typed start and end angles */
  public static createStartEnd(startAngle: Angle, endAngle: Angle, result?: AngleSweep): AngleSweep {
    result = result ? result : new AngleSweep();
    result.setStartEndRadians(startAngle.radians, endAngle.radians);
    return result;
  }
  /** Create an AngleSweep from start and end angles given in radians. */
  public static createStartSweepRadians(startRadians: number = 0, sweepRadians: number = Math.PI, result?: AngleSweep): AngleSweep {
    result = result ? result : new AngleSweep();
    result.setStartEndRadians(startRadians, startRadians + sweepRadians);
    return result;
  }
  /** Create an AngleSweep from start and sweep given in degrees.  */
  public static createStartSweepDegrees(startDegrees: number = 0, sweepDegrees: number = 360, result?: AngleSweep): AngleSweep {
    return AngleSweep.createStartEndRadians(Angle.degreesToRadians(startDegrees), Angle.degreesToRadians(startDegrees + sweepDegrees), result);
  }
  /** Create an angle sweep with limits given as (strongly typed) angles for start and sweep */
  public static createStartSweep(startAngle: Angle, sweepAngle: Angle, result?: AngleSweep): AngleSweep {
    return AngleSweep.createStartSweepRadians(startAngle.radians, sweepAngle.radians, result);
  }
  /** Return a sweep with limits interpolated between this and other. */
  public interpolate(fraction: number, other: AngleSweep): AngleSweep {
    return new AngleSweep(
      Geometry.interpolate(this._radians0, fraction, other._radians0),
      Geometry.interpolate(this._radians1, fraction, other._radians1),
    );
  }
  /** Copy from other AngleSweep. */
  public setFrom(other: AngleSweep) {
    this._radians0 = other._radians0;
    this._radians1 = other._radians1;
  }
  /** Create a full circle sweep (CCW). startRadians defaults to 0 */
  public static create360(startRadians?: number): AngleSweep {
    startRadians = startRadians ? startRadians : 0.0;
    return new AngleSweep(startRadians, startRadians + 2.0 * Math.PI);
  }
  /** Create a sweep from the south pole to the north pole (-90 to +90). */
  public static createFullLatitude() {
    return AngleSweep.createStartEndRadians(-0.5 * Math.PI, 0.5 * Math.PI);
  }
  /** Reverse the start and end angle in place. */
  public reverseInPlace() {
    const tmp = this._radians0;
    this._radians0 = this._radians1;
    this._radians1 = tmp;
  }
  /**
   * Return a sweep for the "other" part of the circle.
   * @param reverseDirection true to move backwards (CW) from start to end, false to more forwards (CCW) from start to end.
   */
  public cloneComplement(reverseDirection: boolean = false, result?: AngleSweep): AngleSweep {
    const s = this.sweepRadians >= 0 ? 2.0 : -2.0;
    if (reverseDirection)
      return AngleSweep.createStartEndRadians(this.startRadians, this.endRadians - s * Math.PI, result);
    else
      return AngleSweep.createStartEndRadians(this.endRadians, this.startRadians + s * Math.PI, result);
  }
  /** Restrict start and end angles into the range (-90,+90) in degrees */
  public capLatitudeInPlace() {
    const limit = 0.5 * Math.PI;
    this._radians0 = Geometry.clampToStartEnd(this._radians0, -limit, limit);
    this._radians1 = Geometry.clampToStartEnd(this._radians1, -limit, limit);
  }
  /** Ask if the sweep is counterclockwise, i.e. positive sweep */
  public get isCCW(): boolean {
    return this._radians1 >= this._radians0;
  }
  /** Ask if the sweep is a full circle. */
  public get isFullCircle(): boolean {
    return Angle.isFullCircleRadians(this.sweepRadians);
  }
  /** Ask if the sweep is a full sweep from south pole to north pole. */
  public get isFullLatitudeSweep(): boolean {
    const a = Math.PI * 0.5;
    return Angle.isAlmostEqualRadiansNoPeriodShift(this._radians0, -a)
      && Angle.isAlmostEqualRadiansNoPeriodShift(this._radians1, a);
  }
  /** Return a clone of this sweep. */
  public clone(): AngleSweep {
    return new AngleSweep(this._radians0, this._radians1);
  }
  /** Convert fractional position in the sweep to radians. */
  public fractionToRadians(fraction: number): number {
    return fraction < 0.5 ?
      this._radians0 + fraction * (this._radians1 - this._radians0) :
      this._radians1 + (fraction - 1.0) * (this._radians1 - this._radians0);
  }
  /** Convert fractional position in the sweep to strongly typed Angle object. */
  public fractionToAngle(fraction: number) {
    return Angle.createRadians(this.fractionToRadians(fraction));
  }
  /**
   * Return 2PI divided by the sweep radians (i.e. 360 degrees divided by sweep angle).
   * * This is the number of fractional intervals required to cover a whole circle.
   * @returns period of the sweep, or 1 if sweep is empty.
   */
  public fractionPeriod(): number {
    return this.isEmpty ? 1.0 : Angle.pi2Radians / Math.abs(this._radians1 - this._radians0);
  }
  /**
   * Return the fractionalized position of the given angle (as Angle) computed without consideration of
   * 2PI period and without consideration of angle sweep direction (CW or CCW).
   * *  the start angle is at fraction 0
   * *  the end angle is at fraction 1
   * *  interior angles are between 0 and 1
   * *  negative fraction for angles "before" the start angle if start < end
   * *  fraction larger than one for angles "after" the end angle if start < end
   * *  fraction larger than one for angles "before" the start angle if start > end
   * *  negative fraction for angles "after" the end angle if start > end
   * *  does not allow period shift
   * @returns unbounded fraction, or 1 if sweep is empty.
   */
  public angleToUnboundedFraction(theta: Angle): number {
    return this.isEmpty ? 1.0 : (theta.radians - this._radians0) / (this._radians1 - this._radians0);
  }

  /**
   * Convert a sweep fraction to the equivalent period-shifted fraction inside the sweep, or within one period of zero
   * on the desired side.
   * @param fraction fraction of the sweep.
   * @param radians0 start angle of sweep (in radians).
   * @param radians1 end angle of sweep (in radians).
   * @param toNegativeFraction return an exterior fraction period-shifted to within one period of the start (true) or
   * end (false) of the sweep.
   * @returns period-shifted fraction. If `fraction` is already in [0,1], or the sweep is empty, then `fraction` is
   * returned unchanged.
   */
  public static fractionToSignedPeriodicFractionStartEnd(fraction: number, radians0: number, radians1: number, toNegativeFraction: boolean): number {
    const sweep = radians1 - radians0;
    if (Angle.isAlmostEqualRadiansNoPeriodShift(0, sweep))
      return fraction; // empty sweep
    if (Geometry.isIn01(fraction))
      return fraction;
    const period = Angle.pi2Radians / Math.abs(sweep);
    fraction = fraction % period; // period-shifted equivalent fraction closest to 0 with same sign as fraction
    if (fraction + period < 1)
      fraction += period; // it's really an interior fraction
    if (Geometry.isIn01(fraction) || (toNegativeFraction && fraction < 0) || (!toNegativeFraction && fraction > 1))
      return fraction;
    return toNegativeFraction ? fraction - period : fraction + period; // shift to other side of sweep
  }
  /**
   * Convert a sweep fraction to the equivalent period-shifted fraction inside this sweep, or within one period of
   * zero on the desired side.
   * @param fraction fraction of the sweep.
   * @param toNegativeFraction return an exterior fraction period-shifted to within one period of the start (true) or
   * end (false) of the sweep.
   * @returns period-shifted fraction. If `fraction` is already in [0,1], or the sweep is empty, then `fraction` is
   * returned unchanged.
   */
  public fractionToSignedPeriodicFraction(fraction: number, toNegativeFraction: boolean): number {
    return AngleSweep.fractionToSignedPeriodicFractionStartEnd(fraction, this._radians0, this._radians1, toNegativeFraction);
  }

  /**
   * Return the fractionalized position of the given angle (as radians), computed with consideration of 2PI period.
   * *  consider radians0 as `start` angle of the sweep and radians1 as `end` angle of the sweep
   * *  the start angle is at fraction 0
   * *  the end angle is at fraction 1
   * *  interior angles are between 0 and 1
   * *  all exterior angles are at fractions greater than 1
   * *  allows period shift
   * @param radians input angle (in radians)
   * @param radians0 start angle of sweep (in radians)
   * @param radians1 end angle of sweep (in radians)
   * @param zeroSweepDefault return value when the sweep is empty (default 0)
   * @returns nonnegative fraction, or `zeroSweepDefault` if the sweep is empty.
   */
  public static radiansToPositivePeriodicFractionStartEnd(radians: number, radians0: number, radians1: number, zeroSweepDefault: number = 0.0): number {
    const zeroSweepMarker = Geometry.largeCoordinateResult;
    let fraction = this.radiansToSignedPeriodicFractionStartEnd(radians, radians0, radians1, zeroSweepMarker);
    if (fraction === zeroSweepMarker)
      return zeroSweepDefault;
    if (fraction < 0) {
      const period = Angle.pi2Radians / Math.abs(radians1 - radians0);
      fraction += period;
    }
    return fraction;
  }
  /**
   * Return the fractionalized position of the given angle (as radians), computed with consideration of 2PI period.
   * *  the start angle is at fraction 0
   * *  the end angle is at fraction 1
   * *  interior angles are between 0 and 1
   * *  all exterior angles are at fractions greater than 1
   * *  allows period shift
   * @param radians input angle (in radians)
   * @param zeroSweepDefault return value when this sweep is empty (default 0)
   * @returns nonnegative fraction, or `zeroSweepDefault` if the sweep is empty.
   */
  public radiansToPositivePeriodicFraction(radians: number, zeroSweepDefault: number = 0.0): number {
    return AngleSweep.radiansToPositivePeriodicFractionStartEnd(radians, this._radians0, this._radians1, zeroSweepDefault);
  }
  /**
   * Return the fractionalized position of the given angle (as Angle), computed with consideration of 2PI period.
   * *  the start angle is at fraction 0
   * *  the end angle is at fraction 1
   * *  interior angles are between 0 and 1
   * *  all exterior angles are at fractions greater than 1
   * *  allows period shift
   * @param theta input angle
   * @param zeroSweepDefault return value when this sweep is empty (default 0)
   * @returns nonnegative fraction, or `zeroSweepDefault` if the sweep is empty.
   */
  public angleToPositivePeriodicFraction(theta: Angle, zeroSweepDefault: number = 0.0): number {
    return this.radiansToPositivePeriodicFraction(theta.radians, zeroSweepDefault);
  }
  /**
   * Return the fractionalized position of the given array of angles (as radian), computed with consideration of 2PI period.
   * *  fraction is always positive
   * *  the start angle is at fraction 0
   * *  the end angle is at fraction 1
   * *  interior angles are between 0 and 1
   * *  all exterior angles are at fractions greater than 1
   * *  allows period shift
   */
  public radiansArrayToPositivePeriodicFractions(data: GrowableFloat64Array) {
    const n = data.length;
    for (let i = 0; i < n; i++) {
      data.reassign(i, this.radiansToPositivePeriodicFraction(data.atUncheckedIndex(i)));
    }
  }
  /**
   * Return the fractionalized position of the given angle (as radians) computed with consideration of
   * 2PI period and with consideration of angle sweep direction (CW or CCW).
   * *  the start angle is at fraction 0
   * *  the end angle is at fraction 1
   * *  interior angles are between 0 and 1
   * *  negative fraction for angles "before" the start angle
   * *  fraction larger than one for angles "after" the end angle
   * *  allows period shift
   * @param radians input angle (in radians)
   * @param radians0 start angle of sweep (in radians)
   * @param radians1 end angle of sweep (in radians)
   * @param zeroSweepDefault return value when the sweep is empty (default 0)
   * @returns fraction, or `zeroSweepDefault` if the sweep is empty.
   */
  public static radiansToSignedPeriodicFractionStartEnd(radians: number, radians0: number, radians1: number, zeroSweepDefault: number = 0.0): number {
    const sweep = radians1 - radians0;
    if (Angle.isAlmostEqualRadiansNoPeriodShift(0, sweep))
      return zeroSweepDefault;
    if (Angle.isAlmostEqualRadiansAllowPeriodShift(radians0, radians1)) {
      // for sweep = 2nPi !== 0, allow matching without period shift, else we never return 1.0
      if (Angle.isAlmostEqualRadiansNoPeriodShift(radians, radians0))
        return 0.0;
      if (Angle.isAlmostEqualRadiansNoPeriodShift(radians, radians1))
        return 1.0;
    } else {
      if (Angle.isAlmostEqualRadiansAllowPeriodShift(radians, radians0))
        return 0.0;
      if (Angle.isAlmostEqualRadiansAllowPeriodShift(radians, radians1))
        return 1.0;
    }
    const fraction = (radians - radians0) / sweep;
    return this.fractionToSignedPeriodicFractionStartEnd(fraction, radians0, radians1, fraction < 0);
  }
  /**
   * Return the fractionalized position of the given angle (as radians) computed with consideration of
   * 2PI period and with consideration of angle sweep direction (CW or CCW).
   * *  the start angle is at fraction 0
   * *  the end angle is at fraction 1
   * *  interior angles are between 0 and 1
   * *  negative fraction for angles "before" the start angle
   * *  fraction larger than one for angles "after" the end angle
   * *  allows period shift
   * @param radians input angle (in radians)
   * @param zeroSweepDefault return value when this sweep is empty (default 0)
   * @returns fraction, or `zeroSweepDefault` if this sweep is empty.
   */
  public radiansToSignedPeriodicFraction(radians: number, zeroSweepDefault: number = 0.0): number {
    return AngleSweep.radiansToSignedPeriodicFractionStartEnd(radians, this._radians0, this._radians1, zeroSweepDefault);
  }
  /**
   * Return the fractionalized position of the given angle (as Angle) computed with consideration of
   * 2PI period and with consideration of angle sweep direction (CW or CCW).
   * *  the start angle is at fraction 0
   * *  the end angle is at fraction 1
   * *  interior angles are between 0 and 1
   * *  negative fraction for angles "before" the start angle
   * *  fraction larger than one for angles "after" the end angle
   * *  allows period shift
   * @param theta input angle
   * @param zeroSweepDefault return value when this sweep is empty (default 0)
   * @returns fraction, or `zeroSweepDefault` if this sweep is empty.
   */
  public angleToSignedPeriodicFraction(theta: Angle, zeroSweepDefault: number = 0.0): number {
    return this.radiansToSignedPeriodicFraction(theta.radians, zeroSweepDefault);
  }

  /**
   * Return the fractionalized position of the given radian angle with respect to the sweep.
   * * The start angle returns fraction 0
   * * The end angle returns fraction 1
   * * Interior angles (and their multiples of 2PI) return fractions in [0,1].
   * * Exterior angles return fractions outside [0,1] according to `toNegativeFraction`.
   * @param radians input angle (in radians)
   * @param radians0 start angle of sweep (in radians)
   * @param radians1 end angle of sweep (in radians)
   * @param toNegativeFraction convert an exterior angle to a negative number (true), or to
   * a number greater than one (false, default). If false, this is just [[radiansToPositivePeriodicFractionStartEnd]].
   * @param zeroSweepDefault return value when the sweep is empty (default 0).
   * @returns fraction, or `zeroSweepDefault` if the sweep is empty
   */
  public static radiansToSignedFractionStartEnd(radians: number, radians0: number, radians1: number, toNegativeFraction: boolean = false, zeroSweepDefault: number = 0.0): number {
    const zeroSweepMarker = Geometry.largeCoordinateResult;
    let fraction = this.radiansToSignedPeriodicFractionStartEnd(radians, radians0, radians1, zeroSweepMarker);
    if (fraction === zeroSweepMarker)
      return zeroSweepDefault;
    if ((toNegativeFraction && fraction > 1) || (!toNegativeFraction && fraction < 0)) {
      let period = Angle.pi2Radians / Math.abs(radians1 - radians0);
      if (toNegativeFraction)
        period = -period;
      fraction += period;
    }
    return fraction;
  }
  /**
   * Return the fractionalized position of the given radian angle with respect to this sweep.
   * * The start angle returns fraction 0
   * * The end angle returns fraction 1
   * * Interior angles (and their multiples of 2PI) return fractions in [0,1].
   * * Exterior angles return fractions outside [0,1] according to `toNegativeFraction`.
   * @param radians input angle (in radians)
   * @param toNegativeFraction convert an exterior angle to a negative number (true), or to
   * a number greater than one (false, default). If false, this is just [[radiansToPositivePeriodicFraction]].
   * @param zeroSweepDefault return value when this sweep is empty (default 0).
   * @returns fraction, or `zeroSweepDefault` if this sweep is empty
   */
  public radiansToSignedFraction(radians: number, toNegativeFraction: boolean = false, zeroSweepDefault: number = 0.0): number {
    return AngleSweep.radiansToSignedFractionStartEnd(radians, this._radians0, this._radians1, toNegativeFraction, zeroSweepDefault);
  }
  /**
   * Return the fractionalized position of the given angle with respect to this sweep.
   * * The start angle returns fraction 0
   * * The end angle returns fraction 1
   * * Interior angles (and their multiples of 2PI) return fractions in [0,1].
   * * Exterior angles return fractions outside [0,1] according to `toNegativeFraction`.
   * @param theta input angle
   * @param toNegativeFraction convert an exterior angle to a negative number (true), or to
   * a number greater than one (false, default). If false, this is just [[angleToPositivePeriodicFraction]].
   * @param zeroSweepDefault return value when this sweep is empty (default 0).
   * @returns fraction, or `zeroSweepDefault` if this sweep is empty
   */
  public angleToSignedFraction(theta: Angle, toNegativeFraction: boolean = false, zeroSweepDefault: number = 0.0): number {
    return this.radiansToSignedFraction(theta.radians, toNegativeFraction, zeroSweepDefault);
  }

  /** Test if the given angle (as radians) is within sweep (between radians0 and radians1)   */
  public static isRadiansInStartEnd(radians: number, radians0: number, radians1: number, allowPeriodShift: boolean = true): boolean {
    const delta0 = radians - radians0;
    const delta1 = radians - radians1;
    if (delta0 * delta1 <= 0.0)
      return true;
    if (radians0 === radians1)
      return allowPeriodShift ? Angle.isAlmostEqualRadiansAllowPeriodShift(radians, radians0) : Angle.isAlmostEqualRadiansNoPeriodShift(radians, radians0);
    return allowPeriodShift ? this.radiansToPositivePeriodicFractionStartEnd(radians, radians0, radians1, 1000.0) <= 1.0 : false;
  }
  /** Test if the given angle (as radians) is within sweep  */
  public isRadiansInSweep(radians: number, allowPeriodShift: boolean = true): boolean {
    return AngleSweep.isRadiansInStartEnd(radians, this.startRadians, this.endRadians, allowPeriodShift);
  }
  /** Test if the given angle (as Angle) is within the sweep */
  public isAngleInSweep(angle: Angle): boolean {
    return this.isRadiansInSweep(angle.radians);
  }
  /**
   * Set this AngleSweep from various sources:
   * * if json is undefined, a full-circle sweep is returned.
   * * If json is an AngleSweep object, it is cloned
   * * If json is an array of 2 numbers, those numbers are start and end angles in degrees.
   * * If `json.degrees` is an array of 2 numbers, those numbers are start and end angles in degrees.
   * * If `json.radians` is an array of 2 numbers, those numbers are start and end angles in radians.
   * * Otherwise, a full-circle sweep is returned.
   */
  public setFromJSON(json?: any) {
    if (!json)
      this.setStartEndRadians(); // default full circle
    else if (json instanceof AngleSweep)
      this.setFrom(json);
    else if (Geometry.isNumberArray(json.degrees, 2))
      this.setStartEndDegrees(json.degrees[0], json.degrees[1]);
    else if (Geometry.isNumberArray(json.radians, 2))
      this.setStartEndRadians(json.radians[0], json.radians[1]);
    else if (Geometry.isNumberArray(json, 2))
      this.setStartEndDegrees(json[0], json[1]);
    else
      this.setStartEndRadians(); // default full circle
  }
  /** Create an AngleSweep from a json object. */
  public static fromJSON(json?: AngleSweepProps): AngleSweep {
    const result = AngleSweep.create360();
    result.setFromJSON(json);
    return result;
  }
  /**
   * Convert an AngleSweep to a JSON object.
   * @return {*} [startAngleInDegrees, endAngleInDegrees]
   */
  public toJSON(): any {
    return [this.startDegrees, this.endDegrees];
  }
  /**
   * Test if two angle sweeps match within the given tolerance.
   * * Period shifts are allowed, but orientations must be the same.
   * @param other sweep to compare to this instance
   * @param radianTol optional radian tolerance, default value `Geometry.smallAngleRadians`
   */
  public isAlmostEqualAllowPeriodShift(other: AngleSweep, radianTol: number = Geometry.smallAngleRadians): boolean {
    return this.isCCW === other.isCCW // this rules out equating opposite sweeps like [0,-100] and [0,260]
      && Angle.isAlmostEqualRadiansAllowPeriodShift(this._radians0, other._radians0, radianTol)
      && Angle.isAlmostEqualRadiansAllowPeriodShift(this._radians1 - this._radians0, other._radians1 - other._radians0, radianTol);
  }
  /**
   * Test if two angle sweeps match within the given tolerance.
   * * Period shifts are not allowed.
   * @param other sweep to compare to this instance
   * @param radianTol optional radian tolerance, default value `Geometry.smallAngleRadians`
   */
  public isAlmostEqualNoPeriodShift(other: AngleSweep, radianTol: number = Geometry.smallAngleRadians): boolean {
    return Angle.isAlmostEqualRadiansNoPeriodShift(this._radians0, other._radians0, radianTol)
      && Angle.isAlmostEqualRadiansNoPeriodShift(this._radians1 - this._radians0, other._radians1 - other._radians0, radianTol);
  }
  /**
   * Test if start and end angles match with radians tolerance.
   * * Period shifts are not allowed.
   * * This function is equivalent to isAlmostEqualNoPeriodShift. It is present for consistency with other classes.
   * However, it is recommended to use isAlmostEqualNoPeriodShift which has a clearer name.
   */
  public isAlmostEqual(other: AngleSweep): boolean {
    return this.isAlmostEqualNoPeriodShift(other);
  }
}
