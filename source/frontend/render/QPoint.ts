/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Range1d, Range2d, Range3d } from "@bentley/geometry-core";
import { XY, XYZ, XYAndZ, Point3d, Point2d } from "@bentley/geometry-core";
import { Point, Range, PointUtil, RangeUtil } from "./Utility";
import { Cloneable } from "./Utility";

// declare constant in module scope to prevent having to write out ScalarQuantizer.rangeScale every time
const rangeScale = 0xffff;

// encapsulates the pos, origin, and scale for each dimension of the Point, can apply a quantization routine
export class QData {
  private _data: number[][];
  constructor(pos: Point, origin: Point, scale: Point) { this.init.apply(this, [pos, origin, scale].map(PointUtil.toNumberArray)); }
  private init(pos: number[], origin: number[], scale: number[]) {
    this._data = pos.map((v, i) => [v, origin[i], scale[i]]);
  }
  public apply(func: (...data: number[]) => number): Point { return PointUtil.fromNumberArray(this._data.map((d) => func(...d))); }
}

// common operations for quantization of scalars
export class ScalarQuantizer {
  public static readonly rangeScale = rangeScale;
  public static quantize(pos: number, origin: number, scale: number): number {
    return Math.max(0, Math.min(rangeScale, 0.5 + (pos - origin) * scale));
  }
  public static unquantize(pos: number, origin: number, scale: number): number {
    return scale === 0 ? origin : origin + pos / scale;
  }
  public static unquantizeAboutCenter(pos: number, origin: number, scale: number): number {
    return scale === 0 ? origin : (pos - 0x7fff) * (pos / scale);
  }
  public static computeScale(extent: number): number {
    return extent === 0 ? extent : rangeScale / extent;
  }
  public static unquantizeScale(origin: number, scale: number) {
    return origin + rangeScale * scale;
  }
  public static isInRange(quantizedPos: number) {
    return quantizedPos >= 0.0 && quantizedPos < rangeScale + 1.0; // rounding term of 0.5 added...double value floored when convert to uint16_t
  }
  public static isQuantizable(pos: number, origin: number, scale: number): boolean {
    return ScalarQuantizer.isInRange(ScalarQuantizer.quantize(pos, origin, scale));
  }
}

// common operations for quantization of points
export class Quantizer {
  // convert arguments points to array, quantize points and return results as a number array, then convert back to point
  public static quantize(pos: Point, origin: Point, scale: Point): Point {
    return new QData(pos, origin, scale).apply(ScalarQuantizer.quantize);
  }
  public static unquantize(pos: Point, origin: Point, scale: Point): Point {
    return new QData(pos, origin, scale).apply(ScalarQuantizer.unquantize);
  }
  public static unquantizeAboutCenter(pos: Point, origin: Point, scale: Point): Point {
    return new QData(pos, origin, scale).apply(ScalarQuantizer.unquantizeAboutCenter);
  }
  public static applyFromRange(pt: Point, range: Range | QParamsBase, func: (pos: Point, origin: Point, scale: Point) => Point): Point {
    // if params are a range object, then convert them to a QParams object
    const qparams = RangeUtil.isRange(range) ? QParamsFactory.create(range)! : range;
    // call function using the origin and scale from the range
    return func(pt, qparams.origin, qparams.scale);
  }
  // convert arguments points to array, quantize points and return results as a number array, then convert back to point
  public static quantizeFromRange(pos: Point, range: Range | QParamsBase): Point {
    return Quantizer.applyFromRange(pos, range, Quantizer.quantize);
  }
  public static unquantizeFromRange(pos: Point, range: Range | QParamsBase): Point {
    return Quantizer.applyFromRange(pos, range, Quantizer.unquantize);
  }
  public static unquantizeAboutCenterFromRange(pos: Point, range: Range | QParamsBase): Point {
    return Quantizer.applyFromRange(pos, range, Quantizer.unquantizeAboutCenter);
  }
  // take a number respresenting a position, origin, and scale, then return the quantized number
  public static computeScale(extents: Point): Point {
    return PointUtil.eachScalar(extents, ScalarQuantizer.computeScale);
  }
  public static unquantizeScale(origin: Point, scale: Point): Point {
    const scaleArr = PointUtil.toNumberArray(scale);
    return PointUtil.eachScalar(origin, (v, i) => ScalarQuantizer.unquantizeScale(v, scaleArr[i!]));
  }
}

// QParams can convert a range to origin and scale points and vice versa
export abstract class QParamsBase {
  private _scale: Point;
  private _origin: Point;
  public get origin(): Point { return this._origin; }
  public get scale(): Point { return this._scale; }
  public get range(): Range { return QParams.computeRange(this.origin, this.scale); }
  public is1d(): this is QParams1d { return this instanceof QParams1d; }
  public is2d(): this is QParams2d { return this instanceof QParams2d; }
  public is3d(): this is QParams3d { return this instanceof QParams3d; }
  constructor(range: Range) { this.init(range); }
  public init(range: Range) {
    this._origin = range.low;
    this._scale = QParamsBase.computeScale(range);
  }
  public static computeScale(range: Range): Point {
    return Quantizer.computeScale(RangeUtil.toDiagonal(range)); // find the range extents then compute the qpoint scale
  }
  public static computeRange(origin: Point, scale: Point): Range {
    return RangeUtil.fromPoints(origin, Quantizer.unquantizeScale(origin, scale))!;
  }
}

