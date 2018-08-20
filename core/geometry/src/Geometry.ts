/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/

/** @module CartesianGeometry */

// import { Point2d } from "./Geometry2d";
/* tslint:disable:variable-name jsdoc-format no-empty*/
import { Point3d, Vector3d, Point2d, Vector2d, XY, XYZ } from "./PointVector";
import { GrowableFloat64Array } from "./GrowableArray";

/** Enumeration of the 6 possible orderings of XYZ axis order */
export const enum AxisOrder {
  /** Right handed system, X then Y then Z */
  XYZ = 0,
  /** Right handed system, Y then Z then X */
  YZX = 1,
  /** Right handed system, Z then X then Y */
  ZXY = 2,
  /** Left handed system, X then Z then Y */
  XZY = 4,
  /** Left handed system, Y then X then Z */
  YXZ = 5,
  /** Left handed system, Z then Y then X */
  ZYX = 6,
}
/* Enumeration of the 3 axes AxisIndex.X, AxisIndex.Y, AxisIndex.Z */
export const enum AxisIndex {
  X = 0,
  Y = 1,
  Z = 2,
}

/* Standard views.   Used in `RotMatrix.createStandardViewAxes (index: StandardViewIndex, worldToView :boolean)`
*/
export const enum StandardViewIndex {
  Top = 1,
  Bottom = 2,
  Left = 3,
  Right = 4,
  Front = 5,
  Back = 6,
  Iso = 7,
  RightIso = 8,
}

/** Enumeration among choice for how a coordinate transformation should incorporate scaling. */
export const enum AxisScaleSelect {
  /** All axes of unit length. */
  Unit = 0,
  /** On each axis, the vector length matches the longest side of the range of the data. */
  LongestRangeDirection = 1,
  /** On each axis, the vector length matches he length of the corresponding edge of the range. */
  NonUniformRangeContainment = 2,
}
export interface TrigValues { c: number; s: number; radians: number; }

export interface BeJSONFunctions {
  /**
   * Set content from a JSON object.
   * If the json object is undefined or unrecognized, always set a default value.
   */
  setFromJSON(json: any): void;
  toJSON(): any;
}

/** The Properties for a JSON representation of an Angle.
 * If value is a number, it is in *degrees*.
 * If value is an object, it can have either degrees or radians.
 */
export type AngleProps = { degrees: number } | { radians: number } | { _radians: number } | { _degrees: number } | number;

/** The Properties for a JSON representation of an AngleSweep.
 * * The json data is always start and end angles as a pair in an array.
 * If AngleProps data is an array of two numbers, it is an angle in degrees.
 * If the AngleProps is an object with key degrees, the degrees value must be an array with the two degrees angles as numbers
 * If the AngleProps is an object with key radians, the radians value must be an array with the two radians angles as numbers
 */
export type AngleSweepProps =
  AngleSweep |
  { degrees: [number, number] } |
  { radians: [number, number] } |
  [number, number];

export class Geometry {
  public static readonly smallMetricDistance = 1.0e-6;
  public static readonly smallMetricDistanceSquared = 1.0e-12;
  public static readonly smallAngleRadians = 1.0e-12;
  public static readonly smallAngleRadiansSquared = 1.0e-24;
  public static readonly largeFractionResult = 1.0e10;
  public static readonly fullCircleRadiansMinusSmallAngle = 2.0 * Math.PI - 1.0e-12;    // smallAngleRadians less than 360degrees
  /** Points and vectors can be emitted in two forms:
    *
    * *  preferJSONArray === true :       [x,y,z]
    * *  preferJSONArray === false :      {x: 1, y: 2, z: 3}
    */
  // possible names for this class: Geometry, Distance, Units
  public static correctSmallMetricDistance(distance: number, replacement: number = 0.0): number {
    if (Math.abs(distance) < Geometry.smallMetricDistance) {
      return replacement;
    }
    return distance;
  }
  /**
 * @returns If `a` is large enough, return `1/a`, using Geometry.smallMetricDistance as the tolerance for declaring it as divide by zero.  Otherwise return `undefined`.
 * @param a denominator of division
 */
  public static inverseMetricDistance(a: number): number | undefined { return (Math.abs(a) <= Geometry.smallMetricDistance) ? undefined : 1.0 / a; }
  /**
   * @returns If `a` is large enough, return `1/a`, using the square of Geometry.smallMetricDistance as the tolerance for declaring it as divide by zero.  Otherwise return `undefined`.
   * @param a denominator of division
   */
  public static inverseMetricDistanceSquared(a: number): number | undefined {
    return (Math.abs(a) <= Geometry.smallMetricDistanceSquared) ? undefined : 1.0 / a;
  }
  public static isSameCoordinate(x: number, y: number, tol?: number): boolean {
    if (tol)
      return Math.abs(x - y) < Math.abs(tol);
    return Math.abs(x - y) < Geometry.smallMetricDistance;
  }
  public static isSameCoordinateSquared(x: number, y: number): boolean {
    return Math.abs(Math.sqrt(x) - Math.sqrt(y)) < Geometry.smallMetricDistance;
  }
  public static isSamePoint3d(dataA: Point3d, dataB: Point3d): boolean { return dataA.distance(dataB) < Geometry.smallMetricDistance; }
  public static isSameXYZ(dataA: XYZ, dataB: XYZ): boolean { return dataA.distance(dataB) < Geometry.smallMetricDistance; }
  public static isSamePoint3dXY(dataA: Point3d, dataB: Point3d): boolean { return dataA.distanceXY(dataB) < Geometry.smallMetricDistance; }
  public static isSameVector3d(dataA: Vector3d, dataB: Vector3d): boolean { return dataA.distance(dataB) < Geometry.smallMetricDistance; }
  public static isSamePoint2d(dataA: Point2d, dataB: Point2d): boolean { return dataA.distance(dataB) < Geometry.smallMetricDistance; }
  public static isSameVector2d(dataA: Vector2d, dataB: Vector2d): boolean { return dataA.distance(dataB) < Geometry.smallMetricDistance; }

