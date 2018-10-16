/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

/** @module Bspline */

// import { Point2d } from "../Geometry2d";
/* tslint:disable:variable-name jsdoc-format no-empty no-console*/
import { Point3d } from "../geometry3d/Point3dVector3d";
import { Point4d } from "../geometry4d/Point4d";
import { Range3d } from "../geometry3d/Range";
import { Transform } from "../geometry3d/Transform";
import { CurvePrimitive } from "../curve/CurvePrimitive";
import { StrokeOptions } from "../curve/StrokeOptions";
import { Plane3dByOriginAndUnitNormal } from "../geometry3d/Plane3dByOriginAndUnitNormal";
import { IStrokeHandler } from "../geometry3d/GeometryHandler";

import { LineString3d } from "../curve/LineString3d";
import { KnotVector } from "./KnotVector";
import { Bezier1dNd } from "./Bezier1dNd";
import { UnivariateBezier } from "../numerics/BezierPolynomials";
/**
 * Base class for CurvePrimitve (necessarily 3D) with _polygon.
 * * This has a Bezier1dNd polygon as a member, and implements dimension-indendent methods
 * * This exists to support BezeierCurve3d and BezierCurve3dH.
 * * The implementations of "pure 3d" queries is based on calling `getPolePoint3d`.
 * * This has the subtle failure difference that `getPolePoint3d` call with a valid index on on a 3d curve always succeeds, but on 3dH curve fails when weight is zero.
 */
export abstract class BezierCurveBase extends CurvePrimitive {
  protected _polygon: Bezier1dNd;
  /** data blocks accessible by concrete class.   Initialized to correct blockSize in constructor. */
  protected _workData0: Float64Array;
  protected _workData1: Float64Array;
  /**
   * *_workPoint0 and _workPoint1 are conventional 3d points
   * * create by constructor
   * * accessbile by derived classes
   * */
  protected _workPoint0: Point3d;
  protected _workPoint1: Point3d;

  protected constructor(blockSize: number, data: Float64Array) {
    super();
    this._polygon = new Bezier1dNd(blockSize, data);
    this._workPoint0 = Point3d.create();
    this._workPoint1 = Point3d.create();
    this._workData0 = new Float64Array(blockSize);
    this._workData1 = new Float64Array(blockSize);

  }
  /** reverse the poles in place */
  public reverseInPlace(): void { this._polygon.reverseInPlace(); }
  /** saturate the pole in place, using knot intervals from `spanIndex` of the `knotVector` */
  public saturateInPlace(knotVector: KnotVector, spanIndex: number): boolean { return this._polygon.saturateInPlace(knotVector, spanIndex); }
  public get degree(): number { return this._polygon.order - 1; }
  public get order(): number { return this._polygon.order; }
  public get numPoles(): number { return this._polygon.order; }
  /** Get pole `i` as a Point3d.
   * * For 3d curve, this is simple a pole access, and only fails (return `undefined`) for invalid index
   * * For 4d curve, this deweights the homogeneous pole and can fail due to 0 weight.
   */
  public abstract getPolePoint3d(i: number, point?: Point3d): Point3d | undefined;

  /** Get pole `i` as a Point4d.
   * * For 3d curve, this accesses the simple pole and returns with weight 1.
   * * For 4d curve, this accesses the (weighted) pole.
   */
  public abstract getPolePoint4d(i: number, point?: Point4d): Point4d | undefined;

  public setInterval(a: number, b: number) { this._polygon.setInterval(a, b); }
  public fractionToParentFraction(fraction: number): number { return this._polygon.fractionToParentFraction(fraction); }
  /** Return a stroke count appropriate for given stroke options. */
  public abstract strokeCount(options?: StrokeOptions): number;

  /** append stroke points to a linestring, based on `strokeCount` and `fractionToPoint` from derived class*/
  public emitStrokes(dest: LineString3d, options?: StrokeOptions): void {
    const numPerSpan = this.strokeCount(options);
    const fractionStep = 1.0 / numPerSpan;
    for (let i = 0; i <= numPerSpan; i++) {
      const fraction = i * fractionStep;
      this.fractionToPoint(fraction, this._workPoint0);
      dest.appendStrokePoint(this._workPoint0);
    }
  }
  /** announce intervals with stroke counts */
  public emitStrokableParts(handler: IStrokeHandler, _options?: StrokeOptions): void {
    const numPerSpan = this.strokeCount(_options);
    handler.announceIntervalForUniformStepStrokes(this, numPerSpan, 0.0, 1.0);
  }
  /** Return a simple array of arrays with the control points as `[[x,y,z],[x,y,z],..]` */
  public copyPolesAsJsonArray(): any[] { return this._polygon.unpackToJsonArrays(); }

  /** return true if all poles are on a plane. */
  public isInPlane(plane: Plane3dByOriginAndUnitNormal): boolean {
    let point: Point3d | undefined = this._workPoint0;
    for (let i = 0; ; i++) {
      point = this.getPolePoint3d(i, point);
      if (!point)
        return true;
      if (!plane.isPointInPlane(point))
        return false;
    }
    return false;
  }
  public polygonLength(): number {
    if (!this.getPolePoint3d(0, this._workPoint0))
      return 0.0;
    let i = 0;
    let sum = 0.0;
    while (this.getPolePoint3d(++i, this._workPoint1)) {
      sum += this._workPoint0.distance(this._workPoint1);
      this._workPoint0.setFrom(this._workPoint1);
    }
    return sum;
  }

  public startPoint(): Point3d {
    const result = this.getPolePoint3d(0);
    if (!result) return Point3d.createZero();
    return result;
  }
  public endPoint(): Point3d {
    const result = this.getPolePoint3d(this.order - 1);
    if (!result) return Point3d.createZero();
    return result;
  }

  public quickLength(): number { return this.polygonLength(); }
  /** Extend range by all poles.  */
  public extendRange(rangeToExtend: Range3d, transform?: Transform): void {
    let i = 0;
    if (transform) {
      while (this.getPolePoint3d(i++, this._workPoint0)) {
        rangeToExtend.extendTransformedPoint(transform, this._workPoint0);
      }
    } else {
      while (this.getPolePoint3d(i++, this._workPoint0)) {
        rangeToExtend.extend(this._workPoint0);
      }
    }
  }
  protected _workBezier?: UnivariateBezier; // available for bezier logic within a method
  protected _workCoffsA?: Float64Array;
  protected _workCoffsB?: Float64Array;

  /**
   * set up the _workBezier members with specific order.
   * * Try to reuse existing members if their sizes match.
   * * Ignore members corresponding to args that are 0 or negative.
   * @param primaryBezierOrder order of expected bezier
   * @param orderA length of _workCoffsA (simple array)
   * @param orderB length of _workdCoffsB (simple array)
   */
  protected allocateAndZeroBezierWorkData(primaryBezierOrder: number, orderA: number, orderB: number) {
    if (primaryBezierOrder > 0) {
      if (this._workBezier !== undefined && this._workBezier.order === primaryBezierOrder) {
        this._workBezier.zero();
      } else
        this._workBezier = new UnivariateBezier(primaryBezierOrder);
    }
    if (orderA > 0) {
      if (this._workCoffsA !== undefined && this._workCoffsA.length === orderA)
        this._workCoffsA.fill(0);
      else
        this._workCoffsA = new Float64Array(orderA);
    }
    if (orderB > 0) {
      if (this._workCoffsB !== undefined && this._workCoffsB.length === orderB)
        this._workCoffsB.fill(0);
      else
        this._workCoffsB = new Float64Array(orderB);
    }
  }

}
