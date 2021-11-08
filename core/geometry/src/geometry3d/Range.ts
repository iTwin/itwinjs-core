/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module CartesianGeometry
 */

import { AxisIndex, BeJSONFunctions, Geometry } from "../Geometry";
import { MultiLineStringDataVariant } from "../topology/Triangulation";
import { GrowableXYZArray } from "./GrowableXYZArray";
import { Matrix3d } from "./Matrix3d";
import { Point2d, Vector2d } from "./Point2dVector2d";
import { Point3d, Vector3d } from "./Point3dVector3d";
import { PointStreamRangeCollector, VariantPointDataStream } from "./PointStreaming";
import { Transform } from "./Transform";
import { LowAndHighXY, LowAndHighXYZ, Range1dProps, Range2dProps, Range3dProps, XAndY, XYAndZ } from "./XYZProps";
// allow _EXTREME_POSITIVE and _EXTREME_NEGATIVE
/* eslint-disable @typescript-eslint/naming-convention */
/**
 * Base class for Range1d, Range2d, Range3d.
 * @public
 */
export abstract class RangeBase {
  /** Number considered impossibly large possibly for a coordinate in a range. */
  protected static readonly _EXTREME_POSITIVE: number = 1.0e200;
  /** Number considered to be impossibly negative for a coordinate in a range. */
  protected static readonly _EXTREME_NEGATIVE: number = -1.0e200;
  /** Return 0 if high<= low, otherwise `1/(high-low)` for use in fractionalizing */
  protected static npcScaleFactor(low: number, high: number): number { return (high <= low) ? 0.0 : 1.0 / (high - low); }
  /** Return true if x is outside the range `[_EXTREME_NEGATIVE, _EXTREME_POSITIVE]' */
  public static isExtremeValue(x: number): boolean { return Math.abs(x) >= RangeBase._EXTREME_POSITIVE; }
  /** Return true if any x or y or z is outside the range `[_EXTREME_NEGATIVE, _EXTREME_POSITIVE]' */
  public static isExtremePoint3d(xyz: Point3d) { return RangeBase.isExtremeValue(xyz.x) || RangeBase.isExtremeValue(xyz.y) || RangeBase.isExtremeValue(xyz.z); }
  /** Return true if either of x,y is outside the range `[_EXTREME_NEGATIVE, _EXTREME_POSITIVE]' */
  public static isExtremePoint2d(xy: Point2d) { return RangeBase.isExtremeValue(xy.x) || RangeBase.isExtremeValue(xy.y); }
  /**
   * Return the min absolute distance from any point of `[lowA,highA]' to any point of `[lowB,highB]'.
   * * Both low,high pairs have order expectations:  The condition `high < low` means null interval.
   * * If there is interval overlap, the distance is zero.
   * @param lowA low of interval A
   * @param highA high of interval A
   * @param lowB low of interval B
   * @param highB high of interval B
   */
  public static rangeToRangeAbsoluteDistance(lowA: number, highA: number, lowB: number, highB: number): number {
    if (highA < lowA)
      return RangeBase._EXTREME_POSITIVE;
    if (highB < lowB)
      return RangeBase._EXTREME_POSITIVE;
    if (highB < lowA)
      return lowA - highB;
    if (highB <= highA)
      return 0.0;
    if (lowB <= highA)
      return 0.0;
    return lowB - highA;
  }
  /** Given a coordinate and pair of range limits, return the smallest distance to the range.
   * * This is zero for any point inside the range
   * * This is _EXTREME_POSITIVE if the range limits are inverted
   * * Otherwise (i.e. x is outside a finite range) the distance to the near endpoint.
   */
  public static coordinateToRangeAbsoluteDistance(x: number, low: number, high: number): number {
    if (high < low)
      return RangeBase._EXTREME_POSITIVE;
    if (x < low)
      return low - x;
    if (x > high)
      return x - high;
    return 0.0;
  }
}
/**
 * Axis aligned range in 3D.
 * * member `low` contains minimum coordinate of range box
 * * member  `high` contains maximum coordinate of range box
 * * The range is considered null (empty) if any low member is larger than its high counterpart.
 * @public
 */
export class Range3d extends RangeBase implements LowAndHighXYZ, BeJSONFunctions {
  // low and high are always non-null objects
  // any direction of low.q > high.q is considered a null range.
  // private ctor and setXYZXYZ_direct set the low and high explicitly (without further tests of low.q.<= high.q)
  /** low point coordinates */
  public low: Point3d;
  /** high point coordinates */
  public high: Point3d;
  /** Set this transform to values that indicate it has no geometric contents. */
  public setNull() {
    this.low.x = RangeBase._EXTREME_POSITIVE;
    this.low.y = RangeBase._EXTREME_POSITIVE;
    this.low.z = RangeBase._EXTREME_POSITIVE;
    this.high.x = RangeBase._EXTREME_NEGATIVE;
    this.high.y = RangeBase._EXTREME_NEGATIVE;
    this.high.z = RangeBase._EXTREME_NEGATIVE;
  }

  /** Freeze this instance (and its members) so it is read-only */
  public freeze(): Readonly<this> { this.low.freeze(); this.high.freeze(); return Object.freeze(this); }
  /** Flatten the low and high coordinates of any json object with low.x .. high.z into an array of 6 doubles */
  public static toFloat64Array(val: LowAndHighXYZ): Float64Array { return Float64Array.of(val.low.x, val.low.y, val.low.z, val.high.x, val.high.y, val.high.z); }
  /** Flatten the low and high coordinates of this into an array of 6 doubles */
  public toFloat64Array(): Float64Array { return Range3d.toFloat64Array(this); }
  /**
   * Construct a Range3d from an array of double-precision values
   * @param f64 the array, which should contain exactly 6 values in this order: lowX, lowY, lowZ, highX, highY, highZ
   * @return a new Range3d object
   */
  public static fromFloat64Array<T extends Range3d>(f64: Float64Array): T {
    if (f64.length !== 6)
      throw new Error("invalid array");
    return new this(f64[0], f64[1], f64[2], f64[3], f64[4], f64[5]) as T;
  }
  /**
   * Construct a Range3d from an un-typed array. This mostly useful when interpreting ECSQL query results of the 'blob' type, where you know that that result is a Range3d.
   * @param buffer untyped array
   * @return a new Range3d object
   */
  public static fromArrayBuffer<T extends Range3d>(buffer: ArrayBuffer): T { return this.fromFloat64Array(new Float64Array(buffer)); }

  // explicit ctor - no enforcement of value relationships
  public constructor(lowX: number = RangeBase._EXTREME_POSITIVE, lowY: number = RangeBase._EXTREME_POSITIVE, lowZ: number = RangeBase._EXTREME_POSITIVE,
    highX: number = RangeBase._EXTREME_NEGATIVE, highY: number = RangeBase._EXTREME_NEGATIVE, highZ: number = RangeBase._EXTREME_NEGATIVE) {
    super();
    this.low = Point3d.create(lowX, lowY, lowZ);
    this.high = Point3d.create(highX, highY, highZ);
  }

