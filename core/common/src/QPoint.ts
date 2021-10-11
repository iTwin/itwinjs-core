/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Geometry
 */

import { assert } from "@itwin/core-bentley";
import { Point2d, Point3d, Range2d, Range3d, Vector2d, Vector3d } from "@itwin/core-geometry";

/**
 * Provides facilities for quantizing floating point values within a specified range into 16-bit unsigned integers.
 * This is a lossy compression technique.
 * Given a floating point range [min, max], a floating point value `x` within that range is quantized by subtracting
 * `min`, scaling the result according to `max`, and truncating the result to an integer.
 * Therefore min quantizes to 0, max to 0xffff, (min+max)/2 to 0x7fff, and so on.
 * These routines are chiefly used by classes like [[QPoint2d]] and [[QPoint3d]] to reduce the space required to store
 * coordinate values for [RenderGraphic]($frontend)s.
 * @public
 */
export namespace Quantization {
  export const rangeScale16 = 0xffff;
  export const rangeScale8 = 0xff;

  /** Compute the scale factor required to quantize `extent` to `rangeScale` discrete values. */
  export function computeScale(extent: number, rangeScale = rangeScale16): number {
    return 0.0 === extent ? extent : rangeScale / extent;
  }

  /** @internal */
  export function isInRange(qpos: number, rangeScale = rangeScale16): boolean {
    return qpos >= 0.0 && qpos < rangeScale + 1.0;
  }

  /** Return `pos` quantized to the range [`origin`, `origin + rangeScale`].
   * @see [[Quantization.unquantize]] for the inverse operation.
   */
  export function quantize(pos: number, origin: number, scale: number, rangeScale = rangeScale16): number {
    return Math.floor(Math.max(0.0, Math.min(rangeScale, 0.5 + (pos - origin) * scale)));
  }

  /** @internal */
  export function isQuantizable(pos: number, origin: number, scale: number, rangeScale = rangeScale16) {
    return isInRange(quantize(pos, origin, scale, rangeScale));
  }

  /** Give `qpos` quantized to the range [`origin`, `origin + rangeScale`], return the unquantized value.
   * @see [[Quantization.quantize]] for the inverse operation.
   */
  export function unquantize(qpos: number, origin: number, scale: number): number {
    return 0.0 === scale ? origin : origin + qpos / scale;
  }

  /** @internal */
  export function isQuantized(qpos: number) {
    return isInRange(qpos) && qpos === Math.floor(qpos);
  }
}

/** Parameters used for [[Quantization]] of 2d points such that the `x` and `y` components are each quantized to 16-bit unsigned integers.
 * @see [[QPoint2d]] for the quantized representation of a [Point2d]($core-geometry).
 * @see [[QPoint2dList]] for a list of [[QPoint2d]]s quantized using a [[QParams2d]].
 * @public
 */
export class QParams2d {
  /** The origin of the quantization range. */
  public readonly origin = new Point2d();
  /** The scale applied to coordinates to quantize them. */
  public readonly scale = new Point2d();

  private constructor(ox = 0, oy = 0, sx = 0, sy = 0) { this.setFrom(ox, oy, sx, sy); }

  private setFrom(ox: number, oy: number, sx: number, sy: number) {
    this.origin.x = ox;
    this.origin.y = oy;
    this.scale.x = sx;
    this.scale.y = sy;
  }

  /** Set [[origin]] and [[scale]] from `src`. */
  public copyFrom(src: QParams2d): void {
    this.setFrom(src.origin.x, src.origin.y, src.scale.x, src.scale.y);
  }

  /** Create a copy of these params.
   * @param out If supplied, these QParams2d will be modified and returned; otherwise a new QParams2d object will be created and returned.
   */
  public clone(out?: QParams2d): QParams2d {
    const result = undefined !== out ? out : new QParams2d();
    result.copyFrom(this);
    return result;
  }

  /** Initialize these parameters to support quantization of values within the specified range. */
  public setFromRange(range: Range2d, rangeScale = Quantization.rangeScale16) {
    if (!range.isNull) {
      this.setFrom(range.low.x, range.low.y, Quantization.computeScale(range.high.x - range.low.x, rangeScale), Quantization.computeScale(range.high.y - range.low.y, rangeScale));
    } else {
      this.origin.x = this.origin.y = this.scale.x = this.scale.y = 0;
    }
  }