  /**
   * Lexical comparison of (a.x,a.y) (b.x,b.y) with x as first test, y second.
   */
  public static lexicalXYLessThan(a: XY | XYZ, b: XY | XYZ) {
    if (a.x < b.x)
      return -1;
    else if (a.x > b.x)
      return 1;
    if (a.y < b.y)
      return -1;
    else if (a.y > b.y)
      return 1;
    return 0;
  }
  /**
   * Lexical comparison of (a.x,a.y) (b.x,b.y) with y as first test, x second.
   */
  public static lexicalYXLessThan(a: XY | XYZ, b: XY | XYZ) {
    if (a.y < b.y)
      return -1;
    else if (a.y > b.y)
      return 1;
    if (a.x < b.x)
      return -1;
    else if (a.x > b.x)
      return 1;
    return 0;
  }

  public static lexicalXYZLessThan(a: XYZ, b: XYZ) {
    if (a.x < b.x)
      return -1;
    else if (a.x > b.x)
      return 1;
    if (a.y < b.y)
      return -1;
    else if (a.y > b.y)
      return 1;
    if (a.z < b.z)
      return -1;
    else if (a.z > b.z)
      return 1;
    return 0;
  }

  public static isSmallRelative(value: number): boolean { return Math.abs(value) < Geometry.smallAngleRadians; }
  public static isSmallAngleRadians(value: number): boolean { return Math.abs(value) < Geometry.smallAngleRadians; }
  public static isAlmostEqualNumber(a: number, b: number) {
    const sumAbs = Math.abs (a) + Math.abs (b);
    return Math.abs(a - b) < Geometry.smallAngleRadians * sumAbs;
  }
  public static isDistanceWithinTol(distance: number, tol: number) {
    return Math.abs(distance) <= Math.abs(tol);
  }
  public static isSmallMetricDistance(distance: number): boolean {
    return Math.abs(distance) <= Geometry.smallMetricDistance;
  }
  public static isSmallMetricDistanceSquared(distanceSquared: number): boolean {
    return Math.abs(distanceSquared) <= Geometry.smallMetricDistanceSquared;
  }
  public static cyclic3dAxis(axis: number): number {
    /* Direct test for the most common cases, avoid modulo */
    if (axis >= 0) {
      if (axis < 3)
        return axis;
      if (axis < 6)
        return axis - 3;
      return axis % 3;
    }
    const j = axis + 3;
    if (j >= 0)
      return j;
    return 2 - ((-axis - 1) % 3);
  }
  /** Return the AxisOrder for which axisIndex is the first named axis.
   * * `axisIndex===0`returns AxisOrder.XYZ
   * * `axisIndex===1`returns AxisOrder.YZX
   * * `axisIndex===2`returns AxisOrder.ZXY
   */
  public static axisIndexToRightHandedAxisOrder(axisIndex: AxisIndex): AxisOrder {
    if (axisIndex === 0) return AxisOrder.XYZ;
    if (axisIndex === 1) return AxisOrder.YZX;
    if (axisIndex === 2) return AxisOrder.ZXY;
    return Geometry.axisIndexToRightHandedAxisOrder(Geometry.cyclic3dAxis(axisIndex));
  }
  /** @returns the largest absolute distance from a to either of b0 or b1 */
  public static maxAbsDiff(a: number, b0: number, b1: number): number { return Math.max(Math.abs(a - b0), Math.abs(a - b1)); }
  /** @returns the largest absolute absolute value among x,y,z */
  public static maxAbsXYZ(x: number, y: number, z: number): number {
    return Geometry.maxXYZ(Math.abs(x), Math.abs(y), Math.abs(z));
  }
  /** @returns the largest signed value among a, b, c */
  public static maxXYZ(a: number, b: number, c: number): number {
    let q = a;
    if (b > q) q = b;
    if (c > q) q = c;
    return q;
  }

  /** @returns Return the hypotenuse sqrt(x\*x + y\*y). This is much faster than Math.hypot(x,y).*/
  public static hypotenuseXY(x: number, y: number) { return Math.sqrt(x * x + y * y); }
  /** @returns Return the squared hypotenuse (x\*x + y\*y). */
  public static hypotenuseSquaredXY(x: number, y: number) { return x * x + y * y; }
  /** @returns Return the square of x */
  public static square(x: number) { return x * x; }

  /** @returns Return the hypotenuse sqrt(x\*x + y\*y). This is much faster than Math.hypot(x,y, z).*/
  public static hypotenuseXYZ(x: number, y: number, z: number) { return Math.sqrt(x * x + y * y + z * z); }
  public static hypotenuseSquaredXYZ(x: number, y: number, z: number) { return x * x + y * y + z * z; }