  /** Returns true if this and other have equal low and high parts, or both are null ranges. */
  public isAlmostEqual(other: Readonly<Range3d>, tol?: number): boolean {
    return (this.low.isAlmostEqual(other.low, tol) && this.high.isAlmostEqual(other.high, tol))
      || (this.isNull && other.isNull);
  }
  /** copy low and high values from other. */
  public setFrom(other: Range3d) { this.low.setFrom(other.low); this.high.setFrom(other.high); }
  /** Return a new Range3d copied from a range or derived type */
  public static createFrom<T extends Range3d>(other: Range3d, result?: T): T {
    if (result) { result.setFrom(other); return result; }
    return this.createXYZXYZOrCorrectToNull<T>(other.low.x, other.low.y, other.low.z,
      other.high.x, other.high.y, other.high.z, result);
  }
  /** set this range (in place) from json such as
   * * key-value pairs: `{low:[1,2,3], high:[4,5,6]}`
   * * array of points: `[[1,2,3],[9,3,4],[-2,1,3] ...]`
   * * Lowest level points can be `[1,2,3]` or `{x:1,y:2,z:3}`
   */
  public setFromJSON(json?: Range3dProps) {
    if (!json)
      return;
    this.setNull();
    if (Array.isArray(json)) {
      const point = Point3d.create();
      for (const value of json) {
        point.setFromJSON(value);
        this.extendPoint(point);
      }
      return;
    }
    const low = Point3d.fromJSON(json.low);
    const high = Point3d.fromJSON(json.high);
    if (!RangeBase.isExtremePoint3d(low) && !RangeBase.isExtremePoint3d(high)) {
      this.extendPoint(low);
      this.extendPoint(high);
    }
  }
  /** Return a JSON object `{low: ... , high: ...}`
   * with points formatted by `Point3d.toJSON()`
   */
  public toJSON(): Range3dProps { return { low: this.low.toJSON(), high: this.high.toJSON() }; }
  /** Use `setFromJSON` to parse `json` into a new Range3d instance. */
  public static fromJSON<T extends Range3d>(json?: Range3dProps): T {
    const result = new this() as T;
    result.setFromJSON(json);
    return result;
  }
  // internal use only -- directly set all coordinates, test only if directed.
  private setDirect(xA: number, yA: number, zA: number, xB: number, yB: number, zB: number, correctToNull: boolean) {
    this.low.x = xA;
    this.low.y = yA;
    this.low.z = zA;

    this.high.x = xB;
    this.high.y = yB;
    this.high.z = zB;
    if (correctToNull) {
      if (this.low.x > this.high.x
        || this.low.y > this.high.y
        || this.low.z > this.high.z)
        this.setNull();
    }
  }
  /** Return a copy */
  public clone(result?: this): this {
    result = result ? result : new (this.constructor as any)() as this;
    result.setDirect(this.low.x, this.low.y, this.low.z, this.high.x, this.high.y, this.high.z, false);
    return result;
  }
  /** Return a copy, translated by adding `shift` components in all directions.
   * * The translate of a null range is also a null range.
   */
  public cloneTranslated(shift: XYAndZ, result?: this): this {
    result = result ? result : new (this.constructor as any)() as this;
    if (!this.isNull)
      result.setDirect(this.low.x + shift.x, this.low.y + shift.y, this.low.z + shift.z, this.high.x + shift.x, this.high.y + shift.y, this.high.z + shift.z, false);
    return result;
  }

  /** Return a range initialized to have no content. */
  public static createNull<T extends Range3d>(result?: T): T {
    result = result ? result : new this() as T;
    result.setNull();
    return result;
  }

  /** Extend (modify in place) so that the range is large enough to include the supplied points. */
  public extend(...point: Point3d[]) {
    let p;
    for (p of point)
      this.extendPoint(p);
  }
  /** Return a range large enough to include the supplied points. If no points are given, the range is a null range */
  public static create(...point: Point3d[]) {
    const result = Range3d.createNull();
    let p;
    for (p of point)
      result.extendPoint(p);
    return result;
  }
  /** Create a range from freely structured MultiLineStringDataVariant. */
  public static createFromVariantData(data: MultiLineStringDataVariant): Range3d {
    const collector = new PointStreamRangeCollector();
    VariantPointDataStream.streamXYZ(data, collector);
    return collector.claimResult();
  }
  /** create a Range3d enclosing the transformed points. */
  public static createTransformed<T extends Range3d>(transform: Transform, ...point: Point3d[]): T {
    const result = this.createNull<T>();
    let p;
    for (p of point)
      result.extendTransformedXYZ(transform, p.x, p.y, p.z);
    return result;
  }
  /** create a Range3d enclosing the transformed points. */
  public static createTransformedArray<T extends Range3d>(transform: Transform, points: Point3d[] | GrowableXYZArray): T {
    const result = this.createNull<T>();
    result.extendArray(points, transform);
    return result;
  }

  /** create a Range3d enclosing the points after inverse transform. */
  public static createInverseTransformedArray<T extends Range3d>(transform: Transform, points: Point3d[] | GrowableXYZArray): T {
    const result = this.createNull<T>();
    result.extendInverseTransformedArray(points, transform);
    return result;
  }
  /** Set the range to be a single point supplied as x,y,z values */
  public setXYZ(x: number, y: number, z: number) {
    this.low.x = this.high.x = x;
    this.low.y = this.high.y = y;
    this.low.z = this.high.z = z;
  }

  /** Create a single point range */
  public static createXYZ<T extends Range3d>(x: number, y: number, z: number, result?: T): T {
    result = result ? result : new this() as T;
    result.setDirect(x, y, z, x, y, z, false);
    return result;
  }

  /** Create a box with 2 pairs of xyz candidates. Theses are compared and shuffled as needed for the box. */
  public static createXYZXYZ<T extends Range3d>(xA: number, yA: number, zA: number, xB: number, yB: number, zB: number, result?: T): T {
    result = result ? result : new this() as T;
    result.setDirect(
      Math.min(xA, xB), Math.min(yA, yB), Math.min(zA, zB),
      Math.max(xA, xB), Math.max(yA, yB), Math.max(zA, zB), false);
    return result;
  }

  /** Create a box with 2 pairs of xyz candidates. If any direction has order flip, create null. */
  public static createXYZXYZOrCorrectToNull<T extends Range3d>(xA: number, yA: number, zA: number, xB: number, yB: number, zB: number, result?: T): T {
    result = result ? result : new this() as T;
    if (xA > xB || yA > yB || zA > zB)
      return this.createNull(result);
    result.setDirect(
      Math.min(xA, xB), Math.min(yA, yB), Math.min(zA, zB),
      Math.max(xA, xB), Math.max(yA, yB), Math.max(zA, zB), true);
    return result;
  }

  /** Creates a 3d range from a 2d range's low and high members, setting the corresponding z values to the value given. */
  public static createRange2d<T extends Range3d>(range: Range2d, z: number = 0, result?: T): T {
    const retVal = result ? result : new this() as T;
    retVal.setNull();

    retVal.extendXYZ(range.low.x, range.low.y, z);
    retVal.extendXYZ(range.high.x, range.high.y, z);
    return retVal;
  }

  /** Create a range around an array of points. */
  public static createArray<T extends Range3d>(points: Point3d[], result?: T): T {
    result = result ? result : new this() as T;
    result.setNull();
    let point;
    for (point of points)
      result.extendPoint(point);
    return result;
  }

  /** extend a range around an array of points (optionally transformed) */
  public extendArray(points: Point3d[] | GrowableXYZArray, transform?: Transform) {
    if (Array.isArray(points))
      if (transform)
        for (const point of points)
          this.extendTransformedXYZ(transform, point.x, point.y, point.z);
      else
        for (const point of points)
          this.extendXYZ(point.x, point.y, point.z);
    else  // growable array -- this should be implemented without point extraction !!!
      if (transform)
        for (let i = 0; i < points.length; i++)
          this.extendTransformedXYZ(transform, points.getXAtUncheckedPointIndex(i), points.getYAtUncheckedPointIndex(i), points.getZAtUncheckedPointIndex(i));
      else
        for (let i = 0; i < points.length; i++)
          this.extendXYZ(points.getXAtUncheckedPointIndex(i), points.getYAtUncheckedPointIndex(i), points.getZAtUncheckedPointIndex(i));
  }

  /** extend a range around an array of points (optionally transformed) */
  public extendInverseTransformedArray(points: Point3d[] | GrowableXYZArray, transform: Transform) {
    if (Array.isArray(points))
      for (const point of points)
        this.extendInverseTransformedXYZ(transform, point.x, point.y, point.z);
    else  // growable array -- this should be implemented without point extraction !!!
      for (let i = 0; i < points.length; i++)
        this.extendInverseTransformedXYZ(transform, points.getXAtUncheckedPointIndex(i), points.getYAtUncheckedPointIndex(i), points.getZAtUncheckedPointIndex(i));
  }

  /** multiply the point x,y,z by transform and use the coordinate to extend this range.
   */
  public extendTransformedXYZ(transform: Transform, x: number, y: number, z: number) {
    const origin = transform.origin;
    const coffs = transform.matrix.coffs;
    this.extendXYZ(
      origin.x + coffs[0] * x + coffs[1] * y + coffs[2] * z,
      origin.y + coffs[3] * x + coffs[4] * y + coffs[5] * z,
      origin.z + coffs[6] * x + coffs[7] * y + coffs[8] * z);
  }