  /** Create parameters to support quantization of values within the specified range. */
  public static fromRange(range: Range2d, out?: QParams2d, rangeScale = Quantization.rangeScale16) {
    const params = undefined !== out ? out : new QParams2d();
    params.setFromRange(range, rangeScale);
    return params;
  }

  /** Return the unquantized point for the input `x` and `y` components. If `out` is supplied, it will be modified to hold the result and returned. */
  public unquantize(x: number, y: number, out?: Point2d): Point2d {
    out = out ?? new Point2d();
    out.x = Quantization.unquantize(x, this.origin.x, this.scale.x);
    out.y = Quantization.unquantize(y, this.origin.y, this.scale.y);
    return out;
  }

  /** Creates parameters supporting quantization of values within the range [-1.0, 1.0], appropriate for normalized 2d vectors. */
  public static fromNormalizedRange(rangeScale = Quantization.rangeScale16) {
    return QParams2d.fromRange(Range2d.createArray([Point2d.create(-1, -1), Point2d.create(1, 1)]), undefined, rangeScale);
  }

  /** Create parameters supporting quantization of values within the range [0.0, 1.0]. */
  public static fromZeroToOne(rangeScale = Quantization.rangeScale16) {
    return QParams2d.fromRange(Range2d.createArray([Point2d.create(0, 0), Point2d.create(1, 1)]), undefined, rangeScale);
  }

  /** Create parameters from origin and scale components */
  public static fromOriginAndScale(originX: number, originY: number, scaleX: number, scaleY: number) {
    return new QParams2d(originX, originY, scaleX, scaleY);
  }

  /** @internal */
  public get rangeDiagonal(): Vector2d {
    return Vector2d.createFrom({ x: 0 === this.scale.x ? 0 : Quantization.rangeScale16 / this.scale.x, y: 0 === this.scale.y ? 0 : Quantization.rangeScale16 / this.scale.y });
  }

  /** Return true if the point point is quantizable using these parameters. */
  public isQuantizable(point: Point2d) {
    return Quantization.isQuantizable(point.x, this.origin.x, this.scale.x) && Quantization.isQuantizable(point.y, this.origin.y, this.scale.y);
  }
}

/** Represents a [Point2d]($core-geometry) compressed such that each component `x` and `y` is quantized to the 16-bit integer range [0, 0xffff].
 * These are primarily used to reduce the space required for coordinates used by [RenderGraphic]($frontend)s.
 * @see [[QParams2d]] to define quantization parameters for a range of points.
 * @see [[QPoint2dList]] for a list of points all quantized to the same range.
 * @public
 */
export class QPoint2d {
  private _x: number = 0;
  private _y: number = 0;

  /** The quantized x component. */
  public get x() { return this._x; }
  public set x(x: number) {
    assert(Quantization.isQuantized(x));
    this._x = x;
  }

  /** The quantized y component. */
  public get y() { return this._y; }
  public set y(y: number) {
    assert(Quantization.isQuantized(y));
    this._y = y;
  }

  /** Construct with `x` and `y` initialized to zero. */
  public constructor() { }

  /** Initialize this point by quantizing the supplied Point2d using the specified params */
  public init(pos: Point2d, params: QParams2d) {
    this.x = Quantization.quantize(pos.x, params.origin.x, params.scale.x);
    this.y = Quantization.quantize(pos.y, params.origin.y, params.scale.y);
  }

  /** Create a quantized point from the supplied Point2d using the specified params */
  public static create(pos: Point2d, params: QParams2d) {
    const qpt = new QPoint2d();
    qpt.init(pos, params);
    return qpt;
  }

  /** Initialize `x` and `y` from `src`. */
  public copyFrom(src: QPoint2d) {
    this.x = src.x;
    this.y = src.y;
  }

  /** Create a copy of this point.
   * @param out If supplied, it will be modified in-place and returned; otherwise a new QPoint2d will be allocated and returned.
   */
  public clone(out?: QPoint2d) {
    const result = undefined !== out ? out : new QPoint2d();
    result.copyFrom(this);
    return result;
  }

