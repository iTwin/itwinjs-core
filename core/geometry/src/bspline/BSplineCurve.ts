/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

/** @module Bspline */

// import { Point2d } from "../Geometry2d";
/* tslint:disable:variable-name jsdoc-format no-empty no-console*/
import { Point3d, Vector3d } from "../geometry3d/Point3dVector3d";
import { Range3d } from "../geometry3d/Range";
import { Transform } from "../geometry3d/Transform";
import { Ray3d } from "../geometry3d/Ray3d";
import { Plane3dByOriginAndVectors } from "../geometry3d/Plane3dByOriginAndVectors";

import { CurvePrimitive } from "../curve/CurvePrimitive";
import { CurveLocationDetail } from "../curve/CurveLocationDetail";

import { StrokeOptions } from "../curve/StrokeOptions";
import { Geometry } from "../Geometry";
import { Plane3dByOriginAndUnitNormal } from "../geometry3d/Plane3dByOriginAndUnitNormal";
import { GeometryHandler, IStrokeHandler } from "../geometry3d/GeometryHandler";
import { KnotVector } from "./KnotVector";
import { LineString3d } from "../curve/LineString3d";
import { Point3dArray } from "../geometry3d/PointHelpers";
import { BezierCurve3d, BezierCurve3dH, BezierCurveBase } from "./BezierCurve";
import { BSpline1dNd } from "./BSpline1dNd";

/**
 * Base class for BSplineCurve3d and BSplineCurve3dH.
 * * The weighted variant has the problem that CurvePrimitive 3d typing does not allow undefined result where Point4d has zero weight.
 * * The convention for these is to return 000 in such places.
 */
export abstract class BSplineCurve3dBase extends CurvePrimitive {
  protected _bcurve: BSpline1dNd;
  protected constructor(poleDimension: number, numPoles: number, order: number, knots: KnotVector) {
    super();
    this._bcurve = BSpline1dNd.create(numPoles, poleDimension, order, knots) as BSpline1dNd;
  }
  public get degree(): number { return this._bcurve.degree; }
  public get order(): number { return this._bcurve.order; }
  public get numSpan(): number { return this._bcurve.numSpan; }
  public get numPoles(): number { return this._bcurve.numPoles; }
  /**
 * return a simple array form of the knots.  optionally replicate the first and last
 * in classic over-clamped manner
 */
  public copyKnots(includeExtraEndKnot: boolean): number[] { return this._bcurve.knots.copyKnots(includeExtraEndKnot); }

  /**
 * Set the flag indicating the bspline might be suitable for having wrapped "closed" interpretation.
 */
  public setWrappable(value: boolean) {
    this._bcurve.knots.wrappable = value;
  }

  /** Evaluate at a position given by fractional position within a span. */
  public abstract evaluatePointInSpan(spanIndex: number, spanFraction: number, result?: Point3d): Point3d;
  /** Evaluate at a position given by fractional position within a span. */
  public abstract evaluatePointAndTangentInSpan(spanIndex: number, spanFraction: number, result?: Ray3d): Ray3d;
  /** Evaluate xyz at a position given by knot. */
  public abstract knotToPoint(knot: number, result?: Point3d): Point3d;
  /** Evaluate xyz and derivative at position given by a knot value.  */
  public abstract knotToPointAndDerivative(knot: number, result?: Ray3d): Ray3d;
  /** Evaluate xyz and 2 derivatives at position given by a knot value.  */
  public abstract knotToPointAnd2Derivatives(knot: number, result?: Plane3dByOriginAndVectors): Plane3dByOriginAndVectors;

  public fractionToPoint(fraction: number, result?: Point3d): Point3d {
    return this.knotToPoint(this._bcurve.knots.fractionToKnot(fraction), result);
  }
  /** Construct a ray with
   * * origin at the fractional position along the arc
   * * direction is the first derivative, i.e. tangent along the curve
   */
  public fractionToPointAndDerivative(fraction: number, result?: Ray3d): Ray3d {
    const knot = this._bcurve.knots.fractionToKnot(fraction);
    result = this.knotToPointAndDerivative(knot, result);
    result.direction.scaleInPlace(this._bcurve.knots.knotLength01);
    return result;
  }

