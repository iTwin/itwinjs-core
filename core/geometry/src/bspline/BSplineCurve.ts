/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Bspline
 */

import { CurveIntervalRole, CurveLocationDetail } from "../curve/CurveLocationDetail";
import { CurvePrimitive } from "../curve/CurvePrimitive";
import { CurveOffsetXYHandler } from "../curve/internalContexts/CurveOffsetXYHandler";
import { PlaneAltitudeRangeContext } from "../curve/internalContexts/PlaneAltitudeRangeContext";
import { LineString3d } from "../curve/LineString3d";
import { OffsetOptions } from "../curve/OffsetOptions";
import { StrokeCountMap } from "../curve/Query/StrokeCountMap";
import { StrokeOptions } from "../curve/StrokeOptions";
import { Geometry, PlaneAltitudeEvaluator } from "../Geometry";
import { GeometryHandler, IStrokeHandler } from "../geometry3d/GeometryHandler";
import { GrowableXYZArray } from "../geometry3d/GrowableXYZArray";
import { Plane3dByOriginAndUnitNormal } from "../geometry3d/Plane3dByOriginAndUnitNormal";
import { Plane3dByOriginAndVectors } from "../geometry3d/Plane3dByOriginAndVectors";
import { Point3d, Vector3d } from "../geometry3d/Point3dVector3d";
import { Point3dArray } from "../geometry3d/PointHelpers";
import { Range1d, Range3d } from "../geometry3d/Range";
import { Ray3d } from "../geometry3d/Ray3d";
import { Transform } from "../geometry3d/Transform";
import { Point4d } from "../geometry4d/Point4d";
import { UnivariateBezier } from "../numerics/BezierPolynomials";
import { AkimaCurve3dOptions } from "./AkimaCurve3d";
import { Bezier1dNd } from "./Bezier1dNd";
import { BezierCurve3d } from "./BezierCurve3d";
import { BezierCurve3dH } from "./BezierCurve3dH";
import { BezierCurveBase } from "./BezierCurveBase";
import { BSpline1dNd } from "./BSpline1dNd";
import { BSplineCurveOps } from "./BSplineCurveOps";
import { InterpolationCurve3dOptions } from "./InterpolationCurve3d";
import { BSplineWrapMode, KnotVector } from "./KnotVector";

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
 *   * The `order` poles begin at index `spanIndex`.
 *   * The `2*order` knots begin as span index
 *   * The knot interval for this span is from `knot[degree+span-1] to knot[degree+span]`
 * * The active part of the knot axis is `knot[degree-1] < knot < knot[degree-1 + numSpan]` i.e. `knot[degree-1] < knot < knot[numPoles]
 *
 * Nearly all bsplines are "clamped ".
 * * Clamping make the curve pass through its first and last poles, with tangents directed along the first and last edges of the control polygon.
 * * The knots for a clamped bspline have `degree` copies of the lowest knot value and `degree` copies of the highest knot value.
 * * For instance, the knot vector `[0,0,0,1,2,3,3,3]
 *   * can be evaluated from `0<=knot<=3`
 *   * has 3 spans: 0 to 1, 1 to 2, 2 to 3
 *   * has 6 poles
 *   * passes through its first and last poles.
 * * `create` methods may allow classic convention that has an extra knot at the beginning and end of the knot vector.
 *   * The extra knots (first and last) were never referenced by the bspline recurrence relations.
 *   * When the `create` methods recognize the classic setup (`numPoles + order = numKnots`), the extra knot is not saved with the BSplineCurve3dBase knots.
 *
 * * The weighted variant has the problem that CurvePrimitive 3d typing does not allow undefined result where Point4d has zero weight.
 * * The convention for these is to return 000 in such places.
 *
 * * Note the class relationships:
 *   * BSpline1dNd knows the bspline recurrence relations for control points (poles) with no physical meaning.
 *   * BsplineCurve3dBase owns a protected BSpline1dNd
 *   * BsplineCurve3dBase is derived from CurvePrimitive, which creates obligation to act as a 3D curve, such as
 *     * evaluate fraction to point and derivatives wrt fraction
 *     * compute intersection with plane
 *   * BSplineCurve3d and BSplineCurve3dH have variant logic driven by whether or not there are "weights" on the poles.
 *     * For `BSplineCurve3d`, the xyz value of pole calculations are "final" values for 3d evaluation
 *     * For `BSplineCurve3dH`, various `BSpline1dNd` results with xyzw have to be normalized back to xyz.
 *
 * * These classes do not support "periodic" variants.
 *   * Periodic curves need to have certain leading knots and poles replicated at the end
 * @public
 */
