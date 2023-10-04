/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Curve
 */
import { assert } from "@itwin/core-bentley";
import { StrokeCountMap } from "../curve/Query/StrokeCountMap";
import { AxisOrder, Geometry, type PlaneAltitudeEvaluator } from "../Geometry";
import { Matrix3d } from "../geometry3d/Matrix3d";
import { Point3d, type Vector3d } from "../geometry3d/Point3dVector3d";
import { type Range1d, Range3d } from "../geometry3d/Range";
import { Ray3d } from "../geometry3d/Ray3d";
import { Transform } from "../geometry3d/Transform";
import { CurveIntervalRole, CurveLocationDetail, CurveSearchStatus } from "./CurveLocationDetail";
import { GeometryQuery } from "./GeometryQuery";
import { AppendPlaneIntersectionStrokeHandler } from "./internalContexts/AppendPlaneIntersectionStrokeHandler";
import { ClosestPointStrokeHandler } from "./internalContexts/ClosestPointStrokeHandler";
import { CurveLengthContext } from "./internalContexts/CurveLengthContext";
import { LineString3d } from "./LineString3d";

import type { AkimaCurve3d } from "../bspline/AkimaCurve3d";
import type { Arc3d } from "./Arc3d";
import type { BezierCurve3d } from "../bspline/BezierCurve3d";
import type { BSplineCurve3d } from "../bspline/BSplineCurve";
import type { Clipper } from "../clipping/ClipUtils";
import type { CurveChainWithDistanceIndex } from "./CurveChainWithDistanceIndex";
import type { DirectSpiral3d } from "./spiral/DirectSpiral3d";
import type { IntegratedSpiral3d } from "./spiral/IntegratedSpiral3d";
import type { InterpolationCurve3d } from "../bspline/InterpolationCurve3d";
import type { IStrokeHandler } from "../geometry3d/GeometryHandler";
import type { LineSegment3d } from "./LineSegment3d";
import type { OffsetOptions } from "./OffsetOptions";
import type { Plane3dByOriginAndUnitNormal } from "../geometry3d/Plane3dByOriginAndUnitNormal";
import type { Plane3dByOriginAndVectors } from "../geometry3d/Plane3dByOriginAndVectors";
import type { StrokeOptions } from "./StrokeOptions";
import type { VariantCurveExtendParameter } from "./CurveExtendMode";

/**
 * Describes the concrete type of a [[CurvePrimitive]]. Each type name maps to a specific subclass and can be used
 * for type-switching in conditional statements.
 *  - "arc" => [[Arc3d]]
 *  - "lineSegment" => [[LineSegment3d]]
 *  - "lineString" => [[LineString3d]]
 *  - "bsplineCurve" => [[BSplineCurve3dBase]] which is an intermediate class implemented by [[BSplineCurve3d]] and
 * [[BSplineCurve3dH]]
 *  - "bezierCurve" => [[BezierCurveBase]] which is an intermediate class implemented by [[BezierCurve3d]] and
 * [[BezierCurve3dH]]
 *  - "transitionSpiral" => [[TransitionSpiral3d]]
 *  - "curveChainWithDistanceIndex" => [[CurveChainWithDistanceIndex]]
 * @see [Curve Collections]($docs/learning/geometry/CurvePrimitive.md) learning article.
 * @see [[AnyCurvePrimitive]] for a union type that supports compile-time type narrowing.
 * @public
 */
export type CurvePrimitiveType = "arc" | "lineSegment" | "lineString" | "bsplineCurve" | "bezierCurve" | "transitionSpiral" | "curveChainWithDistanceIndex" | "interpolationCurve" | "akimaCurve";
/**
 * Union type for subclasses of [[CurvePrimitive]]. Specific subclasses can be discriminated at compile- or run-time
 * using [[CurvePrimitive.curvePrimitiveType]].
 * @public
 */
export type AnyCurvePrimitive = Arc3d | LineSegment3d | LineString3d | BSplineCurve3d | BezierCurve3d | DirectSpiral3d | IntegratedSpiral3d | CurveChainWithDistanceIndex | InterpolationCurve3d | AkimaCurve3d;
/**
 * Union type for a linear [[CurvePrimitive]].
 * @public
 */
export type LinearCurvePrimitive = LineSegment3d | LineString3d;
/**
 * Function signature for callback which announces a pair of numbers, such as a fractional interval, along with a
 * containing CurvePrimitive.
 * @public
 */
export type AnnounceNumberNumberCurvePrimitive = (a0: number, a1: number, cp: CurvePrimitive) => void;
/**
 * Function signature for a callback which announces a pair of numbers
 * @public
 */
export type AnnounceNumberNumber = (a0: number, a1: number) => void;
/** Function signature for a callback which announces a curve primitive
 * @public
 */
export type AnnounceCurvePrimitive = (cp: CurvePrimitive) => void;

