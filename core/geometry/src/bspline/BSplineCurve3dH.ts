/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Serialization
 */

import { CurvePrimitive } from "../curve/CurvePrimitive";
import { LineString3d } from "../curve/LineString3d";
import { StrokeCountMap } from "../curve/Query/StrokeCountMap";
import { StrokeOptions } from "../curve/StrokeOptions";
import { Geometry } from "../Geometry";
import { GeometryHandler, IStrokeHandler } from "../geometry3d/GeometryHandler";
import { Plane3dByOriginAndUnitNormal } from "../geometry3d/Plane3dByOriginAndUnitNormal";
import { Plane3dByOriginAndVectors } from "../geometry3d/Plane3dByOriginAndVectors";
import { Point3d } from "../geometry3d/Point3dVector3d";
import { Point3dArray, Point4dArray } from "../geometry3d/PointHelpers";
import { Range3d } from "../geometry3d/Range";
import { Ray3d } from "../geometry3d/Ray3d";
import { Transform } from "../geometry3d/Transform";
import { Point4d } from "../geometry4d/Point4d";
import { BezierCurve3dH } from "./BezierCurve3dH";
import { BezierCurveBase } from "./BezierCurveBase";
import { BSplineCurve3dBase } from "./BSplineCurve";
import { BSplineWrapMode, KnotVector } from "./KnotVector";

/**
 * Weighted (Homogeneous) BSplineCurve in 3d
 * @public
 */
export class BSplineCurve3dH extends BSplineCurve3dBase {
  private _workBezier?: BezierCurve3dH;
  private initializeWorkBezier(): BezierCurve3dH {
    if (this._workBezier === undefined)
      this._workBezier = BezierCurve3dH.createOrder(this.order);
    return this._workBezier;
  }
  /** Test if `other` is an instance of `BSplineCurve3dH` */
  public isSameGeometryClass(other: any): boolean { return other instanceof BSplineCurve3dH; }
  /** Apply `transform` to the curve */
  public tryTransformInPlace(transform: Transform): boolean { Point4dArray.multiplyInPlace(transform, this._bcurve.packedData); return true; }
  /** Get a pole, normalized to Point3d. */
  public getPolePoint3d(poleIndex: number, result?: Point3d): Point3d | undefined {
    const k = this.poleIndexToDataIndex(poleIndex);
    if (k !== undefined) {
      const data = this._bcurve.packedData;
      const divW = Geometry.conditionalDivideFraction(1.0, data[k + 3]);
      if (divW !== undefined)
        return Point3d.create(data[k] * divW, data[k + 1] * divW, data[k + 2] * divW, result);
    }
    return undefined;
  }
  /** Get a pole as Point4d */
  public getPolePoint4d(poleIndex: number, result?: Point4d): Point4d | undefined {
    const k = this.poleIndexToDataIndex(poleIndex);
    if (k !== undefined) {
      const data = this._bcurve.packedData;
      return Point4d.create(data[k], data[k + 1], data[k + 2], data[k + 3], result);
    }
    return undefined;
  }
  /** map a spanIndex and fraction to a knot value. */
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
  /** Return a simple array of the control points xyz coordinates.  */
  public copyXYZFloat64Array(deweighted: boolean): Float64Array {
    const numValue = this.numPoles * 3;
    const result = new Float64Array(numValue);
    let k = 0;
    for (let poleIndex = 0; poleIndex < this.numPoles; poleIndex++) {
      let i = poleIndex * 4;
      if (deweighted) {
        const w = this._bcurve.packedData[i + 3];
        const dw = w === 0.0 ? 1.0 : 1.0 / w;
        result[k++] = this._bcurve.packedData[i++] * dw;
        result[k++] = this._bcurve.packedData[i++] * dw;
        result[k++] = this._bcurve.packedData[i++] * dw;

      } else {
        result[k++] = this._bcurve.packedData[i++];
        result[k++] = this._bcurve.packedData[i++];
        result[k++] = this._bcurve.packedData[i++];
      }
    }
    return result;
  }
  public copyWeightsFloat64Array(): Float64Array {
    const result = new Float64Array(this.numPoles);
    for (let poleIndex = 0; poleIndex < this.numPoles; poleIndex++) {
      result[poleIndex] = this._bcurve.packedData[4 * poleIndex + 3];
    }
    return result;
  }

