/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Range1d, Range2d, Range3d } from "@bentley/geometry-core/lib/Range";
import { XY, XYZ } from "@bentley/geometry-core/lib/PointVector";
import { Point, Range, PointUtil, RangeUtil } from "./Utility";

// declare constant in module scope to prevent having to write out ScalarQuantizer.rangeScale every time
const rangeScale = 0xffff;

// stores the position, origin, and scale points as an array of QData to facilitate quantization operations against each point's dimensions
export class QData {
  private _data: number[][];
  constructor(pos: Point, origin: Point, scale: Point) { this.init.apply(this, [ pos, origin, scale ].map(PointUtil.toNumberArray)); }
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
  // take a number respresenting a position, origin, and scale, then return the quantized number
  public static computeScale(extents: Point): Point {
    return PointUtil.eachScalar(extents, ScalarQuantizer.computeScale);
  }
  public static unquantizeScale(origin: Point, scale: Point): Point {
    const scaleArr = PointUtil.toNumberArray(scale);
    return PointUtil.eachScalar(origin, (v, i) => ScalarQuantizer.unquantizeScale(v, scaleArr[i!]));
  }
}

export abstract class QPointBase {
  protected _data: Uint16Array;
  protected _params: QParams;
  public get point(): Point { return PointUtil.fromUint16Array(this._data); }
  protected init(pt: Point) { this._data = new Uint16Array(PointUtil.toNumberArray(pt)); }
  public is1d(): this is QPoint1d { return this instanceof QPoint1d; }
  public is2d(): this is QPoint2d { return this instanceof QPoint2d; }
  public is3d(): this is QPoint3d { return this instanceof QPoint3d; }
  public get extents(): Point { return this.is2d() ? PointUtil.toPoint(rangeScale, rangeScale) : this.is3d() ? PointUtil.toPoint(rangeScale, rangeScale, rangeScale) : rangeScale; }
  constructor(pt?: Point, range?: Range) { this.init(!!pt ? !!range ? this.quantize(pt, range) : pt : this.extents); }
  private apply(func: (pos: number, origin: number, scale: number) => Point, pt?: Point): Point { return func.call(null, !!pt ? pt : this.point, this._params.origin, this._params.scale); }
  public quantize(pt: Point, range: Range): Point {
    this._params = new QParams(range);
    return this.apply(Quantizer.quantize, pt);
  }
  public quantize32(pt: Point, range: Range): Point {
    this._params = new QParams(range);
    return PointUtil.eachScalar(this.apply(Quantizer.quantize, pt), Math.fround);
  }
  public unquantize(): Point { return this.apply(Quantizer.unquantize); }
  public unquantize32(): Point { return this.apply(Quantizer.unquantize); }
  public unquantizeAboutCenter(): Point { return this.apply(Quantizer.unquantizeAboutCenter); }
}

export abstract class QPoint<T extends Point, K extends Range> extends QPointBase {
  public get point(): T { return super.point as T; }
  constructor(pt?: T, range?: K) { super(pt, range); }
  public unquantize(): T { return super.unquantize() as T; }
  public unquantize32(): T { return super.unquantize32() as T; }
  public unquantizeAboutCenter(): T { return super.unquantizeAboutCenter() as T; }
}

// Represents a scalar value quantized within some known range to a 16-bit integer.
// This is a lossy compression technique.
export class QPoint1d extends QPoint<number, Range1d> {
  public get x(): number { return this._data[0]; }
  public static fromPoint(pt: number): QPoint1d { return new QPoint1d(pt); }
}

// Represents a DPoint2d quantized within some known range to a pair of 16-bit integers.
// This is a lossy compression technique.
export class QPoint2d extends QPoint<XY, Range2d> {
  public get x(): number { return this._data[0]; }
  public get y(): number { return this._data[1]; }
  public static fromPoint(pt: XY): QPoint2d { return new QPoint2d(pt); }
  public static fromScalars(...scalars: number[]): QPoint2d { return new QPoint2d(PointUtil.toPoint(...scalars) as XY); }
}

// Represents a DPoint3d quantized within some known range to a triplet of 16-bit
// integers. This is a lossy compression technique.
export class QPoint3d extends QPoint<XYZ, Range3d> {
  public get x(): number { return this._data[0]; }
  public get y(): number { return this._data[1]; }
  public get z(): number { return this._data[2]; }
  public static fromPoint(pt: XYZ): QPoint3d { return new QPoint3d(pt); }
  public static fromScalars(...scalars: number[]): QPoint3d { return new QPoint3d(PointUtil.toPoint(...scalars) as XYZ); }
}

export class QParams {
  private _origin: Point;
  private _scale: Point;
  public get origin(): Point { return this._origin; }
  public get scale(): Point { return this._scale; }
  public get range(): Range { return QParams.computeRange(this.origin, this.scale); }
  constructor(range: Range) { this.init(range); }
  public init(range: Range) {
    this._origin = range.low;
    this._scale = QParams.computeScale(range);
  }
  public static computeScale(range: Range): Point {
    return Quantizer.computeScale(RangeUtil.toDiagonal(range)); // find the range extents then compute the qpoint scale
  }
  public static computeRange(origin: Point, scale: Point): Range {
    return RangeUtil.fromPoints(origin, Quantizer.unquantizeScale(origin, scale))!;
  }
}
