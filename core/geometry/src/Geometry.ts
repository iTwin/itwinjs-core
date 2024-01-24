/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module CartesianGeometry
 */

import { AngleSweep } from "./geometry3d/AngleSweep";
import { Point2d, Vector2d, XY } from "./geometry3d/Point2dVector2d";
import { Point3d, Vector3d, XYZ } from "./geometry3d/Point3dVector3d";
import { XAndY } from "./geometry3d/XYZProps";
import { Point4d } from "./geometry4d/Point4d";

/* eslint-disable @typescript-eslint/naming-convention, no-empty */

/**
 * Enumeration of the 6 possible orderings of XYZ axis order
 * * **Note:** There are 3 axis order with right hand system (XYZ = 0, YZX = 1, ZXY = 2) and 3 axis order with
 * left hand system (XZY = 4, YXZ = 5, ZYX = 6). Note that `AxisOrder` is encoding the handedness as well. Cross
 * product of the i_th axis in an ordering (i=0,1,2), with the i+1_th in that ordering, will produce the i+2_th
 * axis in that ordering.
 * @public
 */
export enum AxisOrder {
  /** Right handed system, X then Y then Z */
  XYZ = 0, /* eslint-disable-line @typescript-eslint/no-shadow */
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
/**
 * Enumeration of numeric indices of 3 axes AxisIndex.X, AxisIndex.Y, AxisIndex.Z
 * @public
 */
export enum AxisIndex {
  /** x axis is index 0 */
  X = 0,
  /** y axis is index 1 */
  Y = 1,
  /** 2 axis is index 2 */
  Z = 2,
}
/**
 * Standard views. Used in `Matrix3d.createStandardViewAxes(index: StandardViewIndex, invert: boolean)`
 * @public
 */
export enum StandardViewIndex {
  /** X to right, Y up */
  Top = 1,
  /** X to right, negative Y up */
  Bottom = 2,
  /** Negative Y to right, Z up */
  Left = 3,
  /** Y to right, Z up */
  Right = 4,
  /** X to right, Z up */
  Front = 5,
  /** Negative X to right, Z up */
  Back = 6,
  /** Isometric: view towards origin from (-1,-1,1) */
  Iso = 7, //
  /** Right isometric: view towards origin from (1,-1,1) */
  RightIso = 8,
}
/**
 * Enumeration among choice for how a coordinate transformation should incorporate scaling.
 * @public
 */
export enum AxisScaleSelect {
  /** All axes of unit length. */
  Unit = 0,
  /** On each axis, the vector length matches the longest side of the range of the data. */
  LongestRangeDirection = 1,
  /** On each axis, the vector length matches he length of the corresponding edge of the range. */
  NonUniformRangeContainment = 2,
}
/**
 * Object with a radians value and its associated cosine and sine values.
 * @public
 */
export interface TrigValues {
  /** The cosine value */
  c: number;
  /** The sine value */
  s: number;
  /** The radians value */
  radians: number;
}

/**
 * Plane Evaluation methods.
 * * These provide the necessary queries to implement clipping operations without knowing if the plane in use
 * is a [[ClipPlane]], [[Plane3dByOriginAndUnitNormal]], [[Plane3dByOriginAndVectors]], [[Point4d]].
 * * The Plane3d class declares obligation to implement these methods, and
 * passes the obligation on to concrete implementations by declaring them as abstract members which the particular classes can implement.
 * * It is intended that this interface be deprecated because its implementation by [[Plane3d]] provides all of its functionality and allows more to be added.
 * @public
 */
export interface PlaneAltitudeEvaluator {
  /**
   * Return the altitude of the `point` from the plane.
   * @param point the point for evaluation
   */
  altitude(point: Point3d): number;
  /**
   * Return the altitude of the `point` from the plane, with the point supplied as simple x,y,z
   * @param x x coordinate of the point
   * @param y y coordinate of the point
   * @param z z coordinate of the point
   */
  altitudeXYZ(x: number, y: number, z: number): number;
  /**
   * Return the derivative of altitude with respect to motion along a `vector`.
   * @param vector the vector
   */
  velocity(vector: Vector3d): number;
  /**
   * Return the derivative of altitude with respect to motion along a `vector` given by components.
   * @param x x coordinate of the vector
   * @param y y coordinate of the vector
   * @param z z coordinate of the vector
   */
  velocityXYZ(x: number, y: number, z: number): number;
  /**
   * Return the weighted altitude
   * @param point xyzw data.
   */
  weightedAltitude(point: Point4d): number;
  /** x part of normal vector */
  normalX(): number;
  /** x part of normal vector */
  normalY(): number;
  /** x part of normal vector */
  normalZ(): number;
}
/**
 * Enumeration of possible locations of a point in the plane of a polygon.
 * @public
 */
export enum PolygonLocation {
  /** No location specified. */
  Unknown = 0,
  /** Point is at a vertex. */
  OnPolygonVertex = 1,
  /** Point is on an edge (but not a vertex). */
  OnPolygonEdgeInterior = 2,
  /** Point is strictly inside the polygon with unknown projection. */
  InsidePolygon = 3,
  /** Point is strictly inside the polygon and projects to a vertex. */
  InsidePolygonProjectsToVertex = 4,
  /** Point is strictly inside the polygon and projects to an edge (but not a vertex). */
  InsidePolygonProjectsToEdgeInterior = 5,
  /** Point is strictly outside the polygon with unknown projection. */
  OutsidePolygon = 6,
  /** Point is strictly outside the polygon and projects to a vertex. */
  OutsidePolygonProjectsToVertex = 7,
  /** Point is strictly outside the polygon and projects to an edge (but not a vertex). */
  OutsidePolygonProjectsToEdgeInterior = 8,
}
/**
 * Interface for `toJSON` and `setFromJSON` methods
 * @public
 */
export interface BeJSONFunctions {
  /**
   * Set content from a JSON object.
   * If the json object is undefined or unrecognized, always set a default value.
   */
  setFromJSON(json: any): void;
  /** Return a json object with this object's contents. */
  toJSON(): any;
}
/**
 * The properties for a JSON representation of an `Angle`.
 * * If AngleProps data is a number, it is in **degrees**.
 * * If AngleProps data is an object, it can have either degrees or radians.
 * @public
 */
export type AngleProps =
  { degrees: number } |
  { radians: number } |
  { _radians: number } |
  { _degrees: number } |
  number;
/**
 * The properties for a JSON representation of an `AngleSweep`.
 * * The json data is always *start* and *end* angles as a pair in an array.
 * * If AngleSweepProps data is an array of two numbers, those are both angles in `degrees`.
 * * If AngleSweepProps data is an object with key `degrees`, then the corresponding value must be an array of
 * two numbers, the start and end angles in degrees.
 * * If the AngleSweepProps is an object with key `radians`, then the corresponding value must be an array of
 * two numbers, the start and end angles in radians.
 * @public
 */
export type AngleSweepProps =
  AngleSweep |
  { degrees: [number, number] } |
  { radians: [number, number] } |
  [number, number];
/**
* Interface for method with a clone operation.
* @public
* @deprecated in 4.x. Use ICloneable.
*/
export interface Cloneable<T> {
  /** Required method to return a deep clone. */
  clone(): T | undefined;
}
/**
 * Interface for an object with a clone method.
 * @public
 */
export interface ICloneable<T> {
  /**
   * Return a deep clone of the instance.
   * @param result optional object to populate and return
   */
  clone(result?: T): T;
}
/** Options used for methods like [[Vector2d.isPerpendicularTo]] and [[Vector3d.isParallelTo]].
 * @public
 */
export interface PerpParallelOptions {
  /**
   * Squared radian tolerance for comparing the angle between two vectors.
   * Default: [[Geometry.smallAngleRadiansSquared]].
   */
  radianSquaredTol?: number;
  /**
   * Squared distance tolerance for detecting a zero-length vector.
   * Default: [[Geometry.smallMetricDistanceSquared]].
   */
  distanceSquaredTol?: number;
}

/**
 * Class containing static methods for typical numeric operations.
 * * Experimentally, methods like Geometry.hypotenuse are observed to be faster than the system intrinsics.
 * * This is probably due to
 *    * Fixed length arg lists
 *    * strongly typed parameters
 * @public
 */
export class Geometry {
  /** Tolerance for small distances in metric coordinates. */
  public static readonly smallMetricDistance = 1.0e-6;
  /** Square of `smallMetricDistance`. */
  public static readonly smallMetricDistanceSquared = 1.0e-12;
  /** Tolerance for small angle measured in radians. */
  public static readonly smallAngleRadians = 1.0e-12;
  /** Square of `smallAngleRadians`. */
  public static readonly smallAngleRadiansSquared = 1.0e-24;
  /** Tolerance for small angle measured in degrees. */
  public static readonly smallAngleDegrees = 5.7e-11;
  /** Tolerance for small angle measured in arc-seconds. */
  public static readonly smallAngleSeconds = 2e-7;
  /** Numeric value that may be considered zero for fractions between 0 and 1. */
  public static readonly smallFraction = 1.0e-10;
  /** Tight tolerance near machine precision (unitless). Useful for snapping values, e.g., to 0 or 1. */
  public static readonly smallFloatingPoint = 1.0e-15;
  /** Radians value for full circle 2PI radians minus `smallAngleRadians`. */
  public static readonly fullCircleRadiansMinusSmallAngle = 2.0 * Math.PI - Geometry.smallAngleRadians;
  /**
   * Numeric value that may be considered large for a ratio of numbers.
   * * Note that the allowed result value is vastly larger than 1.
   */
  public static readonly largeFractionResult = 1.0e10;
  /**
   * Numeric value that may considered large for numbers expected to be coordinates.
   * * This allows larger results than `largeFractionResult`.
   */
  public static readonly largeCoordinateResult = 1.0e13;
  /**
   * Numeric value that may considered infinite for metric coordinates.
   * @deprecated in 4.x. Use `largeCoordinateResult`.
   * * This coordinate should be used only as a placeholder indicating "at infinity" -- computing actual
   * points at this coordinate invites numerical problems.
   */
  public static readonly hugeCoordinate = 1.0e12;
  /** Test if absolute value of x is large (larger than `Geometry.largeCoordinateResult`) */
  public static isLargeCoordinateResult(x: number): boolean {
    return x > this.largeCoordinateResult || x < - this.largeCoordinateResult;
  }
  /**
   * Test if absolute value of x is large (larger than `Geometry.largeCoordinateResult`).
   * @deprecated in 4.x. Use `isLargeCoordinateResult`.
   */
  public static isHugeCoordinate(x: number): boolean {
    return Geometry.isLargeCoordinateResult(x);
  }
  /** Test if a number is odd */
  public static isOdd(x: number): boolean {
    return (x & (0x01)) === 1; // bitwise operation
  }
  /**
   * Correct distance to zero.
   * * If `distance` magnitude is `undefined` or smaller than `smallMetricDistance`, then return `replacement`
   * (or 0 if replacement is not passed). Otherwise return `distance`.
   */
  public static correctSmallMetricDistance(distance: number | undefined, replacement: number = 0.0): number {
    if (distance === undefined || Math.abs(distance) < Geometry.smallMetricDistance) {
      return replacement;
    }
    return distance;
  }
  /**
   * Correct `fraction` to `replacement` if `fraction` is undefined or too small.
   * @param fraction number to test
   * @param replacement value to return if `fraction` is too small
   * @returns `fraction` if its absolute value is at least `Geometry.smallFraction`; otherwise returns `replacement`
   */
  public static correctSmallFraction(fraction: number | undefined, replacement: number = 0.0): number {
    if (fraction === undefined || Math.abs(fraction) < Geometry.smallFraction) {
      return replacement;
    }
    return fraction;
  }
  /**
   * Return the inverse of `distance`.
   * * If `distance` magnitude is smaller than `smallMetricDistance` (i.e. distance is large enough for safe division),
   * then return `1/distance`. Otherwise return `undefined`.
   */
  public static inverseMetricDistance(distance: number): number | undefined {
    return (Math.abs(distance) <= Geometry.smallMetricDistance) ? undefined : 1.0 / distance;
  }
  /**
   * Return the inverse of `distanceSquared`.
   * * If `distanceSquared ` magnitude is smaller than `smallMetricDistanceSquared` (i.e. distanceSquared  is large
   * enough for safe division), then return `1/distanceSquared `. Otherwise return `undefined`.
   */
  public static inverseMetricDistanceSquared(distanceSquared: number): number | undefined {
    return (Math.abs(distanceSquared) <= Geometry.smallMetricDistanceSquared) ? undefined : 1.0 / distanceSquared;
  }
  /**
   * Boolean test for metric coordinate near-equality (i.e., if `x` and `y` are almost equal) using `tolerance`.
   * * `Geometry.smallMetricDistance` is used if tolerance is `undefined`.
   */
  public static isSameCoordinate(x: number, y: number, tolerance: number = Geometry.smallMetricDistance): boolean {
    let d = x - y;
    if (d < 0)
      d = -d;
    return d <= tolerance;
  }
  /**
   * Boolean test for metric coordinate near-equality (i.e., if `x` and `y` are almost equal) using
   * `tolerance = toleranceFactor * smallMetricDistance`
   * */
  public static isSameCoordinateWithToleranceFactor(x: number, y: number, toleranceFactor: number): boolean {
    return Geometry.isSameCoordinate(x, y, toleranceFactor * Geometry.smallMetricDistance);
  }
  /**
   * Boolean test for metric coordinate pair near-equality (i.e., if `x0` and `x1` are almost equal
   * and `y0` and `y1` are almost equal) using `tolerance`.
   * * `Geometry.smallMetricDistance` is used if tolerance is `undefined`.
   */
  public static isSameCoordinateXY(
    x0: number, y0: number, x1: number, y1: number, tolerance: number = Geometry.smallMetricDistance,
  ): boolean {
    let d = x1 - x0;
    if (d < 0)
      d = -d;
    if (d > tolerance)
      return false;
    d = y1 - y0;
    if (d < 0)
      d = -d;
    return d <= tolerance;
  }
  /**
   * Boolean test for squared metric coordinate near-equality (i.e., if `sqrt(x)` and `sqrt(y)` are
   * almost equal) using `tolerance`.
   * * `Geometry.smallMetricDistance` is used if tolerance is `undefined`.
   */
  public static isSameCoordinateSquared(
    x: number, y: number, tolerance: number = Geometry.smallMetricDistance,
  ): boolean {
    return Math.abs(Math.sqrt(x) - Math.sqrt(y)) <= tolerance;
  }
  /**
   * Boolean test for small `dataA.distance(dataB)` within `tolerance`.
   * * `Geometry.smallMetricDistance` is used if tolerance is `undefined`.
   */
  public static isSamePoint3d(
    dataA: Point3d, dataB: Point3d, tolerance: number = Geometry.smallMetricDistance,
  ): boolean {
    return dataA.distance(dataB) <= tolerance;
  }
  /**
   * Boolean test for small xyz-distance within `tolerance`.
   * * `Geometry.smallMetricDistance` is used if tolerance is `undefined`.
   * * Note that Point3d and Vector3d are both derived from XYZ, so this method tolerates mixed types.
   */
  public static isSameXYZ(
    dataA: XYZ, dataB: XYZ, tolerance: number = Geometry.smallMetricDistance,
  ): boolean {
    return dataA.distance(dataB) <= tolerance;
  }
  /**
   * Boolean test for small xy-distance (ignoring z) within `tolerance`.
   * * `Geometry.smallMetricDistance` is used if tolerance is `undefined`.
   */
  public static isSamePoint3dXY(
    dataA: Point3d, dataB: Point3d, tolerance: number = Geometry.smallMetricDistance,
  ): boolean {
    return dataA.distanceXY(dataB) <= tolerance;
  }
  /**
   * Boolean test for small xyz-distance within `tolerance`.
   * * `Geometry.smallMetricDistance` is used if tolerance is `undefined`.
   */
  public static isSameVector3d(
    dataA: Vector3d, dataB: Vector3d, tolerance: number = Geometry.smallMetricDistance,
  ): boolean {
    return dataA.distance(dataB) <= tolerance;
  }
  /**
   * Boolean test for small xy-distance within `tolerance`.
   * * `Geometry.smallMetricDistance` is used if tolerance is `undefined`.
   */
  public static isSamePoint2d(
    dataA: Point2d, dataB: Point2d, tolerance: number = Geometry.smallMetricDistance,
  ): boolean {
    return dataA.distance(dataB) <= tolerance;
  }
  /**
   * Boolean test for small xy-distance within `tolerance`.
   * * `Geometry.smallMetricDistance` is used if tolerance is `undefined`.
   */
  public static isSameVector2d(
    dataA: Vector2d, dataB: Vector2d, tolerance: number = Geometry.smallMetricDistance,
  ): boolean {
    return dataA.distance(dataB) <= tolerance;
  }
  /**
   * Lexical comparison of (a.x, a.y) and (b.x, b.y) with x as first test and y as second (z is ignored).
   * * This is appropriate for a horizontal sweep in the plane.
   */
  public static lexicalXYLessThan(a: XY | XYZ, b: XY | XYZ): -1 | 0 | 1 {
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
   * Lexical comparison of (a.x, a.y) and (b.x, b.y) with y as first test and x as second (z is ignored).
   * * This is appropriate for a vertical sweep in the plane.
   */
  public static lexicalYXLessThan(a: XY | XYZ, b: XY | XYZ): -1 | 0 | 1 {
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
  /** Lexical comparison of (a.x, a.y, a.z) and (b.x, b.y, b.z) with x as first test, y as second, and z as third. */
  public static lexicalXYZLessThan(a: XYZ, b: XYZ): -1 | 0 | 1 {
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
  /**
   * Test if `value` is small compared to `smallFraction`.
   * * This is appropriate if `value` is know to be a typical 0..1 fraction.
   */
  public static isSmallRelative(value: number): boolean {
    return Math.abs(value) < Geometry.smallFraction;
  }
  /** Test if `value` is small compared to `smallAngleRadians` */
  public static isSmallAngleRadians(value: number): boolean {
    return Math.abs(value) < Geometry.smallAngleRadians;
  }
  /**
   * Returns `true` if both values are `undefined` or if both are defined and almost equal within tolerance.
   * If one is `undefined` and the other is not, then `false` is returned.
   */
  public static isAlmostEqualOptional(a: number | undefined, b: number | undefined, tolerance: number): boolean {
    if (a !== undefined && b !== undefined) {
      if (Math.abs(a - b) > tolerance)
        return false;
    } else {
      if (a !== undefined || b !== undefined)
        return false;
    }
    return true;
  }
  /**
   * Toleranced equality test using tolerance `tolerance * ( 1 + abs(a) + abs(b) )`.
   * * `Geometry.smallAngleRadians` is used if tolerance is `undefined`.
   */
  public static isAlmostEqualNumber(a: number, b: number, tolerance: number = Geometry.smallAngleRadians): boolean {
    const sumAbs = 1.0 + Math.abs(a) + Math.abs(b);
    return Math.abs(a - b) <= tolerance * sumAbs;
  }
  /**
   * Toleranced equality test using tolerance `tolerance * ( 1 + abs(a.x) + abs(a.y) + abs(b.x) + abs(b.y) )`.
   * * `Geometry.smallAngleRadians` is used if tolerance is `undefined`.
   */
  public static isAlmostEqualXAndY(a: XAndY, b: XAndY, tolerance: number = Geometry.smallAngleRadians): boolean {
    const tol = tolerance * (1.0 + Math.abs(a.x) + Math.abs(b.x) + Math.abs(a.y) + Math.abs(b.y));
    return (Math.abs(a.x - b.x) <= tol) && (Math.abs(a.y - b.y) <= tol);
  }
  /**
   * Toleranced equality test using caller-supplied `tolerance`.
   * * `Geometry.smallMetricDistance` is used if tolerance is `undefined`.
   */
  public static isDistanceWithinTol(distance: number, tolerance: number = Geometry.smallMetricDistance): boolean {
    return Math.abs(distance) <= tolerance;
  }
  /** Toleranced equality test using `smallMetricDistance` tolerance. */
  public static isSmallMetricDistance(distance: number): boolean {
    return Math.abs(distance) <= Geometry.smallMetricDistance;
  }
  /** Toleranced equality test using `smallMetricDistanceSquared` tolerance. */
  public static isSmallMetricDistanceSquared(distanceSquared: number): boolean {
    return Math.abs(distanceSquared) <= Geometry.smallMetricDistanceSquared;
  }
  /**
   * Return `axis modulo 3` with proper handling of negative indices
   * ..., -3:x, -2:y, -1:z, 0:x, 1:y, 2:z, 3:x, 4:y, 5:z, 6:x, 7:y, 8:z, ...
   */
  public static cyclic3dAxis(axis: number): number {
    /* Direct test for the most common cases to avoid more expensive modulo operation */
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
  /**
   * Return the `AxisOrder` for which `axisIndex` is the first named axis.
   * * `axisIndex === 0` returns `AxisOrder.XYZ`
   * * `axisIndex === 1` returns `AxisOrder.YZX`
   * * `axisIndex === 2` returns `AxisOrder.ZXY`
   */
  public static axisIndexToRightHandedAxisOrder(axisIndex: AxisIndex): AxisOrder {
    if (axisIndex === 0)
      return AxisOrder.XYZ;
    if (axisIndex === 1)
      return AxisOrder.YZX;
    if (axisIndex === 2)
      return AxisOrder.ZXY;
    return Geometry.axisIndexToRightHandedAxisOrder(Geometry.cyclic3dAxis(axisIndex));
  }
  /** Return the largest signed value among `a`, `b`, and `c` */
  public static maxXYZ(a: number, b: number, c: number): number {
    let max = a;
    if (b > max)
      max = b;
    if (c > max)
      max = c;
    return max;
  }
  /** Return the smallest signed value among `a`, `b`, and `c` */
  public static minXYZ(a: number, b: number, c: number): number {
    let min = a;
    if (b < min)
      min = b;
    if (c < min)
      min = c;
    return min;
  }
  /** Return the largest signed value among `a` and `b` */
  public static maxXY(a: number, b: number): number {
    let max = a;
    if (b > max)
      max = b;
    return max;
  }
  /** Return the smallest signed value among `a` and `b` */
  public static minXY(a: number, b: number): number {
    let min = a;
    if (b < min)
      min = b;
    return min;
  }
  /** Return the largest absolute value among `x`, `y`, and `z` */
  public static maxAbsXYZ(x: number, y: number, z: number): number {
    return Geometry.maxXYZ(Math.abs(x), Math.abs(y), Math.abs(z));
  }
  /** Return the largest absolute value among `x` and `y` */
  public static maxAbsXY(x: number, y: number): number {
    return Geometry.maxXY(Math.abs(x), Math.abs(y));
  }
  /** Return the largest absolute distance from `a` to either of `b0` or `b1` */
  public static maxAbsDiff(a: number, b0: number, b1: number): number {
    return Math.max(Math.abs(a - b0), Math.abs(a - b1));
  }
  /**
   * Examine the sign of `x`.
   * * If `x` is negative, return `outNegative`
   * * If `x` is true zero, return `outZero`
   * * If `x` is positive, return `outPositive`
   */
  public static split3WaySign(x: number, outNegative: number, outZero: number, outPositive: number): number {
    if (x < 0)
      return outNegative;
    if (x > 0.0)
      return outPositive;
    return outZero;
  }
  /**
   * Examine the value (particularly sign) of x.
   * * If x is negative, return -1
   * * If x is true zero, return 0
   * * If x is positive, return 1
   */
  public static split3Way01(x: number, tolerance: number = Geometry.smallMetricDistance): -1 | 0 | 1 {
    if (x > tolerance)
      return 1;
    if (x < -tolerance)
      return -1;
    return 0;
  }
  /** Return the square of x */
  public static square(x: number): number {
    return x * x;
  }
  /**
   * Return the hypotenuse (i.e., `sqrt(x*x + y*y)`).
   * * This is much faster than `Math.hypot(x,y)`.
   */
  public static hypotenuseXY(x: number, y: number): number {
    return Math.sqrt(x * x + y * y);
  }
  /** Return the squared hypotenuse (i.e., `x*x + y*y`). */
  public static hypotenuseSquaredXY(x: number, y: number): number {
    return x * x + y * y;
  }
  /**
   * Return the hypotenuse (i.e., `sqrt(x*x + y*y + z*z)`).
   * * This is much faster than `Math.hypot(x,y,z)`.
   */
  public static hypotenuseXYZ(x: number, y: number, z: number): number {
    return Math.sqrt(x * x + y * y + z * z);
  }
  /** Return the squared hypotenuse (i.e., `x*x + y*y + z*z`). */
  public static hypotenuseSquaredXYZ(x: number, y: number, z: number): number {
    return x * x + y * y + z * z;
  }
  /**
   * Return the full 4d hypotenuse (i.e., `sqrt(x*x + y*y + z*z + w*w)`).
   * * This is much faster than `Math.hypot(x,y,z,w)`.
   */
  public static hypotenuseXYZW(x: number, y: number, z: number, w: number): number {
    return Math.sqrt(x * x + y * y + z * z + w * w);
  }
  /** Return the squared hypotenuse (i.e., `x*x + y*y + z*z + w*w`). */
  public static hypotenuseSquaredXYZW(x: number, y: number, z: number, w: number): number {
    return x * x + y * y + z * z + w * w;
  }
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
  /**
   * Returns the triple product of 3 vectors provided as x,y,z number sequences.
   * * The triple product is the determinant of the 3x3 matrix with the 9 numbers (3 vectors placed in 3 rows).
   * * The triple product is positive if the 3 vectors form a right handed coordinate system.
   * * The triple product is negative if the 3 vectors form a left handed coordinate system.
   * * Treating the 9 numbers as 3 vectors U, V, W, any of these formulas gives the same result:
   *     * U dot (V cross W)
   *     * V dot (W cross U)
   *     * W dot (U cross V)
   *     * -U dot (W cross V)
   *     * -V dot (U cross W)
   *     * -W dot (V cross U)
   * * Note the negative in the last 3 formulas. Reversing cross product order changes the sign.
   * * The triple product is 6 times the (signed) volume of the tetrahedron with the three vectors as edges from a
   * common vertex.
   */
  public static tripleProduct(
    ux: number, uy: number, uz: number,
    vx: number, vy: number, vz: number,
    wx: number, wy: number, wz: number,
  ): number {
    return ux * (vy * wz - vz * wy)
      + uy * (vz * wx - vx * wz)
      + uz * (vx * wy - vy * wx);
  }
  /** Returns the determinant of the 4x4 matrix unrolled as the 16 parameters */
  public static determinant4x4(
    xx: number, xy: number, xz: number, xw: number,
    yx: number, yy: number, yz: number, yw: number,
    zx: number, zy: number, zz: number, zw: number,
    wx: number, wy: number, wz: number, ww: number,
  ): number {
    return xx * this.tripleProduct(yy, yz, yw, zy, zz, zw, wy, wz, ww)
      - yx * this.tripleProduct(xy, xz, xw, zy, zz, zw, wy, wz, ww)
      + zx * this.tripleProduct(xy, xz, xw, yy, yz, yw, wy, wz, ww)
      - wx * this.tripleProduct(xy, xz, xw, yy, yz, yw, zy, zz, zw);
  }
  /**
   * Returns the determinant of 3x3 matrix with first and second rows created from the 3 xy points and the third
   * row created from the 3 numbers:
   *      [columnA.x   columnB.x   columnC.x]
   *      [columnA.y   columnB.y   columnC.y]
   *      [ weightA     weightB     weightC ]
   */
  public static tripleProductXYW(
    columnA: XAndY, weightA: number,
    columnB: XAndY, weightB: number,
    columnC: XAndY, weightC: number,
  ): number {
    return Geometry.tripleProduct(
      columnA.x, columnB.x, columnC.x,
      columnA.y, columnB.y, columnC.y,
      weightA, weightB, weightC,
    );
  }
  /**
   * Returns the determinant of 3x3 matrix columns created by the given `Point4d` ignoring the z part:
   *      [columnA.x   columnB.x   columnC.x]
   *      [columnA.y   columnB.y   columnC.y]
   *      [columnA.w   columnB.w   columnC.w]
   */
  public static tripleProductPoint4dXYW(columnA: Point4d, columnB: Point4d, columnC: Point4d): number {
    return Geometry.tripleProduct(
      columnA.x, columnB.x, columnC.x,
      columnA.y, columnB.y, columnC.y,
      columnA.w, columnB.w, columnC.w,
    );
  }
  /**
   * 2D cross product of vectors with the vectors presented as numbers.
   * * Sign of 2d cross product is positive <=> sweeping from first vector to second vector is ccw orientation.
   * * Sign of 2d cross product is negative <=> sweeping from first vector to second vector is clockwise orientation.
   * * 2d cross product is 0 <=> parallel/antiparallel vectors.
   */
  public static crossProductXYXY(ux: number, uy: number, vx: number, vy: number): number {
    return ux * vy - uy * vx;
  }
  /** 3D cross product of vectors with the vectors presented as numbers. */
  public static crossProductXYZXYZ(
    ux: number, uy: number, uz: number, vx: number, vy: number, vz: number, result?: Vector3d,
  ): Vector3d {
    return Vector3d.create(
      uy * vz - uz * vy,
      uz * vx - ux * vz,
      ux * vy - uy * vx,
      result,
    );
  }
  /** Magnitude of 3D cross product of vectors with the vectors presented as numbers. */
  public static crossProductMagnitude(
    ux: number, uy: number, uz: number, vx: number, vy: number, vz: number,
  ): number {
    return Geometry.hypotenuseXYZ(
      uy * vz - uz * vy,
      uz * vx - ux * vz,
      ux * vy - uy * vx,
    );
  }
  /**
   * 2D dot product of vectors with the vectors presented as numbers.
   * * Sign of dot product is positive <=> vectorA points into the same half-space as vectorB.
   * * Sign of dot product is negative <=> vectorA points into opposite half-space as vectorB.
   * * Dot product is 0 <=> perpendicular vectors.
   * * **Note:** half-space is defined in terms of a vector, by the perpendicular plane at its origin (it splits
   * the universe into two halves).
   */
  public static dotProductXYXY(ux: number, uy: number, vx: number, vy: number): number {
    return ux * vx + uy * vy;
  }
  /** 3D dot product of vectors with the vectors presented as numbers. */
  public static dotProductXYZXYZ(ux: number, uy: number, uz: number, vx: number, vy: number, vz: number): number {
    return ux * vx + uy * vy + uz * vz;
  }
  /**
   * Return the mean curvature for two radii.
   * * Curvature is the reciprocal of radius.
   * * 0 radius implies 0 curvature.
   * @param r0 first radius
   * @param r1 second radius
   */
  public static meanCurvatureOfRadii(r0: number, r1: number): number {
    return 0.5 * (this.safeDivideFraction(1, r0, 0) + this.safeDivideFraction(1, r1, 0));
  }
  /**
   * Returns curvature from the first and second derivative vectors.
   * * If U is the first derivative and V is the second derivative, the curvature is defined as:
   *     * `|| U x V || / || U ||^3`.
   * * Math details can be found at https://en.wikipedia.org/wiki/Curvature#General_expressions
   * @param ux first derivative x component
   * @param uy first derivative y component
   * @param uz first derivative z component
   * @param vx second derivative x component
   * @param vy second derivative y component
   * @param vz second derivative z component
   */
  public static curvatureMagnitude(
    ux: number, uy: number, uz: number,
    vx: number, vy: number, vz: number,
  ): number {
    let q = uy * vz - uz * vy;
    let sum = q * q;
    q = uz * vx - ux * vz;
    sum += q * q;
    q = ux * vy - uy * vx;
    sum += q * q;
    const magUxV = Math.sqrt(sum);
    const magU = Math.sqrt(ux * ux + uy * uy + uz * uz);
    const magUCubed = magU * magU * magU;
    if (magUCubed > Geometry.smallAngleRadians * magUxV)
      return magUxV / magUCubed;
    return 0;
  }
  /**
   * Clamp to (min(a,b), max(a,b)).
   * * Always returns a number between `a` and `b`.
   * @param value value to clamp
   * @param a smallest allowed output if `a < b` or largest allowed output if `a > b`
   * @param b largest allowed output if `a < b` or smallest allowed output if `a > b`
   */
  public static clampToStartEnd(value: number, a: number, b: number): number {
    if (a > b)
      return Geometry.clampToStartEnd(value, b, a);
    if (value < a)
      return a;
    if (b < value)
      return b;
    return value;
  }
  /**
   * Clamp value to (min, max) with no test for order of (min, max).
   * * Always returns a number between `min` and `max`.
   * @param value value to clamp
   * @param min smallest allowed output
   * @param max largest allowed output
   */
  public static clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }
  /** If given a `value`, return it. If given `undefined`, return `defaultValue`. */
  public static resolveNumber(value: number | undefined, defaultValue: number = 0): number {
    return value !== undefined ? value : defaultValue;
  }
  /** If given a `value`, return it. If given `undefined`, return `defaultValue`. */
  public static resolveValue<T>(value: T | undefined, defaultValue: T): T {
    return value !== undefined ? value : defaultValue;
  }
  /** If given `value` matches the `targetValue`, return `undefined`. Otherwise return the `value`. */
  public static resolveToUndefined<T>(value: T | undefined, targetValue: T): T | undefined {
    return value === targetValue ? undefined : value;
  }
  /**
   * Simple interpolation between values `a` and `b` with fraction `f`.
   * * If `f = 0`, then `a` is returned and if `f = 1`, then `b` is returned.
   * * For maximum accuracy, we choose `a` or `b` as starting point based on fraction `f`.
   */
  public static interpolate(a: number, f: number, b: number): number {
    return f <= 0.5 ? a + f * (b - a) : b - (1.0 - f) * (b - a);
  }
  /**
   * Given an `axisOrder` (e.g. XYZ, YZX, etc) and an `index`, return the `axis` at the given index.
   * * For example, if `axisOrder = XYZ`, then for index 0 return `X` (or axis 0), for index 1 return
   * `Y` (or axis 1), and for index 2 return `Z` (or axis 2).
   * * Another example: if `axisOrder = ZXY`, then for index 0 return `Z` (or axis 2), for index 1 return
   * `X` (or axis 0), and for index 2 return `Y` (or axis 1).
   * * For indexes greater than 2 or smaller than 0, it return cyclic axis. See [[Geometry.cyclic3dAxis]]
   * for more info.
   */
  public static axisOrderToAxis(order: AxisOrder, index: number): number {
    const axis = order <= AxisOrder.ZXY ? order + index : (order - AxisOrder.XZY) - index;
    return Geometry.cyclic3dAxis(axis);
  }
  /**
   * Return `a` modulo `period`.
   * * Both `a` and `period` can be negative.
   * * This function can be faster than the `%` operator for the common case when `p > 0` and `-p < a < 2p`.
   */
  public static modulo(a: number, period: number): number {
    // period is negative
    if (period <= 0) {
      if (period === 0)
        return a;
      return -Geometry.modulo(-a, -period);
    }
    // period is positive
    if (a >= 0) {
      if (a < period) // "0 < a < period"
        return a;
      if (a < 2 * period) // "0 < period < a < 2*period"
        return a - period;
    } else { // "-period < a < 0"
      a += period;
      if (a > 0)
        return a;
    }
    // "0 < 2*period < a" or "a < -period < 0"
    const m = Math.floor(a / period);
    return a - m * period;
  }
  /** Return 0 if the value is `undefined` and 1 if the value is defined. */
  public static defined01(value: any): number {
    return value === undefined ? 0 : 1;
  }
  /**
   * Return `numerator` divided by `denominator`.
   * @param numerator the numerator
   * @param denominator the denominator
   * @returns return `numerator/denominator` but if the ratio exceeds `Geometry.largeFractionResult`,
   * return `undefined`.
   */
  public static conditionalDivideFraction(numerator: number, denominator: number): number | undefined {
    if (Math.abs(denominator) * Geometry.largeFractionResult > Math.abs(numerator))
      return numerator / denominator;
    return undefined;
  }
  /**
   * Return `numerator` divided by `denominator`.
   * @param numerator the numerator
   * @param denominator the denominator
   * @returns return `numerator/denominator` but if the ratio exceeds `Geometry.largeFractionResult`,
   * return `defaultResult`.
   */
  public static safeDivideFraction(numerator: number, denominator: number, defaultResult: number): number {
    const ratio = Geometry.conditionalDivideFraction(numerator, denominator);
    if (ratio !== undefined)
      return ratio;
    return defaultResult;
  }
  /**
   * Return `numerator` divided by `denominator` (with a given `largestResult`).
   * @param numerator the numerator
   * @param denominator the denominator
   * @param largestResult the ratio threshold
   * @returns return `numerator/denominator` but if the ratio exceeds `largestResult`, return `undefined`.
   */
  public static conditionalDivideCoordinate(
    numerator: number, denominator: number, largestResult: number = Geometry.largeCoordinateResult,
  ): number | undefined {
    if (Math.abs(denominator * largestResult) > Math.abs(numerator))
      return numerator / denominator;
    return undefined;
  }
  /**
   * Return solution(s) of equation `constCoff + cosCoff*c + sinCoff*s = 0` for `c` and `s` with the
   * constraint `c*c + s*s = 1`.
   * * There could be 0, 1, or 2 solutions. Return `undefined` if there is no solution.
   */
  public static solveTrigForm(constCoff: number, cosCoff: number, sinCoff: number): Vector2d[] | undefined {
    /**
     * Solutions can be found by finding the intersection of line "ax + by + d = 0" and unit circle "x^2 + y^2 = 1".
     * From the line equation we have "y = (-ax - d) / b". By replacing this into the circle equation we get
     * "x^2 + (ax+d)^2/b^2 = 1". If we solve this by quadratic formula we get
     *      x = (-ad +- b*sqrt(a^2+b^2-d^2)) / (a^2+b^2)
     *      y = (-ad -+ a*sqrt(a^2+b^2-d^2)) / (a^2+b^2)
     *
     * If "a^2+b^2-d^2 > 0" then there are two solutions (above).
     * If "a^2+b^2-d^2 = 0" then there is one solution which is (-ad/(a^2+b^2), -bd/(a^2+b^2)).
     * If "a^2+b^2-d^2 < 0" then there is no solution.
     *
     * Below in the code we have "a = cosCoff", "b = sinCoff", and "d = constCoff". Also equivalent criterion
     * is used in the code. For example, "a^2+b^2-d^2 > 0" is equivalent of "1 - d^2/(a^2+b^2) > 0".
     */
    const a2b2 = cosCoff * cosCoff + sinCoff * sinCoff; // a^2+b^2
    const d2 = constCoff * constCoff; // d^2
    let result;
    if (a2b2 > 0.0) {
      const a2b2r = 1.0 / a2b2; // 1/(a^2+b^2)
      const d2a2b2 = d2 * a2b2r; // d^2/(a^2+b^2)
      const criterion = 1.0 - d2a2b2; // 1 - d^2/(a^2+b^2);
      if (criterion < -Geometry.smallMetricDistanceSquared) // nSolution = 0
        return result;
      const da2b2 = -constCoff * a2b2r; // -d/(a^2+b^2)
      // (c0,s0) is the closest approach of the line to the circle center (origin)
      const c0 = da2b2 * cosCoff; // -ad/(a^2+b^2)
      const s0 = da2b2 * sinCoff; // -bd/(a^2+b^2)
      if (criterion <= Geometry.smallMetricDistanceSquared) { // nSolution = 1
        // We observed criterion = -2.22e-16 in a rotated tangent system, and criterion = 4.44e-16 in a
        // transverse line-arc intersectXYZ near-tangency, therefore for criteria near zero (on either side),
        // return the (near) tangency; any larger criteria fall through to return both solutions.
        result = [Vector2d.create(c0, s0)];
      } else { // nSolution = 2
        const s = Math.sqrt(criterion * a2b2r); // sqrt(a^2+b^2-d^2)) / (a^2+b^2)
        result = [
          Vector2d.create(c0 - s * sinCoff, s0 + s * cosCoff),
          Vector2d.create(c0 + s * sinCoff, s0 - s * cosCoff),
        ];
      }
    }
    return result;
  }
  /**
   * For a line `f(x)` where `f(x0) = f0` and `f(x1) = f1`, return the `x` value at which `f(x) = fTarget`.
   * Return `defaultResult` if `(fTarget - f0) / (f1 - f0)` exceeds `Geometry.largeFractionResult`.
   */
  public static inverseInterpolate(
    x0: number, f0: number, x1: number, f1: number, fTarget: number = 0, defaultResult?: number,
  ): number | undefined {
    /**
     * Line equation is "fTarget-f0 = (f1-f0)/(x1-x0) * (x-x0)" or "(fTarget-f0)/(f1-f0) = (x-x0)/(x1-x0)".
     * The left hand side is known so if we call it "fr" (short for "fraction") we get "fr = (x-x0)/(x1-x0)".
     * Therefore, "x = x0*(1-fr) + x1*fr". This is same as interpolation between "x0" and "x1" with fraction "fr".
     */
    const fr = Geometry.conditionalDivideFraction(fTarget - f0, f1 - f0); // (fTarget-f0)/(f1-f0)
    if (fr !== undefined)
      return Geometry.interpolate(x0, fr, x1); // x = x0*(1-fr) + x1*fr
    return defaultResult;
  }
  /**
   * For a line `f(x)` where `f(0) = f0` and `f(1) = f1`, return the `x` value at which `f(x) = fTarget`
   * Return `undefined` if `(fTarget - f0) / (f1 - f0)` exceeds `Geometry.largeFractionResult`
   */
  public static inverseInterpolate01(f0: number, f1: number, fTarget: number = 0): number | undefined {
    // Line equation is fTarget-f0 = (f1-f0)*x so x = (fTarget-f0)/(f1-f0)
    return Geometry.conditionalDivideFraction(fTarget - f0, f1 - f0);
  }
  /**
   * Return `true` if `json` is an array with at least `minEntries` entries and all entries are numbers (including
   * those beyond minEntries).
   */
  public static isNumberArray(json: any, minEntries: number = 0): json is number[] {
    if (Array.isArray(json) && json.length >= minEntries) {
      let entry;
      for (entry of json) {
        if (!Number.isFinite(entry))
          return false;
      }
      return true;
    }
    return false;
  }
  /**
   * Return `true` if `json` is an array of at least `minArrays` arrays with at least `minEntries` entries in
   * each array and all entries are numbers (including those beyond minEntries).
   */
  public static isArrayOfNumberArray(json: any, minArrays: number, minEntries: number = 0): json is number[][] {
    if (Array.isArray(json) && json.length >= minArrays) {
      let entry;
      for (entry of json)
        if (!Geometry.isNumberArray(entry, minEntries))
          return false;
      return true;
    }
    return false;
  }
  /**
   * Return the number of steps to take so that `numSteps * stepSize >= total`.
   * * `minCount` is returned in the following 3 cases:
   *   * (a) `stepSize <= 0`
   *   * (b) `stepSize >= total`
   *   * (b) `numSteps < minCount`
   * * `maxCount` is returned if `numSteps > maxCount`.
   */
  public static stepCount(stepSize: number, total: number, minCount = 1, maxCount = 101): number {
    if (stepSize <= 0)
      return minCount;
    total = Math.abs(total);
    if (stepSize >= total)
      return minCount;
    /**
     * 0.999999 is multiplied so we return the same "numSteps" if
     * stepSize*(numSteps-1) < total <= stepSize*numSteps.
     * For example, if "stepSize = 2" then we return "numSteps = 5" if 8 < total <= 10.
     */
    const numSteps = Math.floor((total + 0.999999 * stepSize) / stepSize);
    if (numSteps < minCount)
      return minCount;
    if (numSteps > maxCount)
      return maxCount;
    return numSteps;
  }
  /**
   * Test if `x` is in the interval [0,1] (but skip the test if `apply01 = false`).
   * * This odd behavior is very convenient for code that sometimes does not do the filtering.
   * @param x value to test.
   * @param apply01 if false, return `true` for all values of `x`.
   */
  public static isIn01(x: number, apply01: boolean = true): boolean {
    return apply01 ? x >= 0.0 && x <= 1.0 : true;
  }
  /**
   * Test if `x` is in the interval [0,1] for a given positive `tolerance`.
   * * Make sure to pass a positive `tolerance` because there is no check for that in the code.
   * @param x value to test.
   * @param tolerance the tolerance.
   */
  public static isIn01WithTolerance(x: number, tolerance: number): boolean {
    return x + tolerance >= 0.0 && x - tolerance <= 1.0;
  }
  /**
   * Restrict x so it is in the interval `[a,b]` (allowing `a` and `b` to be in either order).
   * @param x value to restrict
   * @param a (usually the lower) interval limit
   * @param b (usually the upper) interval limit
   */
  public static restrictToInterval(x: number, a: number, b: number): number {
    if (a <= b) {
      if (x < a)
        return a;
      if (x > b)
        return b;
      return x;
    }
    // reversed interval
    if (x < b)
      return b;
    if (x > a)
      return a;
    return x;
  }
  /**
   * Case-insensitive string comparison.
   * * Return `true` if the `toUpperCase` values of `string1` and `string2` match.
   */
  public static equalStringNoCase(string1: string, string2: string): boolean {
    return string1.toUpperCase() === string2.toUpperCase();
  }
  /**
   * Test for exact match of two number arrays.
   * Returns `true` if both arrays have the same length and entries, or if both arrays are empty or `undefined`.
   */
  public static exactEqualNumberArrays(a: number[] | undefined, b: number[] | undefined): boolean {
    if (Array.isArray(a) && a.length === 0)
      a = undefined;
    if (Array.isArray(b) && b.length === 0)
      b = undefined;
    if (a === undefined && b === undefined)
      return true;
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length)
        return false;
      for (let i = 0; i < a.length; i++)
        if (a[i] !== b[i])
          return false;
      return true;
    }
    return false;
  }
  /**
   * Test for match of two arrays of type `T`.
   * Returns `true` if both arrays have the same length and have the same entries (or both are empty arrays).
   */
  public static almostEqualArrays<T>(
    a: T[] | undefined, b: T[] | undefined, testFunction: (p: T, q: T) => boolean,
  ): boolean {
    if (Array.isArray(a) && a.length === 0)
      a = undefined;
    if (Array.isArray(b) && b.length === 0)
      b = undefined;
    if (a === undefined && b === undefined)
      return true;
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length)
        return false;
      for (let i = 0; i < a.length; i++) {
        if (!testFunction(a[i], b[i]))
          return false;
      }
      return true;
    }
    return false;
  }
  /**
   * Test for match of two arrays of type number or Float64Array.
   * Returns `true` if both arrays have the same length and have the same entries (or both are empty arrays).
   */
  public static almostEqualNumberArrays(
    a: number[] | Float64Array | undefined, b: number[] | Float64Array | undefined,
    testFunction: (p: number, q: number) => boolean,
  ): boolean {
    if (Array.isArray(a) && a.length === 0)
      a = undefined;
    if (Array.isArray(b) && b.length === 0)
      b = undefined;
    if (a === undefined && b === undefined)
      return true;
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length)
        return false;
      for (let i = 0; i < a.length; i++) {
        if (!testFunction(a[i], b[i]))
          return false;
      }
      return true;
    }
    return false;
  }
  /**
   * Test for match of two values of type `T`.
   * @param a first value
   * @param b second value
   * @param resultIfBothUndefined returned value when both are `undefined`
   * @returns `true` if both values are defined and equal (with ===) and `false` if both values are defined
   * but not equal or if one is defined and the other undefined.
   */
  public static areEqualAllowUndefined<T>(
    a: T | undefined, b: T | undefined, resultIfBothUndefined: boolean = true,
  ): boolean {
    if (a === undefined && b === undefined)
      return resultIfBothUndefined;
    if (a !== undefined && b !== undefined)
      return a === b;
    return false;
  }
  /**
   * Clone an array whose members have type `T`, which implements the clone method.
   * * If the clone method returns `undefined`, then `undefined` is forced into the cloned array.
   * @deprecated in 4.x. Use cloneArray.
   */
  // eslint-disable-next-line deprecation/deprecation
  public static cloneMembers<T extends Cloneable<T>>(array: T[] | undefined): T[] | undefined {
    if (array === undefined)
      return undefined;
    const clonedArray: T[] = [];
    for (const element of array) {
      clonedArray.push(element.clone()!);
    }
    return clonedArray;
  }
  /**
   * Clone an array whose members have the cloneable type `T`.
   */
  public static cloneArray<T extends ICloneable<T>>(array: T[] | undefined): T[] | undefined {
    if (array === undefined)
      return undefined;
    const clonedArray: T[] = [];
    for (const element of array) {
      clonedArray.push(element.clone());
    }
    return clonedArray;
  }
}
