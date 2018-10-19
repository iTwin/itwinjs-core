/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

/** @module Bspline */

// import { Point2d } from "../Geometry2d";
/* tslint:disable:variable-name jsdoc-format no-empty no-console*/
import { Point3d, Vector3d } from "../geometry3d/Point3dVector3d";
import { Range3d, Range1d } from "../geometry3d/Range";
import { Transform } from "../geometry3d/Transform";
import { Ray3d } from "../geometry3d/Ray3d";
import { Plane3dByOriginAndVectors } from "../geometry3d/Plane3dByOriginAndVectors";

import { CurvePrimitive } from "../curve/CurvePrimitive";
import { CurveLocationDetail } from "../curve/CurveLocationDetail";

import { StrokeOptions } from "../curve/StrokeOptions";
import { Geometry, PlaneAltitudeEvaluator } from "../Geometry";
import { Plane3dByOriginAndUnitNormal } from "../geometry3d/Plane3dByOriginAndUnitNormal";
import { GeometryHandler, IStrokeHandler } from "../geometry3d/GeometryHandler";
import { KnotVector } from "./KnotVector";
import { LineString3d } from "../curve/LineString3d";
import { Point3dArray } from "../geometry3d/PointHelpers";
import { BezierCurveBase } from "./BezierCurveBase";
import { BezierCurve3dH } from "./BezierCurve3dH";
import { BezierCurve3d } from "./BezierCurve3d";
import { BSpline1dNd } from "./BSpline1dNd";
import { UnivariateBezier } from "../numerics/BezierPolynomials";
import { Bezier1dNd } from "./Bezier1dNd";
import { Point4d } from "../geometry4d/Point4d";