/**
 * A curve primitive is bounded.
 * A curve primitive maps fractions in 0..1 to points in space.
 * As the fraction proceeds from 0 towards 1, the point moves "forward" along the curve.
 * True distance along the curve is not always strictly proportional to fraction.
 * * A LineSegment3d always has proportional fraction and distance.
 * * An Arc3d which is true circular has proportional fraction and distance.
 * * A LineString3d is not proportional (except for special case of all segments of equal length).
 * * A Spiral3d is proportional.
 * * A BsplineCurve3d is only proportional for special cases.
 * For fractions outside 0..1, the curve primitive class may either (a) return the near endpoint or (b) evaluate
 * an extended curve.
 * @public
 */
export abstract class CurvePrimitive extends GeometryQuery {
  /** String name for schema properties */
  public readonly geometryCategory = "curvePrimitive";
  /** String name for schema properties */
  public abstract readonly curvePrimitiveType: CurvePrimitiveType;
  /** Constructor */
  protected constructor() {
    super();
  }
  /**
   * Data attached during stroking for facets.
   */
  public strokeData?: StrokeCountMap;
  /**
   * Data attached in curve cutting.
   * @internal
   */
  public startCut?: CurveLocationDetail;
  /**
   * Data attached in curve cutting.
   * @internal
   */
  public endCut?: CurveLocationDetail;
  /**
   * Data attached by various algorithms (e.g. Region booleans)
   */
  public parent?: any;
  /**
   * Return the point (x,y,z) on the curve at fractional position.
   * @param fraction fractional position along the geometry.
   * @returns Returns a point on the curve.
   */
  public abstract fractionToPoint(fraction: number, result?: Point3d): Point3d;
  /**
   * Return the point (x,y,z) and derivative on the curve at fractional position.
   * * Note that this derivative is "derivative of xyz with respect to fraction".
   * * This derivative shows the speed of the "fractional point" moving along the curve.
   * * This is not generally a unit vector. Use fractionToPointAndUnitTangent for a unit vector.
   * @param fraction fractional position along the geometry.
   * @returns Returns a ray whose origin is the curve point and direction is the derivative with respect to the fraction.
   */
  public abstract fractionToPointAndDerivative(fraction: number, result?: Ray3d): Ray3d;
  /**
   * Returns a ray whose origin is the curve point and direction is the unit tangent.
   * @param fraction fractional position on the curve
   * @param result optional preallocated ray.
   */
  public fractionToPointAndUnitTangent(fraction: number, result?: Ray3d): Ray3d {
    const ray = this.fractionToPointAndDerivative(fraction, result);
    ray.trySetDirectionMagnitudeInPlace(1.0);
    return ray;
  }
  /**
   * Returns the (absolute) curvature magnitude.
   * * Base implementation in CurvePrimitive computes curvature from the first and second derivative vectors.
   * @param fraction fractional position on the curve
   */
  public fractionToCurvature(fraction: number): number | undefined {
    const data = this.fractionToPointAnd2Derivatives(fraction)!;
    const cross = data.vectorU.crossProduct(data.vectorV);
    const a = cross.magnitude();
    const b = data.vectorU.magnitude();
    return Geometry.conditionalDivideFraction(a, b * b * b);
  }
  /**
   * Return a plane with
   * * origin at fractional position along the curve
   * * vectorU is the first derivative, i.e. tangent vector with length equal to the rate of change with respect to
   * the fraction.
   * * vectorV is the second derivative, i.e. derivative of vectorU which points in the direction of the curve's
   * derivative's change.
   * * **Note:** We are dealing with a parametric equation of the curve (a function f : R -> R^3) so first and
   * second derivatives are in fact derivatives of the parametric equation.
   */
  public abstract fractionToPointAnd2Derivatives(
    fraction: number, result?: Plane3dByOriginAndVectors
  ): Plane3dByOriginAndVectors | undefined;
  /**
   * Construct a frenet frame:
   * * origin at the point on the curve
   * * x axis is unit vector along the curve (tangent)
   * * y axis is perpendicular and in the plane of the osculating circle. y axis is called "main normal"
   * * z axis perpendicular to those. z axis is called "bi-normal"
   */
  public fractionToFrenetFrame(fraction: number, result?: Transform): Transform | undefined {
    const plane = this.fractionToPointAnd2Derivatives(fraction);
    if (!plane)
      return undefined;
    // first derivative (plane.vectorU) and second derivative (plane.vectorV) are not essentially
    // perpendicular so we use createRigidFromColumns to make 3 perpendicular vectors.
    let axes = Matrix3d.createRigidFromColumns(plane.vectorU, plane.vectorV, AxisOrder.XYZ);
    if (axes)
      return Transform.createRefs(plane.origin, axes, result);
    // 2nd derivative not distinct. for example if curve is linear at fraction so second derivative is 0.
    // in this case we find perpendicular vector to plane.vectorU and pass it to createRigidFromColumns.
    const perpVector = Matrix3d.createPerpendicularVectorFavorXYPlane(plane.vectorU, plane.vectorV);
    axes = Matrix3d.createRigidFromColumns(plane.vectorU, perpVector, AxisOrder.XYZ);
    if (axes)
      return Transform.createRefs(plane.origin, axes, result);
    return undefined;
  }
  /**
   * Construct signed distance from a point on the planar curve to its center of curvature (in xy only).
   * * Positive distance means the center is to the left of the curve at fraction.
   * * Negative distance means the center is to the right of the curve at fraction.
   * * Zero distance means curve is linear at fraction.
   */
  public fractionToSignedXYRadiusOfCurvature(fraction: number): number {
    const plane = this.fractionToPointAnd2Derivatives(fraction);
    if (!plane)
      return 0.0;
    const cross = plane.vectorU.crossProductXY(plane.vectorV);
    const b = plane.vectorU.magnitude();
    if (b === 0.0)
      return 0.0;
    const r = Geometry.conditionalDivideCoordinate(b * b * b, cross);
    if (r !== undefined)
      return r;
    return 0.0;
  }
  /**
   * Construct a point extrapolated along tangent at fraction.
   * @param fraction fractional position on the primitive
   * @param distance (signed) distance to move on the tangent.
   */
  public fractionAndDistanceToPointOnTangent(fraction: number, distance: number): Point3d {
    const ray = this.fractionToPointAndUnitTangent(fraction);
    return ray.fractionToPoint(distance);
  }
  /**
   * Return the length of the curve.
   * * Curve length is always positive.
   */
  public curveLength(): number {
    const context = new CurveLengthContext();
    this.emitStrokableParts(context);
    return context.getSum();
  }
  /**
   * Returns a (high accuracy) length of the curve between fractional positions.
   * * Curve length is always positive.
   * * Default implementation applies a generic Gaussian integration.
   * * Most curve classes (certainly LineSegment, LineString, Arc) are expected to provide efficient implementations.
   */
  public curveLengthBetweenFractions(fraction0: number, fraction1: number): number {
    if (fraction0 === fraction1)
      return 0.0;
    const scale = this.getFractionToDistanceScale();
    if (scale !== undefined) {
      // We are in luck! simple proportions determine it all !!!
      // (for example, a LineSegment3d or a circular arc)
      const totalLength = this.curveLength();
      return Math.abs((fraction1 - fraction0) * totalLength);
    }
    const context = new CurveLengthContext(fraction0, fraction1);
    this.emitStrokableParts(context);
    return Math.abs(context.getSum());
  }
  /**
   * Returns a (high accuracy) range of the curve between fractional positions
   * * Default implementation returns the range of the curve from clonePartialCurve.
   */
  public rangeBetweenFractions(fraction0: number, fraction1: number, transform?: Transform): Range3d {
    return this.rangeBetweenFractionsByClone(fraction0, fraction1, transform);
  }
  /**
   * Returns a (high accuracy) range of the curve between fractional positions
   * * Default implementation returns the range of the curve from clonePartialCurve
   */
  public rangeBetweenFractionsByClone(fraction0: number, fraction1: number, transform?: Transform): Range3d {
    if (fraction0 === fraction1)
      return Range3d.create(this.fractionToPoint(fraction0));
    const fragment = this.clonePartialCurve(fraction0, fraction1);
    if (fragment)
      return fragment.range(transform);
    return Range3d.createNull();
  }
  /**
   * Returns an approximate range based on a fixed number of evaluations
   * * Default implementation returns a range determined by evaluating a specified number of points on the curve.
   * * Optional evaluate again at interval midpoints and extrapolate any increase
   * * For a smooth curve, Richardson extrapolation suggests each subdivision moves 3/4 of the way to final. So
   * extrapolationFactor of 1/3 gets speculatively moves closer to the tight range, and larger multipliers increase
   * confidence in being safely larger.
   * * This function is faster version to compute the range of a portion of a curve (because some curves can be
   * expensive to compute the partial curve and/or to compute the partial curve's range.
   * @param fraction0 start fraction for evaluation
   * @param fraction1 end fraction for evaluation
   * @param count number of points to evaluate
   * @param transform optional transform to be applied to the curve
   * @param extrapolationFactor if positive, evaluate again at interval midpoints and apply this fraction multiplier
   * to any increase in size.
   */
  public rangeBetweenFractionsByCount(
    fraction0: number, fraction1: number, count: number, transform?: Transform, extrapolationFactor: number = 0.0,
  ): Range3d {
    const range = Range3d.createNull();
    const workPoint = Point3d.create();
    range.extendPoint(this.startPoint(workPoint));
    range.extendPoint(this.endPoint(workPoint));
    // Evaluate at count fractions (fraction0 + i * fractionStep)
    const evaluateSteps = (fractionA: number, fractionStep: number, countA: number) => {
      let f = fractionA;
      for (let i = 0; i < countA; i++, f += fractionStep) {
        this.fractionToPoint(f, workPoint);
        if (transform)
          range.extendTransformedPoint(transform, workPoint);
        else
          range.extendPoint(workPoint);
      }
    };
    const interiorCount = count - 2;
    if (interiorCount > 0) {
      const localFraction0 = 1.0 / (interiorCount + 1);
      const globalFractionStep = localFraction0 * (fraction1 - fraction0);
      evaluateSteps(fraction0 + globalFractionStep, globalFractionStep, interiorCount);
    }
    if (extrapolationFactor > 0.0) {
      // Evaluate at midpoints.  Where this makes the range larger, apply extrapolationFactor to move it to safer
      // excess value. same interior step, but shift to interval midpoints.
      const baseRange = range.clone();
      const interiorCount1 = interiorCount + 1;
      const localFraction0 = 0.5 / interiorCount1;  // we only evaluate at new midpoints.
      const globalFractionStep = 2 * localFraction0 * (fraction1 - fraction0); // same as above, but avoids special logic for interiorCount = 0
      evaluateSteps(fraction0 + globalFractionStep * 0.5, globalFractionStep, interiorCount1);
      range.extendWhenLarger(baseRange, extrapolationFactor);
    }
    return range;
  }
  /**
   * Run an integration (with a default Gaussian quadrature) with a fixed fractional step
   * * This is typically called by specific curve type implementations of curveLengthBetweenFractions.
   * * For example, in Arc3d implementation of curveLengthBetweenFractions:
   *     * If the Arc3d is true circular, it the arc is true circular, use the direct `arcLength = radius * sweepRadians`
   *     * If the Arc3d is not true circular, call this method with an interval count appropriate to eccentricity and
   * sweepRadians.
   * @returns Returns the curve length via an integral estimated by numerical quadrature between the fractional positions.
   * @param fraction0 start fraction for integration
   * @param fraction1 end fraction for integration
   * @param numInterval number of quadrature intervals
   */
  public curveLengthWithFixedIntervalCountQuadrature(
    fraction0: number, fraction1: number, numInterval: number, numGauss: number = 5,
  ): number {
    if (fraction0 > fraction1) {
      const fSave = fraction0;
      fraction0 = fraction1;
      fraction1 = fSave;
    }
    const context = new CurveLengthContext(fraction0, fraction1, numGauss);
    context.announceIntervalForUniformStepStrokes(this, numInterval, fraction0, fraction1);
    return Math.abs(context.getSum());
  }
  /**
   * (Attempt to) find a position on the curve at a signed distance from start fraction.
   * * Return the position as a CurveLocationDetail.
   * * In the `CurveLocationDetail`, record:
   *   * `fraction` = fractional position
   *   * `point` = coordinates of the point
   *   * `a` = (signed!) distance moved.   If `allowExtension` is false and the move reached the start or end of the
   * curve, this distance is smaller than the requested signedDistance.
   *   * `curveSearchStatus` indicates one of:
   *     * `error` (unusual) computation failed not supported for this curve.
   *     * `success` full movement completed
   *     * `stoppedAtBoundary` partial movement completed. This can be due to either
   *        * `allowExtension` parameter sent as `false`
   *        * the curve type (e.g. bspline) does not support extended range.
   * * if `allowExtension` is true, movement may still end at the startPoint or end point for curves that do not support
   * extended geometry (specifically bsplines)
   * * if the curve returns a value (i.e. not `undefined`) for `curve.getFractionToDistanceScale()`, the base class
   * carries out the computation
   *    and returns a final location.
   *   * LineSegment3d relies on this.
   * * If the curve does not implement the computation or the curve has zero length, the returned `CurveLocationDetail`
   * has
   *    * `fraction` = the value of `startFraction`
   *    * `point` = result of `curve.fractionToPoint(startFraction)`
   *    * `a` = 0
   *    * `curveStartState` = `CurveSearchStatus.error`
   * @param startFraction fractional position where the move starts
   * @param signedDistance distance to move.   Negative distance is backwards in the fraction space
   * @param allowExtension if true, allow the move to go beyond the startPoint or endpoint of the curve.  If false,
   * do not allow movement beyond the startPoint or endpoint
   * @param result optional result.
   * @returns A CurveLocationDetail annotated as above. Note that if the curve does not support the calculation, there is
   * still a result which contains the point at the input startFraction, with failure indicated in the `curveStartState`
   * member
   */
  public moveSignedDistanceFromFraction(
    startFraction: number, signedDistance: number, allowExtension: boolean, result?: CurveLocationDetail,
  ): CurveLocationDetail {
    const scale = this.getFractionToDistanceScale();
    if (scale !== undefined) {
      // We are in luck! simple proportions determine it all  !!!
      // (for example, a LineSegment3d or a circular arc)
      const totalLength = this.curveLength();
      const signedFractionMove = Geometry.conditionalDivideFraction(signedDistance, totalLength);
      if (signedFractionMove === undefined) {
        return CurveLocationDetail.createCurveFractionPointDistanceCurveSearchStatus(
          this, startFraction, this.fractionToPoint(startFraction), 0.0, CurveSearchStatus.error);
      }
      return CurveLocationDetail.createConditionalMoveSignedDistance(
        allowExtension,
        this,
        startFraction,
        startFraction + signedFractionMove,
        signedDistance,
        result,
      );
    }
    return this.moveSignedDistanceFromFractionGeneric(startFraction, signedDistance, allowExtension, result);
  }
  /**
   * Generic algorithm to search for point at signed distance from a fractional startPoint.
   * * This will work for well for smooth curves.
   * * Curves with tangent or other low-order-derivative discontinuities may need to implement specialized algorithms.
   * * We need to find an endFraction which is the end-of-interval (usually upper) limit of integration of the tangent
   * magnitude from startFraction to endFraction
   * * That integral is a function of endFraction.
   * * The derivative of that integral with respect to end fraction is the tangent magnitude at end fraction.
   * * Use that function and (easily evaluated!) derivative for a Newton iteration
   * * TO ALL WHO HAVE FUZZY MEMORIES OF CALCULUS CLASS: "The derivative of the integral wrt upper limit is the value
   * of the integrand there" is the fundamental theorem of integral calculus !!! The fundamental theorem is not just
   * an abstraction !!! It is being used  here in its barest possible form !!!
   * * See https://en.wikipedia.org/wiki/Fundamental_theorem_of_calculus
   * @param startFraction
   * @param signedDistance
   * @param _allowExtension
   * @param result
   */
  protected moveSignedDistanceFromFractionGeneric(
    startFraction: number, signedDistance: number, allowExtension: boolean, result?: CurveLocationDetail,
  ): CurveLocationDetail {
    let limitFraction: number;
    const slackFraction = 0.1;  // slack to use when integration would otherwise have no room to work
    if (signedDistance === 0.0)
      return CurveLocationDetail.createCurveEvaluatedFraction(this, startFraction, result); // no movement, just evaluate at startFraction
    if (signedDistance > 0.0) {
      limitFraction = 1.0;
      if (startFraction >= 1.0) {
        const newStartFraction = 1.0 - slackFraction;
        signedDistance += this.curveLengthBetweenFractions(newStartFraction, startFraction);
        startFraction = newStartFraction;
      }
    } else { // signedDistance < 0.0
      limitFraction = 0.0;
      if (startFraction <= 0.0) {
        const newStartFraction = 0.0 + slackFraction;
        signedDistance -= this.curveLengthBetweenFractions(startFraction, newStartFraction);
        startFraction = newStartFraction;
      }
    }
    const availableLength = this.curveLengthBetweenFractions(startFraction, limitFraction);
    assert(availableLength > 0.0);
    const absDistance = Math.abs(signedDistance);
    if (availableLength < absDistance && !allowExtension)
      return CurveLocationDetail.createConditionalMoveSignedDistance(allowExtension, this, startFraction, limitFraction, signedDistance, result);

    const fractionStep = Geometry.conditionalDivideCoordinate(absDistance, availableLength);
    if (undefined === fractionStep) {
      // no available length!
      result = CurveLocationDetail.createCurveEvaluatedFraction(this, startFraction, result);
      result.curveSearchStatus = CurveSearchStatus.error;
      return result;
    }
    const directionFactor = signedDistance < 0.0 ? -1.0 : 1.0;
    let fractionB = Geometry.interpolate(startFraction, fractionStep, limitFraction);
    let fractionA = startFraction;
    let distanceA = 0.0;
    const tol = 1.0e-12 * availableLength;
    let numConverged = 0;
    const tangent = Ray3d.createXAxis();
    // on each loop entry:
    // fractionA is the most recent endOfInterval.  (It may have been reached by a mixture of forward and backward step.)
    // distanceA is the distance to (the point at) fractionA
    // fractionB is the next end fraction
    for (let iterations = 0; iterations < 10; iterations++) {
      const distanceAB = this.curveLengthBetweenFractions(fractionA, fractionB);
      const directionAB = fractionB > fractionA ? directionFactor : -directionFactor;
      const distance0B = distanceA + directionAB * distanceAB;
      const distanceError = absDistance - distance0B;
      if (Math.abs(distanceError) < tol) {
        numConverged++;
        if (numConverged > 1)
          break;
      } else {
        numConverged = 0;
      }
      this.fractionToPointAndDerivative(fractionB, tangent);
      const tangentMagnitude = tangent.direction.magnitude();
      fractionA = fractionB;
      fractionB = fractionA + directionFactor * distanceError / tangentMagnitude;
      if (fractionA === fractionB) { // YES -- that is an exact equality test.   When it happens, there's no need for confirming with another iteration.
        numConverged = 100;
        break;
      }
      distanceA = distance0B;
    }
    if (numConverged > 1)
      return CurveLocationDetail.createConditionalMoveSignedDistance(
        allowExtension, this, startFraction, fractionB, signedDistance, result,
      );
    result = CurveLocationDetail.createCurveEvaluatedFraction(this, startFraction, result);
    result.curveSearchStatus = CurveSearchStatus.error;
    return result;
  }
  /**
   * * Returns true if the curve can be easily extended past its start/end point (i.e., beyond the usual
   * fraction space [0,1]). Otherwise, returns false.
   * * Base class default implementation returns false.
   * * These classes (and perhaps others in the future) will return true:
   *   * LineSegment3d
   *   * LineString3d
   *   * Arc3d
   */
  public get isExtensibleFractionSpace(): boolean {
    return false;
  }
  /**
   * Compute a length for curve which may be a fast approximation to the true length.
   * This is expected to be either (a) exact or (b) larger than the actual length, but by no more than
   * a small multiple, perhaps up to PI/2, but commonly much closer to 1.
   *
   * * An example use of this is for setting a tolerance which is a small multiple of the curve length.
   * * Simple line, circular arc, and transition spiral may return exact length
   * * Ellipse may return circumference of some circle or polygon that encloses the ellipse.
   * * bspline curve may return control polygon length
   * *
   */
  public abstract quickLength(): number;
  /**
   * Search for a point on the curve that is closest to the spacePoint.
   * * If the space point is exactly on the curve, this is the reverse of fractionToPoint.
   * * Since CurvePrimitive should always have start and end available as candidate points, this method should always
   * succeed
   * @param spacePoint point in space
   * @param extend true to extend the curve (if possible), false for no extend, single CurveExtendOptions (for both
   * directions), or array of distinct CurveExtendOptions for start and end.
   * @returns Returns a CurveLocationDetail structure that holds the details of the close point.
   */
  public closestPoint(
    spacePoint: Point3d, extend: VariantCurveExtendParameter, result?: CurveLocationDetail,
  ): CurveLocationDetail | undefined {
    const strokeHandler = new ClosestPointStrokeHandler(spacePoint, extend, result);
    this.emitStrokableParts(strokeHandler);
    return strokeHandler.claimResult();
  }
  /**
   * Find intervals of this curvePrimitive that are interior to a clipper
   * @param clipper clip structure (e.g. clip planes)
   * @param announce (optional) function to be called announcing fractional intervals
   * `announce(fraction0, fraction1, curvePrimitive)`
   * @returns true if any "in" segments are announced.
   */
  public announceClipIntervals(_clipper: Clipper, _announce?: AnnounceNumberNumberCurvePrimitive): boolean {
    // DEFAULT IMPLEMENTATION -- no interior parts
    return false;
  }
  /** Return a deep clone. */
  public abstract override clone(): CurvePrimitive;
  /** Return a transformed deep clone. */
  public abstract override cloneTransformed(transform: Transform): CurvePrimitive | undefined;
  /**
   * Return (if possible) a curve primitive which is a portion of this curve.
   * @param _fractionA [in] start fraction
   * @param _fractionB [in] end fraction
   */
  public clonePartialCurve(_fractionA: number, _fractionB: number): CurvePrimitive | undefined {
    return undefined;
  }
  /**
   * If the curve primitive has distance-along-curve strictly proportional to curve fraction, return the scale factor.
   * If distance-along-the-curve is not proportional, return undefined.
   * * When defined, the scale factor is always the length of the curve.
   * * This scale factor is typically available for these curve types:
   * * * All `LineSegment3d`
   * * * Arc3d which is a true circular arc (axes perpendicular and of equal length).
   * * * CurveChainWithDistanceIndex
   * * This scale factor is undefined for these curve types:
   * * * Arc3d which is a true ellipse, i.e. unequal lengths of defining vectors or non-perpendicular defining vectors.
   * * * bspline and bezier curves
   * @returns scale factor or undefined
   */
  public getFractionToDistanceScale(): number | undefined {
    return undefined;
  }
  /** Reverse the curve's data so that its fractional stroking moves in the opposite direction. */
  public abstract reverseInPlace(): void;
  /**
   * Compute intersections of the curve with a plane.
   * * The intersections are appended to the result array.
   * * The base class implementation emits strokes to an AppendPlaneIntersectionStrokeHandler object, which uses a
   * Newton iteration to get high-accuracy intersection points within strokes.
   * * Derived classes should override this default implementation if there are easy analytic solutions.
   * * Derived classes are free to implement extended intersections (e.g. arc!!!)
   * @param plane The plane to be intersected.
   * @param result Array to receive intersections
   * @returns Return the number of CurveLocationDetail's added to the result array.
   */
  public appendPlaneIntersectionPoints(plane: PlaneAltitudeEvaluator, result: CurveLocationDetail[]): number {
    const strokeHandler = new AppendPlaneIntersectionStrokeHandler(plane, result);
    const n0 = result.length;
    this.emitStrokableParts(strokeHandler);
    return result.length - n0;
  }
  /**
   * Examine contents of an array of CurveLocationDetail.
   * Filter the intersections according to the parameters.
   * @param allowExtend if false, remove points on the extension.
   * @param applySnappedCoordinates if true, change the stored fractions and coordinates to exact end values.
   * Otherwise use the exact values only for purpose of updating the curveIntervalRole.
   * @param startEndFractionTolerance if nonzero, adjust fraction to 0 or 1 with this tolerance.
   * @param startEndXYZTolerance if nonzero, adjust to endpoint with this tolerance.
   * @internal
   */
  public static snapAndRestrictDetails(
    details: CurveLocationDetail[],
    allowExtend: boolean = true,
    applySnappedCoordinates: boolean = false,
    startEndFractionTolerance = Geometry.smallAngleRadians,
    startEndXYZTolerance = Geometry.smallMetricDistance,
  ): void {
    const n0 = details.length;
    let acceptIndex = 0;
    const point0 = Point3d.create();
    const point1 = Point3d.create();
    let snappedCoordinates: Point3d | undefined;
    for (let candidateIndex = 0; candidateIndex < n0; candidateIndex++) {
      snappedCoordinates = undefined;
      const detail = details[candidateIndex];
      let fraction = detail.fraction;
      let accept = allowExtend || Geometry.isIn01(fraction);
      if (detail.curve) {
        detail.curve.startPoint(point0);
        detail.curve.endPoint(point1);
      }
      if (startEndFractionTolerance > 0) {
        if (Math.abs(fraction) < startEndFractionTolerance) {
          fraction = 0.0;
          accept = true;
          detail.intervalRole = CurveIntervalRole.isolatedAtVertex;
          snappedCoordinates = point0;
        }
        if (Math.abs(fraction - 1.0) < startEndFractionTolerance) {
          fraction = 1.0;
          accept = true;
          detail.intervalRole = CurveIntervalRole.isolatedAtVertex;
          snappedCoordinates = point1;
          if (detail.curve)
            snappedCoordinates = detail.curve.startPoint(point1);
        }
      }
      if (startEndXYZTolerance > 0 && detail.curve !== undefined) {
        // REMARK: always test both endpoints.   If there is a cyclic fraction space, an intersection marked as "after" the end might have wrapped all the way to the beginning.
        if (detail.point.distance(point0) <= startEndXYZTolerance) {
          fraction = 0.0;
          detail.intervalRole = CurveIntervalRole.isolatedAtVertex;
          snappedCoordinates = point0;
        } else if (detail.point.distance(point1) <= startEndXYZTolerance) {
          fraction = 1.0;
          detail.intervalRole = CurveIntervalRole.isolatedAtVertex;
          snappedCoordinates = point1;
        }
      }
      if (accept) {
        if (applySnappedCoordinates) {
          detail.fraction = fraction;
          if (snappedCoordinates !== undefined)
            detail.point.setFrom(snappedCoordinates);
        }
        if (acceptIndex < candidateIndex)
          details[acceptIndex] = detail;
        acceptIndex++;
      }
    }
    if (acceptIndex < n0)
      details.length = acceptIndex;
  }
  /**
   * Ask if the curve is within tolerance of a plane.
   * @returns Returns true if the curve is completely within tolerance of the plane.
   */
  public abstract isInPlane(plane: Plane3dByOriginAndUnitNormal): boolean;
  /** Return the startPoint of the primitive. The default implementation returns fractionToPoint(0.0) */
  public startPoint(result?: Point3d): Point3d {
    return this.fractionToPoint(0.0, result);
  }
  /** Return the end point of the primitive. The default implementation returns fractionToPoint(1.0) */
  public endPoint(result?: Point3d): Point3d {
    return this.fractionToPoint(1.0, result);
  }
  /** Add strokes to caller-supplied linestring (function updates `dest`) */
  public abstract emitStrokes(dest: LineString3d, options?: StrokeOptions): void;
  /**
   * Ask the curve to announce points and simple subcurve fragments for stroking.
   * See IStrokeHandler for description of the sequence of the method calls.
   */
  public abstract emitStrokableParts(dest: IStrokeHandler, options?: StrokeOptions): void;
  /**
   * Return the stroke count required for given options.
   * * This returns a single number
   * * See computeComponentStrokeCountForOptions to get structured per-component counts and fraction mappings.
   * @param options StrokeOptions that determine count
   */
  public abstract computeStrokeCountForOptions(options?: StrokeOptions): number;
  /**
   * Attach StrokeCountMap structure to this primitive (and recursively to any children)
   * * Base class implementation (here) gets the simple count from computeStrokeCountForOptions and attaches it.
   * * LineString3d, arc3d, BezierCurve3d, BezierCurve3dH accept that default.
   * * Subdivided primitives (linestring, bspline curve) implement themselves and attach a StrokeCountMap containing the
   *       total count, and also containing an array of StrokeCountMap per component.
   * * For CurvePrimitiveWithDistanceIndex, the top level gets (only) a total count, and each child gets
   *       its own StrokeCountMap with appropriate structure.
   * @param options StrokeOptions that determine count
   * @param parentStrokeMap optional map from parent.  Its count, curveLength, and a1 values are increased with count
   * and distance from this primitive.
   * @return sum of `a0+this.curveLength()`, for use as `a0` of successor in chain.
   */
  public computeAndAttachRecursiveStrokeCounts(options?: StrokeOptions, parentMap?: StrokeCountMap) {
    const n = this.computeStrokeCountForOptions(options);
    const a = this.curveLength();
    CurvePrimitive.installStrokeCountMap(
      this,
      StrokeCountMap.createWithCurvePrimitive(this, n, a, 0, a),
      parentMap);
  }
  /**
   * Evaluate strokes at fractions indicated in a StrokeCountMap.
   *   * Base class implementation (here) gets the simple count from computeStrokeCountForOptions and strokes at
   * uniform fractions.
   *   * LineString3d, arc3d, BezierCurve3d, BezierCurve3dH accept that default.
   *   * Subdivided primitives (linestring, bspline curve) implement themselves and evaluate within components.
   *   * CurvePrimitiveWithDistanceIndex recurses to its children.
   * * if packedFraction and packedDerivative arrays are present in the LineString3d, fill them.
   * @param map = stroke count data.
   * @param linestring = receiver linestring.
   * @return number of strokes added.  0 if any errors matching the map to the curve primitive.
   */
  public addMappedStrokesToLineString3D(map: StrokeCountMap, linestring: LineString3d): number {
    const numPoint0 = linestring.numPoints();
    if (map.primitive && map.primitive === this && map.numStroke > 0) {
      for (let i = 0; i <= map.numStroke; i++) {
        const fraction = i / map.numStroke;
        linestring.appendFractionToPoint(this, fraction);
      }
    }
    return linestring.numPoints() - numPoint0;
  }
  /**
   * Final install step to save curveMap in curve. If parentMap is given, update its length, count, and a1 fields
   * @param curve curve to receive the annotation
   * @param map
   * @param parentMap
   */
  public static installStrokeCountMap(curve: CurvePrimitive, curveMap: StrokeCountMap, parentMap?: StrokeCountMap) {
    if (parentMap)
      parentMap.addToCountAndLength(curveMap.numStroke, curveMap.curveLength);
    curve.strokeData = curveMap;
  }
  /**
   * Return an array containing only the curve primitives.
   * * This DEFAULT implementation simply pushes `this` to the collectorArray.
   * @param collectorArray array to receive primitives (pushed -- the array is not cleared)
   * @param smallestPossiblePrimitives if true, a [[CurvePrimitiveWithDistanceIndex]] recurses on its (otherwise hidden)
   * children. If false, it returns only itself.
   * @param explodeLinestrings if true, push a [[LineSegment3d]] for each segment of a [[LineString3d]]. If false,
   * push only the [[LineString3d]].
   */
  public collectCurvePrimitivesGo(
    collectorArray: CurvePrimitive[], _smallestPossiblePrimitives: boolean, _explodeLinestrings: boolean = false,
  ): void {
    collectorArray.push(this);
  }
  /**
   * Return an array containing only the curve primitives.
   * * This DEFAULT implementation captures the optional collector and calls [[collectCurvePrimitivesGo]].
   * @param collectorArray optional array to receive primitives.   If present, new primitives are ADDED (without
   * clearing the array.)
   * @param smallestPossiblePrimitives if false, CurvePrimitiveWithDistanceIndex returns only itself.  If true,
   * it recurses to its (otherwise hidden) children.
   */
  public collectCurvePrimitives(
    collectorArray?: CurvePrimitive[], smallestPossiblePrimitives: boolean = false, explodeLinestrings: boolean = false,
  ): CurvePrimitive[] {
    const results: CurvePrimitive[] = collectorArray === undefined ? [] : collectorArray;
    this.collectCurvePrimitivesGo(results, smallestPossiblePrimitives, explodeLinestrings);
    return results;
  }
  /**
   * Construct an offset of the instance curve as viewed in the xy-plane (ignoring z).
   * * No attempt is made to join the offsets of smaller constituent primitives. To construct a fully joined offset
   * for an aggregate instance (e.g., LineString3d, CurveChainWithDistanceIndex), use RegionOps.constructCurveXYOffset()
   * instead.
   * @param offsetDistanceOrOptions offset distance (positive to left of the instance curve), or options object
   */
  public abstract constructOffsetXY(
    offsetDistanceOrOptions: number | OffsetOptions
  ): CurvePrimitive | CurvePrimitive[] | undefined;

  /**
   * Project instance geometry (via dispatch) onto the line of the given ray, and return the extreme fractional
   * parameters of projection.
   * @param ray ray onto which the instance is projected. A `Vector3d` is treated as a `Ray3d` with zero origin.
   * @param lowHigh optional receiver for output
   * @returns range of fractional projection parameters onto the ray, where 0.0 is start of the ray and 1.0 is the
   * end of the ray.
   */
  public projectedParameterRange(_ray: Vector3d | Ray3d, _lowHigh?: Range1d): Range1d | undefined {
    return undefined; // common implementation delegated to subclasses to avoid circular dependency
  }
}