  /** multiply the point x,y,z,w by transform and use the coordinate to extend this range.
   */
  public extendTransformedXYZW(transform: Transform, x: number, y: number, z: number, w: number) {
    const origin = transform.origin;
    const coffs = transform.matrix.coffs;
    this.extendXYZW(
      origin.x * w + coffs[0] * x + coffs[1] * y + coffs[2] * z,
      origin.y * w + coffs[3] * x + coffs[4] * y + coffs[5] * z,
      origin.z * w + coffs[6] * x + coffs[7] * y + coffs[8] * z,
      w);
  }

  /** multiply the point x,y,z by transform and use the coordinate to extend this range.
   */
  public extendInverseTransformedXYZ(transform: Transform, x: number, y: number, z: number): boolean {
    const origin = transform.origin;
    if (!transform.matrix.computeCachedInverse(true))
      return false;
    const coffs = transform.matrix.inverseCoffs!;
    const xx = x - origin.x;
    const yy = y - origin.y;
    const zz = z - origin.z;
    this.extendXYZ(
      coffs[0] * xx + coffs[1] * yy + coffs[2] * zz,
      coffs[3] * xx + coffs[4] * yy + coffs[5] * zz,
      coffs[6] * xx + coffs[7] * yy + coffs[8] * zz);
    return true;
  }

  /** Extend the range by the two transforms applied to xyz */
  public extendTransformTransformedXYZ(transformA: Transform, transformB: Transform, x: number, y: number, z: number) {
    const origin = transformB.origin;
    const coffs = transformB.matrix.coffs;
    this.extendTransformedXYZ(transformA,
      origin.x + coffs[0] * x + coffs[1] * y + coffs[2] * z,
      origin.y + coffs[3] * x + coffs[4] * y + coffs[5] * z,
      origin.z + coffs[6] * x + coffs[7] * y + coffs[8] * z);
  }

  /** Test if the box has high<low for any of x,y,z, condition. Note that a range around a single point is NOT null. */
  public get isNull(): boolean {
    return this.high.x < this.low.x
      || this.high.y < this.low.y
      || this.high.z < this.low.z;
  }

  /** Test if  data has high<low for any of x,y,z, condition. Note that a range around a single point is NOT null. */
  public static isNull(data: LowAndHighXYZ): boolean {
    return data.high.x < data.low.x
      || data.high.y < data.low.y
      || data.high.z < data.low.z;
  }

  /** Test of the range contains a single point. */
  public get isSinglePoint(): boolean {
    return this.high.x === this.low.x
      && this.high.y === this.low.y
      && this.high.z === this.low.z;
  }

  /** Return the midpoint of the diagonal.  No test for null range. */
  public get center(): Point3d { return this.low.interpolate(.5, this.high); }
  /** return the low x coordinate */
  public get xLow(): number { return this.low.x; }
  /** return the low y coordinate */
  public get yLow(): number { return this.low.y; }
  /** return the low z coordinate */
  public get zLow(): number { return this.low.z; }
  /** return the high x coordinate */
  public get xHigh(): number { return this.high.x; }
  /** return the high y coordinate */
  public get yHigh(): number { return this.high.y; }
  /** return the high z coordinate */
  public get zHigh(): number { return this.high.z; }

  /**  Return the length of the box in the x direction */
  public xLength(): number { const a = this.high.x - this.low.x; return a > 0.0 ? a : 0.0; }

  /**  Return the length of the box in the y direction */
  public yLength(): number { const a = this.high.y - this.low.y; return a > 0.0 ? a : 0.0; }

  /**  Return the length of the box in the z direction */
  public zLength(): number { const a = this.high.z - this.low.z; return a > 0.0 ? a : 0.0; }

  /**  Return the largest of the x,y, z lengths of the range. */
  public maxLength(): number { return Math.max(this.xLength(), this.yLength(), this.zLength()); }
  /** return the diagonal vector. There is no check for isNull -- if the range isNull(), the vector will have very large negative coordinates. */
  public diagonal(result?: Vector3d): Vector3d { return this.low.vectorTo(this.high, result); }

  /**  Return the diagonal vector. There is no check for isNull -- if the range isNull(), the vector will have very large negative coordinates. */
  public diagonalFractionToPoint(fraction: number, result?: Point3d): Point3d { return this.low.interpolate(fraction, this.high, result); }

  /**  Return a point given by fractional positions on the XYZ axes. This is done with no check for isNull !!! */
  public fractionToPoint(fractionX: number, fractionY: number, fractionZ: number = 0, result?: Point3d): Point3d {
    return this.low.interpolateXYZ(fractionX, fractionY, fractionZ, this.high, result);
  }

  /**  Return a point given by fractional positions on the XYZ axes.
   *  Returns undefined if the range is null.
   */
  public localXYZToWorld(fractionX: number, fractionY: number, fractionZ: number, result?: Point3d): Point3d | undefined {
    if (this.isNull) return undefined;
    return this.low.interpolateXYZ(fractionX, fractionY, fractionZ, this.high, result);
  }

  /** Return a point given by fractional positions on the XYZ axes.
   * * Returns undefined if the range is null.
   */
  public localToWorld(xyz: XYAndZ, result?: Point3d): Point3d | undefined {
    return this.localXYZToWorld(xyz.x, xyz.y, xyz.z, result);
  }
  /** Replace fractional coordinates by world coordinates.
   * @returns false if null range.
   */
  public localToWorldArrayInPlace(points: Point3d[]): boolean {
    if (this.isNull) return false;
    for (const p of points)
      this.low.interpolateXYZ(p.x, p.y, p.z, this.high, p);
    return false;
  }
  /** Return fractional coordinates of point within the range.
   * * returns undefined if the range is null.
   * * returns undefined if any direction (x,y,z) has zero length
   */
  public worldToLocal(point: Point3d, result?: Point3d): Point3d | undefined {
    const ax = RangeBase.npcScaleFactor(this.low.x, this.high.x);
    const ay = RangeBase.npcScaleFactor(this.low.y, this.high.y);
    const az = RangeBase.npcScaleFactor(this.low.z, this.high.z);
    if (ax === 0.0 || ay === 0.0 || az === 0.0)
      return undefined;
    return Point3d.create((point.x - this.low.x) * ax, (point.y - this.low.y) * ay, (point.z - this.low.z) * az, result);
  }

  /** Return fractional coordinates of point within the range.
   * * returns undefined if the range is null.
   * * returns undefined if any direction (x,y,z) has zero length
   */
  public worldToLocalArrayInPlace(point: Point3d[]): boolean {
    const ax = RangeBase.npcScaleFactor(this.low.x, this.high.x);
    const ay = RangeBase.npcScaleFactor(this.low.y, this.high.y);
    const az = RangeBase.npcScaleFactor(this.low.z, this.high.z);
    if (ax === 0.0 || ay === 0.0 || az === 0.0)
      return false;
    for (const p of point)
      Point3d.create((p.x - this.low.x) * ax, (p.y - this.low.y) * ay, (p.z - this.low.z) * az, p);
    return true;
  }

  /** Return an array with the 8 corners on order wth "x varies fastest, then y, then z"
   * * points preallocated in `result` are reused if result.length >= 8.
   * * in reuse case, result.length is trimmed to 8
   */
  public corners(result?: Point3d[]): Point3d[] {
    if (result !== undefined && result.length >= 8) {
      result[0].set(this.low.x, this.low.y, this.low.z);
      result[1].set(this.high.x, this.low.y, this.low.z);
      result[2].set(this.low.x, this.high.y, this.low.z);
      result[3].set(this.high.x, this.high.y, this.low.z);
      result[4].set(this.low.x, this.low.y, this.high.z);
      result[5].set(this.high.x, this.low.y, this.high.z);
      result[6].set(this.low.x, this.high.y, this.high.z);
      result[7].set(this.high.x, this.high.y, this.high.z);
      result.length = 8;
      return result;
    }
    return [
      Point3d.create(this.low.x, this.low.y, this.low.z),
      Point3d.create(this.high.x, this.low.y, this.low.z),
      Point3d.create(this.low.x, this.high.y, this.low.z),
      Point3d.create(this.high.x, this.high.y, this.low.z),
      Point3d.create(this.low.x, this.low.y, this.high.z),
      Point3d.create(this.high.x, this.low.y, this.high.z),
      Point3d.create(this.low.x, this.high.y, this.high.z),
      Point3d.create(this.high.x, this.high.y, this.high.z)];
  }