export class QParams<T extends Point, K extends Range> extends QParamsBase {
  public get origin(): Point { return super.origin as T; }
  public get scale(): Point { return super.scale as T; }
  public get range(): Range { return super.range as K; }
  constructor(range: K) { super(range); }
}

export class QParams1d extends QParams<number, Range1d> implements Cloneable<QParams1d> {
  constructor(range: Range1d) { super(range); }
  public clone(): QParams1d { return new QParams1d(RangeUtil.clone(this.range) as Range1d); }
}
export class QParams2d extends QParams<XY, Range2d> {
  constructor(range: Range2d) { super(range); }
  public clone(): QParams2d { return new QParams2d(RangeUtil.clone(this.range) as Range2d); }
  public static fromDefaultRange(): QParams2d {
    return new QParams2d(Range2d.createArray([Point2d.create(0, 0), Point2d.create(1, 1)]));
  }
}
export class QParams3d extends QParams<XYZ, Range3d> {
  constructor(range: Range3d) { super(range); }
  public clone(): QParams3d { return new QParams3d(RangeUtil.clone(this.range) as Range3d); }
  public static fromNormalizedRange(): QParams3d {
    return new QParams3d(Range3d.createArray([Point3d.create(-1, -1, -1), Point3d.create(1, 1, 1)]));
  }
}

// QPoint can quantize/unquantize a point, requires a range or qparams object to execute a quantization routine
export abstract class QPointBase {
  protected readonly data: Uint16Array;
  public get point32(): Point { return PointUtil.asFloat32Point(this.point); }
  public get point(): Point { return PointUtil.fromUint16Array(this.data); }
  public get extents(): Point { return this.is2d() ? PointUtil.toPoint(rangeScale, rangeScale) : this.is3d() ? PointUtil.toPoint(rangeScale, rangeScale, rangeScale) : rangeScale; }
  public is1d(): this is QPoint1d { return this instanceof QPoint1d; }
  public is2d(): this is QPoint2d { return this instanceof QPoint2d; }
  public is3d(): this is QPoint3d { return this instanceof QPoint3d; }
  constructor(pt: Point, params?: Range | QParamsBase) {
    // if params exist then use them to quantize pt, otherwise we assume the point is already quantized
    const qpt = !!params ? Quantizer.quantizeFromRange(pt, params) : pt;
    // convert the qpt into a uint16 array
    this.data = PointUtil.toUint16Array(qpt);
  }
  public unquantize(params: Range | QParamsBase): Point { return Quantizer.unquantizeFromRange(this.point, params); }
  public unquantize32(params: Range | QParamsBase): Point { return Quantizer.unquantizeFromRange(this.point32, params); }
  public unquantizeAboutCenter(params: Range | QParamsBase): Point { return Quantizer.unquantizeAboutCenterFromRange(this.point, params); }
}

export abstract class QPoint<T extends Point, K extends Range> extends QPointBase {
  public get point(): T { return super.point as T; }
  constructor(pt: T, range?: K | QParams<T, K>) { super(pt, range); }
  public unquantize(params: K | QParams<T, K>): T { return super.unquantize(params) as T; }
  public unquantize32(params: K | QParams<T, K>): T { return super.unquantize32(params) as T; }
  public unquantizeAboutCenter(params: K | QParams<T, K>): T { return super.unquantizeAboutCenter(params) as T; }
}

// Represents a scalar value quantized within some known range to a 16-bit integer.
// This is a lossy compression technique.
export class QPoint1d extends QPoint<number, Range1d> implements Cloneable<QPoint1d> {
  public get x(): number { return this.data[0]; }
  public static fromPoint(pt: number): QPoint1d { return new QPoint1d(pt); }
  public clone(): QPoint1d { return new QPoint1d(PointUtil.clone(this.point) as number); }
}

// Represents a DPoint2d quantized within some known range to a pair of 16-bit integers.
// This is a lossy compression technique.
export class QPoint2d extends QPoint<XY, Range2d> implements Cloneable<QPoint2d> {
  public get x(): number { return this.data[0]; }
  public get y(): number { return this.data[1]; }
  public static fromPoint(pt: XY): QPoint2d { return new QPoint2d(pt); }
  public static fromScalars(...scalars: number[]): QPoint2d { return new QPoint2d(PointUtil.toPoint(...scalars) as XY); }
  public clone(): QPoint2d { return new QPoint2d(PointUtil.clone(this.point) as XY); }
}