  /** Create a homogeneous B-spline curve with uniform knots.
   * * Control points may be supplied as:
   *   * array of Point4d, with weight already multiplied into the `[wx,wy,wz,w]`
   *   * array of Point3d, with implied weight 1.
   *   * Float64Array, blocked as [wx,wy,wz,w], i.e. 4 numbers per control point.
   * @param controlPoints pole data in array form as noted above.
   * @param order curve order (1 more than degree)
   */
  public static createUniformKnots(controlPoints: Point3d[] | Point4d[] | Float64Array, order: number): BSplineCurve3dH | undefined {
    const numPoles = (controlPoints instanceof Float64Array) ? controlPoints.length / 4 : controlPoints.length;
    if (order < 1 || numPoles < order)
      return undefined;
    const knots = KnotVector.createUniformClamped(controlPoints.length, order - 1, 0.0, 1.0);
    const curve = new BSplineCurve3dH(numPoles, order, knots);
    let i = 0;
    if (Array.isArray(controlPoints)) {
      if (controlPoints[0] instanceof Point3d) {
        for (const p of (controlPoints as Point3d[])) {
          curve._bcurve.packedData[i++] = p.x;
          curve._bcurve.packedData[i++] = p.y;
          curve._bcurve.packedData[i++] = p.z;
          curve._bcurve.packedData[i++] = 1.0;
        }
      } else if (controlPoints[0] instanceof Point4d) {
        for (const p of (controlPoints as Point4d[])) {
          curve._bcurve.packedData[i++] = p.x;
          curve._bcurve.packedData[i++] = p.y;
          curve._bcurve.packedData[i++] = p.z;
          curve._bcurve.packedData[i++] = p.w;
        }
      }
    } else {
      const numQ = controlPoints.length;
      for (let k = 0; k < numQ; k++)
        curve._bcurve.packedData[k] = controlPoints[k];
    }
    return curve;
  }

  /** Create a smoothly closed homogeneous B-spline curve with uniform knots.
   * * Note that the curve does not start at the first pole!
   * * Control points (poles) may be supplied as:
   *   * array of Point4d, with weight already multiplied into the `[wx,wy,wz,w]`
   *   * array of Point3d, with implied weight 1.
   *   * Float64Array, blocked as [wx,wy,wz,w], i.e. 4 numbers per control point.
   * @param poles control point data in array form as noted above.
   * @param order curve order (1 more than degree)
   */
  public static createPeriodicUniformKnots(poles: Point3d[] | Point4d[] | Float64Array, order: number): BSplineCurve3dH | undefined {
    if (order < 2)
      return undefined;

    let numPoles = poles instanceof Float64Array ? poles.length / 4 : poles.length;
    if (numPoles < 2)
      return undefined;

    const is4d = poles[0] instanceof Point4d;
    const startPoint = Point4d.createZero();
    const endPoint = Point4d.createZero();
    let hasClosurePoint = false;
    do {
      if (poles instanceof Float64Array) {
        startPoint.set(poles[0], poles[1], poles[2], poles[3]);
        endPoint.set(poles[4 * numPoles - 4], poles[4 * numPoles - 3], poles[4 * numPoles - 2], poles[4 * numPoles - 1]);
      } else {
        startPoint.set(poles[0].x, poles[0].y, poles[0].z, is4d ? (poles[0] as Point4d).w : 1.0);
        endPoint.set(poles[numPoles - 1].x, poles[numPoles - 1].y, poles[numPoles - 1].z, is4d ? (poles[numPoles - 1] as Point4d).w : 1.0);
      }
      if (hasClosurePoint = startPoint.isAlmostEqual(endPoint))
        --numPoles;   // remove wraparound pole if found
    } while (hasClosurePoint && numPoles > 1);

    if (numPoles < order)
      return undefined;

    const degree = order - 1;
    const numIntervals = numPoles;
    const knots = KnotVector.createUniformWrapped(numIntervals, degree, 0.0, 1.0);
    knots.wrappable = BSplineWrapMode.OpenByAddingControlPoints;
    // append degree wraparound poles
    const curve = new BSplineCurve3dH(numPoles + degree, order, knots);
    if (poles instanceof Float64Array) {
      let i = 0;
      for (let j = 0; j < 4 * numPoles; j++)
        curve._bcurve.packedData[i++] = poles[j];
      for (let j = 0; j < 4 * degree; j++)
        curve._bcurve.packedData[i++] = poles[j];
    } else {
      let i = 0;
      for (let j = 0; j < numPoles; j++) {
        curve._bcurve.packedData[i++] = poles[j].x;
        curve._bcurve.packedData[i++] = poles[j].y;
        curve._bcurve.packedData[i++] = poles[j].z;
        curve._bcurve.packedData[i++] = is4d ? (poles[j] as Point4d).w : 1.0;
      }
      for (let j = 0; j < degree; j++) {
        curve._bcurve.packedData[i++] = poles[j].x;
        curve._bcurve.packedData[i++] = poles[j].y;
        curve._bcurve.packedData[i++] = poles[j].z;
        curve._bcurve.packedData[i++] = is4d ? (poles[j] as Point4d).w : 1.0;
      }
    }
    return curve;
  }

