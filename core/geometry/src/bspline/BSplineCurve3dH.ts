/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

/** @module Bspline */

// import { Point2d } from "../Geometry2d";
/* tslint:disable:variable-name jsdoc-format no-empty no-console*/
import { Point3d } from "../PointVector";
import { Point4d } from "../numerics/Geometry4d";
import { Range3d } from "../Range";
import { Transform } from "../Transform";
import { Ray3d, Plane3dByOriginAndVectors } from "../AnalyticGeometry";

import { StrokeOptions } from "../curve/StrokeOptions";
import { Geometry } from "../Geometry";
import { Plane3dByOriginAndUnitNormal } from "../AnalyticGeometry";
import { GeometryHandler, IStrokeHandler } from "../GeometryHandler";
import { KnotVector } from "./KnotVector";
import { LineString3d } from "../curve/LineString3d";
import { Point3dArray, Point4dArray } from "../PointHelpers";
import { BezierCurve3d, BezierCurve3dH, BezierCurveBase } from "./BezierCurve";
import { BSplineCurve3dBase } from "./BSplineCurve";

/**
 * Weighted (Homogeneous) BSplineCurve in 3d
 */
export class BSplineCurve3dH extends BSplineCurve3dBase {
  public isSameGeometryClass(other: any): boolean { return other instanceof BSplineCurve3dH; }
  public tryTransformInPlace(transform: Transform): boolean { Point4dArray.multiplyInPlace(transform, this._bcurve.packedData); return true; }

  public getPole(i: number, result?: Point3d): Point3d | undefined { return this._bcurve.getPoint3dPole(i, result); }
  public spanFractionToKnot(span: number, localFraction: number): number {
    return this._bcurve.spanFractionToKnot(span, localFraction);
  }
  private constructor(numPoles: number, order: number, knots: KnotVector) {
    super(4, numPoles, order, knots);
  }
  /** Return a simple array of arrays with the control points as `[[x,y,z,w],[x,y,z,w],..]` */
  public copyPoints(): any[] { return Point3dArray.unpackNumbersToNestedArrays(this._bcurve.packedData, 4); }
  /** Return a simple array of the control points coordinates */
  public copyPointsFloat64Array(): Float64Array { return this._bcurve.packedData.slice(); }

  /** Create a bspline with uniform knots. */
  public static createUniformKnots(poles: Point3d[] | Point4d[], order: number): BSplineCurve3dH | undefined {
    const numPoles = poles.length;
    if (order < 1 || numPoles < order)
      return undefined;
    const knots = KnotVector.createUniformClamped(poles.length, order - 1, 0.0, 1.0);
    const curve = new BSplineCurve3dH(poles.length, order, knots);
    let i = 0;
    if (poles[0] instanceof Point3d)
      for (const p of poles) { curve._bcurve.packedData[i++] = p.x; curve._bcurve.packedData[i++] = p.y; curve._bcurve.packedData[i++] = p.z; curve._bcurve.packedData[i++] = 1.0; }
    else if (poles[0] instanceof Point4d)
      for (const p of (poles as Point4d[])) { curve._bcurve.packedData[i++] = p.x; curve._bcurve.packedData[i++] = p.y; curve._bcurve.packedData[i++] = p.z; curve._bcurve.packedData[i++] = p.w; }
    else
      return undefined;
    return curve;
  }
  /** Create a bspline with given knots.
   *
   * *  Two count conditions are recognized:
   *
   * ** If poleArray.length + order == knotArray.length, the first and last are assumed to be the
   *      extraneous knots of classic clamping.
   * ** If poleArray.length + order == knotArray.length + 2, the knots are in modern form.
   *
   */
  public static create(poleArray: Float64Array | Point4d[], knotArray: Float64Array | number[], order: number): BSplineCurve3dH | undefined {
    let numPoles = poleArray.length;
    if (poleArray instanceof Float64Array) {
      numPoles /= 4;  // blocked as xyz
    }
    const numKnots = knotArray.length;
    // shift knots-of-interest limits for overclampled case ...
    const skipFirstAndLast = (numPoles + order === numKnots);
    if (order < 1 || numPoles < order)
      return undefined;
    const knots = KnotVector.create(knotArray, order - 1, skipFirstAndLast);
    const curve = new BSplineCurve3dH(numPoles, order, knots);
    if (poleArray instanceof Float64Array) {
      let i = 0;
      for (const coordinate of poleArray) { curve._bcurve.packedData[i++] = coordinate; }
    } else if (poleArray[0] instanceof Point4d) {
      let i = 0;
      for (const p of poleArray) { curve._bcurve.packedData[i++] = p.x; curve._bcurve.packedData[i++] = p.y; curve._bcurve.packedData[i++] = p.z; curve._bcurve.packedData[i++] = p.w; }
    } else if (poleArray[0] instanceof Point3d) {
      let i = 0;
      for (const p of poleArray) { curve._bcurve.packedData[i++] = p.x; curve._bcurve.packedData[i++] = p.y; curve._bcurve.packedData[i++] = p.z; curve._bcurve.packedData[i++] = 1.0; }
    }
    return curve;
  }
  public clone(): BSplineCurve3dH {
    const knotVector1 = this._bcurve.knots.clone();
    const curve1 = new BSplineCurve3dH(this.numPoles, this.order, knotVector1);
    curve1._bcurve.packedData = this._bcurve.packedData.slice();
    return curve1;
  }
  public cloneTransformed(transform: Transform): BSplineCurve3dH {
    const curve1 = this.clone();
    curve1.tryTransformInPlace(transform);
    return curve1;
  }
  /** Evaluate at a position given by fractional position within a span. */
  public evaluatePointInSpan(spanIndex: number, spanFraction: number, result?: Point3d): Point3d {
    this._bcurve.evaluateBuffersInSpan(spanIndex, spanFraction);
    const xyzw = this._bcurve.poleBuffer;
    return Point4d.createRealPoint3dDefault000(xyzw[0], xyzw[1], xyzw[2], xyzw[3], result);
  }

