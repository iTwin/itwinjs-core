/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Curve
 */

import { assert } from "@itwin/core-bentley";
import { Clipper } from "../clipping/ClipUtils";
import { BeJSONFunctions, Geometry, PlaneAltitudeEvaluator } from "../Geometry";
import { GeometryHandler, IStrokeHandler } from "../geometry3d/GeometryHandler";
import { Plane3dByOriginAndVectors } from "../geometry3d/Plane3dByOriginAndVectors";
import { Vector2d } from "../geometry3d/Point2dVector2d";
import { Point3d, Vector3d } from "../geometry3d/Point3dVector3d";
import { Range1d, Range3d } from "../geometry3d/Range";
import { Ray3d } from "../geometry3d/Ray3d";
import { Transform } from "../geometry3d/Transform";
import { Order2Bezier } from "../numerics/BezierPolynomials";
import { SmallSystem } from "../numerics/Polynomials";
import { CurveExtendOptions, VariantCurveExtendParameter } from "./CurveExtendMode";
import { CurveIntervalRole, CurveLocationDetail, CurveLocationDetailPair } from "./CurveLocationDetail";
import { AnnounceNumberNumberCurvePrimitive, CurvePrimitive } from "./CurvePrimitive";
import { GeometryQuery } from "./GeometryQuery";
import { PlaneAltitudeRangeContext } from "./internalContexts/PlaneAltitudeRangeContext";
import { LineString3d } from "./LineString3d";
import { OffsetOptions } from "./OffsetOptions";
import { StrokeOptions } from "./StrokeOptions";

/* eslint-disable @typescript-eslint/naming-convention, no-empty */

/**
 * A LineSegment3d is:
 * * A 3d line segment represented by its start and end coordinates
 *   * startPoint
 *   * endPoint
 * * The segment is parameterized with fraction 0 at the start and fraction 1 at the end, i.e. each of these
 * equivalent forms maps fraction `f` to a point `X(f)`:
 * ```
 * equation
 *  X(f) = P_0 + f*(P_1 - P_0)\newline
 *  X(f) = (1-f)*P_0 + f*P_1
 * ```
 * @public
 */