  /** Construct a plane with
   * * origin at the fractional position along the arc
   * * x axis is the first derivative, i.e. tangent along the curve
   * * y axis is the second derivative
   */
  public fractionToPointAnd2Derivatives(fraction: number, result?: Plane3dByOriginAndVectors): Plane3dByOriginAndVectors {
    const knot = this._bcurve.knots.fractionToKnot(fraction);
    result = this.knotToPointAnd2Derivatives(knot, result);
    const a = this._bcurve.knots.knotLength01;
    result.vectorU.scaleInPlace(a);
    result.vectorV.scaleInPlace(a * a);
    return result;
  }
  public startPoint(): Point3d { return this.evaluatePointInSpan(0, 0.0); }
  public endPoint(): Point3d { return this.evaluatePointInSpan(this.numSpan - 1, 1.0); }
  public reverseInPlace(): void { this._bcurve.reverseInPlace(); }
  /**
   * Return an array with this curve's bezier fragments.
   */
  public collectBezierSpans(prefer3dH: boolean): BezierCurveBase[] {
    const result: BezierCurveBase[] = [];
    const numSpans = this.numSpan;
    for (let i = 0; i < numSpans; i++) {
      const span = this.getSaturatedBezierSpan3dOr3dH(i, prefer3dH);
      if (span)
        result.push(span);
    }
    return result;
  }
  /**
    * Return a BezierCurveBase for this curve.  The concrete return type may be BezierCuve3d or BezierCurve3dH according to the instance type and the prefer3dH parameter.
    * @param spanIndex
    * @param prefer3dH true to force promotion to homogeneous.
    * @param result optional reusable curve.  This will only be reused if it is a BezierCurve3d with matching order.
    */
  public abstract getSaturatedBezierSpan3dOr3dH(spanIndex: number, prefer3dH: boolean, result?: BezierCurveBase): BezierCurveBase | undefined;

  /** Search for the curve point that is closest to the spacePoint.
   *
   * * If the space point is exactly on the curve, this is the reverse of fractionToPoint.
   * * Since CurvePrimitive should always have start and end available as candidate points, this method should always succeed
   * @param spacePoint point in space
   * @param extend true to extend the curve (if possible)
   * @returns Returns a CurveLocationDetail structure that holds the details of the close point.
   */
  public closestPoint(spacePoint: Point3d, _extend: boolean): CurveLocationDetail | undefined {
    const point = this.fractionToPoint(0);
    const result = CurveLocationDetail.createCurveFractionPointDistance(this, 0.0, point, point.distance(spacePoint));
    this.fractionToPoint(1.0, point);
    result.updateIfCloserCurveFractionPointDistance(this, 1.0, spacePoint, spacePoint.distance(point));

    let span: BezierCurve3dH | undefined;
    const numSpans = this.numSpan;
    for (let i = 0; i < numSpans; i++) {
      span = this.getSaturatedBezierSpan3dOr3dH(i, true, span) as BezierCurve3dH;
      if (span) {
        if (span.updateClosestPointByTruePerpendicular(spacePoint, result)) {
          // the detail records the span bezier -- promote it to the parent curve . ..
          result.curve = this;
          result.fraction = span.fractionToParentFraction(result.fraction);
        }
      }
    }
    return result;
  }
}

export class BSplineCurve3d extends BSplineCurve3dBase {
  public isSameGeometryClass(other: any): boolean { return other instanceof BSplineCurve3d; }
  public tryTransformInPlace(transform: Transform): boolean { Point3dArray.multiplyInPlace(transform, this._bcurve.packedData); return true; }

  public getPole(i: number, result?: Point3d): Point3d | undefined { return this._bcurve.getPoint3dPole(i, result); }
  public spanFractionToKnot(span: number, localFraction: number): number {
    return this._bcurve.spanFractionToKnot(span, localFraction);
  }
  private constructor(numPoles: number, order: number, knots: KnotVector) {
    super(3, numPoles, order, knots);
  }
  /** Return a simple array of arrays with the control points as `[[x,y,z],[x,y,z],..]` */
  public copyPoints(): any[] { return Point3dArray.unpackNumbersToNestedArrays(this._bcurve.packedData, 3); }
  /** Return a simple array of the control points coordinates */
  public copyPointsFloat64Array(): Float64Array { return this._bcurve.packedData.slice(); }
  /**
   * return a simple array form of the knots.  optionally replicate the first and last
   * in classic over-clamped manner
   */
  public copyKnots(includeExtraEndKnot: boolean): number[] { return this._bcurve.knots.copyKnots(includeExtraEndKnot); }