  /** Evaluate at a position given by fractional position within a span. */
  public evaluatePointAndTangentInSpan(spanIndex: number, spanFraction: number, result?: Ray3d): Ray3d {
    this._bcurve.evaluateBuffersInSpan1(spanIndex, spanFraction);
    const xyzw = this._bcurve.poleBuffer;
    const dxyzw = this._bcurve.poleBuffer1;
    return Point4d.createRealDerivativeRay3dDefault000(
      xyzw[0], xyzw[1], xyzw[2], xyzw[3],
      dxyzw[0], dxyzw[1], dxyzw[2], dxyzw[3], result);
  }

  /** Evaluate at a positioni given by a knot value. */
  public knotToPoint(u: number, result?: Point3d): Point3d {
    this._bcurve.evaluateBuffersAtKnot(u);
    const xyzw = this._bcurve.poleBuffer;
    return Point4d.createRealPoint3dDefault000(xyzw[0], xyzw[1], xyzw[2], xyzw[3], result);
  }
  /** Evaluate at a position given by a knot value.  */
  public knotToPointAndDerivative(u: number, result?: Ray3d): Ray3d {
    this._bcurve.evaluateBuffersAtKnot(u, 1);
    const xyzw = this._bcurve.poleBuffer;
    const dxyzw = this._bcurve.poleBuffer1;
    return Point4d.createRealDerivativeRay3dDefault000(
      xyzw[0], xyzw[1], xyzw[2], xyzw[3],
      dxyzw[0], dxyzw[1], dxyzw[2], dxyzw[3], result);
  }

  /** Evaluate at a position given by a knot value.  Return point with 2 derivatives. */
  public knotToPointAnd2Derivatives(u: number, result?: Plane3dByOriginAndVectors): Plane3dByOriginAndVectors {
    this._bcurve.evaluateBuffersAtKnot(u, 2);
    const xyzw = this._bcurve.poleBuffer;
    const dxyzw = this._bcurve.poleBuffer1;
    const ddxyzw = this._bcurve.poleBuffer2;
    return Point4d.createRealDerivativePlane3dByOriginAndVectorsDefault000(
      xyzw[0], xyzw[1], xyzw[2], xyzw[3],
      dxyzw[0], dxyzw[1], dxyzw[2], dxyzw[3],
      ddxyzw[0], ddxyzw[1], ddxyzw[2], ddxyzw[3],
      result);
  }

  public isAlmostEqual(other: any): boolean {
    if (other instanceof BSplineCurve3dH) {
      return this._bcurve.knots.isAlmostEqual(other._bcurve.knots)
        && Point4dArray.isAlmostEqual(this._bcurve.packedData, other._bcurve.packedData);
    }
    return false;
  }
  public isInPlane(plane: Plane3dByOriginAndUnitNormal): boolean {
    return Point4dArray.isCloseToPlane(this._bcurve.packedData, plane);
  }