  /**
   * Set the x and y components directly.
   * @param x Must be an integer in the range [0, 0xffff]
   * @param y Must be an integer in the range [0, 0xffff]
   */
  public setFromScalars(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  /**
   * Create a QPoint2d directly from x and y components.
   * @param x Must be an integer in the range [0, 0xffff]
   * @param y Must be an integer in the range [0, 0xffff]
   */
  public static fromScalars(x: number, y: number) {
    const pt = new QPoint2d();
    pt.setFromScalars(x, y);
    return pt;
  }

  /** Return a Point2d unquantized according to the supplied `params`. If `out` is supplied, it will be modified in-place and returned. */
  public unquantize(params: QParams2d, out?: Point2d): Point2d {
    const pt: Point2d = undefined !== out ? out : new Point2d();
    pt.x = Quantization.unquantize(this.x, params.origin.x, params.scale.x);
    pt.y = Quantization.unquantize(this.y, params.origin.y, params.scale.y);
    return pt;
  }
}

/** A list of [[QPoint2d]]s all quantized to the same range.
 * @public
 */
export class QPoint2dList {
  /** Parameters used to quantize the points. */
  public readonly params: QParams2d;
  private readonly _list = new Array<QPoint2d>();

  /** The list of quantized points. */
  public get list(): ReadonlyArray<QPoint2d> {
    return this._list;
  }

  /** Construct an empty list set up to use the supplied quantization parameters. */
  public constructor(params: QParams2d) {
    this.params = params.clone();
  }

  /** Removes all points from the list. */
  public clear() {
    this._list.length = 0;
  }

  /** Removes all points from the list and change the quantization parameters. */
  public reset(params: QParams2d) {
    this.clear();
    this.params.copyFrom(params);
  }

  /** Quantizes the supplied Point2d to this list's range and appends it to the list. */
  public add(pt: Point2d) {
    this._list.push(QPoint2d.create(pt, this.params));
  }

  /** Adds a previously-quantized point to this list. */
  public push(qpt: QPoint2d) {
    this._list.push(qpt.clone());
  }

  /** The number of points in the list. */
  public get length() {
    return this._list.length;
  }

  /** Returns the unquantized value of the point at the specified index in the list. */
  public unquantize(index: number, out?: Point2d): Point2d {
    assert(index < this.length);
    if (index < this.length) {
      return this._list[index].unquantize(this.params, out);
    } else {
      return undefined !== out ? out : new Point2d();
    }
  }

  /** Changes the quantization parameters and requantizes all points in the list to the new range.
   * @note The loss of precision is compounded each time the points are requantized to a new range.
   */
  public requantize(params: QParams2d) {
    for (let i = 0; i < this.length; i++) {
      const pt = this.unquantize(i);
      this._list[i].init(pt, params);
    }

    this.params.copyFrom(params);
  }

  /** Extracts the current contents of the list as a Uint16Array such that the first element of the array corresponds to the first point's `x` component,
   * the second to the first point's `y` component, and so on.
   */
  public toTypedArray(): Uint16Array {
    const array = new Uint16Array(this.length * 2);
    const pts = this._list;
    for (let i = 0; i < this.length; i++) {
      const pt = pts[i];
      array[i * 2] = pt.x;
      array[i * 2 + 1] = pt.y;
    }

    return array;
  }

  /**  Create from a Uint16Array laid out such that `array[0]` corresponds to the first point's `x` component, `array[1]` to the first point's `y` component, and so on. */
  public fromTypedArray(range: Range2d, array: Uint16Array) {
    this.params.setFromRange(range);
    this._list.length = array.length / 2;
    for (let i = 0, j = 0; i < this.list.length; i++)
      this._list[i] = QPoint2d.fromScalars(array[j++], array[j++]);
  }

  /** Construct a QPoint2dList containing all points in the supplied list, quantized to the range of those points. */
  public static fromPoints(points: Point2d[], out?: QPoint2dList) {
    let qPoints;
    const qParams = QParams2d.fromRange(Range2d.createArray(points));
    if (out) {
      qPoints = out;
      qPoints.reset(qParams);
    } else qPoints = new QPoint2dList(qParams);
    for (const point of points)
      qPoints.add(point);

    return qPoints;
  }
}

/** Parameters used for [[Quantization]] of 3d points such that the `x`, `y`, and `z` components are each quantized to 16-bit unsigned integers.
 * @see [[QPoint3d]] for the quantized representation of a [Point3d]($core-geometry).
 * @see [[QPoint3dList]] for a list of [[QPoint3d]]s quantized using a [[QParams3d]].
 * @public
 */
export class QParams3d {
  /** The origin of the quantization range. */
  public readonly origin = new Point3d();
  /** The scale applied to coordinates to quantize them. */
  public readonly scale = new Point3d();

  private constructor(ox = 0, oy = 0, oz = 0, sx = 0, sy = 0, sz = 0) {
    this.setFrom(ox, oy, oz, sx, sy, sz);
  }