  public static hypotenuseXYZW(x: number, y: number, z: number, w: number) { return Math.sqrt(x * x + y * y + z * z + w * w); }
  public static hypotenuseSquaredXYZW(x: number, y: number, z: number, w: number) { return x * x + y * y + z * z + w * w; }
  /**
   * Return the distance between xy points given as numbers.
   * @param x0 x coordinate of point 0
   * @param y0 y coordinate of point 0
   * @param x1 x coordinate of point 1
   * @param y1 y coordinate of point 1
   */
  public static distanceXYXY(x0: number, y0: number, x1: number, y1: number): number {
    return Geometry.hypotenuseXY(x1 - x0, y1 - y0);
  }
  /**
   * Return the distance between xyz points given as numbers.
   * @param x0 x coordinate of point 0
   * @param y0 y coordinate of point 0
   * @param z0 z coordinate of point 0
   * @param x1 x coordinate of point 1
   * @param y1 y coordinate of point 1
   * @param z1 z coordinate of point 1
   */
  public static distanceXYZXYZ(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): number {
    return Geometry.hypotenuseXYZ(x1 - x0, y1 - y0, z1 - z0);
  }
  /** @returns Returns the triple product of 3 vectors provided as x,y,z number sequences.
   *
   * * The triple product is the determinant of the 3x3 matrix with the 9 numbers placed in either row or column order.
   * * The triple product is positive if the 3 vectors form a right handed coordinate system.
   * * The triple product is negative if the 3 vectors form a left handed coordinate system.
   * * Treating the 9 numbers as 3 vectors U, V, W, any of these formulas gives the same result:
   *
   * ** U dot (V cross W)
   * ** V dot (W cross U)
   * ** W dot (U cross V)
   * **  (-U dot (W cross V))  -- (note the negative -- reversing cross product order changes the sign)
   * ** (-V dot (U cross W)) -- (note the negative -- reversing cross product order changes the sign)
   * ** (-W dot (V cross U)) -- (note the negative -- reversing cross product order changes the sign)
   * * the triple product is 6 times the (signed) volume of the tetrahedron with the three vectors as edges from a common vertex.
   */
  public static tripleProduct(
    ux: number, uy: number, uz: number,
    vx: number, vy: number, vz: number,
    wx: number, wy: number, wz: number): number {
    return ux * (vy * wz - vz * wy)
      + uy * (vz * wx - vx * wz)
      + uz * (vx * wy - vy * wx);
  }
  /**  2D cross product of vectors layed out as scalars. */
  public static crossProductXYXY(ux: number, uy: number, vx: number, vy: number): number {
    return ux * vy - uy * vx;
  }

  /**  3D cross product of vectors layed out as scalars. */
  public static crossProductXYZXYZ(ux: number, uy: number, uz: number, vx: number, vy: number, vz: number, result?: Vector3d): Vector3d {
    return Vector3d.create(
      uy * vz - uz * vy,
      uz * vx - ux * vz,
      ux * vy - uy * vx, result);
  }

  /**  3D dot product of vectors layed out as scalars. */
  public static dotProductXYZXYZ(ux: number, uy: number, uz: number, vx: number, vy: number, vz: number): number {
    return ux * vx + uy * vy + uz * vz;
  }

  public static clampToStartEnd(x: number, a: number, b: number): number {
    if (a > b)
      return Geometry.clampToStartEnd(x, b, a);
    if (x < a)
      return a;
    if (b < x)
      return b;
    return x;
  }

  /** simple interpolation between values, but choosing (based on fraction) a or b as starting point for maximum accuracy. */
  public static interpolate(a: number, f: number, b: number): number {
    return f <= 0.5 ? a + f * (b - a) : b - (1.0 - f) * (b - a);
  }

  /** given an axisOrder (e.g. XYZ, YZX, ZXY, XZYLeftHanded etc) and an (integer) offset, resolve to an axis index. */
  public static axisOrderToAxis(order: AxisOrder, index: number): number {
    const axis = order <= AxisOrder.ZXY ? order + index : (order - AxisOrder.XZY) - index;
    return Geometry.cyclic3dAxis(axis);
  }
  /** Return (a modulo period), e.g. for use as a cyclid index.  Both a and period may be negative. */
  public static modulo(a: number, period: number): number {
    if (period <= 0) {
      if (period === 0)
        return a;
      return -Geometry.modulo(-a, -period);
    }

    if (a >= 0) {
      if (a < period)
        return a;
      if (a < 2 * period)
        return a - period;
    } else {
      a += period;  // hopefully move into primary period without division and floor
      if (a > 0)
        return a;
    }
    const m = Math.floor(a / period);
    return a - m * period;
  }
  /** return 0 if the value is undefined, 1 if defined. */
  public static defined01(value: any): number { return value === undefined ? 0 : 1; }
  /** normally, return numerator/denominator.
   * but if the ratio would exceed Geometry.largeFractionResult, return undefined.
   */
  public static conditionalDivideFraction(numerator: number, denominator: number): number | undefined {
    if (Math.abs(denominator) * Geometry.largeFractionResult > Math.abs(numerator))
      return numerator / denominator;
    return undefined;
  }

  /** return the 0, 1, or 2 pairs of (c,s) values that solve
   * {constCoff + cosCoff * c + sinCoff * s = }
   * with the constraint {c*c+s*s = 1}
   */
  public static solveTrigForm(constCoff: number, cosCoff: number, sinCoff: number): Vector2d[] | undefined {
    {
      const delta2 = cosCoff * cosCoff + sinCoff * sinCoff;
      const constCoff2 = constCoff * constCoff;
      // let nSolution = 0;
      let result;
      if (delta2 > 0.0) {
        const lambda = - constCoff / delta2;
        const a2 = constCoff2 / delta2;
        const D2 = 1.0 - a2;
        if (D2 >= 0.0) {
          const mu = Math.sqrt(D2 / delta2);
          /* c0,s0 = closest approach of line to origin */
          const c0 = lambda * cosCoff;
          const s0 = lambda * sinCoff;
          // nSolution = 2;
          result = [Vector2d.create(c0 - mu * sinCoff, s0 + mu * cosCoff), Vector2d.create(c0 + mu * sinCoff, s0 - mu * cosCoff)];
        }
      }
      return result;
    }
  }