  /**
   * Assemble a variously structured control points into packed array of [xyzw].
   * @param controlPoints
   */
  public static assemblePackedXYZW(controlPoints: Float64Array | Point4d[] | { xyz: Float64Array, weights: Float64Array } | Point3d[] | number[][]): Float64Array | undefined {
    if (controlPoints instanceof Float64Array)
      return controlPoints.slice();

    let packedPoints: Float64Array | undefined;
    if (Array.isArray(controlPoints) && controlPoints.length > 0) {
      const numPoints = controlPoints.length;
      let i = 0;
      if (controlPoints[0] instanceof Point4d) {
        packedPoints = new Float64Array(4 * numPoints);
        for (const p of (controlPoints as Point4d[])) {
          packedPoints[i++] = p.x;
          packedPoints[i++] = p.y;
          packedPoints[i++] = p.z;
          packedPoints[i++] = p.w;
        }
      } else if (controlPoints[0] instanceof Point3d) {
        packedPoints = new Float64Array(4 * numPoints);
        for (const p of (controlPoints as Point3d[])) {
          packedPoints[i++] = p.x;
          packedPoints[i++] = p.y;
          packedPoints[i++] = p.z;
          packedPoints[i++] = 1.0;
        }
      } else if (Array.isArray(controlPoints[0])) {
        if (controlPoints[0].length === 4) {
          packedPoints = new Float64Array(4 * numPoints);
          for (const point of controlPoints as number[][])
            for (const coord of point)
              packedPoints[i++] = coord;
        } else if (controlPoints[0].length === 3) {
          packedPoints = new Float64Array(4 * numPoints);
          for (const point of controlPoints as number[][]) {
            for (const coord of point)
              packedPoints[i++] = coord;
            packedPoints[i++] = 1.0;
          }
        }
      }
    } else { // controlPoints is NOT an array
      const obj = controlPoints as any;
      if (obj.xyz instanceof Float64Array && obj.weights instanceof Float64Array && obj.xyz.length === 3 * obj.weights.length) {
        const numPoints = obj.weights.length;
        packedPoints = new Float64Array(4 * numPoints);
        let m = 0;
        for (let i = 0; i < obj.weights.length; i++) {
          const k = 3 * i;
          packedPoints[m++] = obj.xyz[k];
          packedPoints[m++] = obj.xyz[k + 1];
          packedPoints[m++] = obj.xyz[k + 2];
          packedPoints[m++] = obj.weights[i];
        }
      }
    }
    return packedPoints;
  }

  /**
   * Create a bspline with given knots.
   * * The poles have several variants:
   *    * Float64Array(4 * numPoles) in blocks of [wx,xy,wz,w]
   *    * Point4d[numPoles]
   *    * Point3d[], with implied unit weight to be added
   *    * number[][], with inner dimension 4
   *    * {xyz: Float64Array(3 * numPoles), weights: Float64Array (numPoles)}
   * * Two count conditions are recognized:
   *    * If poleArray.length + order == knotArray.length, the first and last are assumed to be the extraneous knots of classic clamping.
   *    * If poleArray.length + order == knotArray.length + 2, the knots are in modern form.
   */
  public static create(controlPointData: Float64Array | Point4d[] | { xyz: Float64Array, weights: Float64Array } | Point3d[] | number[][], knotArray: Float64Array | number[], order: number): BSplineCurve3dH | undefined {
    if (order < 2)
      return undefined;

    const controlPoints = this.assemblePackedXYZW(controlPointData);
    if (undefined === controlPoints)
      return undefined;

    const numPoles = Math.floor(controlPoints.length / 4);
    if (numPoles < order)
      return undefined;

    const numKnots = knotArray.length;
    const skipFirstAndLast = (numPoles + order === numKnots);   // classic over-clamped input knots
    if (!skipFirstAndLast && numPoles + order !== numKnots + 2) // modern knots
      return undefined;
    const knots = KnotVector.create(knotArray, order - 1, skipFirstAndLast);

    const curve = new BSplineCurve3dH(numPoles, order, knots);

    let i = 0;
    for (const coordinate of controlPoints)
      curve._bcurve.packedData[i++] = coordinate;
    return curve;
  }

