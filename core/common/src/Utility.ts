/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Geometry */

import { Range1d, Range2d, Range3d, XY, XYZ, Vector3d, Vector2d, Point2d, Point3d } from "@bentley/geometry-core";

export type Point = number | XY | XYZ;
export type Range = Range1d | Range2d | Range3d;

export class PointUtil {
  public static isNaN(val: any): boolean { return Number.isNaN(Number.parseFloat(val)); }
  public static isNumber(val: any): val is number { return !PointUtil.isNaN(val); }
  public static isNumberArray(arr: any[]): arr is number[] { return arr.every(PointUtil.isNumber); }
  public static isVector(val: any): val is XY | XYZ { return typeof val === "object" && (val instanceof XY || val instanceof XYZ); }
  public static isXY(val: any): val is XY { return val instanceof XY; }
  public static isXYZ(val: any): val is XYZ { return val instanceof XYZ; }
  public static isPoint2d(val: any): val is Point2d { return val instanceof Point2d; }
  public static isPoint3d(val: any): val is Point3d { return val instanceof Point3d; }
  public static isXYArray(arr: any[]): arr is XY[] { return arr.every((n) => PointUtil.isXY(n)); }
  public static isXYZArray(arr: any[]): arr is XYZ[] { return arr.every((n) => PointUtil.isXYZ(n)); }
  public static isPoint2dArray(arr: any[]): arr is Point2d[] { return arr.every((n) => PointUtil.isPoint2d(n)); }
  public static isPoint3dArray(arr: any[]): arr is Point3d[] { return arr.every((n) => PointUtil.isPoint3d(n)); }
  public static toNumberArray(pt: Point): number[] { return (PointUtil.isVector(pt) ? pt.toJSON() : [pt]) as number[]; }
  public static toPoint(...scalars: number[]): Point { return PointUtil.fromNumberArray(scalars); }
  public static fromNumberArray(data: number[]): Point {
    if (data.length === 1) return data[0];
    if (data.length === 2) return Vector2d.fromJSON(data);
    return Vector3d.fromJSON(data);
  }
  public static fromFloat32Array(data: Float32Array): Point { return PointUtil.fromNumberArray(Array.from(data)); }
  public static fromUint16Array(data: Uint16Array): Point { return PointUtil.fromNumberArray(Array.from(data)); }
  public static toUint16Array(pt: Point): Uint16Array { return new Uint16Array(PointUtil.toNumberArray(pt)); }
  public static toFloat32Array(pt: Point): Float32Array { return new Float32Array(PointUtil.toNumberArray(pt)); }
  public static asFloat32Point(pt: Point): Point { return PointUtil.fromFloat32Array((PointUtil.toFloat32Array(pt))); }
  public static to2dNumberArray(...pts: Point[]): number[][] { return pts.map(PointUtil.toNumberArray); }
  public static toUint16(val: number): number { return new Uint16Array([val])[0]; }
  public static asNumberArray(pt: Point, func: (pt: number[]) => number[]): Point { return PointUtil.fromNumberArray(func(PointUtil.toNumberArray(pt))); }
  public static eachScalar(pt: Point, func: (pt: number, i?: number) => number): Point { return PointUtil.asNumberArray(pt, (pts) => pts.map((v, i) => func(v, i))); }
  public static fromNumberArrays(...arrs: number[][]): Point[] { return arrs.map((arr) => PointUtil.fromNumberArray(arr)); }
  public static clone(pt: Point): Point { return PointUtil.fromNumberArray(PointUtil.toNumberArray(pt)); }
}

export class RangeUtil {
  public static isRange1d(val: any): val is Range1d { return val instanceof Range1d; }
  public static isRange2d(val: any): val is Range2d { return val instanceof Range2d; }
  public static isRange3d(val: any): val is Range3d { return val instanceof Range3d; }
  public static isRange(val: any): val is Range { return RangeUtil.isRange3d(val) || RangeUtil.isRange2d(val) || RangeUtil.isRange1d(val); }
  // computes diagonal for a range of any dimension and returns a zeroed point of same dimension if range is invalid
  public static toDiagonal(range: Range): Point {
    if (RangeUtil.isRange1d(range)) return range.length(); // Range1d length bottoms out at zero, so no null check required
    else if (RangeUtil.isRange2d(range)) return range.isNull() ? new Vector2d(0, 0) : range.diagonal();
    else return range.isNull() ? new Vector3d(0, 0, 0) : range.diagonal();
  }
  public static fromPoints(...pts: Point[]): Range | undefined {
    if (PointUtil.isNumberArray(pts)) return Range1d.createArray(pts);
    if (PointUtil.isPoint2dArray(pts)) return Range2d.createArray(pts);
    if (PointUtil.isPoint3dArray(pts)) return Range3d.createArray(pts);
    return undefined;
  }
  public static clone(range: Range): Range { return RangeUtil.fromPoints(range.low, range.high)!; }
}
