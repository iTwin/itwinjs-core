/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

/** @module CartesianGeometry */

// import { Point2d } from "./Geometry2d";
/* tslint:disable:variable-name jsdoc-format no-empty*/
import { Point2d, Vector2d, XY } from "./geometry3d/Point2dVector2d";
import { XAndY } from "./geometry3d/XYZProps";
import { Point3d, Vector3d, XYZ } from "./geometry3d/Point3dVector3d";
import { Point4d } from "./geometry4d/Point4d";
import { AngleSweep } from "./geometry3d/AngleSweep";

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

/* Standard views.   Used in `Matrix3d.createStandardViewAxes (index: StandardViewIndex, worldToView :boolean)`
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
/**
 * Interface so various plane representations can be used by algorithms that just want altitude evaluations.
 *
 * Specific implementors are
 * * Plane3dByOriginAndUnitNormal
 * * Point4d (used for homogeneous plane coefficients)
 */
export interface PlaneAltitudeEvaluator {
  /**
   * Return the altitude of the point from the plane.
   * @param point point for evaluation
   */
  altitude(point: Point3d): number;
  /**
   * Return the derivative of altitude wrt motion along a vector.
   * @param point point for evaluation
   */
  velocity(vector: Vector3d): number;

  /**
   * Return the derivative of altitude wrt motion along a vector given by components
   * @param point point for evaluation
   */
  velocityXYZ(x: number, y: number, z: number): number;

}
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
    const sumAbs = Math.abs(a) + Math.abs(b);
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
  /** @returns the largest absolute absolute value among x,y */
  public static maxAbsXY(x: number, y: number): number {
    return Geometry.maxXY(Math.abs(x), Math.abs(y));
  }

  /** @returns the largest signed value among a, b, c */
  public static maxXYZ(a: number, b: number, c: number): number {
    let q = a;
    if (b > q) q = b;
    if (c > q) q = c;
    return q;
  }
  /** @returns the largest signed value among a, b*/
  public static maxXY(a: number, b: number): number {
    let q = a;
    if (b > q) q = b;
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

  /**
 * @returns Returns curvature magnitude from a first and second derivative vector.
 * @param ux  first derivative x component
 * @param uy first derivative y component
 * @param uz first derivative z component
 * @param vx second derivative x component
 * @param vy second derivative y component
 * @param vz second derivative z component
 */
  public static curvatureMagnitude(
    ux: number, uy: number, uz: number,
    vx: number, vy: number, vz: number): number {
    let q = uy * vz - uz * vy;
    let sum = q * q;
    q = uz * vx - ux * vz;
    sum += q * q;
    q = ux * vy - uy * vx;
    sum += q * q;
    const a = Math.sqrt(ux * ux + uy * uy + uz * uz);
    const b = Math.sqrt(sum);
    // (sum and a are both nonnegative)
    const aaa = a * a * a;
    // radius of curvature = aaa / b;
    // curvature = b/aaa
    const tol = Geometry.smallAngleRadians;
    if (aaa > tol * b)
      return b / aaa;
    return 0; // hm.. maybe should be infinte?
  }

  /** Returns the determinant of 3x3 matrix with x and y rows taken from 3 points, third row from corresponding numbers.
   *
   */
  public static tripleProductXYW(
    columnA: XAndY, weightA: number,
    columnB: XAndY, weightB: number,
    columnC: XAndY, weightC: number) {
    return Geometry.tripleProduct(
      columnA.x, columnB.x, columnC.x,
      columnA.y, columnB.y, columnC.y,
      weightA, weightB, weightC);
  }

  /** Returns the determinant of 3x3 matrix with x and y rows taken from 3 points, third row from corresponding numbers.
   *
   */
  public static tripleProductPoint4dXYW(
    columnA: Point4d,
    columnB: Point4d,
    columnC: Point4d) {
    return Geometry.tripleProduct(
      columnA.x, columnB.x, columnC.x,
      columnA.y, columnB.y, columnC.y,
      columnA.w, columnB.w, columnC.w);
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

  /**  magnitude of 3D cross product of vectors, with the vectors presented as */
  public static crossProductMagnitude(ux: number, uy: number, uz: number, vx: number, vy: number, vz: number): number {
    return Geometry.hypotenuseXYZ(
      uy * vz - uz * vy,
      uz * vx - ux * vz,
      ux * vy - uy * vx);
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

  public static clamp(value: number, min: number, max: number): number { return Math.max(min, Math.min(max, value)); }

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
  public static inverseInterpolate(x0: number, f0: number, x1: number, f1: number,
    targetF: number = 0,
    defaultResult?: number): number | undefined {
    const g = Geometry.conditionalDivideFraction(targetF - f0, f1 - f0);
    if (g)
      return Geometry.interpolate(x0, g, x1);
    return defaultResult;
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
  /** Test if x is in simple 0..1 interval.  But optionally skip the test.  (this odd behavior is very convenient for code that sometimes does not do the filtering.)
   * @param x value to test.
   * @param apply01 if false, accept all x.
   */
  public static isIn01WithTolerance(x: number, tolerance: number): boolean { return x + tolerance >= 0.0 && x - tolerance <= 1.0; }

}