// Represents a DPoint3d quantized within some known range to a triplet of 16-bit
// integers. This is a lossy compression technique.
export class QPoint3d extends QPoint<XYZ, Range3d> implements XYAndZ, Cloneable<QPoint3d> {
  public get x(): number { return this.data[0]; }
  public get y(): number { return this.data[1]; }
  public get z(): number { return this.data[2]; }
  public static fromPoint(pt: XYZ): QPoint3d { return new QPoint3d(pt); }
  public static fromScalars(...scalars: number[]): QPoint3d { return new QPoint3d(PointUtil.toPoint(...scalars) as XYZ); }
  public clone(): QPoint3d { return new QPoint3d(PointUtil.clone(this.point) as XYZ); }
}

export class QPointFactory {
  public static createFromQRange(pt: Point, range: Range): QPointBase | undefined {
    if (PointUtil.isXYZ(pt) && RangeUtil.isRange3d(range)) return new QPoint3d(pt, range);
    if (PointUtil.isXY(pt) && RangeUtil.isRange2d(range)) return new QPoint2d(pt, range);
    if (PointUtil.isNumber(pt) && RangeUtil.isRange1d(range)) return new QPoint1d(pt, range);
    return undefined;
  }
  public static create(pt: Point, params: QParamsBase): QPointBase | undefined {
    if (PointUtil.isXYZ(pt) && params.is3d()) return new QPoint3d(pt, params);
    if (PointUtil.isXY(pt) && params.is2d()) return new QPoint2d(pt, params);
    if (PointUtil.isNumber(pt) && params.is1d()) return new QPoint1d(pt, params);
    return undefined;
  }
}

export class QParamsFactory {
  public static create(range: Range): QParamsBase | undefined {
    if (RangeUtil.isRange3d(range)) return new QParams3d(range);
    if (RangeUtil.isRange2d(range)) return new QParams2d(range);
    if (RangeUtil.isRange1d(range)) return new QParams1d(range);
    return undefined;
  }
}

export class QPointList<Q extends QPointBase, P extends Point, R extends Range, K extends QParamsBase> {
  protected _valid = false;
  protected _pts: Q[];
  protected get pts(): Q[] { return this._pts; }
  public params: K;
  public get canLoad(): boolean { return this._valid; }
  public get length(): number { return this._pts.length; }
  constructor(params?: R | K, pts: Q[] = []) {
    this._valid = !!params;
    if (this.canLoad) this.params = (RangeUtil.isRange(params) ? QParamsFactory.create(params)! : params) as K;
    this._pts = pts;
  }
  public push(pt: P) {
    if (!this.canLoad) return; // if no params are set, then we can't quantize the point
    const qpt = QPointFactory.create(pt, this.params);
    if (!!qpt) this.pts.push(qpt as Q);
  }
  public assign(pts: P[], params: R | K) {
    this.reset((RangeUtil.isRange(params) ? QParamsFactory.create(params)! : params) as K);
    pts.forEach((pt) => this.push(pt));
  }
  public reset(params: R | K) {
    this._valid = true;
    this.params = (RangeUtil.isRange(params) ? QParamsFactory.create(params)! : params) as K;
    this._pts = [];
  }
  public initFrom(pts: P[]) {
    const range = RangeUtil.fromPoints(...pts);
    if (!!range) this.assign(pts, range as R);
  }
  public unquantize(index: number): P | undefined {
    const pt = this.pts[index];
    return !!pt ? pt.unquantize(this.params) as P : undefined;
  }
  public unquantizeAll(): P[] {
    return this.pts.map((pt) => pt.unquantize(this.params) as P);
  }
  public unquantize32(index: number): P | undefined {
    const pt = this.pts[index];
    return !!pt ? pt.unquantize32(this.params) as P : undefined;
  }
  public requantize(params: R | K) {
    this.assign(this.unquantizeAll(), params);
  }
}

export class QPoint3dList extends QPointList<QPoint3d, XYZ, Range3d, QParams3d> implements Cloneable<QPoint3dList> {
  constructor(params?: Range3d | QParams3d, pts: QPoint3d[] = []) { super(params, pts); }
  public clone(): QPoint3dList { return new QPoint3dList(this._valid ? this.params.clone() : undefined, this.pts.map((qpt) => qpt.clone())); }
}
export class QPoint2dList extends QPointList<QPoint2d, XY, Range2d, QParams2d> implements Cloneable<QPoint2dList> {
  constructor(params?: Range2d | QParams2d, pts: QPoint2d[] = []) { super(params, pts); }
  public clone(): QPoint2dList { return new QPoint2dList(this._valid ? this.params.clone() : undefined, this.pts.map((qpt) => qpt.clone())); }
}
export class QPoint1dList extends QPointList<QPoint1d, number, Range1d, QParams1d> implements Cloneable<QPoint1dList> {
  constructor(params?: Range1d | QParams1d, pts: QPoint1d[] = []) { super(params, pts); }
  public clone(): QPoint1dList { return new QPoint1dList(this._valid ? this.params.clone() : undefined, this.pts.map((qpt) => qpt.clone())); }
}
