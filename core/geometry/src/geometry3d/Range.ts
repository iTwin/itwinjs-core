/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

/** @module CartesianGeometry */

import { Geometry, BeJSONFunctions } from "../Geometry";
import { Point2d, Vector2d } from "./Point2dVector2d";
import { Point3d, Vector3d } from "./Point3dVector3d";
import { Transform } from "./Transform";
import { Matrix3d } from "./Matrix3d";
import { Range1dProps, Range2dProps, Range3dProps } from "./XYZProps";
import { LowAndHighXYZ, LowAndHighXY } from "./XYZProps";
import { XAndY, XYAndZ } from "./XYZProps";
import { GrowableXYZArray } from "./GrowableArray";

export abstract class RangeBase {
  protected static readonly _EXTREME_POSITIVE: number = 1.0e200;
  protected static readonly _EXTREME_NEGATIVE: number = -1.0e200;
  /** @return 0 if high<= low, otherwise `1/(high-low)` for use in fractionalizing */
  protected static npcScaleFactor(low: number, high: number): number { return (high <= low) ? 0.0 : 1.0 / (high - low); }
  public static isExtremeValue(x: number): boolean { return Math.abs(x) >= RangeBase._EXTREME_POSITIVE; }
  public static isExtremePoint3d(xyz: Point3d) { return RangeBase.isExtremeValue(xyz.x) || RangeBase.isExtremeValue(xyz.y) || RangeBase.isExtremeValue(xyz.z); }
  public static isExtremePoint2d(xy: Point2d) { return RangeBase.isExtremeValue(xy.x) || RangeBase.isExtremeValue(xy.y); }
  /**
   * * Both low,high pairs have order expectations:  The condition `high > low` means null interval.
   * * If there is interval overlap, the distance is zero.
   * @returns The min absolute distance from any point of `[lowA,highA]' to any point of `[lowB,highB]'.
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

  public static coordinateToRangeAbsoluteDistance(x: number, low: number, high: number): number {
    if (high < low)
      return RangeBase._EXTREME_POSITIVE;
    if (x < low)
      return low - x;
    if (x > high)
      return x - high;
    return 0.0;
  }

  /**
   * move low and high points by scaleFactor around the center point.
   * @param scaleFactor scale factor applied to low, high distance from center.
   */
  public abstract scaleAboutCenterInPlace(scaleFactor: number): void;

  /**
   * move all limits by a fixed amount.
   * * positive delta expands the range size
   * * negative delta reduces the range size
   * * if any dimension reduces below zero size, the whole range becomes null
   * @param delta shift to apply.
   */
  public abstract expandInPlace(delta: number): void;
}

export class Range3d extends RangeBase implements LowAndHighXYZ, BeJSONFunctions {
  // low and high are always non-null objects
  // any direction of low.q > high.q is considered a null range.
  // private ctor and setXYZXYZ_direct set the low and high explicitly (without further tests of low.q.<= high.q)
  public low: Point3d;
  public high: Point3d;
  /** Set this transform to values that indicate it has no contents. */
  public setNull() {
    this.low.x = RangeBase._EXTREME_POSITIVE;
    this.low.y = RangeBase._EXTREME_POSITIVE;
    this.low.z = RangeBase._EXTREME_POSITIVE;
    this.high.x = RangeBase._EXTREME_NEGATIVE;
    this.high.y = RangeBase._EXTREME_NEGATIVE;
    this.high.z = RangeBase._EXTREME_NEGATIVE;
  }

  public freeze() { Object.freeze(this); Object.freeze(this.low); Object.freeze(this.high); }
  public static toFloat64Array(val: LowAndHighXYZ): Float64Array { return Float64Array.of(val.low.x, val.low.y, val.low.z, val.high.x, val.high.y, val.high.z); }
  public toFloat64Array(): Float64Array { return Range3d.toFloat64Array(this); }
  /**
   * Construct a Range3d from an array of double-precision values
   * @param f64 the array, which should contain exactly 6 values in this order: lowx, lowy, lowz, highx, highy, highz
   * @return a new Range3d object
   */
  public static fromFloat64Array(f64: Float64Array) {
    if (f64.length !== 6)
      throw new Error("invalid array");
    return new Range3d(f64[0], f64[1], f64[2], f64[3], f64[4], f64[5]);
  }
  /**
   * Construct a Range3d from an un-typed array. This mostly useful when interpreting ECSQL query results of the 'blob' type, where you know that that result is a Range3d.
   * @param buffer untyped array
   * @return a new Range3d object
   */
  public static fromArrayBuffer(buffer: ArrayBuffer) { return this.fromFloat64Array(new Float64Array(buffer)); }