export abstract class BSplineCurve3dBase extends CurvePrimitive {
  /** String name for schema properties */
  public readonly curvePrimitiveType = "bsplineCurve";

  /** The underlying blocked-pole spline, with simple x,y,z poles */
  protected _bcurve: BSpline1dNd;
  private _definitionData?: any;
  public set definitionData(data: any) { this._definitionData = data; }
  public get definitionData(): any { return this._definitionData; }
  protected constructor(poleDimension: number, numPoles: number, order: number, knots: KnotVector) {
    super();
    this._bcurve = BSpline1dNd.create(numPoles, poleDimension, order, knots) as BSpline1dNd;
  }
  /** Return the degree (one less than the order) of the curve */
  public get degree(): number { return this._bcurve.degree; }
  /** Return the order (one more than degree) of the curve */
  public get order(): number { return this._bcurve.order; }
  /** Return the number of bezier spans in the curve.  Note that this number includes the number of null spans at repeated knows */
  public get numSpan(): number { return this._bcurve.numSpan; }
  /** Return the number of poles */
  public get numPoles(): number { return this._bcurve.numPoles; }
  /** Return live reference to the packed control point coordinates of the curve. */
  public get polesRef(): Float64Array { return this._bcurve.packedData; }
  /** Return live reference to the knots of the curve. */
  public get knotsRef(): Float64Array { return this._bcurve.knots.knots; }
  /** Number of components per pole.
   * * 3 for conventional (x,y,z) curve
   * * 4 for weighted (wx,wy,wz,w) curve
   */
  public get poleDimension(): number { return this._bcurve.poleLength; }
  /**
   * return a simple array form of the knots.  optionally replicate the first and last
   * in classic over-clamped manner
   */
  public copyKnots(includeExtraEndKnot: boolean): number[] { return this._bcurve.knots.copyKnots(includeExtraEndKnot); }