  private setFrom(ox: number, oy: number, oz: number, sx: number, sy: number, sz: number) {
    this.origin.x = ox;
    this.origin.y = oy;
    this.origin.z = oz;
    this.scale.x = sx;
    this.scale.y = sy;
    this.scale.z = sz;
  }

  /** Set `x`, `y`, and `z` from `src. */
  public copyFrom(src: QParams3d): void {
    this.setFrom(src.origin.x, src.origin.y, src.origin.z, src.scale.x, src.scale.y, src.scale.z);
  }

  /** Create a copy of these parameters.
   * @param out If supplied, it will be modified in-place and returned instead of allocating a new QParams3d.
   */
  public clone(out?: QParams3d): QParams3d {
    const result = undefined !== out ? out : new QParams3d();
    result.copyFrom(this);
    return result;
  }

  /** Initialize from origin and scale */
  public setFromOriginAndScale(origin: Point3d, scale: Point3d) {
    this.setFrom(origin.x, origin.y, origin.z, scale.x, scale.y, scale.z);
  }

  /** Initialize these parameters to support quantization of values within the specified range. */
  public setFromRange(range: Range3d, rangeScale = Quantization.rangeScale16) {
    if (!range.isNull) {
      this.setFrom(range.low.x, range.low.y, range.low.z,
        Quantization.computeScale(range.high.x - range.low.x, rangeScale), Quantization.computeScale(range.high.y - range.low.y, rangeScale), Quantization.computeScale(range.high.z - range.low.z, rangeScale));
    } else {
      this.origin.x = this.origin.y = this.origin.z = 0;
      this.scale.x = this.scale.y = this.scale.z = 0;
    }
  }

  /** Return the unquantized point for the input components.
   * @param out If supplied, it will be modified in-place and returned instead of allocating a new Point3d.
   */
  public unquantize(x: number, y: number, z: number, out?: Point3d): Point3d {
    const pt: Point3d = undefined !== out ? out : new Point3d();
    pt.x = Quantization.unquantize(x, this.origin.x, this.scale.x);
    pt.y = Quantization.unquantize(y, this.origin.y, this.scale.y);
    pt.z = Quantization.unquantize(z, this.origin.z, this.scale.z);
    return pt;
  }

  /** Creates parameters to support quantization of values within the specified range.
   * If `out` is supplied, it will be modified in-place and returned instead of allocating a new QParams3d.
   */
  public static fromRange(range: Range3d, out?: QParams3d, rangeScale = Quantization.rangeScale16): QParams3d {
    const params = undefined !== out ? out : new QParams3d();
    params.setFromRange(range, rangeScale);
    return params;
  }

  /** Creates parameters supporting quantization of values within the range [-1.0, 1.0].
   * If `out` is supplied, it will be modified in-place and returned instead of allocating a new QParams3d.
   */
  public static fromOriginAndScale(origin: Point3d, scale: Point3d, out?: QParams3d): QParams3d {
    const params = undefined !== out ? out : new QParams3d();
    params.setFromOriginAndScale(origin, scale);
    return params;
  }

  /** Creates parameters supporting quantization of values within the range [-1.0, 1.0]. */
  public static fromNormalizedRange(rangeScale = Quantization.rangeScale16) {
    return QParams3d.fromRange(Range3d.createArray([Point3d.create(-1, -1, -1), Point3d.create(1, 1, 1)]), undefined, rangeScale);
  }

  /** Creates parameters supporting quantization of values within the range [0.0, 1.0]. */
  public static fromZeroToOne(rangeScale = Quantization.rangeScale16) {
    return QParams3d.fromRange(Range3d.createArray([Point3d.create(0, 0, 0), Point3d.create(1, 1, 1)]), undefined, rangeScale);
  }

  /** @internal */
  public get rangeDiagonal(): Vector3d {
    return Vector3d.createFrom({
      x: this.scale.x === 0 ? 0 : Quantization.rangeScale16 / this.scale.x,
      y: this.scale.y === 0 ? 0 : Quantization.rangeScale16 / this.scale.y,
      z: this.scale.z === 0 ? 0 : Quantization.rangeScale16 / this.scale.z,
    });
  }

  /** Return true if the point point is quantizable using these parameters. */
  public isQuantizable(point: Point3d) {
    return Quantization.isQuantizable(point.x, this.origin.x, this.scale.x) && Quantization.isQuantizable(point.y, this.origin.y, this.scale.y) && Quantization.isQuantizable(point.z, this.origin.z, this.scale.z);
  }