  /** Return an array with indices of the corners of a face
   * * face 0 has negative x normal
   * * face 1 has positive x normal
   * * face 2 has negative y normal
   * * face 3 has positive y normal
   * * face 4 has negative z normal
   * * face 5 has positive z normal
   * * Any other value returns face 5
   * * faces are CCW as viewed from outside.
   */
  public static faceCornerIndices(index: number): number[] {
    if (index === 0)
      return [0, 4, 6, 2];
    if (index === 1)
      return [1, 3, 7, 5];
    if (index === 2)
      return [0, 1, 5, 4];
    if (index === 3)
      return [3, 2, 6, 7];
    if (index === 4)
      return [0, 2, 3, 1];
    return [4, 5, 7, 6];
  }
  /**
   * Return a rectangle that is the cross section as viewed from above (z direction) and at zFraction
   * @param zFraction plane altitude within the 0..1 z fraction range
   * @param upwardNormal true for CCW as viewed from above
   * @param addClosure true to add closure edge back to the start
   * @returns
   */
  public rectangleXY(zFraction: number = 0.0, upwardNormal: boolean = true, addClosure: boolean = true): Point3d[] | undefined{
    if (this.isNull)
      return undefined;
    const points: Point3d[] = [
      this.fractionToPoint(0, 0, zFraction),
      this.fractionToPoint(1, 0, zFraction),
      this.fractionToPoint(1, 1, zFraction),
      this.fractionToPoint(0, 1, zFraction),
    ];
    if (addClosure)
      points.push(points[0].clone());

    if (!upwardNormal)
      points.reverse();
    return points;
  }

  /** Return the largest absolute value among any coordinates in the box corners. */
  public maxAbs(): number {
    if (this.isNull)
      return 0.0;
    return Math.max(this.low.maxAbs(), this.high.maxAbs());
  }

  /** returns true if the x direction size is nearly zero */
  public get isAlmostZeroX(): boolean { return Geometry.isSmallMetricDistance(this.xLength()); }
  /** returns true if the y direction size is nearly zero */
  public get isAlmostZeroY(): boolean { return Geometry.isSmallMetricDistance(this.yLength()); }
  /** returns true if the z direction size is nearly zero */
  public get isAlmostZeroZ(): boolean { return Geometry.isSmallMetricDistance(this.zLength()); }

  /** Test if a point given as x,y,z is within the range. */
  public containsXYZ(x: number, y: number, z: number): boolean {
    return x >= this.low.x
      && y >= this.low.y
      && z >= this.low.z
      && x <= this.high.x
      && y <= this.high.y
      && z <= this.high.z;
  }

  /** Test if a point given as x,y is within the range.  (Ignoring z of range) */
  public containsXY(x: number, y: number): boolean {
    return x >= this.low.x
      && y >= this.low.y
      && x <= this.high.x
      && y <= this.high.y;
  }
  /** Test if a point is within the range. */
  public containsPoint(point: Point3d): boolean { return this.containsXYZ(point.x, point.y, point.z); }

  /** Test if the x,y coordinates of a point are within the range. */
  public containsPointXY(point: Point3d): boolean {
    return point.x >= this.low.x
      && point.y >= this.low.y
      && point.x <= this.high.x
      && point.y <= this.high.y;
  }

  /** Test of other range is within this range */
  public containsRange(other: Range3d): boolean {
    return other.low.x >= this.low.x
      && other.low.y >= this.low.y
      && other.low.z >= this.low.z
      && other.high.x <= this.high.x
      && other.high.y <= this.high.y
      && other.high.z <= this.high.z;
  }

  /** Test if there is any intersection with other range */
  public intersectsRange(other: Range3d): boolean {
    return !(this.low.x > other.high.x
      || this.low.y > other.high.y
      || this.low.z > other.high.z
      || other.low.x > this.high.x
      || other.low.y > this.high.y
      || other.low.z > this.high.z);
  }

  /** Test if there is any intersection with other range */
  public intersectsRangeXY(other: Range3d): boolean {
    return !(this.low.x > other.high.x
      || this.low.y > other.high.y
      || other.low.x > this.high.x
      || other.low.y > this.high.y);
  }
  /** Return 0 if the point is within the range, otherwise the distance to the closest face or corner */
  public distanceToPoint(point: XYAndZ): number {
    if (this.isNull)
      return RangeBase._EXTREME_POSITIVE;
    return Math.min(
      Geometry.hypotenuseXYZ(
        RangeBase.coordinateToRangeAbsoluteDistance(point.x, this.low.x, this.high.x),
        RangeBase.coordinateToRangeAbsoluteDistance(point.y, this.low.y, this.high.y),
        RangeBase.coordinateToRangeAbsoluteDistance(point.z, this.low.z, this.high.z)),
      RangeBase._EXTREME_POSITIVE);
  }

  /** returns 0 if the ranges have any overlap, otherwise the shortest absolute distance from one to the other. */
  public distanceToRange(other: Range3d): number {
    return Math.min(
      Geometry.hypotenuseXYZ(
        RangeBase.rangeToRangeAbsoluteDistance(this.low.x, this.high.x, other.low.x, other.high.x),
        RangeBase.rangeToRangeAbsoluteDistance(this.low.y, this.high.y, other.low.y, other.high.y),
        RangeBase.rangeToRangeAbsoluteDistance(this.low.z, this.high.z, other.low.z, other.high.z)),
      RangeBase._EXTREME_POSITIVE);
  }

  /** Expand this range by distances a (possibly signed) in all directions */
  public extendXYZ(x: number, y: number, z: number): void {
    if (x < this.low.x) this.low.x = x;
    if (x > this.high.x) this.high.x = x;

    if (y < this.low.y) this.low.y = y;
    if (y > this.high.y) this.high.y = y;

    if (z < this.low.z) this.low.z = z;
    if (z > this.high.z) this.high.z = z;
  }

  /** Expand this range by distances a in only the x direction.  */
  public extendXOnly(x: number): void {
    if (x < this.low.x) this.low.x = x;
    if (x > this.high.x) this.high.x = x;
  }
  /** Expand this range by distances a in only the x direction.  */
  public extendYOnly(y: number): void {
    if (y < this.low.y) this.low.y = y;
    if (y > this.high.y) this.high.y = y;
  }
  /** Expand this range by distances a in only the x direction.  */
  public extendZOnly(z: number): void {
    if (z < this.low.z) this.low.z = z;
    if (z > this.high.z) this.high.z = z;
  }
  /** Expand one component of this range  */
  public extendSingleAxis(a: number, axisIndex: AxisIndex) {
    if (axisIndex === AxisIndex.X)
      this.extendXOnly(a);
    if (axisIndex === AxisIndex.Y)
      this.extendYOnly(a);
    if (axisIndex === AxisIndex.Z)
      this.extendZOnly(a);
  }
  /** Expand this range by distances a (weighted and possibly signed) in all directions */
  public extendXYZW(x: number, y: number, z: number, w: number): void {
    if (!Geometry.isSmallMetricDistance(w))
      this.extendXYZ(x / w, y / w, z / w);
  }
  /** Expand this range to include a point. */
  public extendPoint(point: Point3d, transform?: Transform): void {
    if (transform) {
      this.extendTransformedXYZ(transform, point.x, point.y, point.z);
    } else {
      this.extendXYZ(point.x, point.y, point.z);
    }
  }

  /** Expand this range to include a transformed point. */
  public extendTransformedPoint(transform: Transform, point: Point3d): void {
    this.extendTransformedXYZ(transform, point.x, point.y, point.z);
  }

  /** Expand this range to include a range. */
  public extendRange(other: LowAndHighXYZ): void {
    if (!Range3d.isNull(other)) {
      this.extendXYZ(other.low.x, other.low.y, other.low.z);
      this.extendXYZ(other.high.x, other.high.y, other.high.z);
    }
  }

  /** Return the intersection of ranges. */
  public intersect(other: Range3d, result?: Range3d): Range3d {
    if (!this.intersectsRange(other))
      return Range3d.createNull(result);
    return Range3d.createXYZXYZOrCorrectToNull
      (
        Math.max(this.low.x, other.low.x), Math.max(this.low.y, other.low.y), Math.max(this.low.z, other.low.z),
        Math.min(this.high.x, other.high.x), Math.min(this.high.y, other.high.y), Math.min(this.high.z, other.high.z),
        result);

  }