  /** Create a bspline with uniform knots. */
  public static createUniformKnots(poles: Point3d[], order: number): BSplineCurve3d | undefined {
    const numPoles = poles.length;
    if (order < 1 || numPoles < order)
      return undefined;
    const knots = KnotVector.createUniformClamped(poles.length, order - 1, 0.0, 1.0);
    const curve = new BSplineCurve3d(poles.length, order, knots);
    let i = 0;
    for (const p of poles) { curve._bcurve.packedData[i++] = p.x; curve._bcurve.packedData[i++] = p.y; curve._bcurve.packedData[i++] = p.z; }
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
  public static create(poleArray: Float64Array | Point3d[], knotArray: Float64Array | number[], order: number): BSplineCurve3d | undefined {
    let numPoles = poleArray.length;
    if (poleArray instanceof Float64Array) {
      numPoles /= 3;  // blocked as xyz
    }
    const numKnots = knotArray.length;
    // shift knots-of-interest limits for overclampled case ...
    const skipFirstAndLast = (numPoles + order === numKnots);
    if (order < 1 || numPoles < order)
      return undefined;
    const knots = KnotVector.create(knotArray, order - 1, skipFirstAndLast);
    const curve = new BSplineCurve3d(numPoles, order, knots);
    if (poleArray instanceof Float64Array) {
      let i = 0;
      for (const coordinate of poleArray) { curve._bcurve.packedData[i++] = coordinate; }
    } else {
      let i = 0;
      for (const p of poleArray) { curve._bcurve.packedData[i++] = p.x; curve._bcurve.packedData[i++] = p.y; curve._bcurve.packedData[i++] = p.z; }
    }
    return curve;
  }
  public clone(): BSplineCurve3d {
    const knotVector1 = this._bcurve.knots.clone();
    const curve1 = new BSplineCurve3d(this.numPoles, this.order, knotVector1);
    curve1._bcurve.packedData = this._bcurve.packedData.slice();
    return curve1;
  }
  public cloneTransformed(transform: Transform): BSplineCurve3d {
    const curve1 = this.clone();
    curve1.tryTransformInPlace(transform);
    return curve1;
  }
  /** Evaluate at a position given by fractional position within a span. */
  public evaluatePointInSpan(spanIndex: number, spanFraction: number): Point3d {
    this._bcurve.evaluateBuffersInSpan(spanIndex, spanFraction);
    return Point3d.createFrom(this._bcurve.poleBuffer);
  }
  public evaluatePointAndTangentInSpan(spanIndex: number, spanFraction: number): Ray3d {
    this._bcurve.evaluateBuffersInSpan1(spanIndex, spanFraction);
    return Ray3d.createCapture(
      Point3d.createFrom(this._bcurve.poleBuffer),
      Vector3d.createFrom(this._bcurve.poleBuffer1));
  }

  /** Evaluate at a positioni given by a knot value.  */
  public knotToPoint(u: number, result?: Point3d): Point3d {
    this._bcurve.evaluateBuffersAtKnot(u);
    return Point3d.createFrom(this._bcurve.poleBuffer, result);
  }
  /** Evaluate at a position given by a knot value.  */
  public knotToPointAndDerivative(u: number, result?: Ray3d): Ray3d {
    this._bcurve.evaluateBuffersAtKnot(u, 1);
    if (!result) return Ray3d.createCapture(
      Point3d.createFrom(this._bcurve.poleBuffer),
      Vector3d.createFrom(this._bcurve.poleBuffer1));
    result.origin.setFrom(this._bcurve.poleBuffer);
    result.direction.setFrom(this._bcurve.poleBuffer1);
    return result;
  }

  /** Evaluate at a position given by a knot value.  Return point with 2 derivatives. */
  public knotToPointAnd2Derivatives(u: number, result?: Plane3dByOriginAndVectors): Plane3dByOriginAndVectors {
    this._bcurve.evaluateBuffersAtKnot(u, 2);
    return Plane3dByOriginAndVectors.createOriginAndVectorsXYZ(
      this._bcurve.poleBuffer[0], this._bcurve.poleBuffer[1], this._bcurve.poleBuffer[2],
      this._bcurve.poleBuffer1[0], this._bcurve.poleBuffer1[1], this._bcurve.poleBuffer1[2],
      this._bcurve.poleBuffer2[0], this._bcurve.poleBuffer2[1], this._bcurve.poleBuffer2[2], result);
  }

  public fractionToPoint(fraction: number, result?: Point3d): Point3d {
    return this.knotToPoint(this._bcurve.knots.fractionToKnot(fraction), result);
  }

  public fractionToPointAndDerivative(fraction: number, result?: Ray3d): Ray3d {
    const knot = this._bcurve.knots.fractionToKnot(fraction);
    result = this.knotToPointAndDerivative(knot, result);
    result.direction.scaleInPlace(this._bcurve.knots.knotLength01);
    return result;
  }

  /** Construct a plane with
   * * origin at the fractional position along the arc
   * * x axis is the first derivative, i.e. tangent along the arc
   * * y axis is the second derivative, i.e. in the plane and on the center side of the tangent.
   * If the arc is circular, the second derivative is directly towards the center
   */
  public fractionToPointAnd2Derivatives(fraction: number, result?: Plane3dByOriginAndVectors): Plane3dByOriginAndVectors {
    const knot = this._bcurve.knots.fractionToKnot(fraction);
    result = this.knotToPointAnd2Derivatives(knot, result);
    const a = this._bcurve.knots.knotLength01;
    result.vectorU.scaleInPlace(a);
    result.vectorV.scaleInPlace(a * a);
    return result;
  }

  public isAlmostEqual(other: any): boolean {
    if (other instanceof BSplineCurve3d) {
      return this._bcurve.knots.isAlmostEqual(other._bcurve.knots)
        && Point3dArray.isAlmostEqual(this._bcurve.packedData, other._bcurve.packedData);
    }
    return false;
  }
  public isInPlane(plane: Plane3dByOriginAndUnitNormal): boolean {
    return Point3dArray.isCloseToPlane(this._bcurve.packedData, plane);
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
   * Return a BezierCurveBase for this curve.  The concrete return type may be BezierCuve3d or BezierCurve3dH according to this type.
   * @param spanIndex
   * @param result optional reusable curve.  This will only be reused if it is a BezierCurve3d with matching order.
   */
  public getSaturatedBezierSpan3dOr3dH(spanIndex: number, prefer3dH: boolean, result?: BezierCurveBase): BezierCurveBase | undefined {
    if (prefer3dH)
      return this.getSaturatedBezierSpan3dH(spanIndex, result);
    return this.getSaturatedBezierSpan3d(spanIndex, result);
  }

  /**
   * Return a CurvePrimitive (which is a BezierCurve3d) for a specified span of this curve.
   * @param spanIndex
   * @param result optional reusable curve.  This will only be reused if it is a BezierCurve3d with matching order.
   */
  public getSaturatedBezierSpan3d(spanIndex: number, result?: BezierCurveBase): BezierCurveBase | undefined {
    if (spanIndex < 0 || spanIndex >= this.numSpan)
      return undefined;

    const order = this.order;
    if (result === undefined || !(result instanceof BezierCurve3d) || result.order !== order)
      result = BezierCurve3d.createOrder(order);
    const bezier = result as BezierCurve3d;
    bezier.loadSpanPoles(this._bcurve.packedData, spanIndex);
    bezier.saturateInPlace(this._bcurve.knots, spanIndex);
    return result;
  }
  /**
   * Return a CurvePrimitive (which is a BezierCurve3dH) for a specified span of this curve.
   * @param spanIndex
   * @param result optional reusable curve.  This will only be reused if it is a BezierCurve3d with matching order.
   */
  public getSaturatedBezierSpan3dH(spanIndex: number, result?: BezierCurveBase): BezierCurve3dH | undefined {
    if (spanIndex < 0 || spanIndex >= this.numSpan)
      return undefined;

    const order = this.order;
    if (result === undefined || !(result instanceof BezierCurve3dH) || result.order !== order)
      result = BezierCurve3dH.createOrder(order);
    const bezier = result as BezierCurve3dH;
    bezier.loadSpan3dPolesWithWeight(this._bcurve.packedData, spanIndex, 1.0);
    bezier.saturateInPlace(this._bcurve.knots, spanIndex);
    return bezier;
  }

  /**
   * Set the flag indicating the bspline might be suitable for having wrapped "closed" interpretation.
   */
  public setWrappable(value: boolean) {
    this._bcurve.knots.wrappable = value;
  }

  public dispatchToGeometryHandler(handler: GeometryHandler): any {
    return handler.handleBSplineCurve3d(this);
  }

  public extendRange(rangeToExtend: Range3d, transform?: Transform): void {
    const buffer = this._bcurve.packedData;
    const n = buffer.length - 2;
    if (transform) {
      for (let i0 = 0; i0 < n; i0 += 3)
        rangeToExtend.extendTransformedXYZ(transform, buffer[i0], buffer[i0 + 1], buffer[i0 + 2]);
    } else {
      for (let i0 = 0; i0 < n; i0 += 3)
        rangeToExtend.extendXYZ(buffer[i0], buffer[i0 + 1], buffer[i0 + 2]);
    }
  }
}