  /** Get the flag indicating the curve might be suitable for having wrapped "closed" interpretation. */
  public getWrappable(): BSplineWrapMode {
    return this._bcurve.knots.wrappable;
  }
  /** Set the flag indicating the curve might be suitable for having wrapped "closed" interpretation. */
  public setWrappable(value: BSplineWrapMode) {
    this._bcurve.knots.wrappable = value;
  }
  /**
   * Test knots and control points to determine if it is possible to close (aka "wrap") the curve.
   * @returns the manner in which it is possible to close the curve. See `BSplineWrapMode` for particulars of each mode.
   */
  public get isClosableCurve(): BSplineWrapMode {
    const mode = this._bcurve.knots.wrappable;
    if (mode === BSplineWrapMode.None)
      return BSplineWrapMode.None;
    if (!this._bcurve.knots.testClosable(mode))
      return BSplineWrapMode.None;
    if (!this._bcurve.testClosablePolygon(mode))
      return BSplineWrapMode.None;
    return mode;
  }
  /** Evaluate at a position given by fractional position within a span. */
  public abstract evaluatePointInSpan(spanIndex: number, spanFraction: number, result?: Point3d): Point3d;
  /** Evaluate at a position given by fractional position within a span. */
  public abstract evaluatePointAndDerivativeInSpan(spanIndex: number, spanFraction: number, result?: Ray3d): Ray3d;
  /** Evaluate xyz at a position given by knot. */
  public abstract knotToPoint(knot: number, result?: Point3d): Point3d;
  /** Evaluate xyz and derivative at position given by a knot value.  */
  public abstract knotToPointAndDerivative(knot: number, result?: Ray3d): Ray3d;
  /** Evaluate xyz and 2 derivatives at position given by a knot value.  */
  public abstract knotToPointAnd2Derivatives(knot: number, result?: Plane3dByOriginAndVectors): Plane3dByOriginAndVectors;
  /** Evaluate the curve point at `fraction` */
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
   * Return the start point of the curve.
   */
  public override startPoint(): Point3d { return this.evaluatePointInSpan(0, 0.0); }
  /**
   * Return the end point of the curve
   */
  public override endPoint(): Point3d { return this.evaluatePointInSpan(this.numSpan - 1, 1.0); }
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
    * Return a BezierCurveBase for this curve.  The concrete return type may be BezierCurve3d or BezierCurve3dH according to the instance type and the prefer3dH parameter.
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
   * @param _extend ignored. A BSplineCurve3dBase cannot be extended.
   * @returns Returns a CurveLocationDetail structure that holds the details of the close point.
   */
  public override closestPoint(spacePoint: Point3d, _extend: boolean): CurveLocationDetail | undefined {
    // seed at start point -- final point comes with final bezier perpendicular step.
    const point = this.fractionToPoint(0);
    const result = CurveLocationDetail.createCurveFractionPointDistance(this, 0.0, point, point.distance(spacePoint));

    let span: BezierCurve3dH | undefined;
    const numSpans = this.numSpan;
    for (let i = 0; i < numSpans; i++) {
      if (this._bcurve.knots.isIndexOfRealSpan(i)) {
        span = this.getSaturatedBezierSpan3dOr3dH(i, true, span) as BezierCurve3dH;
        if (span) {
          // umm ... if the bspline is discontinuous, both ends should be tested.  Ignore that possibility ...
          if (span.updateClosestPointByTruePerpendicular(spacePoint, result, false, true)) {
            // the detail records the span bezier -- promote it to the parent curve . ..
            result.curve = this;
            result.fraction = span.fractionToParentFraction(result.fraction);
          }
        }
      }
    }
    return result;
  }

    /** Return a deep clone. */
  public abstract override clone(): BSplineCurve3dBase;

  /** Return a transformed deep clone. */
  public override cloneTransformed(transform: Transform): BSplineCurve3dBase {
    const curve1 = this.clone();
    curve1.tryTransformInPlace(transform);
    return curve1;
  }

  /** Return a curve primitive which is a portion of this curve.
   * @param fractionA [in] start fraction
   * @param fractionB [in] end fraction
   */
  public override clonePartialCurve(fractionA: number, fractionB: number): BSplineCurve3dBase {
    const clone = this.clone();
    const origNumKnots = clone._bcurve.knots.knots.length;
    let knotA = clone._bcurve.knots.fractionToKnot(fractionA);
    let knotB = clone._bcurve.knots.fractionToKnot(fractionB);
    clone._bcurve.addKnot(knotA, clone.degree);
    clone._bcurve.addKnot(knotB, clone.degree);

    if (origNumKnots === clone._bcurve.knots.knots.length)
      return clone;  // full curve
    if (knotA > knotB) {
      const tmp = knotA; knotA = knotB; knotB = tmp;
    }

    // choose first/last knot and pole such that knotA/knotB has degree multiplicity in the new knot sequence
    const iStartKnot = clone._bcurve.knots.knotToLeftKnotIndex(knotA) - clone.degree + 1;
    const iStartPole = iStartKnot * clone._bcurve.poleLength;
    const iLastKnot = clone._bcurve.knots.knotToLeftKnotIndex(knotB);
    let iLastKnotLeftMultiple = iLastKnot - clone._bcurve.knots.getKnotMultiplicityAtIndex(iLastKnot) + 1;
    if (clone._bcurve.knots.knots[iLastKnot] < knotB)
      iLastKnotLeftMultiple = iLastKnot + 1;
    const iEndPole = (iLastKnotLeftMultiple + 1) * clone._bcurve.poleLength;  // one past last pole
    const iEndKnot = iLastKnotLeftMultiple + clone.degree;  // one past last knot

    // trim the arrays (leave knots unnormalized!)
    clone._bcurve.knots.setKnotsCapture(clone._bcurve.knots.knots.slice(iStartKnot, iEndKnot));
    clone._bcurve.packedData = clone._bcurve.packedData.slice(iStartPole, iEndPole);
    clone.setWrappable(BSplineWrapMode.None);  // always open
    return clone;
  }