  /** Return the union of ranges. */
  public union(other: Range3d, result?: Range3d): Range3d {
    if (this.isNull)
      return other.clone(result);
    if (other.isNull)
      return this.clone(result as this);
    // we trust null ranges have EXTREME values, so a null in either input leads to expected results.
    return Range3d.createXYZXYZOrCorrectToNull
      (
        Math.min(this.low.x, other.low.x), Math.min(this.low.y, other.low.y), Math.min(this.low.z, other.low.z),
        Math.max(this.high.x, other.high.x), Math.max(this.high.y, other.high.y), Math.max(this.high.z, other.high.z),
        result);
  }
  /**
   * move low and high points by scaleFactor around the center point.
   * @param scaleFactor scale factor applied to low, high distance from center.
   */
  public scaleAboutCenterInPlace(scaleFactor: number) {
    if (!this.isNull) {
      scaleFactor = Math.abs(scaleFactor);
      // do the scalar stuff to avoid making a temporary object ....
      const xMid = 0.5 * (this.low.x + this.high.x);
      const yMid = 0.5 * (this.low.y + this.high.y);
      const zMid = 0.5 * (this.low.z + this.high.z);
      this.high.x = Geometry.interpolate(xMid, scaleFactor, this.high.x);
      this.high.y = Geometry.interpolate(yMid, scaleFactor, this.high.y);
      this.high.z = Geometry.interpolate(zMid, scaleFactor, this.high.z);
      this.low.x = Geometry.interpolate(xMid, scaleFactor, this.low.x);
      this.low.y = Geometry.interpolate(yMid, scaleFactor, this.low.y);
      this.low.z = Geometry.interpolate(zMid, scaleFactor, this.low.z);
    }
  }

  /**
   * move all limits by a fixed amount.
   * * positive delta expands the range size
   * * negative delta reduces the range size
   * * if any dimension reduces below zero size, the whole range becomes null
   * @param delta shift to apply.
   */
  public expandInPlace(delta: number): void {
    this.setDirect(
      this.low.x - delta, this.low.y - delta, this.low.z - delta,
      this.high.x + delta, this.high.y + delta, this.high.z + delta, true);
  }

  /** Create a local to world transform from this range. */
  public getLocalToWorldTransform(result?: Transform): Transform {
    return Transform.createOriginAndMatrix(Point3d.create(this.low.x, this.low.y, this.low.z), Matrix3d.createRowValues(
      this.high.x - this.low.x, 0, 0,
      0, this.high.y - this.low.y, 0,
      0, 0, this.high.z - this.low.z,
    ), result);
  }

  /**
   * Creates an NPC to world transformation to go from 000...111 to the globally aligned cube with diagonally opposite corners that are the
   * min and max of this range. The diagonal component for any degenerate direction is 1.
   */
  public getNpcToWorldRangeTransform(result?: Transform): Transform {
    const transform = this.getLocalToWorldTransform(result);
    const matrix = transform.matrix;
    if (matrix.coffs[0] === 0)
      matrix.coffs[0] = 1;
    if (matrix.coffs[4] === 0)
      matrix.coffs[4] = 1;
    if (matrix.coffs[8] === 0)
      matrix.coffs[8] = 1;
    return transform;
  }

  /** Ensure that the length of each dimension of this AxisAlignedBox3d is at least a minimum size. If not, expand to minimum about the center.
   * @param min The minimum length for each dimension.
   */
  public ensureMinLengths(min: number = .001) {
    let size = (min - this.xLength()) / 2.0;
    if (size > 0) {
      this.low.x -= size;
      this.high.x += size;
    }
    size = (min - this.yLength()) / 2.0;
    if (size > 0) {
      this.low.y -= size;
      this.high.y += size;
    }
    size = (min - this.zLength()) / 2.0;
    if (size > 0) {
      this.low.z -= size;
      this.high.z += size;
    }
  }
}
/**
 * Range on a 1d axis
 * * `low` and `high` members are always non-null objects
 * * having `low > high` indicates an empty range.
 * * the range contains x values for which `low <= x <= high`
 * @public
 */
export class Range1d extends RangeBase {
  /** low point coordinates.  DO NOT MODIFY FROM OUTSIDE THIS CLASS */
  public low: number;
  /** high point coordinates.  DO NOT MODIFY FROM OUTSIDE THIS CLASS */
  public high: number;
  /** reset the low and high to null range state. */
  public setNull() {
    this.low = RangeBase._EXTREME_POSITIVE;
    this.high = RangeBase._EXTREME_NEGATIVE;
  }
  // internal use only -- directly set all coordinates, test only if directed.
  private setDirect(low: number, high: number, correctToNull: boolean = false) {
    this.low = low;
    this.high = high;
    if (correctToNull && low > high)
      this.setNull();
  }
  // explicit ctor - no enforcement of value relationships
  private constructor(
    low: number = RangeBase._EXTREME_POSITIVE,
    high: number = RangeBase._EXTREME_NEGATIVE) {
    super();
    this.low = low; this.high = high; // duplicates set_direct, but compiler is not convinced they are set.
    this.setDirect(low, high);
  }
  /** Returns true if this and other have equal low and high parts, or both are null ranges. */
  public isAlmostEqual(other: Readonly<Range1d>): boolean {
    return (Geometry.isSameCoordinate(this.low, other.low) && Geometry.isSameCoordinate(this.high, other.high))
      || (this.isNull && other.isNull);
  }
  /** copy contents from other Range1d. */
  public setFrom(other: Range1d) { this.low = other.low; this.high = other.high; }
  /** Convert from a JSON object of one of these forms:
   *
   * *  Any array of numbers: `[value,value, value]`
   * *  An object with low and high as properties: `{low:lowValue, high: highValue}`
   */
  public setFromJSON(json: Range1dProps): void {
    this.setNull();
    if (Array.isArray(json)) {
      let value;
      for (value of json) {
        if (Number.isFinite(value))
          this.extendX(value);
      }
    } else if (json.low !== undefined && Number.isFinite(json.low) && json.high !== undefined && Number.isFinite(json.high)) {
      this.extendX(json.low);
      this.extendX(json.high);
    }
  }
  /** Use `setFromJSON` to parse `json` into a new Range1d instance. */
  public static fromJSON<T extends Range1d>(json?: Range1dProps): T {
    const result = new this() as T;
    if (json)
      result.setFromJSON(json);
    return result;
  }
  /** Convert to a JSON object of form
   * ```
   *    [lowValue,highValue]
   * ```
   */
  public toJSON(): Range1dProps { if (this.isNull) return new Array<number>(); else return [this.low, this.high]; }

  /** return a new Range1d with contents of this.
   * @param result optional result.
   */
  public clone(result?: this): this {
    result = result ? result : new (this.constructor as any)() as this;
    result.setDirect(this.low, this.high);
    return result;
  }

  /** return a new Range1d with contents of this.
   * @param result optional result.
   */
  public static createFrom<T extends Range1d>(other: T, result?: T) {
    result = result ? result : new this() as T;
    result.setDirect(other.low, other.high);
    return result;
  }

  /** Create a range with no content.
   * @param result optional result.
   */
  public static createNull<T extends Range1d>(result?: T): T {
    result = result ? result : new this() as T;
    result.setNull();
    return result;
  }

  /** create a range with `delta` added to low and high
   * * If `this` is a null range, return a null range.
   */
  public cloneTranslated(delta: number, result?: Range1d): Range1d {
    result = result ? result : this.clone();
    if (!result.isNull) {
      result.low += delta;
      result.high += delta;
    }
    return result;
  }

  /**
   * Set this range to be a single value.
   * @param x value to use as both low and high.
   */
  public setX(x: number) { this.low = this.high = x; }

  /** Create a single point box */
  public static createX<T extends Range1d>(x: number, result?: T): T {
    result = result ? result : new this() as T;
    result.setDirect(x, x);
    return result;
  }