  /** normally,  return the number result of conditionalDivideFraction.
   * but if conditionalDivideFraction fails return specified default number.
   */
  public static safeDivideFraction(numerator: number, denominator: number, defaultResult: number): number {
    const a = Geometry.conditionalDivideFraction(numerator, denominator);
    if (a !== undefined)
      return a;
    return defaultResult;
  }
  /** For a line f(x) whose function values at x0 and x1 are f0 and f1, return the x value at which f(x)=fTarget;
   */
  public static inverseInterpolate(x0: number, f0: number, x1: number, f1: number, targetF: number = 0): number | undefined {
    const g = Geometry.conditionalDivideFraction(targetF - f0, f1 - f0);
    if (g)
      return Geometry.interpolate(x0, g, x1);
    return undefined;
  }
  /** For a line f(x) whose function values at x=0 and x=1 are f0 and f1, return the x value at which f(x)=fTarget;
   */
  public static inverseInterpolate01(f0: number, f1: number, targetF: number = 0): number | undefined {
    return Geometry.conditionalDivideFraction(targetF - f0, f1 - f0);
  }
  /** Return true if json is an array with at least minEntries, and all entries are numbers (including those beyond minEntries) */
  public static isNumberArray(json: any, minEntries: number = 0): boolean {
    if (Array.isArray(json) && json.length >= minEntries) {
      let entry;
      for (entry of json) {
        //        if (!(entry as number) && entry !== 0.0)
        if (!Number.isFinite(entry))
          return false;
      }
      return true;
    }
    return false;
  }
  /** Return true if json is an array of at least numNumberArrays, with at least minEntries in each number array.
   */
  public static isArrayOfNumberArray(json: any, numNumberArray: number, minEntries: number = 0): boolean {
    if (Array.isArray(json) && json.length >= numNumberArray) {
      let entry;
      for (entry of json)
        if (!Geometry.isNumberArray(entry, minEntries)) return false;
      return true;
    }
    return false;
  }

  /** return the number of steps to take so that numSteps * stepSize >= total.
   * minCount is returned for both (a) setSize 0 or less and (b) stepSize > total.
   * A small tolerance is applied for almost
  */
  public static stepCount(stepSize: number, total: number, minCount = 1, maxCount = 101): number {
    if (stepSize <= 0)
      return minCount;
    if (stepSize >= total)
      return minCount;
    const stepCount = Math.floor((total + 0.999999 * stepSize) / stepSize);
    if (stepCount < minCount)
      return minCount;
    if (stepCount > maxCount)
      return maxCount;
    return stepCount;
  }
  /** Test if x is in simple 0..1 interval.  But optionally skip the test.  (this odd behavior is very convenient for code that sometimes does not do the filtering.)
   * @param x value to test.
   * @param apply01 if false, accept all x.
   */
  public static isIn01(x: number, apply01: boolean = true): boolean { return apply01 ? x >= 0.0 && x <= 1.0 : true; }
}
/**
 * Carries the numeric value of an angle.
 * * The numeric value is private, and callers should not know or care whether it is in degrees or radians.
 * * The various access method are named so that callers can specify whether untyped numbers passed in or out are degrees or radians.
 */
