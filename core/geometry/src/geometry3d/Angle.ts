/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module CartesianGeometry
 */

import { AngleProps, BeJSONFunctions, Geometry, TrigValues } from "../Geometry";

/**
 * An `Angle` carries the numeric value of an angle, with methods to allow (require!) callers to
 * be clear about whether their angle is degrees or radians.
 * * After the Angle object is created, the callers should not know or care whether it is stored in
 * `degrees` or `radians` because both are available if requested by caller.
 * * The various access method are named so that callers can specify whether untyped numbers passed in or
 * out are degrees or radians.
 * * Visualization can be found at https://www.itwinjs.org/sandbox/SaeedTorabi/AngleSweep
 * @public
 */
export class Angle implements BeJSONFunctions {
  /** maximal accuracy value of pi/12 (15 degrees), in radians */
  public static readonly piOver12Radians = 0.26179938779914946;
  /** maximal accuracy value of pi/4 (45 degrees), in radians */
  public static readonly piOver4Radians = 7.853981633974483e-001;
  /** maximal accuracy value of pi/2 (90 degrees), in radians */
  public static readonly piOver2Radians = 1.5707963267948966e+000;
  /** maximal accuracy value of pi (180 degrees), in radians */
  public static readonly piRadians = 3.141592653589793e+000;
  /** maximal accuracy value of 2*pi (360 degrees), in radians */
  public static readonly pi2Radians = 6.283185307179586e+000;
  /** scale factor for converting radians to degrees */
  public static readonly degreesPerRadian = (45.0 / Angle.piOver4Radians);
  /** scale factor for converting degrees to radians */
  public static readonly radiansPerDegree = (Angle.piOver4Radians / 45.0);
  private _radians: number;
  private _degrees?: number;
  private constructor(radians = 0, degrees?: number) {
    this._radians = radians;
    this._degrees = degrees;
  }
  /** Return a new angle with the same content. */
  public clone(): Angle {
    return new Angle(this._radians, this._degrees);
  }
  /** Freeze this instance so it is read-only */
  public freeze(): Readonly<this> {
    return Object.freeze(this);
  }
  /**
   * Return a new Angle object for angle given in degrees.
   * @param degrees angle in degrees
   */
  public static createDegrees(degrees: number): Angle {
    return new Angle(Angle.degreesToRadians(degrees), degrees);
  }
  /**
   * Return a (new) Angle object for a value given in radians.
   * @param radians angle in radians
   */
  public static createRadians(radians: number): Angle {
    return new Angle(radians);
  }
  /**
   * Return a new `Angle` object with the default "small" angle measurement specified by [[Geometry.smallAngleRadians]].
   */
  public static createSmallAngle(): Angle {
    return new Angle(Geometry.smallAngleRadians);
  }
  /**
   * Return a (new) Angle object that is interpolated between two inputs (based on a fraction)
   * @param angle0 first angle in radians
   * @param fraction the interpolation fraction
   * @param angle1 second angle in radians
   */
  public static createInterpolate(angle0: Angle, fraction: number, angle1: Angle): Angle {
    return new Angle(Geometry.interpolate(angle0.radians, fraction, angle1.radians));
  }
  /**
   * Return a (new) Angle object, with angle scaled from existing angle.
   * @param scale scale factor to apply to angle.
   */
  public cloneScaled(scale: number): Angle {
    return new Angle(this.radians * scale);
  }
  /**
   * Set this angle to a value given in radians.
   * @param radians angle given in radians
   */
  public setRadians(radians: number) {
    this._radians = radians;
    this._degrees = undefined;
  }
  /**
   * Set this angle to a value given in degrees.
   * @param degrees angle given in degrees.
   */
  public setDegrees(degrees: number) {
    this._radians = Angle.degreesToRadians(degrees);
    this._degrees = degrees;
  }
  /** Create an angle for a full circle. */
  public static create360(): Angle {
    return new Angle(Math.PI * 2.0, 360.0);
  }
  /**
   * Create a (strongly typed) Angle whose tangent is `numerator/denominator`, using the signs of both in
   * determining the (otherwise ambiguous) quadrant.
   * @param numerator numerator for tangent
   * @param denominator denominator for tangent
   */
  public static createAtan2(numerator: number, denominator: number): Angle {
    return new Angle(Math.atan2(numerator, denominator));
  }
  /**
   * Copy all contents of `other` to this Angle.
   * @param other source data
   */
  public setFrom(other: Angle) {
    this._radians = other._radians;
    this._degrees = other._degrees;
  }
  /**
   * Set an Angle from a JSON object
   * * A simple number is considered as degrees.
   * * specified `json.degrees` or `json._degrees` is degree value.
   * * specified `son.radians` or `json._radians` is radians value.
   * @param json object from JSON.parse. If a number, value is in *DEGREES*
   * @param defaultValRadians if json is undefined, default value in radians.
   */
  public setFromJSON(json?: AngleProps, defaultValRadians?: number) {
    this._radians = defaultValRadians ? defaultValRadians : 0;
    if (!json)
      return;
    if (typeof json === "number") {
      this.setDegrees(json);
    } else if (typeof (json as any).degrees === "number") {
      this.setDegrees((json as any).degrees);
    } else if (typeof (json as any)._degrees === "number") {
      this.setDegrees((json as any)._degrees);
    } else if (typeof (json as any).radians === "number") {
      this.setRadians((json as any).radians);
    } else if (typeof (json as any)._radians === "number") {
      this.setRadians((json as any)._radians);
    }
  }
  /**
   * Create an Angle from a JSON object
   * @param json object from JSON.parse. If a number, value is in *DEGREES*
   * @param defaultValRadians if json is undefined, default value in radians.
   * @return a new Angle
   */
  public static fromJSON(json?: AngleProps, defaultValRadians?: number): Angle {
    const val = new Angle();
    val.setFromJSON(json, defaultValRadians);
    return val;
  }
  /** Convert an Angle to a JSON object as a number in degrees */
  public toJSON(): AngleProps {
    return this.degrees;
  }
  /** Return a json object with radians keyword, e.g. `{ radians: 0.10}` */
  public toJSONRadians(): AngleProps {
    return { radians: this.radians };
  }
  /** Return the angle measured in radians. */
  public get radians(): number {
    return this._radians;
  }
  /** Return the angle measured in degrees. */
  public get degrees(): number {
    return this._degrees !== undefined ? this._degrees : Angle.radiansToDegrees(this._radians);
  }
  /**
   * Convert an angle in degrees to radians.
   * @param degrees angle in degrees
   */
  public static degreesToRadians(degrees: number): number {
    return degrees * Math.PI / 180;
  }
  /**
   * Convert an angle in radians to degrees.
   * @param degrees angle in radians
   */
  public static radiansToDegrees(radians: number): number {
    if (radians < 0)
      return -Angle.radiansToDegrees(-radians);
    // Now radians is positive ...
    const pi = Math.PI;
    const factor = 180.0 / pi;
    /* the following if statements are for round-off reasons. The problem is that no IEEE number is
      * an exact hit for any primary multiple of pi (90, 180, etc). The following is supposed to have
      * a better chance that if the input was computed by direct assignment from 90, 180, etc degrees
      * it will return exactly 90,180 etc.
      */
    if (radians <= 0.25 * pi)
      return factor * radians;
    if (radians < 0.75 * pi)
      return 90.0 + 180 * ((radians - 0.5 * pi) / pi);
    if (radians <= 1.25 * pi)
      return 180.0 + 180 * ((radians - pi) / pi);
    if (radians <= 1.75 * pi)
      return 270.0 + 180 * ((radians - 1.5 * pi) / pi);
    // all larger radians reference from 360 degrees (2PI)
    return 360.0 + 180 * ((radians - 2.0 * pi) / pi);
  }
  /** Return the cosine of this Angle object's angle */
  public cos(): number {
    return Math.cos(this._radians);
  }
  /** Return the sine of this Angle object's angle */
  public sin(): number {
    return Math.sin(this._radians);
  }
  /** Return the tangent of this Angle object's angle */
  public tan(): number {
    return Math.tan(this._radians);
  }
  /** Test if a radians (absolute) value is nearly 2PI or larger! */
  public static isFullCircleRadians(radians: number): boolean {
    return Math.abs(radians) >= Geometry.fullCircleRadiansMinusSmallAngle;
  }
  /** Test if the radians value is a half circle */
  public static isHalfCircleRadians(radians: number): boolean {
    return Math.abs(Math.abs(radians) - Math.PI) <= Geometry.smallAngleRadians;
  }
  /** Test if the angle is a full circle */
  public get isFullCircle(): boolean {
    return Angle.isFullCircleRadians(this._radians);
  }
  /** Test if the angle is a half circle (in either direction) */
  public get isHalfCircle(): boolean {
    return Angle.isHalfCircleRadians(this._radians);
  }
  /** Adjust a radians value so it is positive in 0..360 */
  public static adjustDegrees0To360(degrees: number): number {
    if (degrees >= 0) {
      const period = 360.0;
      if (degrees < period)
        return degrees;
      const numPeriods = Math.floor(degrees / period);
      return degrees - numPeriods * period;
    } else if (degrees < 0) {
      // negative angle ...
      const radians = Angle.adjustDegrees0To360(-degrees);
      return 360.0 - radians;
    }
    // fall through for Nan (disaster) !!!
    return 0;
  }
  /** Adjust a radians value so it is in -180..180 */
  public static adjustDegreesSigned180(degrees: number): number {
    if (Math.abs(degrees) <= 180.0)
      return degrees;
    if (degrees >= 0) {
      const period = 360.0;
      const numPeriods = 1 + Math.floor((degrees - 180.0) / period);
      return degrees - numPeriods * period;
    } else if (degrees < 0) {
      // negative angle ...
      return -Angle.adjustDegreesSigned180(-degrees);
    }
    // fall through for NaN disaster.
    return 0;
  }
  /** Adjust a radians value so it is positive in 0..2Pi */
  public static adjustRadians0To2Pi(radians: number): number {
    if (radians >= 0) {
      const period = Math.PI * 2.0;
      if (radians < period)
        return radians;
      const numPeriods = Math.floor(radians / period);
      return radians - numPeriods * period;
    } else if (radians < 0) {
      // negative angle ...
      return Math.PI * 2.0 - Angle.adjustRadians0To2Pi(-radians);
    }
    // fall through for NaN disaster.
    return 0;
  }
  /** Adjust a radians value so it is positive in -PI..PI */
  public static adjustRadiansMinusPiPlusPi(radians: number): number {
    if (Math.abs(radians) <= Math.PI)
      return radians;
    if (radians >= 0) {
      const period = Math.PI * 2.0;
      const numPeriods = 1 + Math.floor((radians - Math.PI) / period);
      return radians - numPeriods * period;
    } else if (radians < 0) {
      // negative angle ...
      return -Angle.adjustRadiansMinusPiPlusPi(-radians);
    }
    // fall through for NaN disaster.
    return 0;
  }
  /** Return a (newly allocated) Angle object with value 0 radians */
  public static zero(): Angle {
    return new Angle(0);
  }
  /** Test if the angle is exactly zero. */
  public get isExactZero(): boolean {
    return this.radians === 0;
  }
  /** Test if the angle is almost zero (within tolerance `Geometry.smallAngleRadians`) */
  public get isAlmostZero(): boolean {
    return Math.abs(this.radians) < Geometry.smallAngleRadians;
  }
  /** Test if the angle is almost a north or south pole (within tolerance `Geometry.smallAngleRadians`) */
  public get isAlmostNorthOrSouthPole(): boolean {
    return Angle.isHalfCircleRadians(this.radians * 2.0);
  }
  /** Create an angle object with degrees adjusted into 0..360. */
  public static createDegreesAdjustPositive(degrees: number): Angle {
    return Angle.createDegrees(Angle.adjustDegrees0To360(degrees));
  }
  /** Create an angle object with degrees adjusted into -180..180. */
  public static createDegreesAdjustSigned180(degrees: number): Angle {
    return Angle.createDegrees(Angle.adjustDegreesSigned180(degrees));
  }
  /**
   * Test if two radians values are equivalent, allowing shift by full circle (i.e. by a multiple of `2*PI`)
   * @param radiansA first radians value
   * @param radiansB second radians value
   * @param radianTol radian tolerance with default value of Geometry.smallAngleRadians
   */
  public static isAlmostEqualRadiansAllowPeriodShift(radiansA: number, radiansB: number,
    radianTol: number = Geometry.smallAngleRadians): boolean {
    const delta = Math.abs(radiansA - radiansB);
    if (delta <= radianTol)
      return true;
    const period = Math.PI * 2.0;
    if (Math.abs(delta - period) <= radianTol)
      return true;
    const numPeriod = Math.round(delta / period);
    const delta1 = delta - numPeriod * period;
    return Math.abs(delta1) <= radianTol;
  }
  /**
 * Test if this angle has magnitude no greater than that of `other`.
 * @param other the other angle
 */
  public isMagnitudeLessThanOrEqual(other: Angle): boolean {
    return Math.abs(this.radians) <= Math.abs(other.radians);
  }