  /**
   * Set this range to (min(x0,x1), max(x0,x1))
   * @param x0 first value
   * @param x1 second value
   */
  public setXXUnordered(x0: number, x1: number) {
    if (x0 <= x1) {
      this.low = x0; this.high = x1;
    } else {
      this.low = x1; this.high = x0;
    }
  }
  public get isExact01(): boolean {
    return this.low === 0.0 && this.high === 1.0;
}
  /** Create a box from two values. Values are reversed if needed
   * @param xA first value
   * @param xB second value
   */
  public static createXX<T extends Range1d>(xA: number, xB: number, result?: T): T {
    result = result ? result : new this() as T;
    result.setDirect(
      Math.min(xA, xB),
      Math.max(xA, xB));
    return result;
  }

  /** Create a box from two values, but null range if the values are reversed
   * @param xA first value
   * @param xB second value
   */
  public static createXXOrCorrectToNull<T extends Range1d>(xA: number, xB: number, result?: T): T {
    if (xB < xA)
      return Range1d.createNull(result);

    result = result ? result : new this() as T;
    result.setDirect(
      Math.min(xA, xB),
      Math.max(xA, xB));
    return result;
  }

  /** Create a range containing all the values in an array.
   * @param values array of points to be contained in the range.
   * @param result optional result.
   */
  public static createArray<T extends Range1d>(values: Float64Array | number[], result?: T): T {
    result = result ? result : new this() as T;
    let x;
    for (x of values)
      result.extendX(x);
    return result;
  }
  /** extend to include an array of values */
  public extendArray(values: Float64Array | number[]) {
    let x;
    for (x of values)
      this.extendX(x);
  }

  /** extend to include `values` at indices `beginIndex <= i < endIndex]`
   * @param values array of values
   * @param beginIndex first index to include
   * @param numValue number of values to access
   */
  public extendArraySubset(values: Float64Array | number[], beginIndex: number, numValue: number) {
    const endIndex = beginIndex + numValue;
    for (let i = beginIndex; i < endIndex; i++)
      this.extendX(values[i]);
  }

  /** Test if the box has high<low Note that a range around a single point is NOT null. */
  public get isNull(): boolean {
    return this.high < this.low;
  }

  /** Test of the range contains a single point. */
  public get isSinglePoint(): boolean {
    return this.high === this.low;
  }

  /** Return the length of the range in the x direction */
  public length(): number { const a = this.high - this.low; return a > 0.0 ? a : 0.0; }

  /** return a point given by fractional positions within the range. This is done with no check for isNull !!! */
  public fractionToPoint(fraction: number): number {
    return Geometry.interpolate(this.low, fraction, this.high);
  }

  /** Return the largest absolute value among the box limits. */
  public maxAbs(): number {
    if (this.isNull)
      return 0.0;
    return Math.max(Math.abs(this.low), Math.abs(this.high));
  }

  /** Test if the x direction size is nearly zero */
  public get isAlmostZeroLength(): boolean { return Geometry.isSmallMetricDistance(this.length()); }

  /** Test if a number is within the range. */
  public containsX(x: number): boolean {
    return x >= this.low
      && x <= this.high;
  }

  /** Test of other range is within this range */
  public containsRange(other: Range1d): boolean {
    return other.low >= this.low
      && other.high <= this.high;
  }

  /** Test if there is any intersection with other range */
  public intersectsRange(other: Range1d): boolean {
    return !(this.low > other.high || other.low > this.high);
  }
/**
 * Intersect this range with a range defined by parameters x0 and x1
 * * For x1 > x0, that range is null, and the intersection is null.
 * * For x0 <= x1, the input is a non-null range.
 * * The intersection range replaces the contents of this.
 *
 */
  public intersectRangeXXInPlace(x0: number, x1: number){
    if (x1 < x0 || x1 < this.low || x0 > this.high) {
      this.setNull();
    } else {
      if (x1 < this.high)
        this.high = x1;
      if (x0 > this.low)
        this.low = x0;
    }
  }

  /** returns 0 if the ranges have any overlap, otherwise the shortest absolute distance from one to the other. */
  public distanceToRange(other: Range1d): number {
    return RangeBase.rangeToRangeAbsoluteDistance(this.low, this.high, other.low, other.high);
  }

  /** Return 0 if the point is within the range, otherwise the (unsigned) distance to the closest face or corner */
  public distanceToX(x: number): number {
    if (this.isNull)
      return RangeBase._EXTREME_POSITIVE;
    return RangeBase.coordinateToRangeAbsoluteDistance(x, this.low, this.high);
  }

  /** Expand this range by a single coordinate */
  public extendX(x: number): void {
    if (x < this.low) this.low = x;
    if (x > this.high) this.high = x;
  }

  /** Expand this range to include a range. */
  public extendRange(other: Range1d): void {
    if (!other.isNull) {
      this.extendX(other.low);
      this.extendX(other.high);
    }
  }

  /** Extend only the low limit to x.  Return true if the low limit is changed. */
  public extendLow(x: number): boolean {
    if (this.isNull || x < this.low) {
      this.low = x;
      return true;
    }
    return false;
  }

  /** Extend only the high limit to x.  Return true if the high limit is changed. */
  public extendHigh(x: number): boolean {
    if (this.isNull || x > this.high) {
      this.high = x;
      return true;
    }
    return false;
  }

  /** Return the intersection of ranges. */
  public intersect(other: Range1d, result?: Range1d): Range1d {
    if (!this.intersectsRange(other))
      return Range1d.createNull(result);

    return Range1d.createXXOrCorrectToNull
      (
        Math.max(this.low, other.low),
        Math.min(this.high, other.high),
        result);

  }

  /** Return the union of ranges. */
  /** Return the intersection of ranges. */
  public union(other: Range1d, result?: Range1d): Range1d {
    // we trust null ranges have EXTREME values, so a null in either input leads to expected results.
    return Range1d.createXX
      (
        Math.min(this.low, other.low),
        Math.max(this.high, other.high),
        result);
  }
  /**
   * move low and high points by scaleFactor around the center point.
   * @param scaleFactor scale factor applied to low, high distance from center.
   */
  public scaleAboutCenterInPlace(scaleFactor: number) {
    if (!this.isNull) {
      scaleFactor = Math.abs(scaleFactor);
      // do the scalar stuff to avoid making a temporary object ....
      const xMid = 0.5 * (this.low + this.high);
      this.high = Geometry.interpolate(xMid, scaleFactor, this.high);
      this.low = Geometry.interpolate(xMid, scaleFactor, this.low);
    }
  }
  /**
   * move all limits by a fixed amount.
   * * positive delta expands the range size
   * * negative delta reduces the range size
   * * if any dimension reduces below zero size, the whole range becomes null
   * @param delta shift to apply.
   */
  public expandInPlace(delta: number): void {
    this.setDirect(
      this.low - delta,
      this.high + delta, true);
  }
  /**
   * clip this range to a linear half space condition
   * * if `limitA > limitB` the limit space is empty
   *   * make this range null
   *   * return false;
   * * otherwise (i.e `limitA <= limitB`)
   *   * solve `a + u * f = limitA' and `a + u * f = limitA`
   *   * if unable to solve (i.e. u near zero), `a` alone determines whether to (a) leave this interval unchanged or (b) reduce to nothing.
   *   * the `f` values are an interval in the space of this `Range1d`
   *   * restrict the range to that interval (i.e intersect existing (low,high) with the fraction interval.
   *   * return true if the range is non-null after the clip.
   * @param a constant of linear map
   * @param u coefficient of linear map
   * @param limitA crossing value, assumed in range relation with limitB
   * @param limitB crossing value, assumed in range relation with limitB
   * @param limitIsHigh true if the limit is an upper limit on mapped values.
   *
   */
  public clipLinearMapToInterval(a: number, u: number, limitA: number, limitB: number): boolean {
    // f = (limit - a) / u
    if (limitB < limitA || this.high < this.low)
      return false;
    const fractionA = Geometry.conditionalDivideFraction(limitA - a, u);
    const fractionB = Geometry.conditionalDivideFraction(limitB - a, u);
    // single point case
    if (fractionA === undefined || fractionB === undefined) {
      if (limitA <= a && a <= limitB)
        return true;
      this.setNull();
      return false;
    }

    if (fractionA < fractionB) {
      if (fractionA > this.low)
        this.low = fractionA;
      if (fractionB < this.high)
        this.high = fractionB;
    } else {
      if (fractionA < this.high)
        this.high = fractionA;
      if (fractionB > this.low)
        this.low = fractionB;
    }
    if (this.high < this.low) {
      this.setNull();
      return false;
    }
    return true;
  }
}