  /** Return a deep clone of this curve. */
  public override clone(): BSplineCurve3dH {
    const knotVector1 = this._bcurve.knots.clone();
    const curve1 = new BSplineCurve3dH(this.numPoles, this.order, knotVector1);
    curve1._bcurve.packedData = this._bcurve.packedData.slice();
    return curve1;
  }

  /** Evaluate at a position given by fractional position within a span. */
  public evaluatePointInSpan(spanIndex: number, spanFraction: number, result?: Point3d): Point3d {
    this._bcurve.evaluateBuffersInSpan(spanIndex, spanFraction);
    const xyzw = this._bcurve.poleBuffer;
    return Point4d.createRealPoint3dDefault000(xyzw[0], xyzw[1], xyzw[2], xyzw[3], result);
  }

  /** Evaluate at a position given by fractional position within a span. */
  public evaluatePointAndDerivativeInSpan(spanIndex: number, spanFraction: number, result?: Ray3d): Ray3d {
    this._bcurve.evaluateBuffersInSpan1(spanIndex, spanFraction);
    const xyzw = this._bcurve.poleBuffer;
    const dXYZW = this._bcurve.poleBuffer1;
    return Point4d.createRealDerivativeRay3dDefault000(
      xyzw[0], xyzw[1], xyzw[2], xyzw[3],
      dXYZW[0], dXYZW[1], dXYZW[2], dXYZW[3], result);
  }

  /** Evaluate at a position given by a knot value. */
  public knotToPoint(u: number, result?: Point3d): Point3d {
    this._bcurve.evaluateBuffersAtKnot(u);
    const xyzw = this._bcurve.poleBuffer;
    return Point4d.createRealPoint3dDefault000(xyzw[0], xyzw[1], xyzw[2], xyzw[3], result);
  }
  /** Evaluate at a position given by a knot value.  */
  public knotToPointAndDerivative(u: number, result?: Ray3d): Ray3d {
    this._bcurve.evaluateBuffersAtKnot(u, 1);
    const xyzw = this._bcurve.poleBuffer;
    const dXYZW = this._bcurve.poleBuffer1;
    return Point4d.createRealDerivativeRay3dDefault000(
      xyzw[0], xyzw[1], xyzw[2], xyzw[3],
      dXYZW[0], dXYZW[1], dXYZW[2], dXYZW[3], result);
  }