/**
 * Base class for BSplineCurve3d and BSplineCurve3dH.
 * * A bspline curve consists of a set of knots and a set of poles.
 * * The bspline curve is a function of the independent "knot axis" variable
 * * The curve "follows" the poles loosely.
 * * The is a set of polynomial spans.
 * * The polynomial spans all have same `degree`.
 * * Within each span, the polynomial of that `degree` is controlled by `order = degree + 1` contiguous points called poles.
 * * The is a strict relationship between knot and poles counts:  `numPoles + order = numKnots + 2'
 * * The number of spans is `numSpan = numPoles - degree`
 * * For a given `spanIndex`:
 * * * The `order` poles begin at index `spanIndex`.
 * * * The `2*order` knots begin as span index
 * * * The knot interval for this span is from `knot[degree+span-1] to knot[degree+span]`
 * * The active part of the knot axis is `knot[degree-1] < knot < knot[degree-1 + numSpan]` i.e. `knot[degree-1] < knot < knot[numPoles]
 *
 * Nearly all bsplines are "clamped ".
 * * Clamping make the curve pass through its first and last poles, with tangents directed along the first and last edges of the control polygon.
 * * The knots for a clampled bspline have `degree` copies of the lowest knot value and `degree` copies of the highest knot value.
 * * For instance, the knot vector `[0,0,0,1,2,3,3,3]
 * * * can be evaluated from `0<=knot<=3`
 * * * has 3 spans: 0 to 1, 1 to 2, 2 to 3
 * * * has 6 poles
 * * * passes through its first and last poles.
 * * `create` methods may allow classic convention that has an extra knot at the beginning and end of the knot vector.
 * * * The extra knots (first and last) were never referenced by the bspline recurrance relations.
 * * * When the `ceate` methods recognize the classic setup (`numPoles + order = numKnots`), the extra knot is not saved with the BSplineCurve3dBase knots.
 *
 * * The weighted variant has the problem that CurvePrimitive 3d typing does not allow undefined result where Point4d has zero weight.
 * * The convention for these is to return 000 in such places.
 *
 * * Note the class relationships:
 * * * BSpline1dNd knows the bspline reucurrance relations for control points (poles) with no physical meaning.
 * * * BsplineCurve3dBase owns a protected BSpline1dNd
 * * * BsplineCurve3dBase is derived from CurvePrimitive, which creates obligation to act as a 3D curve, such as
 * * * * evaluate fraction to point and derivatives wrt fraction
 * * * * compute intersection with plane
 * * * BSplineCurve3d and BSplineCurve3dH have variant logic driven by whether or not there are "weights" on the poles.
 * * * * For `BSplineCurve3d`, the xyz value of pole calculations are "final" values for 3d evaluation
 * * * * For `BSplineCurve3dH`, various `BSpline1dNd` results with xyzw have to be normalized back to xyz.
 *
 * * These classes do not support "periodic" variants.
 * * * Periodic curves need to have certain leading knots and poles replicated at the end
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
  /**
   * Return the start point of hte curve.
   */
  public startPoint(): Point3d { return this.evaluatePointInSpan(0, 0.0); }
  /**
   * Return the end point of the curve
   */
  public endPoint(): Point3d { return this.evaluatePointInSpan(this.numSpan - 1, 1.0); }
  /** Reverse the curve in place.
   * * Poles are reversed
   * * knot values are mirrored around the middle of the
   */
  public reverseInPlace(): void { this._bcurve.reverseInPlace(); }
  /**
   * Return an array with this curve's bezier fragments.
   */
  public collectBezierSpans(prefer3dH: boolean): BezierCurveBase[] {
    const result: BezierCurveBase[] = [];
    const numSpans = this.numSpan;
    for (let i = 0; i < numSpans; i++) {
      if (this._bcurve.knots.isIndexOfRealSpan(i)) {
        const span = this.getSaturatedBezierSpan3dOr3dH(i, prefer3dH);
        if (span)
          result.push(span);
      }
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
  /** Return a specified pole as a Point4d.
   * * BSplineCurve3d appends weight 1 to its xyz
   * * BSplineCurve3dH with pole whose "normalized" point is (x,y,z) but has weight w returns its weighted (wx,wy,wz,w)
   */
  public abstract getPolePoint4d(poleIndex: number, result?: Point4d): Point4d | undefined;
  /** Return a specified pole as a Point3d
   * * BSplineCurve3d returns its simple xyz
   * * BSplineCurve3dH attempts to normalize its (wx,wy,wz,w) back to (x,y,z), and returns undefined if weight is zero.
   * @param poleIndex
   * @param result optional result
   */
  public abstract getPolePoint3d(poleIndex: number, result?: Point3d): Point3d | undefined;

  /** Given a pole index, return the starting index for the contiguous array. */
  public poleIndexToDataIndex(poleIndex: number): number | undefined {
    if (poleIndex >= 0 && poleIndex < this.numPoles)
      return poleIndex * this._bcurve.poleLength;
    return undefined;
  }

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
      if (this._bcurve.knots.isIndexOfRealSpan(i)) {
        span = this.getSaturatedBezierSpan3dOr3dH(i, true, span) as BezierCurve3dH;
        if (span) {
          if (span.updateClosestPointByTruePerpendicular(spacePoint, result)) {
            // the detail records the span bezier -- promote it to the parent curve . ..
            result.curve = this;
            result.fraction = span.fractionToParentFraction(result.fraction);
          }
        }
      }
    }
    return result;
  }
  /** Implement `CurvePrimitive.appendPlaneIntersections`
   * @param plane A plane (e.g. specific type Plane3dByOriginAndUnitNormal or Point4d)
   * @param result growing array of plane intersections
   * @return number of intersections appended to the array.
  */
  public appendPlaneIntersectionPoints(plane: PlaneAltitudeEvaluator, result: CurveLocationDetail[]): number {
    const numPole = this.numPoles;
    const order = this.order;
    const allCoffs = new Float64Array(numPole);
    const numSpan = this.numSpan;
    const point4d = Point4d.create();
    // compute all pole altitudes from the plane
    const minMax = Range1d.createNull();
    // Put the altitudes of all the bspline poles in one array.
    for (let i = 0; i < numPole; i++) {
      allCoffs[i] = plane.weightedAltitude(this.getPolePoint4d(i, point4d)!);
      minMax.extendX(allCoffs[i]);
    }
    // A univaraite bspline throught the altitude poles gives altitude as function of the bspline knot.
    // The (bspline) altitude function for each span is `order` consecutive altitudes.
    // If those altitutdes bracket zero, the span may potentially have a crossing.
    // When that occurs,
    let univariateBezier: UnivariateBezier | undefined;
    let numFound = 0;
    let previousFraction = -1000.0;
    if (minMax.containsX(0.0)) {
      for (let spanIndex = 0; spanIndex < numSpan; spanIndex++) {
        if (this._bcurve.knots.isIndexOfRealSpan(spanIndex)) {  // ignore trivial knot intervals.
          // outer range test ...
          minMax.setNull();
          minMax.extendArraySubset(allCoffs, spanIndex, order);
          if (minMax.containsX(0.0)) {
            // pack the bspline support into a univariate bezier ...
            univariateBezier = UnivariateBezier.createArraySubset(allCoffs, spanIndex, order, univariateBezier)!;
            // saturate and solve the bezier
            Bezier1dNd.saturate1dInPlace(univariateBezier.coffs, this._bcurve.knots, spanIndex);
            const roots = univariateBezier.roots(0.0, true);
            if (roots) {
              for (const spanFraction of roots) {
                // promote each local bezier fraction to global fraction.
                // savet the curve evaluation at that fraction.
                numFound++;
                const fraction = this._bcurve.knots.spanFractionToFraction(spanIndex, spanFraction);
                if (!Geometry.isAlmostEqualNumber(fraction, previousFraction)) {
                  const detail = CurveLocationDetail.createCurveEvaluatedFraction(this, fraction);
                  result.push(detail);
                  previousFraction = fraction;
                }
              }
            }
          }
        }
      }
    }
    return numFound;
  }

}
/**
 * A BSplineCurve3d is a bspline curve whose poles are Point3d.
 * See BSplineCurve3dBase for description of knots, order, degree.
 */