  public quickLength(): number { return Point3dArray.sumLengths(this._bcurve.packedData); }
  public emitStrokableParts(handler: IStrokeHandler, _options?: StrokeOptions): void {
    const numSpan = this.numSpan;
    const numPerSpan = 5; // NEEDS WORK -- apply stroke options to get better count !!!
    for (let spanIndex = 0; spanIndex < numSpan; spanIndex++) {
      handler.announceIntervalForUniformStepStrokes(this, numPerSpan,
        this._bcurve.knots.spanFractionToFraction(spanIndex, 0.0),
        this._bcurve.knots.spanFractionToFraction(spanIndex, 1.0));
    }
  }

  public emitStrokes(dest: LineString3d, _options?: StrokeOptions): void {
    const numSpan = this.numSpan;
    const numPerSpan = 5; // NEEDS WORK -- apply stroke options to get better count !!!
    const fractionStep = 1.0 / numPerSpan;
    for (let spanIndex = 0; spanIndex < numSpan; spanIndex++) {
      for (let i = 0; i <= numPerSpan; i++) {
        const spanFraction = i * fractionStep;
        const point = this.evaluatePointInSpan(spanIndex, spanFraction);
        dest.appendStrokePoint(point);
      }
    }
  }
  /**
   * return true if the spline is (a) unclamped with (degree-1) matching knot intervals,
   * (b) (degree-1) wrapped points,
   * (c) marked wrappable from construction time.
   */
  public get isClosable(): boolean {
    if (!this._bcurve.knots.wrappable)
      return false;
    const degree = this.degree;
    const leftKnotIndex = this._bcurve.knots.leftKnotIndex;
    const rightKnotIndex = this._bcurve.knots.rightKnotIndex;
    const period = this._bcurve.knots.rightKnot - this._bcurve.knots.leftKnot;
    const indexDelta = rightKnotIndex - leftKnotIndex;
    for (let k0 = leftKnotIndex - degree + 1; k0 < leftKnotIndex + degree - 1; k0++) {
      const k1 = k0 + indexDelta;
      if (!Geometry.isSameCoordinate(this._bcurve.knots.knots[k0] + period, this._bcurve.knots.knots[k1]))
        return false;
    }
    const poleIndexDelta = this.numPoles - this.degree;
    for (let p0 = 0; p0 + 1 < degree; p0++) {
      const p1 = p0 + poleIndexDelta;
      if (!Geometry.isSamePoint3d(this.getPole(p0) as Point3d, this.getPole(p1) as Point3d))
        return false;
    }
    return true;
  }
  /**
   * Return a CurvePrimitive (which is a BezierCurve3dH) for a specified span of this curve.
   * @param spanIndex
   * @param result optional reusable curve.  This will only be reused if it is a BezierCurve3d with matching order.
   */
  public getSaturatedBezierSpan3dH(spanIndex: number, result?: BezierCurveBase): BezierCurveBase | undefined {
    if (spanIndex < 0 || spanIndex >= this.numSpan)
      return undefined;

    const order = this.order;
    if (result === undefined || !(result instanceof BezierCurve3d) || result.order !== order)
      result = BezierCurve3dH.createOrder(order);
    const bezier = result as BezierCurve3dH;
    bezier.loadSpan3dPolesWithWeight(this._bcurve.packedData, spanIndex, 1.0);
    bezier.saturateInPlace(this._bcurve.knots, spanIndex);
    return result;
  }

  /**
   * Return a BezierCurveBase for this curve.  Because BSplineCurve3dH is homogeneous, the returned BezierCurveBase is always homogeneous.
   * @param spanIndex
   * @param result optional reusable curve.  This will only be reused if it is a BezierCurve3d with matching order.
   */
  public getSaturatedBezierSpan3dOr3dH(spanIndex: number, _prefer3dH: boolean, result?: BezierCurveBase): BezierCurveBase | undefined {
    return this.getSaturatedBezierSpan3dH(spanIndex, result);
  }

  public dispatchToGeometryHandler(handler: GeometryHandler): any {
    return handler.handleBSplineCurve3dH(this);
  }

  public extendRange(rangeToExtend: Range3d, transform?: Transform): void {
    const buffer = this._bcurve.packedData;
    const n = buffer.length - 3;
    if (transform) {
      for (let i0 = 0; i0 < n; i0 += 4)
        rangeToExtend.extendTransformedXYZW(transform, buffer[i0], buffer[i0 + 1], buffer[i0 + 2], buffer[i0 + 3]);
    } else {
      for (let i0 = 0; i0 < n; i0 += 4)
        rangeToExtend.extendXYZW(buffer[i0], buffer[i0 + 1], buffer[i0 + 2], buffer[i0 + 3]);
    }
  }
}