  /** Evaluate at a position given by a knot value.  Return point with 2 derivatives. */
  public knotToPointAnd2Derivatives(u: number, result?: Plane3dByOriginAndVectors): Plane3dByOriginAndVectors {
    this._bcurve.evaluateBuffersAtKnot(u, 2);
    const xyzw = this._bcurve.poleBuffer;
    const dXYZW = this._bcurve.poleBuffer1;
    const ddXYZW = this._bcurve.poleBuffer2;
    return Point4d.createRealDerivativePlane3dByOriginAndVectorsDefault000(
      xyzw[0], xyzw[1], xyzw[2], xyzw[3],
      dXYZW[0], dXYZW[1], dXYZW[2], dXYZW[3],
      ddXYZW[0], ddXYZW[1], ddXYZW[2], ddXYZW[3],
      result);
  }
  /** test if the curve is almost equal to `other` */
  public override isAlmostEqual(other: any): boolean {
    if (other instanceof BSplineCurve3dH) {
      return this._bcurve.knots.isAlmostEqual(other._bcurve.knots)
        && Point4dArray.isAlmostEqual(this._bcurve.packedData, other._bcurve.packedData);
    }
    return false;
  }
  /** Test if the curve is entirely within a plane. */
  public isInPlane(plane: Plane3dByOriginAndUnitNormal): boolean {
    return Point4dArray.isCloseToPlane(this._bcurve.packedData, plane);
  }
  /** Return the control polygon length as quick approximation to the curve length. */
  public quickLength(): number { return Point3dArray.sumEdgeLengths(this._bcurve.packedData); }
  /** call a handler with interval data for stroking. */
  public emitStrokableParts(handler: IStrokeHandler, options?: StrokeOptions): void {
    const needBeziers = (handler as any).announceBezierCurve;
    const workBezier = this.initializeWorkBezier();
    const numSpan = this.numSpan;
    let numStrokes;
    for (let spanIndex = 0; spanIndex < numSpan; spanIndex++) {
      const bezier = this.getSaturatedBezierSpan3dOr3dH(spanIndex, false, workBezier);
      if (bezier) {
        numStrokes = bezier.computeStrokeCountForOptions(options);
        if (needBeziers) {
          (handler as any).announceBezierCurve(bezier, numStrokes, this,
            spanIndex,
            this._bcurve.knots.spanFractionToFraction(spanIndex, 0.0),
            this._bcurve.knots.spanFractionToFraction(spanIndex, 1.0));

        } else {
          handler.announceIntervalForUniformStepStrokes(this, numStrokes,
            this._bcurve.knots.spanFractionToFraction(spanIndex, 0.0),
            this._bcurve.knots.spanFractionToFraction(spanIndex, 1.0));
        }
      }
    }
  }
  /**  Append stroked approximation of this curve to the linestring. */
  public emitStrokes(dest: LineString3d, options?: StrokeOptions): void {
    const workBezier = this.initializeWorkBezier();
    const numSpan = this.numSpan;
    for (let spanIndex = 0; spanIndex < numSpan; spanIndex++) {
      const bezier = this.getSaturatedBezierSpan3dH(spanIndex, workBezier);
      if (bezier)
        bezier.emitStrokes(dest, options);
    }
  }
  /**
   * Assess length and turn to determine a stroke count.
   * @param options stroke options structure.
   */
  public computeStrokeCountForOptions(options?: StrokeOptions): number {
    const workBezier = this.initializeWorkBezier();
    const numSpan = this.numSpan;
    let numStroke = 0;
    for (let spanIndex = 0; spanIndex < numSpan; spanIndex++) {
      const bezier = this.getSaturatedBezierSpan3dH(spanIndex, workBezier);
      if (bezier)
        numStroke += bezier.computeStrokeCountForOptions(options);
    }
    return numStroke;
  }
  /**
   * Compute individual segment stroke counts.  Attach in a StrokeCountMap.
   * @param options StrokeOptions that determine count
   * @param parentStrokeMap evolving parent map.
   */
  public override computeAndAttachRecursiveStrokeCounts(options?: StrokeOptions, parentStrokeMap?: StrokeCountMap) {
    const workBezier = this.initializeWorkBezier();
    const numSpan = this.numSpan;
    const myData = StrokeCountMap.createWithCurvePrimitiveAndOptionalParent(this, parentStrokeMap, []);

    for (let spanIndex = 0; spanIndex < numSpan; spanIndex++) {
      const bezier = this.getSaturatedBezierSpan3dH(spanIndex, workBezier);
      if (bezier) {
        const segmentLength = workBezier.curveLength();
        const numStrokeOnSegment = workBezier.computeStrokeCountForOptions(options);
        myData.addToCountAndLength(numStrokeOnSegment, segmentLength);
      }
    }
    CurvePrimitive.installStrokeCountMap(this, myData, parentStrokeMap);
  }
  /**
   * Test knots and control points to determine if it is possible to close (aka "wrap") the curve.
   * @return whether the curve can be wrapped.
   */
  public get isClosable(): boolean {
    return BSplineWrapMode.None !== this.isClosableCurve;
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
    if (result === undefined || !(result instanceof BezierCurve3dH) || result.order !== order)
      result = BezierCurve3dH.createOrder(order);
    const bezier = result as BezierCurve3dH;
    bezier.loadSpan4dPoles(this._bcurve.packedData, spanIndex);
    if (bezier.saturateInPlace(this._bcurve.knots, spanIndex))
      return result;
    return undefined;
  }

  /**
   * Return a BezierCurveBase for this curve.  Because BSplineCurve3dH is homogeneous, the returned BezierCurveBase is always homogeneous.
   * @param spanIndex
   * @param result optional reusable curve.  This will only be reused if it is a BezierCurve3dH with matching order.
   */
  public getSaturatedBezierSpan3dOr3dH(spanIndex: number, _prefer3dH: boolean, result?: BezierCurveBase): BezierCurveBase | undefined {
    return this.getSaturatedBezierSpan3dH(spanIndex, result);
  }
  /** Second step of double dispatch:  call `handler.handleBSplineCurve3dH(this)` */
  public dispatchToGeometryHandler(handler: GeometryHandler): any {
    return handler.handleBSplineCurve3dH(this);
  }
  /**
   * Extend a range so in includes the range of this curve
   * * REMARK: this is based on the poles, not the exact curve.  This is generally larger than the true curve range.
   * @param rangeToExtend
   * @param transform transform to apply to points as they are entered into the range.
   */
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