/**
 * Range box in xy plane
 * @public
 */
export class Range2d extends RangeBase implements LowAndHighXY {
  // low and high are always non-null objects
  // any direction of low.q > high.q is considered a null range.
  /** low point coordinates.  DO NOT MODIFY FROM OUTSIDE THIS CLASS */
  public low: Point2d;
  /** low point coordinates.  DO NOT MODIFY FROM OUTSIDE THIS CLASS */
  public high: Point2d;

  /** reset the low and high to null range state. */
  public setNull() {
    this.low.x = RangeBase._EXTREME_POSITIVE;
    this.low.y = RangeBase._EXTREME_POSITIVE;
    this.high.x = RangeBase._EXTREME_NEGATIVE;
    this.high.y = RangeBase._EXTREME_NEGATIVE;
  }
  /** Flatten the low and high coordinates of any json object with low.x .. high.y into an array of 4 doubles */
  public static toFloat64Array(val: LowAndHighXY): Float64Array { return Float64Array.of(val.low.x, val.low.y, val.high.x, val.high.y); }
  /** Flatten the low and high coordinates of this instance into an array of 4 doubles */
  public toFloat64Array(): Float64Array { return Range2d.toFloat64Array(this); }
  /**
   * Construct a Range2d from an array of double-precision values
   * @param f64 the array, which should contain exactly 4 values in this order: lowX, lowY, highX, highY
   * @return a new Range2d object
   */
  public static fromFloat64Array<T extends Range2d>(f64: Float64Array): T {
    if (f64.length !== 4)
      throw new Error("invalid array");
    return new this(f64[0], f64[1], f64[2], f64[3]) as T;
  }
  /**
   * Construct a Range2d from an un-typed array. This mostly useful when interpreting ECSQL query results of the 'blob' type, where you know that that result is a Range3d.
   * @param buffer untyped array
   * @return a new Range2d object
   */
  public static fromArrayBuffer<T extends Range2d>(buffer: ArrayBuffer): T { return this.fromFloat64Array(new Float64Array(buffer)); }

  // explicit ctor - no enforcement of value relationships
  public constructor(lowX = Range2d._EXTREME_POSITIVE, lowY = Range2d._EXTREME_POSITIVE, highX = Range2d._EXTREME_NEGATIVE, highY = Range2d._EXTREME_NEGATIVE) {
    super();
    this.low = Point2d.create(lowX, lowY);
    this.high = Point2d.create(highX, highY);
  }
  /** Returns true if this and other have equal low and high parts, or both are null ranges. */
  public isAlmostEqual(other: Range2d): boolean {
    return (this.low.isAlmostEqual(other.low) && this.high.isAlmostEqual(other.high))
      || (this.isNull && other.isNull);
  }
  /** copy all content from any `other` that has low and high xy data. */
  public setFrom(other: LowAndHighXY) {
    this.low.set(other.low.x, other.low.y);
    this.high.set(other.high.x, other.high.y);
  }
  /** create a new Range2d from any `other` that has low and high xy data. */
  public static createFrom<T extends Range2d>(other: LowAndHighXY, result?: T): T {
    if (result) { result.setFrom(other); return result; }
    return this.createXYXYOrCorrectToNull(other.low.x, other.low.y, other.high.x, other.high.y, result) as T;
  }
  /** treat any array of numbers as numbers to be inserted !!! */
  public setFromJSON(json: Range2dProps): void {
    this.setNull();
    if (Array.isArray(json)) {
      const point = Point2d.create();
      for (const value of json) {
        point.setFromJSON(value);
        this.extendPoint(point);
      }
      return;
    }
    const low = Point2d.fromJSON(json.low);
    const high = Point2d.fromJSON(json.high);
    if (!RangeBase.isExtremePoint2d(low) && !RangeBase.isExtremePoint2d(high)) {
      this.extendPoint(low);
      this.extendPoint(high);
    }
  }
  /** Freeze this instance (and its members) so it is read-only */
  public freeze(): Readonly<this> { this.low.freeze(); this.high.freeze(); return Object.freeze(this); }
  /** return json array with two points as produced by `Point2d.toJSON` */
  public toJSON(): Range2dProps { return this.isNull ? [] : [this.low.toJSON(), this.high.toJSON()]; }
  /** Use `setFromJSON` to parse `json` into a new Range2d instance. */
  public static fromJSON<T extends Range2d>(json?: Range2dProps): T {
    const result = new this() as T;
    if (json)
      result.setFromJSON(json);
    return result;
  }
  // internal use only -- directly set all coordinates, without tests.
  private setDirect(xA: number, yA: number, xB: number, yB: number, correctToNull: boolean) {
    this.low.x = xA;
    this.low.y = yA;

    this.high.x = xB;
    this.high.y = yB;
    if (correctToNull) {
      if (this.low.x > this.high.x || this.low.y > this.high.y)
        this.setNull();
    }
  }
  /** return a clone of this range (or copy to optional result) */
  public clone(result?: this): this {
    result = result ? result : new (this.constructor as any)() as this;
    result.setDirect(this.low.x, this.low.y, this.high.x, this.high.y, false);
    return result;
  }
  /** create a range with no content. */
  public static createNull<T extends Range2d>(result?: T): T {
    result = result ? result : new this() as T;
    result.setNull();
    return result;
  }
  /** Set low and hight to a single xy value. */
  public setXY(x: number, y: number) {
    this.low.x = this.high.x = x;
    this.low.y = this.high.y = y;
  }

  /** Create a single point box */
  public static createXY<T extends Range2d>(x: number, y: number, result?: T): T {
    result = result ? result : new this() as T;
    result.setDirect(x, y, x, y, false);
    return result;
  }

  /** Create a box with 2 pairs of xy candidates. Theses are compared and shuffled as needed for the box. */
  public static createXYXY<T extends Range2d>(xA: number, yA: number, xB: number, yB: number, result?: T): T {
    result = result ? result : new this() as T;
    result.setDirect(
      Math.min(xA, xB), Math.min(yA, yB),
      Math.max(xA, xB), Math.max(yA, yB), false);
    return result;
  }
  /** Create a box with 3 pairs of xy candidates. Theses are compared and shuffled as needed for the box. */
  public static createXYXYXY<T extends Range2d>(xA: number, yA: number, xB: number, yB: number, xC: number, yC: number, result?: T): T {
    result = result ? result : new this() as T;
    result.setDirect(
      Math.min(xA, xB, xC), Math.min(yA, yB, yC),
      Math.max(xA, xB, xC), Math.max(yA, yB, yC), false);
    return result;
  }
  /** Create a box with 2 pairs of xy candidates. If any direction has order flip, create null. */
  public static createXYXYOrCorrectToNull<T extends Range2d>(xA: number, yA: number, xB: number, yB: number, result?: T): T {
    if (xA > xB || yA > yB)
      return this.createNull(result);
    result = result ? result : new this() as T;
    result.setDirect(
      Math.min(xA, xB), Math.min(yA, yB),
      Math.max(xA, xB), Math.max(yA, yB), true);
    return result;
  }

  /** Create a range around an array of points. */
  public static createArray<T extends Range2d>(points: Point2d[], result?: T): T {
    result = result ? result : new this() as T;
    let point;
    for (point of points)
      result.extendPoint(point);
    return result;
  }

  /** Test if the box has high<low for any of x,y, condition. Note that a range around a single point is NOT null. */
  public get isNull(): boolean {
    return this.high.x < this.low.x
      || this.high.y < this.low.y;
  }

  /** Test if the box has high strictly less than low for any of x,y, condition. Note that a range around a single point is NOT null. */
  public static isNull(range: LowAndHighXY): boolean {
    return range.high.x < range.low.x
      || range.high.y < range.low.y;
  }

  /** Test of the range contains a single point. */
  public get isSinglePoint(): boolean {
    return this.high.x === this.low.x
      && this.high.y === this.low.y;
  }
  /** Return the midpoint of the diagonal.  No test for null range. */
  public get center(): Point2d { return this.low.interpolate(.5, this.high); }
  /** return the low x coordinate */
  public get xLow(): number { return this.low.x; }
  /** return the low y coordinate */
  public get yLow(): number { return this.low.y; }
  /** return the high x coordinate */
  public get xHigh(): number { return this.high.x; }
  /** return the high y coordinate */
  public get yHigh(): number { return this.high.y; }