  /** Implement `CurvePrimitive.appendPlaneIntersections`
   * @param plane A plane (e.g. specific type Plane3dByOriginAndUnitNormal or Point4d)
   * @param result growing array of plane intersections
   * @return number of intersections appended to the array.
  */
  public override appendPlaneIntersectionPoints(plane: PlaneAltitudeEvaluator, result: CurveLocationDetail[]): number {
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
    // A univariate bspline through the altitude poles gives altitude as function of the bspline knot.
    // The (bspline) altitude function for each span is `order` consecutive altitudes.
    // If those altitudes bracket zero, the span may potentially have a crossing.
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
                // save the curve evaluation at that fraction.
                numFound++;
                const fraction = this._bcurve.knots.spanFractionToFraction(spanIndex, spanFraction);
                if (!Geometry.isAlmostEqualNumber(fraction, previousFraction)) {
                  const detail = CurveLocationDetail.createCurveEvaluatedFraction(this, fraction);
                  detail.intervalRole = CurveIntervalRole.isolated;
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

  /**
   * Construct an offset of the instance curve as viewed in the xy-plane (ignoring z).
   * * No attempt is made to join the offsets of smaller constituent primitives. To construct a fully joined offset
   *   for an aggregate instance (e.g., LineString3d, CurveChainWithDistanceIndex), use RegionOps.constructCurveXYOffset() instead.
   * @param offsetDistanceOrOptions offset distance (positive to left of the instance curve), or options object
   */
  public override constructOffsetXY(offsetDistanceOrOptions: number | OffsetOptions): CurvePrimitive | CurvePrimitive[] | undefined {
    const options = OffsetOptions.create(offsetDistanceOrOptions);
    const handler = new CurveOffsetXYHandler(this, options.leftOffsetDistance);
    this.emitStrokableParts(handler, options.strokeOptions);
    return handler.claimResult();
  }
  /** Project instance geometry (via dispatch) onto the given ray, and return the extreme fractional parameters of projection.
   * @param ray ray onto which the instance is projected. A `Vector3d` is treated as a `Ray3d` with zero origin.
   * @param lowHigh optional receiver for output
   * @returns range of fractional projection parameters onto the ray, where 0.0 is start of the ray and 1.0 is the end of the ray.
   */
  public override projectedParameterRange(ray: Vector3d | Ray3d, lowHigh?: Range1d): Range1d | undefined {
    return PlaneAltitudeRangeContext.findExtremeFractionsAlongDirection(this, ray, lowHigh);
  }
}
/**
 * A BSplineCurve3d is a bspline curve whose poles are Point3d.
 * See BSplineCurve3dBase for description of knots, order, degree.
 * @public
 */
export class BSplineCurve3d extends BSplineCurve3dBase {

  private _workBezier?: BezierCurve3d;
  private initializeWorkBezier(): BezierCurve3d {
    if (this._workBezier === undefined)
      this._workBezier = BezierCurve3d.createOrder(this.order);
    return this._workBezier;
  }
  /** test of `other` is an instance of BSplineCurve3d */
  public isSameGeometryClass(other: any): boolean { return other instanceof BSplineCurve3d; }
  /** Apply `transform` to the poles. */
  public tryTransformInPlace(transform: Transform): boolean { Point3dArray.multiplyInPlace(transform, this._bcurve.packedData); return true; }
  /** Get a pole as simple Point3d. */
  public getPolePoint3d(poleIndex: number, result?: Point3d): Point3d | undefined {
    const k = this.poleIndexToDataIndex(poleIndex);
    if (k !== undefined) {
      const data = this._bcurve.packedData;
      return Point3d.create(data[k], data[k + 1], data[k + 2], result);
    }
    return undefined;
  }
  /** Get a pole as Point4d with weight 1 */
  public getPolePoint4d(poleIndex: number, result?: Point4d): Point4d | undefined {
    const k = this.poleIndexToDataIndex(poleIndex);
    if (k !== undefined) {
      const data = this._bcurve.packedData;
      return Point4d.create(data[k], data[k + 1], data[k + 2], 1.0, result);
    }
    return undefined;
  }
  /** Convert  `spanIndex` and `localFraction` to a knot. */
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
  public override copyKnots(includeExtraEndKnot: boolean): number[] { return this._bcurve.knots.copyKnots(includeExtraEndKnot); }

  /** Create a bspline with uniform knots. */
  public static createUniformKnots(poles: Point3d[] | Float64Array | GrowableXYZArray, order: number): BSplineCurve3d | undefined {
    const numPoles = poles instanceof Float64Array ? poles.length / 3 : poles.length;
    if (order < 2 || numPoles < order)
      return undefined;
    const knots = KnotVector.createUniformClamped(numPoles, order - 1, 0.0, 1.0);
    const curve = new BSplineCurve3d(numPoles, order, knots);
    if (poles instanceof Float64Array) {
      for (let i = 0; i < 3 * numPoles; i++)
        curve._bcurve.packedData[i] = poles[i];
    } else if (poles instanceof GrowableXYZArray) {
      curve._bcurve.packedData = poles.float64Data().slice(0, 3 * numPoles);
    } else {
      let i = 0;
      for (const p of poles) {
        curve._bcurve.packedData[i++] = p.x;
        curve._bcurve.packedData[i++] = p.y;
        curve._bcurve.packedData[i++] = p.z;
      }
    }
    return curve;
  }

  /** Create a smoothly closed B-spline curve with uniform knots.
   *  Note that the curve does not start at the first pole!
  */
  public static createPeriodicUniformKnots(poles: Point3d[] | Float64Array | GrowableXYZArray, order: number): BSplineCurve3d | undefined {
    if (order < 2)
      return undefined;

    let numPoles = poles instanceof Float64Array ? poles.length / 3 : poles.length;
    if (numPoles < 2)
      return undefined;

    const startPoint = Point3d.createZero();
    const endPoint = Point3d.createZero();
    let hasClosurePoint = false;
    do {
      if (poles instanceof Float64Array) {
        startPoint.set(poles[0], poles[1], poles[2]);
        endPoint.set(poles[3 * numPoles - 3], poles[3 * numPoles - 2], poles[3 * numPoles - 1]);
      } else if (poles instanceof GrowableXYZArray) {
        poles.getPoint3dAtUncheckedPointIndex(0, startPoint);
        poles.getPoint3dAtUncheckedPointIndex(numPoles - 1, endPoint);
      } else {
        startPoint.setFromPoint3d(poles[0]);
        endPoint.setFromPoint3d(poles[numPoles - 1]);
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
    const curve = new BSplineCurve3d(numPoles + degree, order, knots);
    if (poles instanceof Float64Array) {
      let i = 0;
      for (let j = 0; j < 3 * numPoles; j++)
        curve._bcurve.packedData[i++] = poles[j];
      for (let j = 0; j < 3 * degree; j++)
        curve._bcurve.packedData[i++] = poles[j];
    } else if (poles instanceof GrowableXYZArray) {
      let i = 0;
      for (let j = 0; j < 3 * numPoles; j++)
        curve._bcurve.packedData[i++] = poles.float64Data()[j];
      for (let j = 0; j < 3 * degree; j++)
        curve._bcurve.packedData[i++] = poles.float64Data()[j];
    } else {
      let i = 0;
      for (let j = 0; j < numPoles; j++) {
        curve._bcurve.packedData[i++] = poles[j].x;
        curve._bcurve.packedData[i++] = poles[j].y;
        curve._bcurve.packedData[i++] = poles[j].z;
      }
      for (let j = 0; j < degree; j++) {
        curve._bcurve.packedData[i++] = poles[j].x;
        curve._bcurve.packedData[i++] = poles[j].y;
        curve._bcurve.packedData[i++] = poles[j].z;
      }
    }
    return curve;
  }

  /**
   * Create a C2 cubic B-spline curve that interpolates the given points and optional end tangents.
   * @param options collection of points and end conditions.
   */
  public static createFromInterpolationCurve3dOptions(options: InterpolationCurve3dOptions): BSplineCurve3d | undefined {
    return BSplineCurveOps.createThroughPointsC2Cubic(options);
  }

  /**
   *
   * @param options collection of points and end conditions.
   */
  public static createFromAkimaCurve3dOptions(options: AkimaCurve3dOptions): BSplineCurve3d | undefined {
    return BSplineCurveOps.createThroughPoints(options.fitPoints, 4);  // temporary
  }

  /**
   * Create a bspline with given knots.
   * * The poles have several variants:
   *    * Float64Array(3 * numPoles) in blocks of [x,y,z]
   *    * Point3d[]
   *    * number[][], with inner dimension 3
   * * Two count conditions are recognized:
   *    * If poleArray.length + order === knotArray.length, the first and last are assumed to be the extraneous knots of classic clamping.
   *    * If poleArray.length + order === knotArray.length + 2, the knots are in modern form.
   */
  public static create(poleArray: Float64Array | Point3d[] | number[][], knotArray: Float64Array | number[], order: number): BSplineCurve3d | undefined {
    if (order < 2)
      return undefined;

    let numPoles = poleArray.length;
    if (poleArray instanceof Float64Array)
      numPoles = Math.floor(numPoles / 3);  // blocked as xyz
    if (numPoles < order)
      return undefined;

    const numKnots = knotArray.length;
    const skipFirstAndLast = (numPoles + order === numKnots);   // classic over-clamped input knots
    if (!skipFirstAndLast && numPoles + order !== numKnots + 2) // modern knots
      return undefined;
    const knots = KnotVector.create(knotArray, order - 1, skipFirstAndLast);

    const curve = new BSplineCurve3d(numPoles, order, knots);

    let i = 0;
    if (poleArray instanceof Float64Array) {
      for (const coordinate of poleArray)
        curve._bcurve.packedData[i++] = coordinate;
    } else if (poleArray[0] instanceof Point3d) {
      for (const p of poleArray as Point3d[]) {
        curve._bcurve.packedData[i++] = p.x;
        curve._bcurve.packedData[i++] = p.y;
        curve._bcurve.packedData[i++] = p.z;
      }
    } else if (Array.isArray(poleArray[0]) && poleArray[0].length === 3) {
      for (const point of poleArray as number[][])
        for (const coord of point)
          curve._bcurve.packedData[i++] = coord;
    } else {
      return undefined; // unexpected poleArray type
    }
    return curve;
  }

  /** Return a deep clone */
  public override clone(): BSplineCurve3d {
    const knotVector1 = this._bcurve.knots.clone();
    const curve1 = new BSplineCurve3d(this.numPoles, this.order, knotVector1);
    curve1._bcurve.packedData = this._bcurve.packedData.slice();
    return curve1;
  }

  /** Evaluate at a position given by fractional position within a span. */
  public evaluatePointInSpan(spanIndex: number, spanFraction: number): Point3d {
    this._bcurve.evaluateBuffersInSpan(spanIndex, spanFraction);
    return Point3d.createFrom(this._bcurve.poleBuffer);
  }
  /** Evaluate point and derivative vector at a position given by fractional position within a span.
   * * The derivative is with respect to the span fraction (NOT scaled to either global fraction or knot)
   */
  public evaluatePointAndDerivativeInSpan(spanIndex: number, spanFraction: number): Ray3d {
    this._bcurve.evaluateBuffersInSpan1(spanIndex, spanFraction);
    return Ray3d.createCapture(
      Point3d.createFrom(this._bcurve.poleBuffer),
      Vector3d.createFrom(this._bcurve.poleBuffer1));
  }

  /** Evaluate at a position given by a knot value.  */
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

  /** test if almost the same curve as `other` */
  public override isAlmostEqual(other: any): boolean {
    if (other instanceof BSplineCurve3d) {
      return this._bcurve.knots.isAlmostEqual(other._bcurve.knots)
        && Point3dArray.isAlmostEqual(this._bcurve.packedData, other._bcurve.packedData);
    }
    return false;
  }
  /** test if this curve is entirely within plane. */
  public isInPlane(plane: Plane3dByOriginAndUnitNormal): boolean {
    return Point3dArray.isCloseToPlane(this._bcurve.packedData, plane);
  }
  /** Return the control polygon length as approximation (always overestimate) of the curve length. */
  public quickLength(): number { return Point3dArray.sumEdgeLengths(this._bcurve.packedData); }
  /** Emit beziers or strokes (selected by the stroke options) to the handler. */
  public emitStrokableParts(handler: IStrokeHandler, options?: StrokeOptions): void {
    const needBeziers = handler.announceBezierCurve !== undefined;
    const workBezier = this.initializeWorkBezier();
    const numSpan = this.numSpan;
    let numStrokes;
    for (let spanIndex = 0; spanIndex < numSpan; spanIndex++) {
      const bezier = this.getSaturatedBezierSpan3dOr3dH(spanIndex, false, workBezier);
      if (bezier) {
        numStrokes = bezier.computeStrokeCountForOptions(options);
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

  /**
   * Assess length and turn to determine a stroke count.
   * @param options stroke options structure.
   */
  public computeStrokeCountForOptions(options?: StrokeOptions): number {
    const workBezier = this.initializeWorkBezier();
    const numSpan = this.numSpan;
    let numStroke = 0;
    for (let spanIndex = 0; spanIndex < numSpan; spanIndex++) {
      const bezier = this.getSaturatedBezierSpan3d(spanIndex, workBezier);
      if (bezier)
        numStroke += bezier.computeStrokeCountForOptions(options);
    }
    return numStroke;
  }
  /**
   * Compute individual segment stroke counts.  Attach in a StrokeCountMap.
   * @param options StrokeOptions that determine count
   * @param parentStrokeMap evolving parent map.
   * @alpha
   */
  public override computeAndAttachRecursiveStrokeCounts(options?: StrokeOptions, parentStrokeMap?: StrokeCountMap) {
    const workBezier = this.initializeWorkBezier();
    const numSpan = this.numSpan;
    const myData = StrokeCountMap.createWithCurvePrimitiveAndOptionalParent(this, parentStrokeMap, []);

    for (let spanIndex = 0; spanIndex < numSpan; spanIndex++) {
      const bezier = this.getSaturatedBezierSpan3d(spanIndex, workBezier);
      if (bezier) {
        const segmentLength = workBezier.curveLength();
        const numStrokeOnSegment = workBezier.computeStrokeCountForOptions(options);
        myData.addToCountAndLength(numStrokeOnSegment, segmentLength);
      }
    }
    CurvePrimitive.installStrokeCountMap(this, myData, parentStrokeMap);
  }
  /** Append strokes to a linestring. */
  public emitStrokes(dest: LineString3d, options?: StrokeOptions): void {
    const workBezier = this.initializeWorkBezier();
    const numSpan = this.numSpan;
    for (let spanIndex = 0; spanIndex < numSpan; spanIndex++) {
      const bezier = this.getSaturatedBezierSpan3d(spanIndex, workBezier);
      if (bezier)
        bezier.emitStrokes(dest, options);
    }
  }
  /**
   * Test knots and control points to determine if it is possible to close (aka "wrap") the curve.
   * @returns the manner in which it is possible to close the curve. See `BSplineWrapMode` for particulars of each mode.
   */
   public get isClosable(): BSplineWrapMode {
    return this.isClosableCurve;
  }
  /**
   * Return a BezierCurveBase for this curve.  The concrete return type may be BezierCurve3d or BezierCurve3dH according to this type.
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
    if (bezier.saturateInPlace(this._bcurve.knots, spanIndex))
      return result;
    return undefined;
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
    if (bezier.saturateInPlace(this._bcurve.knots, spanIndex))
      return bezier;
    return undefined;
  }

  /** Second step of double dispatch:  call `handler.handleBSplineCurve3d(this)` */
  public dispatchToGeometryHandler(handler: GeometryHandler): any {
    return handler.handleBSplineCurve3d(this);
  }
  /**
   * Extend a range so in includes the range of this curve
   * * REMARK: this is based on the poles, not the exact curve.  This is generally larger than the true curve range.
   * @param rangeToExtend
   * @param transform transform to apply to points as they are entered into the range.
   */
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