  /** Compute the range to which these parameters quantize. */
  public computeRange(out?: Range3d): Range3d {
    const range = Range3d.createNull(out);
    range.extendPoint(this.origin);
    range.extendPoint(this.origin.plus(this.rangeDiagonal));
    return range;
  }
}

/** Represents a [Point3d]($core-geometry) compressed such that each component `x`, `y`, and `z` is quantized to the 16-bit integer range [0, 0xffff].
 * These are primarily used to reduce the space required for coordinates used by [RenderGraphic]($frontend)s.
 * @see [[QParams3d]] to define quantization parameters for a range of points.
 * @see [[QPoint3dList]] for a list of points all quantized to the same range.
 * @public
 */
export class QPoint3d {
  private _x: number = 0;
  private _y: number = 0;
  private _z: number = 0;

  /** The quantized x component. */
  public get x() { return this._x; }
  public set x(x: number) {
    assert(Quantization.isQuantized(x));
    this._x = x;
  }

  /** The quantized y component. */
  public get y() { return this._y; }
  public set y(y: number) {
    assert(Quantization.isQuantized(y));
    this._y = y;
  }

  /** The quantized z component. */
  public get z() { return this._z; }
  public set z(z: number) {
    assert(Quantization.isQuantized(z));
    this._z = z;
  }

  /** Construct with all components initialized to zero. */
  public constructor() { }

  /** Initialize this point by quantizing the supplied Point3d using the specified params */
  public init(pos: Point3d, params: QParams3d): void {
    this.x = Quantization.quantize(pos.x, params.origin.x, params.scale.x);
    this.y = Quantization.quantize(pos.y, params.origin.y, params.scale.y);
    this.z = Quantization.quantize(pos.z, params.origin.z, params.scale.z);
  }

  /** Creates a quantized point from the supplied Point3d using the specified params */
  public static create(pos: Point3d, params: QParams3d): QPoint3d {
    const qpt = new QPoint3d();
    qpt.init(pos, params);
    return qpt;
  }

  /** Set this points components from `src`. */
  public copyFrom(src: QPoint3d): void {
    this.x = src.x;
    this.y = src.y;
    this.z = src.z;
  }

  /** Create a copy of this point.
   * @param out If supplied, it will be modified in-place instead of allocating a new QPoint3d.
   */
  public clone(out?: QPoint3d): QPoint3d {
    const result = undefined !== out ? out : new QPoint3d();
    result.copyFrom(this);
    return result;
  }

  /**
   * Sets the x, y, and z components directly.
   * @param x Must be an integer in the range [0, 0xffff]
   * @param y Must be an integer in the range [0, 0xffff]
   * @param z Must be an integer in the range [0, 0xffff]
   */
  public setFromScalars(x: number, y: number, z: number) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  /**
   * Creates a QPoint3d directly from x, y, and z components.
   * @param x Must be an integer in the range [0, 0xffff]
   * @param y Must be an integer in the range [0, 0xffff]
   * @param z Must be an integer in the range [0, 0xffff]
   * @param out If supplied, it will be modified in-place instead of allocating a new QPoint3d.
   */
  public static fromScalars(x: number, y: number, z: number, out?: QPoint3d): QPoint3d {
    const pt = undefined === out ? new QPoint3d() : out;
    pt.setFromScalars(x, y, z);
    return pt;
  }

  /** Returns a Point3d unquantized according to the supplied params.
   * If `out` is supplied, it will be modified in-place instead of allocating a new Point3d.
   */
  public unquantize(params: QParams3d, out?: Point3d): Point3d {
    const pt: Point3d = undefined !== out ? out : new Point3d();
    pt.x = Quantization.unquantize(this.x, params.origin.x, params.scale.x);
    pt.y = Quantization.unquantize(this.y, params.origin.y, params.scale.y);
    pt.z = Quantization.unquantize(this.z, params.origin.z, params.scale.z);
    return pt;
  }

  /** Return true if this point's components are identical to the other point's components. */
  public equals(other: QPoint3d): boolean {
    return this.x === other.x && this.y === other.y && this.z === other.z;
  }