  /** Length of the box in the x direction */
  public xLength(): number { const a = this.high.x - this.low.x; return a > 0.0 ? a : 0.0; }

  /** Length of the box in the y direction */
  public yLength(): number { const a = this.high.y - this.low.y; return a > 0.0 ? a : 0.0; }

  /** return the diagonal vector. There is no check for isNull -- if the range isNull(), the vector will have very large negative coordinates. */
  public diagonal(result?: Vector2d): Vector2d { return this.low.vectorTo(this.high, result); }

  /** return the diagonal vector. There is no check for isNull -- if the range isNull(), the vector will have very large negative coordinates. */
  public diagonalFractionToPoint(fraction: number, result?: Point2d): Point2d { return this.low.interpolate(fraction, this.high, result); }

  /** return a point given by fractional positions on the XY axes. This is done with no check for isNull !!! */
  public fractionToPoint(fractionX: number, fractionY: number, result?: Point2d): Point2d {
    return this.low.interpolateXY(fractionX, fractionY, this.high, result);
  }
  /** Return an array with the 4 corners.
   * * if asLoop is false, 4 corners are "x varies fastest, then y"
   * * if asLoop is true, 5 corners are in CCW order WITH CLOSURE
   */
  public corners3d(asLoop: boolean = false, z: number = 0): Point3d[] {
    if (asLoop)
      return [
        Point3d.create(this.low.x, this.low.y, z),
        Point3d.create(this.high.x, this.low.y, z),
        Point3d.create(this.high.x, this.high.y, z),
        Point3d.create(this.low.x, this.high.y, z),
        Point3d.create(this.low.x, this.low.y, z)];

    return [
      Point3d.create(this.low.x, this.low.y, z),
      Point3d.create(this.high.x, this.low.y, z),
      Point3d.create(this.low.x, this.high.y, z),
      Point3d.create(this.high.x, this.high.y, z)];
  }

  /** Largest absolute value among any coordinates in the box corners. */
  public maxAbs(): number {
    if (this.isNull)
      return 0.0;
    return Math.max(this.low.maxAbs(), this.high.maxAbs());
  }

  /** Test if the x direction size is nearly zero */
  public get isAlmostZeroX(): boolean { return Geometry.isSmallMetricDistance(this.xLength()); }
  /** Test if the y direction size is nearly zero */
  public get isAlmostZeroY(): boolean { return Geometry.isSmallMetricDistance(this.yLength()); }

  /** Test if a point given as x,y is within the range. */
  public containsXY(x: number, y: number): boolean {
    return x >= this.low.x
      && y >= this.low.y
      && x <= this.high.x
      && y <= this.high.y;
  }

  /** Test if a point is within the range. */
  public containsPoint(point: XAndY): boolean { return this.containsXY(point.x, point.y); }

  /** Test of other range is within this range */
  public containsRange(other: LowAndHighXY): boolean {
    return other.low.x >= this.low.x
      && other.low.y >= this.low.y
      && other.high.x <= this.high.x
      && other.high.y <= this.high.y;
  }

  /** Test if there is any intersection with other range */
  public intersectsRange(other: LowAndHighXY): boolean {
    return !(this.low.x > other.high.x
      || this.low.y > other.high.y
      || other.low.x > this.high.x
      || other.low.y > this.high.y);
  }

  /** Return 0 if the point is within the range, otherwise the distance to the closest face or corner */
  public distanceToPoint(point: XAndY): number {
    if (this.isNull)
      return Range2d._EXTREME_POSITIVE;
    return Math.min(
      Geometry.hypotenuseXY(
        RangeBase.coordinateToRangeAbsoluteDistance(point.x, this.low.x, this.high.x),
        RangeBase.coordinateToRangeAbsoluteDistance(point.y, this.low.y, this.high.y)),
      Range2d._EXTREME_POSITIVE);
  }

  /** Return 0 if the point is within the range, otherwise the distance to the closest face or corner */
  public distanceToRange(other: LowAndHighXY): number {
    return Math.min(
      Geometry.hypotenuseXY(
        RangeBase.rangeToRangeAbsoluteDistance(this.low.x, this.high.x, other.low.x, other.high.x),
        RangeBase.rangeToRangeAbsoluteDistance(this.low.y, this.high.y, other.low.y, other.high.y)),
      Range2d._EXTREME_POSITIVE);
  }

  /** Expand this range to include a point given by x,y */
  public extendXY(x: number, y: number): void {
    if (x < this.low.x) this.low.x = x;
    if (x > this.high.x) this.high.x = x;

    if (y < this.low.y) this.low.y = y;
    if (y > this.high.y) this.high.y = y;
  }

  /** Expand this range to include a point given by x,y */
  public extendTransformedXY(transform: Transform, x: number, y: number): void {
    const x1 = transform.multiplyComponentXYZ(0, x, y, 0);
    const y1 = transform.multiplyComponentXYZ(1, x, y, 0);
    this.extendXY(x1, y1);
  }
  /** Expand this range to include a point. */
  public extendPoint(point: XAndY): void { this.extendXY(point.x, point.y); }

  /** Expand this range to include a range. */
  public extendRange(other: LowAndHighXY): void {
    if (!Range2d.isNull(other)) {
      this.extendXY(other.low.x, other.low.y);
      this.extendXY(other.high.x, other.high.y);
    }
  }

  /** Return the intersection of ranges. */
  public intersect(other: LowAndHighXY, result?: Range2d): Range2d {
    if (!this.intersectsRange(other))
      return Range2d.createNull(result);
    return Range2d.createXYXY
      (
        Math.max(this.low.x, other.low.x), Math.max(this.low.y, other.low.y),
        Math.min(this.high.x, other.high.x), Math.min(this.high.y, other.high.y),
        result);

  }

  /** Return the union of ranges. */
  public union(other: LowAndHighXY, result?: Range2d): Range2d {
    if (this.isNull)
      return Range2d.createFrom(other, result);
    if (Range2d.isNull(other))
      return this.clone(result as this);
    // we trust null ranges have EXTREME values, so a null in either input leads to expected results.
    return Range2d.createXYXY
      (
        Math.min(this.low.x, other.low.x), Math.min(this.low.y, other.low.y),
        Math.max(this.high.x, other.high.x), Math.max(this.high.y, other.high.y),
        result);
  }

  /**
   * move low and high points by scaleFactor around the center point.
   * @param scaleFactor scale factor applied to low, high distance from center.
   */
  public scaleAboutCenterInPlace(scaleFactor: number) {
    if (!this.isNull) {
      scaleFactor = Math.abs(scaleFactor);
      // do the scalar stuff to avoid making a temporary object ....
      const xMid = 0.5 * (this.low.x + this.high.x);
      const yMid = 0.5 * (this.low.y + this.high.y);
      this.high.x = Geometry.interpolate(xMid, scaleFactor, this.high.x);
      this.high.y = Geometry.interpolate(yMid, scaleFactor, this.high.y);
      this.low.x = Geometry.interpolate(xMid, scaleFactor, this.low.x);
      this.low.y = Geometry.interpolate(yMid, scaleFactor, this.low.y);
    }
  }
  /**
   * move all limits by a fixed amount.
   * * positive delta expands the range size
   * * negative delta reduces the range size
   * * if any dimension reduces below zero size, the whole range becomes null
   * @param delta shift to apply.
   */
  public expandInPlace(delta: number): void {
    this.setDirect(
      this.low.x - delta, this.low.y - delta,
      this.high.x + delta, this.high.y + delta, true);
  }
  /** Return fractional coordinates of point within the range.
   * * returns undefined if the range is null.
   * * returns undefined if any direction (x,y) has zero length
   */
  public worldToLocal(point: Point2d, result?: Point2d): Point2d | undefined {
    const ax = RangeBase.npcScaleFactor(this.low.x, this.high.x);
    const ay = RangeBase.npcScaleFactor(this.low.y, this.high.y);
    if (ax === 0.0 || ay === 0.0)
      return undefined;
    return Point2d.create((point.x - this.low.x) * ax, (point.y - this.low.y) * ay, result);
  }
}