export class Angle implements BeJSONFunctions {
  public static readonly piOver4Radians = 7.85398163397448280000e-001;
  public static readonly piOver2Radians = 1.57079632679489660000e+000;
  public static readonly piRadians = 3.14159265358979310000e+000;
  public static readonly pi2Radians = 6.28318530717958620000e+000;
  public static readonly degreesPerRadian = (45.0 / Angle.piOver4Radians);
  public static readonly radiansPerDegree = (Angle.piOver4Radians / 45.0);
  public static readonly piOver12Radians = 0.26179938779914943653855361527329;
  private _radians: number;
  private _degrees?: number;
  private constructor(radians = 0, degrees?: number) { this._radians = radians; this._degrees = degrees; }
  public clone(): Angle { return new Angle(this._radians, this._degrees); }
  /**
   * Return a new Angle object for angle given in degrees.
   * @param degrees angle in degrees
   */
  public static createDegrees(degrees: number) { return new Angle(Angle.degreesToRadians(degrees), degrees); }
  /**
   * Return a (new) Angle object for a value given in radians.
   * @param radians angle in radians
   */
  public static createRadians(radians: number) { return new Angle(radians); }
  /**
   * Set this angle to a value given in radians.
   * @param radians angle given in radians
   */
  public setRadians(radians: number) { this._radians = radians; this._degrees = undefined; }
  /**
   * Set this angle to a value given in degrees.
   * @param degrees angle given in degrees.
   */
  public setDegrees(degrees: number) { this._radians = Angle.degreesToRadians(degrees); this._degrees = degrees; }
  /** Create an angle for a full circle. */
  public static create360() { return new Angle(Math.PI * 2.0, 360.0); }
  /**
   * @return a (strongly typed) Angle whose tangent is `numerator/denominator`, using the signs of both in determining the (otherwise ambiguous)
   * quadrant.
   * @param numerator numerator for tangent
   * @param denominator denominator for tangent
   */
  public static createAtan2(numerator: number, denominator: number): Angle { return new Angle(Math.atan2(numerator, denominator)); }
  /**
   * Copy all contents of `other` to this Angle.
   * @param other source data
   */
  public setFrom(other: Angle) { this._radians = other._radians; this._degrees = other._degrees; }
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
  /**
   * set an Angle from a JSON object
   * * A simple number is degrees.
   * * specified `json.degrees` or `json._degrees` is degree value.
   * * specified `son.radians` or `json._radians` is radians value.
   * @param json object from JSON.parse. If a number, value is in *DEGREES*
   * @param defaultValRadians if json is undefined, default value in radians.
   */
  public setFromJSON(json?: AngleProps, defaultValRadians?: number) {
    this._radians = defaultValRadians ? defaultValRadians : 0;
    if (!json) return;
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
  /** Convert an Angle to a JSON object as a number in degrees */
  public toJSON(): AngleProps { return this.degrees; }
  public toJSONRadians(): AngleProps { return { radians: this.radians }; }

  /** @returns Return the angle measured in radians. */
  public get radians(): number { return this._radians; }
  /** @returns Return the angle measured in degrees. */
  public get degrees(): number { return this._degrees !== undefined ? this._degrees : Angle.radiansToDegrees(this._radians); }
  /**
   * Convert an angle in degrees to radians.
   * @param degrees angle in degrees
   */
  public static degreesToRadians(degrees: number) { return degrees * Math.PI / 180; }
  /**
   * Convert an angle in radians to degrees.
   * @param degrees angle in radians
   */
  public static radiansToDegrees(radians: number): number {
    if (radians < 0)
      return - Angle.radiansToDegrees(-radians);
    // Now radians is positive ...
    const pi = Math.PI;
    const factor = 180.0 / pi;
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
  /**
   * @returns Return the cosine of this Angle object's angle.
   */
  public cos(): number { return Math.cos(this._radians); }
  /**
   * @returns Return the sine of this Angle object's angle.
   */
  public sin(): number { return Math.sin(this._radians); }
  /**
   * @returns Return the tangent of this Angle object's angle.
   */
  public tan(): number { return Math.tan(this._radians); }

  public static isFullCircleRadians(radians: number) { return Math.abs(radians) >= Geometry.fullCircleRadiansMinusSmallAngle; }
  public isFullCircle(): boolean { return Angle.isFullCircleRadians(this._radians); }

  /** Adjust a radians value so it is positive in 0..360 */
  public static adjustDegrees0To360(degrees: number): number {
    if (degrees >= 0) {
      const period = 360.0;
      if (degrees < period)
        return degrees;
      const numPeriods = Math.floor(degrees / period);
      return degrees - numPeriods * period;
    }
    // negative angle ...
    const radians1 = Angle.adjustDegrees0To360(-degrees);
    return 360.0 - radians1;
  }

  /** Adjust a radians value so it is positive in -180..180 */
  public static adjustDegreesSigned180(degrees: number): number {
    if (Math.abs(degrees) <= 180.0)
      return degrees;
    if (degrees >= 0) {
      const period = 360.0;
      const numPeriods = 1 + Math.floor((degrees - 180.0) / period);
      return degrees - numPeriods * period;
    }
    // negative angle ...
    return - Angle.adjustDegreesSigned180(-degrees);
  }

  /** Adjust a radians value so it is positive in 0..2Pi */
  public static adjustRadians0To2Pi(radians: number): number {
    if (radians >= 0) {
      const period = Math.PI * 2.0;
      if (radians < period)
        return radians;
      const numPeriods = Math.floor(radians / period);
      return radians - numPeriods * period;
    }
    // negative angle ...
    const radians1 = Angle.adjustRadians0To2Pi(-radians);
    return Math.PI * 2.0 - radians1;
  }

  /** Adjust a radians value so it is positive in -PI..PI */
  public static adjustRadiansMinusPiPlusPi(radians: number): number {
    if (Math.abs(radians) <= Math.PI)
      return radians;
    if (radians >= 0) {
      const period = Math.PI * 2.0;
      const numPeriods = 1 + Math.floor((radians - Math.PI) / period);
      return radians - numPeriods * period;
    }
    // negative angle ...
    return -Angle.adjustRadiansMinusPiPlusPi(-radians);
  }

  public static zero() { return new Angle(0); }
  public isExactZero() { return this.radians === 0; }
  public isAlmostZero() { return Math.abs(this.radians) < Geometry.smallAngleRadians; }

  /** Create an angle object with degrees adjusted into 0..360. */
  public static createDegreesAdjustPositive(degrees: number): Angle { return Angle.createDegrees(Angle.adjustDegrees0To360(degrees)); }
  /** Create an angle object with degrees adjusted into -180..180. */
  public static createDegreesAdjustSigned180(degrees: number): Angle { return Angle.createDegrees(Angle.adjustDegreesSigned180(degrees)); }

  /**
   * Test if two radians values are equivalent, allowing shift by full circle (i.e. by a multiple of `2*PI`)
   * @param radiansA first radians value
   * @param radiansB second radians value
   */
  public static isAlmostEqualRadiansAllowPeriodShift(radiansA: number, radiansB: number): boolean {
    // try to get simple conclusions with un-shifted radians ...
    const delta = Math.abs(radiansA - radiansB);
    if (delta <= Geometry.smallAngleRadians)
      return true;
    const period = Math.PI * 2.0;
    if (Math.abs(delta - period) <= Geometry.smallAngleRadians)
      return true;
    const numPeriod = Math.round(delta / period);
    const delta1 = delta - numPeriod * period;
    return Math.abs(delta1) <= Geometry.smallAngleRadians;
  }

  /**
   * Test if this angle and other are equivalent, allowing shift by full circle (i.e. by a multiple of 360 degrees)
   */
  public isAlmostEqualAllowPeriodShift(other: Angle): boolean {
    return Angle.isAlmostEqualRadiansAllowPeriodShift(this._radians, other._radians);
  }
  /**
   * Test if two this angle and other are almost equal, NOT allowing shift by full circle multiples of 360 degrees.
   */
  public isAlmostEqualNoPeriodShift(other: Angle): boolean { return Math.abs(this._radians - other._radians) < Geometry.smallAngleRadians; }
  /**
   * Test if two angle (in radians)  almost equal, NOT allowing shift by full circle multiples of `2 * PI`.
   */
  public static isAlmostEqualRadiansNoPeriodShift(radiansA: number, radiansB: number): boolean { return Math.abs(radiansA - radiansB) < Geometry.smallAngleRadians; }
  /**
   * Test if dot product values indicate non-zero length perpendicular vectors.
   * @param dotUU dot product of vectorU with itself
   * @param dotVV dot product of vectorV with itself
   * @param dotUV dot product of vectorU with vectorV
   */
  public static isPerpendicularDotSet(dotUU: number, dotVV: number, dotUV: number) {
    return dotUU > Geometry.smallMetricDistanceSquared
      && dotVV > Geometry.smallMetricDistanceSquared
      && dotUV * dotUV <= Geometry.smallAngleRadiansSquared * dotUU * dotVV;
  }
  /**
   * Return cosine, sine, and radians for the half angle of a cosine,sine pair.
   * @param rCos2A cosine value (scaled by radius) for initial angle.
   * @param rSin2A sine value (scaled by radius) for final angle.
   */
  public static trigValuesToHalfAngleTrigValues(rCos2A: number, rSin2A: number): TrigValues {
    const r = Geometry.hypotenuseXY(rCos2A, rSin2A);
    if (r < Geometry.smallMetricDistance) {
      return { c: 1.0, s: 0.0, radians: 0.0 };
    } else {

      /* If the caller really gave you sine and cosine values, r should be 1.  However,*/
      /* to allow scaled values -- e.g. the x and y components of any vector -- we normalize*/
      /* right here.  This adds an extra sqrt and 2 divides to the whole process, but improves*/
      /* both the usefulness and robustness of the computation.*/
      let cosA = 1.0;
      let sinA = 0.0;
      const cos2A = rCos2A / r;
      const sin2A = rSin2A / r;
      if (cos2A >= 0.0) {
        /* Original angle in NE and SE quadrants.  Half angle in same quadrant */
        cosA = Math.sqrt(0.5 * (1.0 + cos2A));
        sinA = sin2A / (2.0 * (cosA));
      } else {
        if (sin2A > 0.0) {
          /* Original angle in NW quadrant. Half angle in NE quadrant */
          sinA = Math.sqrt(0.5 * (1.0 - cos2A));
        } else {
          /* Original angle in SW quadrant. Half angle in SE quadrant*/
          /* cosA comes out positive because both sines are negative. */
          sinA = - Math.sqrt(0.5 * (1.0 - cos2A));
        }
        cosA = sin2A / (2.0 * (sinA));
      }
      return { c: cosA, s: sinA, radians: Math.atan2(sinA, cosA) };
    }
  }
  /** If value is close to -1, -0.5, 0, 0.5, 1, adjust it to the exact value. */
  public static cleanupTrigValue(value: number, tolerance: number = 1.0e-15): number {
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
     * Return the half angle of angle between vectors U, V with given vector dots.
     * @param dotUU dot product of vectorU with itself
     * @param dotVV dot product of vectorV with itself
     * @param dotUV dot product of vectorU with vectorV
     */
  public static dotProductsToHalfAngleTrigValues(dotUU: number, dotVV: number, dotUV: number, favorZero: boolean = true): TrigValues {
    const rcos = dotUU - dotVV;
    const rsin = 2.0 * dotUV;
    if (favorZero && Math.abs(rsin) < Geometry.smallAngleRadians * (Math.abs(dotUU) + Math.abs(dotVV)))
      return { c: 1.0, s: 0.0, radians: 0.0 };
    return Angle.trigValuesToHalfAngleTrigValues(rcos, rsin);
  }
}
/**
 * An AngleSweep is a pair of angles at start and end of an interval.
 *
 * *  For stroking purposes, the "included interval" is all angles numerically reached by theta = start + f*(end-start), where f is between 0 and 1.
 * *  This stroking formula is simple numbers -- 2PI shifts are not involved.
 * *  2PI shifts do become important in the reverse mapping of an angle to a fraction.
 * *  If (start < end) the angle proceeds CCW around the unit circle.
 * *  If (end < start) the angle proceeds CW around the unit circle.
 * *  Angles beyond 360 are fine as endpoints.
 *
 * **  (350,370) covers the same unit angles as (-10,10).
 * **  (370,350) covers the same unit angles as (10,-10).
 */
export class AngleSweep implements BeJSONFunctions {
  private _radians0: number;
  private _radians1: number;
  /** Read-property for degrees at the start of this AngleSweep. */
  public get startDegrees() { return Angle.radiansToDegrees(this._radians0); }
  /** Read-property for degrees at the end of this AngleSweep. */
  public get endDegrees() { return Angle.radiansToDegrees(this._radians1); }
  /** Read-property for signed start-to-end sweep in degrees. */
  public get sweepDegrees() { return Angle.radiansToDegrees(this._radians1 - this._radians0); }

  /** Read-property for degrees at the start of this AngleSweep. */
  public get startRadians() { return this._radians0; }
  /** Read-property for degrees at the end of this AngleSweep. */
  public get endRadians() { return this._radians1; }

  /** Read-property for signed start-to-end sweep in radians. */
  public get sweepRadians() { return this._radians1 - this._radians0; }
  /** Return the (strongly typed) start angle */
  public get startAngle() { return Angle.createRadians(this._radians0); }
  /** Return the (strongly typed) end angle */
  public get endAngle() { return Angle.createRadians(this._radians1); }

  /** (private) constructor with start and end angles in radians.
   *  * Use explicitly named static methods to clarify intent and units of inputs:
   *
   * * createStartEndRadians (startRadians:number, endRadians:number)
   * * createStartEndDegrees (startDegrees:number, endDegrees:number)
   * * createStartEnd (startAngle:Angle, endAngle:Angle)
   * * createStartSweepRadians (startRadians:number, sweepRadians:number)
   * * createStartSweepDegrees (startDegrees:number, sweepDegrees:number)
   * * createStartSweep (startAngle:Angle, sweepAngle:Angle)
  */
  private constructor(startRadians: number = 0, endRadians: number = 0) { this._radians0 = startRadians; this._radians1 = endRadians; }
  /** create an AngleSweep from start and end angles given in radians. */
  public static createStartEndRadians(startRadians: number = 0, endRadians: number = 2.0 * Math.PI, result?: AngleSweep): AngleSweep {
    result = result ? result : new AngleSweep();
    result.setStartEndRadians(startRadians, endRadians);
    return result;
  }
  /** Return the angle obtained by subtracting radians from this angle. */
  public cloneMinusRadians(radians: number): AngleSweep { return new AngleSweep(this._radians0 - radians, this._radians1 - radians); }
  /** create an AngleSweep from start and end angles given in degrees. */
  public static createStartEndDegrees(startDegrees: number = 0, endDegrees: number = 360, result?: AngleSweep): AngleSweep {
    return AngleSweep.createStartEndRadians(Angle.degreesToRadians(startDegrees), Angle.degreesToRadians(endDegrees), result);
  }
  /** create an angle sweep from strongly typed start and end angles */
  public static createStartEnd(startAngle: Angle, endAngle: Angle, result?: AngleSweep): AngleSweep {
    result = result ? result : new AngleSweep();
    result.setStartEndRadians(startAngle.radians, endAngle.radians);
    return result;
  }
  /** Create an angle sweep with limits given as (strongly typed) angles for start and sweep */
  public static createStartSweep(startAngle: Angle, sweepAngle: Angle, result?: AngleSweep): AngleSweep {
    return AngleSweep.createStartSweepRadians(startAngle.radians, sweepAngle.radians, result);
  }

  /** @returns Return a sweep with limits interpolated between this and other. */
  public interpolate(fraction: number, other: AngleSweep): AngleSweep {
    return new AngleSweep(Geometry.interpolate(this._radians0, fraction, other._radians0),
      Geometry.interpolate(this._radians1, fraction, other._radians1));
  }
  /** create an AngleSweep from start and end angles given in radians. */
  public static createStartSweepRadians(startRadians: number = 0, sweepRadians: number = Math.PI, result?: AngleSweep): AngleSweep {
    result = result ? result : new AngleSweep();
    result.setStartEndRadians(startRadians, startRadians + sweepRadians);
    return result;
  }
  /** create an AngleSweep from start and sweep given in degrees.  */
  public static createStartSweepDegrees(startDegrees: number = 0, sweepDegrees: number = 360, result?: AngleSweep): AngleSweep {
    return AngleSweep.createStartEndRadians(Angle.degreesToRadians(startDegrees), Angle.degreesToRadians(startDegrees + sweepDegrees), result);
  }

  /** directly set the start and end angles in radians */
  public setStartEndRadians(startRadians: number = 0, endRadians: number = 2.0 * Math.PI) {
    const delta = endRadians - startRadians;
    if (Angle.isFullCircleRadians(delta)) {
      endRadians = startRadians + (delta > 0 ? 2.0 : -2.0) * Math.PI;
    }
    this._radians0 = startRadians; this._radians1 = endRadians;
  }
  /** directly set the start and end angles in degrees */
  public setStartEndDegrees(startDegrees: number = 0, endDegrees: number = 360.0) {
    this.setStartEndRadians(Angle.degreesToRadians(startDegrees), Angle.degreesToRadians(endDegrees));
  }
  /** copy from other AngleSweep. */
  public setFrom(other: AngleSweep) { this._radians0 = other._radians0; this._radians1 = other._radians1; }

  /** create a full circle sweep (CCW). startRadians defaults to 0 */
  public static create360(startRadians?: number): AngleSweep {
    startRadians = startRadians ? startRadians : 0.0;
    return new AngleSweep(startRadians, startRadians + 2.0 * Math.PI);
  }
  /** create a sweep from the south pole to the north pole. */
  public static createFullLatitude() { return AngleSweep.createStartEndRadians(-0.5 * Math.PI, 0.5 * Math.PI); }
  /** Reverse the start and end angle in place. */
  public reverseInPlace() { const a = this._radians0; this._radians0 = this._radians1; this._radians1 = a; }
  /** Restrict start and end angles into the range (-90,+90) in degrees. */
  public capLatitudeInPlace() {
    const limit = 0.5 * Math.PI;
    this._radians0 = Geometry.clampToStartEnd(this._radians0, -limit, limit);
    this._radians1 = Geometry.clampToStartEnd(this._radians1, -limit, limit);
  }
  /** Ask if the sweep is counterclockwise, i.e. positive sweep */
  public isCCW(): boolean { return this._radians1 >= this._radians0; }
  /** Ask if the sweep is a full circle. */
  public isFullCircle(): boolean { return Angle.isFullCircleRadians(this.sweepRadians); }
  /** Ask if the sweep is a full sweep from south pole to north pole. */
  public isFullLatitudeSweep(): boolean {
    const a = Math.PI * 0.5;
    return Angle.isAlmostEqualRadiansNoPeriodShift(this._radians0, -a)
      && Angle.isAlmostEqualRadiansNoPeriodShift(this._radians1, a);
  }

  /** return a clone of this sweep. */
  public clone(): AngleSweep { return new AngleSweep(this._radians0, this._radians1); }
  /** Convert fractional position in the sweep to radians. */
  public fractionToRadians(fraction: number) {
    return fraction < 0.5 ?
      this._radians0 + fraction * (this._radians1 - this._radians0)
      : this._radians1 + (fraction - 1.0) * (this._radians1 - this._radians0);
  }
  /** Convert fractional position in the sweep to strongly typed Angle object. */
  public fractionToAngle(fraction: number) {
    return Angle.createRadians(this.fractionToRadians(fraction));
  }

  /** return 2PI divided by the sweep radians (i.e. 360 degrees divided by sweep angle).
   * This is the number of fractional intervals required to cover a whole circle.
   */
  public fractionPeriod(): number {
    return Geometry.safeDivideFraction(
      Math.PI * 2.0,
      Math.abs(this._radians1 - this._radians0),
      1.0);
  }
  /** return the fractional ized position of the angle,
   * computed without consideration of 2PI period.
   * That is, an angle that is numerically much beyond than the end angle
   * will produce a large fraction and an angle much beyond the start angle
   * will produce a large negative fraction.
   *
   */
  public angleToUnboundedFraction(theta: Angle): number {
    return Geometry.safeDivideFraction(
      theta.radians - this._radians0,
      this._radians1 - this._radians0,
      1.0);
  }
  /** map an angle to a fractional coordinate which is:
  *
  * *  the start angle is at fraction 0
  * *  the end angle is at fraction 1
  * *  interior angles are between 0 and 1
  * *  all exterior angles are at fractions greater than 1
  * *  the periodic jump is at full wraparound to the start angle
   */
  public angleToPositivePeriodicFraction(theta: Angle): number { return this.radiansToPositivePeriodicFraction(theta.radians); }
  /**
   * Convert each value in an array from radians to fraction.
   * @param data array that is input as radians, output as fractions
   */
  public radiansArraytoPositivePeriodicFractions(data: GrowableFloat64Array) {
    const n = data.length;
    for (let i = 0; i < n; i++) {
      data.reassign(i, this.radiansToPositivePeriodicFraction(data.at(i)));
    }
  }
  public radiansToPositivePeriodicFraction(radians: number): number {
    if (Angle.isAlmostEqualRadiansAllowPeriodShift(radians, this._radians0))
      return 0.0;
    if (Angle.isAlmostEqualRadiansAllowPeriodShift(radians, this._radians1))
      return 1.0;

    const sweep = this._radians1 - this._radians0;
    const delta = radians - this._radians0;
    if (sweep > 0) {
      const delta1 = Angle.adjustRadians0To2Pi(delta);
      const fraction1 = Geometry.safeDivideFraction(delta1, sweep, 0.0);
      return fraction1;
    }

    const delta2 = Angle.adjustRadians0To2Pi(-delta);
    const fraction2 = Geometry.safeDivideFraction(delta2, -sweep, 0.0);
    return fraction2;
  }
  /** map an angle to a fractional coordinate which is:
  *
  * *  the start angle is at fraction 0
  * *  the end angle is at fraction 1
  * *  interior angles are between 0 and 1
  * *  small negative for angles just "before" the start angle
  * *  more than one for angles just "after" the end angle
  * *  the periodic jump is at the middle of the "outside" interval
  */
  public angleToSignedPeriodicFraction(theta: Angle): number {
    return this.radiansToSignedPeriodicFraction(theta.radians);
  }

  public radiansToSignedPeriodicFraction(radians: number): number {
    if (Angle.isAlmostEqualRadiansAllowPeriodShift(radians, this._radians0))
      return 0.0;
    if (Angle.isAlmostEqualRadiansAllowPeriodShift(radians, this._radians1))
      return 1.0;
    const sweep = this._radians1 - this._radians0;
    // measure from middle of interval ...
    const delta = radians - this._radians0 - 0.5 * sweep;
    if (sweep > 0) {
      const delta1 = Angle.adjustRadiansMinusPiPlusPi(delta);
      const fraction1 = 0.5 + Geometry.safeDivideFraction(delta1, sweep, 0.0);
      return fraction1;
    }

    const delta2 = Angle.adjustRadiansMinusPiPlusPi(-delta);
    const fraction = 0.5 + Geometry.safeDivideFraction(delta2, -sweep, 0.0);
    return fraction;
  }

  /** test if an angle is within the sweep */
  public isAngleInSweep(angle: Angle): boolean { return this.isRadiansInSweep(angle.radians); }
  /** test if radians are within sweep  */
  public isRadiansInSweep(radians: number): boolean {
    // quick out for simple inside ...
    const delta0 = radians - this._radians0;
    const delta1 = radians - this._radians1;
    if (delta0 * delta1 <= 0.0)
      return true;
    return this.radiansToPositivePeriodicFraction(radians) <= 1.0;

  }
  /** set this AngleSweep from various sources:
   *
   * * if json is undefined, a full-circle sweep is returned.
   * * If json is an AngleSweep object it is is cloned
   * * If json is an array of 2 numbers, those numbers are start and end angles in degrees.
   * * If `json.degrees` is an array of 2 numbers, those numbers are start and end angles in degrees.
   * * If `json.radians` is an array of 2 numbers, those numbers are start and end angles in radians.
   */
  public setFromJSON(json?: any) {
    if (!json)
      this.setStartEndRadians(); // default full circle
    else if (json instanceof AngleSweep)
      this.setFrom(json as AngleSweep);
    else if (Geometry.isNumberArray(json.degrees, 2))
      this.setStartEndDegrees(json.degrees[0], json.degrees[1]);
    else if (Geometry.isNumberArray(json.radians, 2))
      this.setStartEndRadians(json.radians[0], json.radians[1]);
    else if (Geometry.isNumberArray(json, 2))
      this.setStartEndDegrees(json[0], json[1]);
  }
  /** create an AngleSweep from a json object. */
  public static fromJSON(json?: AngleSweepProps) {
    const result = AngleSweep.create360();
    result.setFromJSON(json);
    return result;
  }
  /**
   * Convert an AngleSweep to a JSON object.
   * @return {*} {degrees: [startAngleInDegrees, endAngleInDegrees}
   */
  public toJSON(): any {
    // return { degrees: [this.startDegrees, this.endDegrees] };
    return [this.startDegrees, this.endDegrees];
  }
  /** test if start and end angles match, with no test for 360-degree shifts. */
  public isAlmostEqualAllowPeriodShift(other: AngleSweep): boolean {
    return Angle.isAlmostEqualRadiansAllowPeriodShift(this._radians0, other._radians0)
      && Angle.isAlmostEqualRadiansNoPeriodShift(this._radians1 - this._radians0, other._radians1 - other._radians0);
  }
  /** test if start and end angles match, allowing for 360-degree shifts. */
  public isAlmostEqualNoPeriodShift(other: AngleSweep): boolean {
    return Angle.isAlmostEqualRadiansNoPeriodShift(this._radians0, other._radians0)
      && Angle.isAlmostEqualRadiansNoPeriodShift(this._radians1 - this._radians0, other._radians1 - other._radians0);
  }
}