  // explicit ctor - no enforcement of value relationships
  public constructor(lowx: number = RangeBase._EXTREME_POSITIVE, lowy: number = RangeBase._EXTREME_POSITIVE, lowz: number = RangeBase._EXTREME_POSITIVE,
    highx: number = RangeBase._EXTREME_NEGATIVE, highy: number = RangeBase._EXTREME_NEGATIVE, highz: number = RangeBase._EXTREME_NEGATIVE) {
    super();
    this.low = Point3d.create(lowx, lowy, lowz);
    this.high = Point3d.create(highx, highy, highz);
  }

  /** Returns true if this and other have equal low and high point x,y,z parts */
  public isAlmostEqual(other: Range3d): boolean {
    return (this.low.isAlmostEqual(other.low) && this.high.isAlmostEqual(other.high))
      || (this.isNull && other.isNull);
  }
  /** copy low and high values from other. */
  public setFrom(other: Range3d) { this.low.setFrom(other.low); this.high.setFrom(other.high); }

  public static createFrom(other: Range3d, result?: Range3d): Range3d {
    if (result) { result.setFrom(other); return result; }
    return Range3d.createXYZXYZOrCorrectToNull(other.low.x, other.low.y, other.low.z,
      other.high.x, other.high.y, other.high.z, result);
  }

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
  /** Return a JSON object */
  public toJSON(): Range3dProps { return { low: this.low.toJSON(), high: this.high.toJSON() }; }