  /**
   * Test if this angle and other are equivalent, allowing shift by full circle (i.e., multiples of `2 * PI`).
   * @param other the other angle
   * @param radianTol radian tolerance with default value of Geometry.smallAngleRadians
   */
  public isAlmostEqualAllowPeriodShift(other: Angle, radianTol: number = Geometry.smallAngleRadians): boolean {
    return Angle.isAlmostEqualRadiansAllowPeriodShift(this._radians, other._radians, radianTol);
  }
  /**
   * Test if two angle (in radians)  almost equal, NOT allowing shift by full circle (i.e., multiples of `2 * PI`).
   * @param radiansA first radians value
   * @param radiansB second radians value
   * @param radianTol radian tolerance with default value of Geometry.smallAngleRadians
   */
  public static isAlmostEqualRadiansNoPeriodShift(radiansA: number, radiansB: number,
    radianTol: number = Geometry.smallAngleRadians): boolean {
    return Math.abs(radiansA - radiansB) < radianTol;
  }
  /**
   * Test if two this angle and other are almost equal, NOT allowing shift by full circle (i.e., multiples of `2 * PI`).
   * @param other the other angle
   * @param radianTol radian tolerance with default value of Geometry.smallAngleRadians
   */
  public isAlmostEqualNoPeriodShift(other: Angle, radianTol: number = Geometry.smallAngleRadians): boolean {
    return Angle.isAlmostEqualRadiansNoPeriodShift(this._radians, other._radians, radianTol);
  }
  /**
   * Test if two this angle and other are almost equal, NOT allowing shift by full circle (i.e., multiples of `2 * PI`).
   * * This function is same as isAlmostEqualRadiansNoPeriodShift. Please use isAlmostEqualRadiansNoPeriodShift.
   * @param other the other angle
   * @param radianTol radian tolerance with default value of Geometry.smallAngleRadians
   */
  public isAlmostEqual(other: Angle, radianTol: number = Geometry.smallAngleRadians): boolean {
    return this.isAlmostEqualNoPeriodShift(other, radianTol);
  }
  /**
   * Test if dot product values indicate non-zero length perpendicular vectors.
   * @param dotUU dot product of vectorU with itself
   * @param dotVV dot product of vectorV with itself
   * @param dotUV dot product of vectorU with vectorV
   */
  public static isPerpendicularDotSet(dotUU: number, dotVV: number, dotUV: number): boolean {
    return dotUU > Geometry.smallMetricDistanceSquared
      && dotVV > Geometry.smallMetricDistanceSquared
      && dotUV * dotUV <= Geometry.smallAngleRadiansSquared * dotUU * dotVV;
  }
  /**
   * Return cosine, sine, and radians for the half angle of a "cosine,sine" pair.
   * * This function assumes the input arguments are related to an angle between -PI and PI
   * * This function returns an angle between -PI and PI
   * @param rCos2A cosine value (scaled by radius) for initial angle.
   * @param rSin2A sine value (scaled by radius) for final angle.
   */
  public static trigValuesToHalfAngleTrigValues(rCos2A: number, rSin2A: number): TrigValues {
    const r = Geometry.hypotenuseXY(rCos2A, rSin2A);
    if (r < Geometry.smallMetricDistance) {
      return { c: 1.0, s: 0.0, radians: 0.0 }; // angle = 0
    } else {
      /* If the caller really gave you sine and cosine values, r should be 1.  However,
       * to allow scaled values -- e.g. the x and y components of any vector -- we normalize
       * right here. This adds an extra sqrt and 2 divides to the whole process, but improves
       * both the usefulness and robustness of the computation.
       */
      let cosA;
      let sinA = 0.0;
      const cos2A = rCos2A / r;
      const sin2A = rSin2A / r;
      // Original angle in NE and SE quadrants. Half angle in same quadrant
      if (cos2A >= 0.0) {
        /*
         * We know cos2A = (cosA)^2 - (sinA)^2 and 1 = (cosA)^2 + (sinA)^2
         * so 1 + cos2A = 2(cosA)^2 and therefore, cosA = sqrt((1+cos2A)/2)
         * cosine is positive in NE and SE quadrants so we use +sqrt
         */
        cosA = Math.sqrt(0.5 * (1.0 + cos2A));
        // We know sin2A = 2 sinA cosA so sinA = sin2A/(2*cosA)
        sinA = sin2A / (2.0 * cosA);
      } else {
        // Original angle in NW quadrant. Half angle in NE quadrant
        if (sin2A > 0.0) {
          /*
           * We know cos2A = (cosA)^2 - (sinA)^2 and 1 = (cosA)^2 + (sinA)^2
           * so 1 - cos2A = 2(sinA)^2 and therefore, sinA = sqrt((1-cos2A)/2)
           * sine is positive in NE quadrant so we use +sqrt
           */
          sinA = Math.sqrt(0.5 * (1.0 - cos2A));
          // Original angle in SW quadrant. Half angle in SE quadrant
        } else {
          // sine is negative in SE quadrant so we use -sqrt
          sinA = -Math.sqrt(0.5 * (1.0 - cos2A));
        }
        // We know sin2A = 2 sinA cosA so cosA = sin2A/(2*sinA)
        cosA = sin2A / (2.0 * sinA); // always positive
      }
      return { c: cosA, s: sinA, radians: Math.atan2(sinA, cosA) };
    }
  }
  /** If value is close to -1, -0.5, 0, 0.5, 1, adjust it to the exact value. */
  public static cleanupTrigValue(value: number, tolerance: number = Geometry.smallFloatingPoint): number {
    const absValue = Math.abs(value);
    if (absValue <= tolerance)
      return 0;
    let a = Math.abs(absValue - 0.5);
    if (a <= tolerance)
      return value < 0.0 ? -0.5 : 0.5;
    a = Math.abs(absValue - 1.0);
    if (a <= tolerance)
      return value < 0.0 ? -1.0 : 1.0;
    return value;
  }
  /**
   * Return the half angle cosine, sine, and radians for given dot products between vectors. The vectors define
   * an ellipse using x(t) = c + U cos(t) + V sin(t) so U and V are at angle t=0 degree and t=90 degree. The
   * half angle t0 is an angle such that x(t0) is one of the ellipse semi-axis.
   * * This construction arises e.g. in `Arc3d.toScaledMatrix3d`.
   * * Given ellipse x(t) = c + U cos(t) + V sin(t), find t0 such that radial vector W(t0) = x(t0) - c is
   * perpendicular to the ellipse.
   * * Then 0 = W(t0).x'(t0) = (U cos(t0) + V sin(t0)).(V cos(t0) - U sin(t0)) = U.V cos(2t0) + 0.5 (V.V - U.U) sin(2t0)
   * implies sin(2t0) / cos(2t0) = 2 U.V / (U.U - V.V), i.e., t0 can be computed given the three dot products on the RHS.
   * math details can be found at docs/learning/geometry/Angle.md
   * @param dotUU dot product of vectorU with itself
   * @param dotVV dot product of vectorV with itself
   * @param dotUV dot product of vectorU with vectorV
   */
  public static dotProductsToHalfAngleTrigValues(
    dotUU: number, dotVV: number, dotUV: number, favorZero: boolean = true,
  ): TrigValues {

    const cos2t0 = dotUU - dotVV;
    const sin2t0 = 2.0 * dotUV;
    if (favorZero && Math.abs(sin2t0) < Geometry.smallAngleRadians * (Math.abs(dotUU) + Math.abs(dotVV)))
      return { c: 1.0, s: 0.0, radians: 0.0 };
    return Angle.trigValuesToHalfAngleTrigValues(cos2t0, sin2t0);
  }
  /**
   * Returns the angle between two vectors, with the vectors given as xyz components
   * * The returned angle is between 0 and PI
   * @param ux x component of vector u
   * @param uy y component of vector u
   * @param uz z component of vector u
   * @param vx x component of vector v
   * @param vy y component of vector v
   * @param vz z component of vector v
   */
  public static radiansBetweenVectorsXYZ(
    ux: number, uy: number, uz: number, vx: number, vy: number, vz: number,
  ): number {
    const uDotV = ux * vx + uy * vy + uz * vz;
    return Math.atan2(Geometry.crossProductMagnitude(ux, uy, uz, vx, vy, vz), uDotV);
  }
  /**
   * Returns the angle between two vectors, with the vectors given as xyz components, and an up vector to resolve
   * angle to a full 2PI range.
   * * The returned angle is (-PI < radians <= PI) or (0 <= radians < 2 * PI)
   * * The angle is in the plane of the U and V vectors.
   * * The upVector determines a positive side of the plane but need not be strictly perpendicular to the plane.
   * @param ux x component of vector u
   * @param uy y component of vector u
   * @param uz z component of vector u
   * @param vx x component of vector v
   * @param vy y component of vector v
   * @param vz z component of vector v
   * @param upVectorX x component of vector to positive side of plane.
   * @param upVectorY y component of vector to positive side of plane.
   * @param upVectorZ z component of vector to positive side of plane.
   * @param adjustToAllPositive if true, return strictly non-negative sweep (0 <= radians < 2*PI). If false, return
   * signed (-PI < radians <= PI)
   */
  public static orientedRadiansBetweenVectorsXYZ(
    ux: number, uy: number, uz: number,
    vx: number, vy: number, vz: number,
    upVectorX: number, upVectorY: number, upVectorZ: number,
    adjustToPositive: boolean = false,
  ): number {
    const uDotV = ux * vx + uy * vy + uz * vz;
    const wx = uy * vz - uz * vy;
    const wy = uz * vx - ux * vz;
    const wz = ux * vy - uy * vx;
    const upDotW = upVectorX * wx + upVectorY * wy + upVectorZ * wz;
    const crossMagnitude = Geometry.hypotenuseXYZ(wx, wy, wz);
    if (upDotW < 0.0) {
      if (adjustToPositive) {
        // The turn is greater than 180 degrees.  Take a peculiarly oriented atan2 to get the excess-180 part as
        // addition to PI. This gives the smoothest numerical transition passing PI.
        return Math.PI + Math.atan2(crossMagnitude, -uDotV);
      } else {
        return -Math.atan2(crossMagnitude, uDotV);
      }
    } else {
      return Math.atan2(crossMagnitude, uDotV);
    }
  }
  /**
   * Add a multiple of a full circle angle (360 degrees, 2PI) in place.
   * @param multiple multiplier factor
   */
  public addMultipleOf2PiInPlace(multiple: number) {
    if (this._degrees !== undefined) {
      this._degrees += multiple * 360.0;
      this._radians = Angle.degreesToRadians(this._degrees);
    } else {
      this._radians += multiple * Angle.pi2Radians;
    }
  }
}