export class LineSegment3d extends CurvePrimitive implements BeJSONFunctions {
  /** String name for schema properties */
  public readonly curvePrimitiveType = "lineSegment";
  /** Test if `other` is of class `LineSegment3d` */
  public isSameGeometryClass(other: GeometryQuery): boolean {
    return other instanceof LineSegment3d;
  }
  /** Start point of the segment */
  private _point0: Point3d;
  /** End point of the segment */
  private _point1: Point3d;
  /**
   * Return REFERENCE to the start point of this segment.
   * * This is distinct from the `CurvePrimitive` abstract method `startPoint()` which creates a returned point.
   */
  public get point0Ref(): Point3d {
    return this._point0;
  }
  /**
   * Return REFERENCE to the end point of this segment.
   * * This is distinct from the `CurvePrimitive` abstract method `endPoint()` which creates a returned point.
   */
  public get point1Ref(): Point3d {
    return this._point1;
  }
  /** A LineSegment3d extends along its infinite line. */
  public override get isExtensibleFractionSpace(): boolean {
    return true;
  }
  /**
   * CAPTURE point references as a `LineSegment3d`
   * @param point0
   * @param point1
   */
  protected constructor(point0: Point3d, point1: Point3d) {
    super();
    this._point0 = point0;
    this._point1 = point1;
  }
  /** Set the start and endpoints by capturing input references. */
  public setRefs(point0: Point3d, point1: Point3d) {
    this._point0 = point0;
    this._point1 = point1;
  }
  /** Set the start and endpoints by cloning the input parameters. */
  public set(point0: Point3d, point1: Point3d) {
    this._point0 = point0.clone();
    this._point1 = point1.clone();
  }
  /** Copy (clone) data from other */
  public setFrom(other: LineSegment3d) {
    this._point0.setFrom(other._point0);
    this._point1.setFrom(other._point1);
  }
  /** Return a (clone of) the start point (This is NOT a reference to the stored start point) */
  public override startPoint(result?: Point3d): Point3d {
    if (result) { result.setFrom(this._point0); return result; }
    return this._point0.clone();
  }
  /** Return a (clone of) the end point (This is NOT a reference to the stored end point) */
  public override endPoint(result?: Point3d): Point3d {
    if (result) { result.setFrom(this._point1); return result; }
    return this._point1.clone();
  }
  /** Return the point and derivative vector at fractional position along the line segment. */
  public fractionToPointAndDerivative(fraction: number, result?: Ray3d): Ray3d {
    result = result ? result : Ray3d.createZero();
    result.direction.setStartEnd(this._point0, this._point1);
    this._point0.interpolate(fraction, this._point1, result.origin);
    return result;
  }
  /**
   * Construct a plane with
   * * origin at the fractional position along the line segment
   * * x axis is the first derivative, i.e. along the line segment
   * * y axis is the second derivative, i.e. 000
   */
  public fractionToPointAnd2Derivatives(fraction: number, result?: Plane3dByOriginAndVectors): Plane3dByOriginAndVectors {
    result = result ? result : Plane3dByOriginAndVectors.createXYPlane();
    result.vectorU.setStartEnd(this._point0, this._point1);
    result.vectorV.set(0, 0, 0);
    this._point0.interpolate(fraction, this._point1, result.origin);
    return result;
  }
  /** Clone the LineSegment3d */
  public clone(): LineSegment3d {
    return LineSegment3d.create(this._point0, this._point1);
  }
  /** Clone and apply transform to the clone. */
  public cloneTransformed(transform: Transform): LineSegment3d {  // we know tryTransformInPlace succeeds.
    const c = this.clone();
    c.tryTransformInPlace(transform);
    return c;
  }
  /** Create with start and end points.  The point contents are cloned into the LineSegment3d. */
  public static create(point0: Point3d, point1: Point3d, result?: LineSegment3d): LineSegment3d {
    if (result) {
      result.set(point0, point1);  // and this will clone them !!
      return result;
    }
    return new LineSegment3d(point0.clone(), point1.clone());
  }
  /** Create with start and end points.  The point contents are CAPTURED into the result */
  public static createCapture(point0: Point3d, point1: Point3d): LineSegment3d {
    return new LineSegment3d(point0, point1);
  }
  /**
   * Create a LineSegment3d from xy coordinates of start and end, with common z.
   * @param x0 start point x coordinate.
   * @param y0 start point y coordinate.
   * @param x1 end point x coordinate.
   * @param y1 end point y coordinate.
   * @param z z coordinate to use for both points.
   * @param result optional existing LineSegment to be reinitialized.
   */
  public static createXYXY(x0: number, y0: number, x1: number, y1: number, z: number = 0, result?: LineSegment3d) {
    if (result) {
      result._point0.set(x0, y0, z);
      result._point1.set(x1, y1, z);
      return result;
    }
    return new LineSegment3d(Point3d.create(x0, y0, z), Point3d.create(x1, y1, z));
  }
  /**
   * Create a LineSegment3d from xy coordinates of start and end, with common z.
   * @param x0 start point x coordinate.
   * @param y0 start point y coordinate.
   * @param x1 end point x coordinate.
   * @param y1 end point y coordinate.
   * @param z z coordinate to use for both points.
   * @param result optional existing LineSegment to be reinitialized.
   */
  public static createXYZXYZ(
    x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, result?: LineSegment3d,
  ): LineSegment3d {
    if (result) {
      result._point0.set(x0, y0, z0);
      result._point1.set(x1, y1, z1);
      return result;
    }
    return new LineSegment3d(Point3d.create(x0, y0, z0), Point3d.create(x1, y1, z1));
  }
  /** Return the point at fractional position along the line segment. */
  public fractionToPoint(fraction: number, result?: Point3d): Point3d {
    return this._point0.interpolate(fraction, this._point1, result);
  }
  /** Return the length of the segment. */
  public override curveLength(): number {
    return this._point0.distance(this._point1);
  }
  /** Return the length of the partial segment between fractions. */
  public override curveLengthBetweenFractions(fraction0: number, fraction1: number): number {
    return Math.abs(fraction1 - fraction0) * this._point0.distance(this._point1);
  }
  /** Return the length of the segment. */
  public quickLength(): number {
    return this.curveLength();
  }
  /**
   * Returns a curve location detail with both xyz and fractional coordinates of the closest point.
   * @param spacePoint point in space
   * @param extend if false, only return points within the bounded line segment. If true, allow the point to be on
   * the unbounded line that contains the bounded segment.
   * @param result optional pre-allocated object to populate and return
   * @returns detail, with `a` field set to the distance from `spacePoint` to the closest point
   */
  public override closestPoint(
    spacePoint: Point3d, extend: VariantCurveExtendParameter, result?: CurveLocationDetail,
  ): CurveLocationDetail {
    let fraction = spacePoint.fractionOfProjectionToLine(this._point0, this._point1, 0.0);
    fraction = CurveExtendOptions.correctFraction(extend, fraction);
    result = CurveLocationDetail.create(this, result);
    result.fraction = fraction;
    this._point0.interpolate(fraction, this._point1, result.point);
    result.vectorInCurveLocationDetail = undefined;
    result.a = result.point.distance(spacePoint);
    return result;
  }
  /**
   * Compute the closest approach between a pair of line segments.
   * * The approach distance is returned in the `a` fields of the details.
   * @param segmentA first line segment
   * @param extendA how to extend segmentA forward/backward
   * @param segmentB second line segment
   * @param extendB how to extend segmentB forward/backward
   * @param result optional pre-allocated object to populate and return
   * @returns pair of details, one per segment, each with `a` field set to the closest approach distance
   */
  public static closestApproach(
    segmentA: LineSegment3d,
    extendA: VariantCurveExtendParameter,
    segmentB: LineSegment3d,
    extendB: VariantCurveExtendParameter,
    result?: CurveLocationDetailPair,
  ): CurveLocationDetailPair | undefined {
    const unboundedFractions = Vector2d.create();
    if (result === undefined)
      result = CurveLocationDetailPair.createCapture(CurveLocationDetail.create(), CurveLocationDetail.create());
    if (SmallSystem.lineSegment3dClosestApproachUnbounded(segmentA._point0, segmentA._point1, segmentB._point0, segmentB._point1, unboundedFractions)) {
      // There is a simple approach between the unbounded segments.  Maybe its a really easy case ...
      const fractionA = CurveExtendOptions.correctFraction(extendA, unboundedFractions.x);
      const fractionB = CurveExtendOptions.correctFraction(extendB, unboundedFractions.y);
      // if neither fraction was corrected, just accept !!!
      if (fractionA === unboundedFractions.x && fractionB === unboundedFractions.y) {
        CurveLocationDetail.createCurveEvaluatedFraction(segmentA, fractionA, result.detailA);
        CurveLocationDetail.createCurveEvaluatedFraction(segmentB, fractionB, result.detailB);
        result.detailA.a = result.detailB.a = result.detailA.point.distance(result.detailB.point);
        return result;
      }
      // One or both of the fractions were clamped back to an endpoint.
      // Claim: (????!!!????) The only proximity candidates that matter are from clamped point onto the other.
      if (fractionA !== unboundedFractions.x && fractionB !== unboundedFractions.y) {
        // Fill in (in the result) both individual details with "projected" points and distance.
        // The "loser" will have its contents replaced.
        const clampedPointOnA = fractionA < 0.5 ? segmentA._point0 : segmentA._point1;
        const clampedPointOnB = fractionB < 0.5 ? segmentB._point0 : segmentB._point1;
        segmentB.closestPoint(clampedPointOnA, extendB, result.detailB);
        segmentA.closestPoint(clampedPointOnB, extendA, result.detailA);
        if (result.detailA.a <= result.detailB.a) {
          CurveLocationDetail.createCurveFractionPoint(segmentB, fractionB, clampedPointOnB, result.detailB);
        } else {
          CurveLocationDetail.createCurveFractionPoint(segmentA, fractionA, clampedPointOnA, result.detailA);
        }
      } else if (fractionB !== unboundedFractions.y) {
        // B (only) was clamped.
        const clampedPointOnB = fractionB < 0.5 ? segmentB._point0 : segmentB._point1;
        segmentA.closestPoint(clampedPointOnB, extendA, result.detailA);
        result.detailB.setCurve(segmentB);
        result.detailB.point.setFrom(clampedPointOnB);
        result.detailB.fraction = fractionB;
      } else {
        // fractionA was clamped.
        const clampedPointOnA = fractionA < 0.5 ? segmentA._point0 : segmentA._point1;
        segmentB.closestPoint(clampedPointOnA, extendB, result.detailB);
        result.detailA.setCurve(segmentA);
        result.detailA.point.setFrom(clampedPointOnA);
        result.detailA.fraction = fractionA;
      }
      result.detailA.a = result.detailB.a = result.detailA.point.distance(result.detailB.point);
      return result;
    }
    // (probably? certainly?) parallel (possibly coincident) lines.
    // run all 4 endpoint-to-other cases . . . reassemble carefully ...
    const resultSet = [
      segmentA.closestPoint(segmentB._point0, extendA),
      segmentA.closestPoint(segmentB._point1, extendA),
      segmentB.closestPoint(segmentA._point0, extendB),
      segmentB.closestPoint(segmentA._point1, extendB),
    ];
    let dMin = resultSet[0].a;
    let iMin = 0;
    for (let i = 1; i < 4; i++) {
      if (resultSet[i].a < dMin) {
        iMin = i;
        dMin = resultSet[i].a;
      }
    }
    if (iMin === 0) {
      resultSet[0].clone(result.detailA);
      CurveLocationDetail.createCurveEvaluatedFraction(segmentB, 0.0, result.detailB);
      result.detailB.a = result.detailA.a;
    } else if (iMin === 1) {
      resultSet[1].clone(result.detailA);
      CurveLocationDetail.createCurveEvaluatedFraction(segmentB, 1.0, result.detailB);
      result.detailB.a = result.detailA.a;
    } else if (iMin === 2) {
      resultSet[2].clone(result.detailB);
      CurveLocationDetail.createCurveEvaluatedFraction(segmentA, 0.0, result.detailA);
      result.detailA.a = result.detailB.a;
    } else {
      assert(iMin === 3);
      resultSet[3].clone(result.detailB);
      CurveLocationDetail.createCurveEvaluatedFraction(segmentA, 1.0, result.detailA);
      result.detailA.a = result.detailB.a;
    }
    return result;
  }
  /** Swap the endpoint references. */
  public reverseInPlace(): void {
    const a = this._point0;
    this._point0 = this._point1;
    this._point1 = a;
  }
  /** Transform the two endpoints of this LinSegment. */
  public tryTransformInPlace(transform: Transform): boolean {
    this._point0 = transform.multiplyPoint3d(this._point0, this._point0);
    this._point1 = transform.multiplyPoint3d(this._point1, this._point1);
    return true;
  }
  /** Test if both endpoints are in a plane (within tolerance) */
  public isInPlane(plane: PlaneAltitudeEvaluator): boolean {
    return Geometry.isSmallMetricDistance(plane.altitude(this._point0))
      && Geometry.isSmallMetricDistance(plane.altitude(this._point1));
  }
  /**
   * Compute points of simple (transverse) with a plane.
   * * Use isInPlane to test if the line segment is completely in the plane.
   */
  public override appendPlaneIntersectionPoints(plane: PlaneAltitudeEvaluator, result: CurveLocationDetail[]): number {
    const h0 = plane.altitude(this._point0);
    const h1 = plane.altitude(this._point1);
    const fraction = Order2Bezier.solveCoffs(h0, h1);
    let numIntersection = 0;
    if (fraction !== undefined) {
      numIntersection++;
      const detail = CurveLocationDetail.createCurveFractionPoint(this, fraction, this.fractionToPoint(fraction));
      detail.intervalRole = CurveIntervalRole.isolated;
      result.push(detail);
    }
    return numIntersection;
  }
  /**
   * Extend a range to include the (optionally transformed) line segment
   * @param range range to extend
   * @param transform optional transform to apply to the end points
   */
  public extendRange(range: Range3d, transform?: Transform): void {
    if (transform) {
      range.extendTransformedPoint(transform, this._point0);
      range.extendTransformedPoint(transform, this._point1);
    } else {
      range.extendPoint(this._point0);
      range.extendPoint(this._point1);
    }
  }
  /**
   * Construct a line from either of these json forms:
   *
   * * object with named start and end:
   * `{startPoint: pointValue, endPoint: pointValue}`
   * * array of two point values:
   * `[pointValue, pointValue]`
   * The point values are any values accepted by the Point3d method setFromJSON.
   * @param json data to parse.
   */
  public setFromJSON(json?: any) {
    if (!json) {
      this._point0.set(0, 0, 0);
      this._point1.set(1, 0, 0);
      return;
    } else if (json.startPoint && json.endPoint) { // {startPoint:json point, endPoint:json point}
      this._point0.setFromJSON(json.startPoint);
      this._point1.setFromJSON(json.endPoint);
    } else if (Array.isArray(json)
      && json.length > 1) { // [json point, json point]
      this._point0.setFromJSON(json[0]);
      this._point1.setFromJSON(json[1]);
    }
  }
  /** A simple line segment's fraction and distance are proportional. */
  public override getFractionToDistanceScale(): number | undefined {
    return this.curveLength();
  }
  /**
   * Place the lineSegment3d start and points in a json object
   * @return {*} [[x,y,z],[x,y,z]]
   */
  public toJSON(): any {
    return [this._point0.toJSON(), this._point1.toJSON()];
  }
  /** Create a new `LineSegment3d` with coordinates from json object.   See `setFromJSON` for object layout description. */
  public static fromJSON(json?: any): LineSegment3d {
    const result = new LineSegment3d(Point3d.createZero(), Point3d.create());
    result.setFromJSON(json);
    return result;
  }
  /** Near equality test with `other`. */
  public override isAlmostEqual(other: GeometryQuery): boolean {
    if (other instanceof LineSegment3d) {
      const ls = other;
      return this._point0.isAlmostEqual(ls._point0) && this._point1.isAlmostEqual(ls._point1);
    }
    return false;
  }
  /** Emit strokes to caller-supplied linestring */
  public emitStrokes(dest: LineString3d, options?: StrokeOptions): void {
    const numStroke = this.computeStrokeCountForOptions(options);
    dest.appendFractionalStrokePoints(this, numStroke, 0.0, 1.0);
  }
  /** Emit strokes to caller-supplied handler */
  public emitStrokableParts(handler: IStrokeHandler, options?: StrokeOptions): void {
    handler.startCurvePrimitive(this);
    const numStroke = this.computeStrokeCountForOptions(options);
    handler.announceSegmentInterval(this, this._point0, this._point1, numStroke, 0.0, 1.0);
    handler.endCurvePrimitive(this);
  }
  /**
   * Return the stroke count required for given options.
   * @param options StrokeOptions that determine count
   */
  public computeStrokeCountForOptions(options?: StrokeOptions): number {
    let numStroke = 1;
    if (options) {
      if (options.maxEdgeLength)
        numStroke = options.applyMaxEdgeLength(numStroke, this.curveLength());
      numStroke = options.applyMinStrokesPerPrimitive(numStroke);
    }
    return numStroke;
  }
  /** Second step of double dispatch: call `handler.handleLineSegment3d(this)` */
  public dispatchToGeometryHandler(handler: GeometryHandler): any {
    return handler.handleLineSegment3d(this);
  }
  /**
   * Find intervals of this curve primitive that are interior to a clipper
   * @param clipper clip structure (e.g. clip planes)
   * @param announce function to be called announcing fractional intervals `announce(fraction0, fraction1, curvePrimitive)`
   */
  public override announceClipIntervals(clipper: Clipper, announce?: AnnounceNumberNumberCurvePrimitive): boolean {
    return clipper.announceClippedSegmentIntervals(
      0.0, 1.0, this._point0, this._point1,
      announce ? (fraction0: number, fraction1: number) => announce(fraction0, fraction1, this) : undefined,
    );
  }
  /**
   * Return (if possible) a curve primitive which is a portion of this curve.
   * @param fractionA [in] start fraction
   * @param fractionB [in] end fraction
   */
  public override clonePartialCurve(fractionA: number, fractionB: number): LineSegment3d {
    return LineSegment3d.create(this.fractionToPoint(fractionA), this.fractionToPoint(fractionB));
  }
  /**
   * Returns a (high accuracy) range of the curve between fractional positions
   * * Default implementation returns teh range of the curve from clonePartialCurve
   */
  public override rangeBetweenFractions(fraction0: number, fraction1: number, transform?: Transform): Range3d {
    // (This is cheap -- don't bother testing for fraction0===fraction1)
    if (!transform) {
      const range = Range3d.create();
      range.extendInterpolated(this._point0, fraction0, this._point1);
      range.extendInterpolated(this._point0, fraction1, this._point1);
      return range;
    }
    const point0 = this.fractionToPoint(fraction0);
    const point1 = this.fractionToPoint(fraction1);
    if (transform) {
      transform.multiplyPoint3d(point0, point0);
      transform.multiplyPoint3d(point1, point1);
    }
    return Range3d.create(point0, point1);
  }
  /**
   * Construct an offset of the instance curve as viewed in the xy-plane (ignoring z).
   * @param offsetDistanceOrOptions offset distance (positive to left of the instance curve), or options object
   */
  public override constructOffsetXY(
    offsetDistanceOrOptions: number | OffsetOptions,
  ): CurvePrimitive | CurvePrimitive[] | undefined {
    const offsetVec = Vector3d.createStartEnd(this._point0, this._point1);
    if (offsetVec.normalizeInPlace()) {
      offsetVec.rotate90CCWXY(offsetVec);
      const offsetDist = OffsetOptions.getOffsetDistance(offsetDistanceOrOptions);
      return LineSegment3d.create(
        this._point0.plusScaled(offsetVec, offsetDist), this._point1.plusScaled(offsetVec, offsetDist),
      );
    }
    return undefined;
  }
  /**
   * Project instance geometry (via dispatch) onto the given ray, and return the extreme fractional parameters of
   * projection.
   * @param ray ray onto which the instance is projected. A `Vector3d` is treated as a `Ray3d` with zero origin.
   * @param lowHigh optional receiver for output
   * @returns range of fractional projection parameters onto the ray, where 0.0 is start of the ray and 1.0 is the
   * end of the ray.
   */
  public override projectedParameterRange(ray: Vector3d | Ray3d, lowHigh?: Range1d): Range1d | undefined {
    return PlaneAltitudeRangeContext.findExtremeFractionsAlongDirection(this, ray, lowHigh);
  }
}