  public static fromJSON(json?: Range3dProps): Range3d {
    const result = new Range3d();
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

  public clone(result?: Range3d) {
    result = result ? result : new Range3d();
    result.setDirect(this.low.x, this.low.y, this.low.z, this.high.x, this.high.y, this.high.z, false);
    return result;
  }
  /** Return a range initialized to have no content. */
  public static createNull(result?: Range3d): Range3d {
    result = result ? result : new Range3d();
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
  /** create a Range3d enclosing the transformed points. */
  public static createTransformed(transform: Transform, ...point: Point3d[]): Range3d {
    const result = Range3d.createNull();
    let p;
    for (p of point)
      result.extendTransformedXYZ(transform, p.x, p.y, p.z);
    return result;
  }
  /** create a Range3d enclosing the transformed points. */
  public static createTransformedArray(transform: Transform, points: Point3d[]): Range3d {
    const result = Range3d.createNull();
    result.extendArray(points, transform);
    return result;
  }

  /** create a Range3d enclosing the points after inverse transform. */
  public static createInverseTransformedArray(transform: Transform, points: Point3d[]): Range3d {
    const result = Range3d.createNull();
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
  public static createXYZ(x: number, y: number, z: number, result?: Range3d): Range3d {
    result = result ? result : new Range3d();
    result.setDirect(x, y, z, x, y, z, false);
    return result;
  }

  /** Create a box with 2 pairs of xyz candidates. Theses are compared and shuffled as needed for the box. */
  public static createXYZXYZ(xA: number, yA: number, zA: number, xB: number, yB: number, zB: number, result?: Range3d): Range3d {
    result = result ? result : new Range3d();
    result.setDirect(
      Math.min(xA, xB), Math.min(yA, yB), Math.min(zA, zB),
      Math.max(xA, xB), Math.max(yA, yB), Math.max(zA, zB), false);
    return result;
  }

  /** Create a box with 2 pairs of xyz candidates. If any direction has order flip, create null. */
  public static createXYZXYZOrCorrectToNull(xA: number, yA: number, zA: number, xB: number, yB: number, zB: number, result?: Range3d): Range3d {
    result = result ? result : new Range3d();
    result.setDirect(
      Math.min(xA, xB), Math.min(yA, yB), Math.min(zA, zB),
      Math.max(xA, xB), Math.max(yA, yB), Math.max(zA, zB), true);
    return result;
  }

  /** Creates a 3d range from a 2d range's low and high members, setting the corresponding z values to the value given. */
  public static createRange2d(range: Range2d, z: number = 0, result?: Range3d): Range3d {
    const retVal = result ? result : new Range3d();
    retVal.setNull();

    retVal.extendXYZ(range.low.x, range.low.y, z);
    retVal.extendXYZ(range.high.x, range.high.y, z);
    return retVal;
  }

  /** Create a range around an array of points. */
  public static createArray(points: Point3d[], result?: Range3d): Range3d {
    result = result ? result : new Range3d();
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
          this.extendTransformedXYZ(transform, points.getPoint3dAt(i).x, points.getPoint3dAt(i).y, points.getPoint3dAt(i).z);
      else
        for (let i = 0; i < points.length; i++)
          this.extendXYZ(points.getPoint3dAt(i).x, points.getPoint3dAt(i).y, points.getPoint3dAt(i).z);
  }

  /** extend a range around an array of points (optionally transformed) */
  public extendInverseTransformedArray(points: Point3d[] | GrowableXYZArray, transform: Transform) {
    if (Array.isArray(points))
      for (const point of points)
        this.extendInverseTransformedXYZ(transform, point.x, point.y, point.z);
    else  // growable array -- this should be implemented without point extraction !!!
      for (let i = 0; i < points.length; i++)
        this.extendInverseTransformedXYZ(transform, points.getPoint3dAt(i).x, points.getPoint3dAt(i).y, points.getPoint3dAt(i).z);
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
      coffs[0] * xx + coffs[3] * yy + coffs[6] * zz,
      coffs[1] * xx + coffs[4] * yy + coffs[7] * zz,
      coffs[2] * xx + coffs[5] * yy + coffs[8] * zz);
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
  public fractionToPoint(fractionX: number, fractionY: number, fractionZ: number, result?: Point3d): Point3d {
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

  /** Return an array with the 8 corners on order wth "x varies fastest, then y, then z" */
  public corners(): Point3d[] {
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

  /** Expand this range by distances a (weighted and possibly signed) in all directions */
  public extendXYZW(x: number, y: number, z: number, w: number): void {
    if (!Geometry.isSmallMetricDistance(w))
      this.extendXYZ(x / w, y / w, z / w);
  }
  /** Expand this range to include a point. */
  public extendPoint(point: Point3d): void { this.extendXYZ(point.x, point.y, point.z); }

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
      return this.clone(result);
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
}
export class Range1d extends RangeBase {

  // low and high are always non-null objects
  // low > high is considered a null range.
  public low: number;
  public high: number;

  public setNull() {
    this.low = RangeBase._EXTREME_POSITIVE;
    this.high = RangeBase._EXTREME_NEGATIVE;
  }
  // internal use only -- directly set all coordinates, test only if directed.
  private setDirect(low: number, high: number, correctToNull: boolean) {
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
    this.set_direct(low, high);
  }
  /** Returns true if this and other have equal low and high parts */
  public isAlmostEqual(other: Range1d): boolean {
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
        const v = value;
        if (v)
          this.extendX(v);
      }
    } else if (json.low && json.low && json.high && json.high) {
      this.setNull();
      this.extendX(json.low);
      this.extendX(json.high);
    }
  }
  public static fromJSON(json?: Range1dProps): Range1d {
    const result = new Range1d();
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

  // internal use only -- directly set both lwo and high coordinates, without tests.
  private set_direct(low: number, high: number) {
    this.low = low; this.high = high;
  }
  /** return a new Range1d with contents of this.
   * @param result optional result.
   */
  public clone(result?: Range1d) {
    result = result ? result : new Range1d();
    result.set_direct(this.low, this.high);
    return result;
  }

  /** return a new Range1d with contents of this.
   * @param result optional result.
   */
  public static createFrom(other: Range1d, result?: Range1d) {
    result = result ? result : new Range1d();
    result.set_direct(other.low, other.high);
    return result;
  }

  /** Create a range with no content.
   * @param result optional result.
   */
  public static createNull(result?: Range1d): Range1d {
    result = result ? result : new Range1d();
    result.setNull();
    return result;
  }

  /**
   * Set this range to be a single value.
   * @param x value to use as both low and high.
   */
  public setX(x: number) { this.low = this.high = x; }

  /** Create a single point box */
  public static createX(x: number, result?: Range1d): Range1d {
    result = result ? result : new Range1d();
    result.set_direct(x, x);
    return result;
  }

  /** Create a box from two values. Values are reversed if needed
   * @param xA first value
   * @param xB second value
   */
  public static createXX(xA: number, xB: number, result?: Range1d): Range1d {
    result = result ? result : new Range1d();
    result.set_direct(
      Math.min(xA, xB),
      Math.max(xA, xB));
    return result;
  }

  /** Create a box from two values, but null range if the values are reversed
   * @param xA first value
   * @param xB second value
   */
  public static createXXOrCorrectToNull(xA: number, xB: number, result?: Range1d): Range1d {
    if (xB < xA)
      return Range1d.createNull(result);

    result = result ? result : new Range1d();
    result.set_direct(
      Math.min(xA, xB),
      Math.max(xA, xB));
    return result;
  }

  /** Create a range containing all the values in an array.
   * @param points array of points to be contained in the range.
   * @param result optional result.
   */
  public static createArray(points: number[], result?: Range1d): Range1d {
    result = result ? result : new Range1d();
    let x;
    for (x of points)
      result.extendX(x);
    return result;
  }
  /** extend to include an array of values */
  public extendArray(points: number[]) {
    let x;
    for (x of points)
      this.extendX(x);
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
}

export class Range2d extends RangeBase implements LowAndHighXY {
  // low and high are always non-null objects
  // any direction of low.q > high.q is considered a null range.
  public low: Point2d;
  public high: Point2d;

  public setNull() {
    this.low.x = RangeBase._EXTREME_POSITIVE;
    this.low.y = RangeBase._EXTREME_POSITIVE;
    this.high.x = RangeBase._EXTREME_NEGATIVE;
    this.high.y = RangeBase._EXTREME_NEGATIVE;
  }
  public static toFloat64Array(val: LowAndHighXY): Float64Array { return Float64Array.of(val.low.x, val.low.y, val.high.x, val.high.y); }
  public toFloat64Array(): Float64Array { return Range2d.toFloat64Array(this); }
  /**
   * Construct a Range2d from an array of double-precision values
   * @param f64 the array, which should contain exactly 4 values in this order: lowx, lowy, highx, highy
   * @return a new Range2d object
   */
  public static fromFloat64Array(f64: Float64Array) {
    if (f64.length !== 6)
      throw new Error("invalid array");
    return new Range3d(f64[0], f64[1], f64[2], f64[3], f64[4], f64[5]);
  }
  /**
   * Construct a Range2d from an un-typed array. This mostly useful when interpreting ECSQL query results of the 'blob' type, where you know that that result is a Range3d.
   * @param buffer untyped array
   * @return a new Range2d object
   */
  public static fromArrayBuffer(buffer: ArrayBuffer) { return this.fromFloat64Array(new Float64Array(buffer)); }

  // explicit ctor - no enforcement of value relationships
  public constructor(lowx = Range2d._EXTREME_POSITIVE, lowy = Range2d._EXTREME_POSITIVE, highx = Range2d._EXTREME_NEGATIVE, highy = Range2d._EXTREME_NEGATIVE) {
    super();
    this.low = Point2d.create(lowx, lowy);
    this.high = Point2d.create(highx, highy);
  }
  public isAlmostEqual(other: Range2d): boolean {
    return (this.low.isAlmostEqual(other.low) && this.high.isAlmostEqual(other.high))
      || (this.isNull && other.isNull);
  }

  public setFrom(other: LowAndHighXY) {
    this.low.set(other.low.x, other.low.y);
    this.high.set(other.high.x, other.high.y);
  }
  public static createFrom(other: LowAndHighXY, result?: Range2d): Range2d {
    if (result) { result.setFrom(other); return result; }
    return Range2d.createXYXYOrCorrectToNull(other.low.x, other.low.y, other.high.x, other.high.y, result);
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

  public freeze() { Object.freeze(this.low); Object.freeze(this.high); }
  public toJSON(): Range2dProps { return this.isNull ? [] : [this.low.toJSON(), this.high.toJSON()]; }

  public static fromJSON(json?: Range2dProps): Range2d {
    const result = new Range2d();
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
  public clone(result?: Range2d) {
    result = result ? result : new Range2d();
    result.setDirect(this.low.x, this.low.y, this.high.x, this.high.y, false);
    return result;
  }
  /** create a range with no content. */
  public static createNull(result?: Range2d): Range2d {
    result = result ? result : new Range2d();
    result.setNull();
    return result;
  }
  /** Set low and hight to a single xy value. */
  public setXY(x: number, y: number) {
    this.low.x = this.high.x = x;
    this.low.y = this.high.y = y;
  }

  /** Create a single point box */
  public static createXY(x: number, y: number, result?: Range2d): Range2d {
    result = result ? result : new Range2d();
    result.setDirect(x, y, x, y, false);
    return result;
  }

  /** Create a box with 2 pairs of xy candidates. Theses are compared and shuffled as needed for the box. */
  public static createXYXY(xA: number, yA: number, xB: number, yB: number, result?: Range2d): Range2d {
    result = result ? result : new Range2d();
    result.setDirect(
      Math.min(xA, xB), Math.min(yA, yB),
      Math.max(xA, xB), Math.max(yA, yB), false);
    return result;
  }
  /** Create a box with 2 pairs of xy candidates. If any direction has order flip, create null. */
  public static createXYXYOrCorrectToNull(xA: number, yA: number, xB: number, yB: number, result?: Range2d): Range2d {
    if (xA > xB || yA > yB)
      return Range2d.createNull(result);
    result = result ? result : new Range2d();
    result.setDirect(
      Math.min(xA, xB), Math.min(yA, yB),
      Math.max(xA, xB), Math.max(yA, yB), true);
    return result;
  }

  /** Create a range around an array of points. */
  public static createArray(points: Point2d[], result?: Range2d): Range2d {
    result = result ? result : new Range2d();
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

  /** Expand this range by distances a (possibly signed) in all directions */
  public extendXY(x: number, y: number): void {
    if (x < this.low.x) this.low.x = x;
    if (x > this.high.x) this.high.x = x;

    if (y < this.low.y) this.low.y = y;
    if (y > this.high.y) this.high.y = y;

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
      return this.clone(result);
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
}