export class BSplineCurve3d extends BSplineCurve3dBase {

  private _workBezier?: BezierCurve3dH;
  private initializeWorkBezier(): BezierCurve3dH {
    if (this._workBezier === undefined)
      this._workBezier = BezierCurve3dH.createOrder(this.order);
    return this._workBezier;
  }

  public isSameGeometryClass(other: any): boolean { return other instanceof BSplineCurve3d; }
  public tryTransformInPlace(transform: Transform): boolean { Point3dArray.multiplyInPlace(transform, this._bcurve.packedData); return true; }

  public getPolePoint3d(poleIndex: number, result?: Point3d): Point3d | undefined {
    const k = this.poleIndexToDataIndex(poleIndex);
    if (k !== undefined) {
      const data = this._bcurve.packedData;
      return Point3d.create(data[k], data[k + 1], data[k + 2], result);
    }
    return undefined;
  }
  public getPolePoint4d(poleIndex: number, result?: Point4d): Point4d | undefined {
    const k = this.poleIndexToDataIndex(poleIndex);
    if (k !== undefined) {
      const data = this._bcurve.packedData;
      return Point4d.create(data[k], data[k + 1], data[k + 2], 1.0, result);
    }
    return undefined;
  }

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
  public emitStrokableParts(handler: IStrokeHandler, options?: StrokeOptions): void {
    const needBeziers = handler.announceBezierCurve !== undefined;
    const workBezier = this.initializeWorkBezier();
    const numSpan = this.numSpan;
    let numStrokes;
    for (let spanIndex = 0; spanIndex < numSpan; spanIndex++) {
      const bezier = this.getSaturatedBezierSpan3dOr3dH(spanIndex, false, workBezier);
      if (bezier) {
        numStrokes = bezier.strokeCount(options);
        if (needBeziers) {
          handler.announceBezierCurve!(bezier, numStrokes, this,
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
      if (!Geometry.isSamePoint3d(this.getPolePoint3d(p0) as Point3d, this.getPolePoint3d(p1) as Point3d))
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