  /** Perform ordinal comparison to another point. The function returns:
   *  - Zero if this point is identical to `rhs`; or
   *  - A number less than zero if this point is ordered before `rhs`; or
   *  - A number greater than zero if this point is ordered after `rhs`.
   * @see [OrderedComparator]($core-bentley).
   */
  public compare(rhs: QPoint3d): number {
    let diff = this.x - rhs.x;
    if (0 === diff) {
      diff = this.y - rhs.y;
      if (0 === diff) {
        diff = this.z - rhs.z;
      }
    }

    return diff;
  }
}

/** A list of [[QPoint3d]]s all quantized to the same range.
 * @public
 */
export class QPoint3dList {
  /** Parameters used to quantize the points. */
  public readonly params: QParams3d;
  private readonly _list: QPoint3d[] = [];

  /** The list of quantized points. */
  public get list(): ReadonlyArray<QPoint3d> {
    return this._list;
  }

  /** Construct an empty list set up to quantize to the supplied range.
   * @param The quantization parameters. If omitted, a null range will be used.
   */
  public constructor(params?: QParams3d) {
    this.params = params ? params.clone() : QParams3d.fromRange(Range3d.createNull());
  }

  /** Construct a QPoint3dList containing all points in the supplied list, quantized to the range of those points.
   * @param The points to quantize and add to the list.
   * @param out If supplied, it will be cleared, its parameters recomputed, and the points will be added to it; otherwise, a new QPoint3dList will be created and returned.
   */
  public static fromPoints(points: Point3d[], out?: QPoint3dList): QPoint3dList {
    let qPoints;
    const qParams = QParams3d.fromRange(Range3d.createArray(points));
    if (out) {
      qPoints = out;
      qPoints.reset(qParams);
    } else {
      qPoints = new QPoint3dList(qParams);
    }

    for (const point of points)
      qPoints.add(point);

    return qPoints;
  }

  /** Removes all points from the list. */
  public clear() {
    this._list.length = 0;
  }

  /** Clears out the contents of the list and changes the quantization parameters. */
  public reset(params: QParams3d) {
    this.clear();
    this.params.copyFrom(params);
  }

  /** Quantizes the supplied Point3d to this list's range and appends it to the list. */
  public add(pt: Point3d) {
    this._list.push(QPoint3d.create(pt, this.params));
  }

  /** Adds a previously-quantized point to this list. */
  public push(qpt: QPoint3d) {
    this._list.push(qpt.clone());
  }

  /** The number of points in the list. */
  public get length() {
    return this._list.length;
  }

  /** Returns the unquantized value of the point at the specified index in the list. */
  public unquantize(index: number, out?: Point3d): Point3d {
    assert(index < this.length);
    if (index < this.length) {
      return this._list[index].unquantize(this.params, out);
    } else {
      return undefined !== out ? out : new Point3d();
    }
  }

  /** Changes the quantization parameters and requantizes all points in the list to the new range.
   * @note The loss of precision is compounded each time the points are requantized to a new range.
   */
  public requantize(params: QParams3d): void {
    for (let i = 0; i < this.length; i++) {
      const pt = this.unquantize(i);
      this._list[i].init(pt, params);
    }

    this.params.copyFrom(params);
  }

  /** Extracts the current contents of the list as a Uint16Array such that the first 3 elements contain the first point's x, y, and z components,
   * the second three elements contain the second point's components, and so on.
   */
  public toTypedArray(): Uint16Array {
    const array = new Uint16Array(this.length * 3);
    const pts = this._list;
    for (let i = 0; i < this.length; i++) {
      const pt = pts[i];
      array[i * 3 + 0] = pt.x;
      array[i * 3 + 1] = pt.y;
      array[i * 3 + 2] = pt.z;
    }

    return array;
  }

  /** Reinitialize from a Uint16Array in which the first three elements specify the x, y, and z components of the first point, the second three elements specify the components
   * of the second point, and so on.
   */
  public fromTypedArray(range: Range3d, array: Uint16Array): void {
    this.params.setFromRange(range);
    this._list.length = array.length / 3;
    for (let i = 0, j = 0; i < this.list.length; i++)
      this._list[i] = QPoint3d.fromScalars(array[j++], array[j++], array[j++]);
  }

  /** Construct a list containing all points in the supplied list, quantized using the supplied parameters. */
  public static createFrom(points: Point3d[], params: QParams3d): QPoint3dList {
    const list = new QPoint3dList(params);
    for (const point of points)
      list.add(point);

    return list;
  }

  /** An iterator over the points in the list. */
  public [Symbol.iterator]() {
    return this.list[Symbol.iterator]();
  }
}
