/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

/** @module Curve */

import { Geometry, BeJSONFunctions, PlaneAltitudeEvaluator } from "../Geometry";
import { Order2Bezier } from "../numerics/BezierPolynomials";
import { Point3d } from "../geometry3d/Point3dVector3d";
import { Range3d } from "../geometry3d/Range";
import { Transform } from "../geometry3d/Transform";
import { Plane3dByOriginAndUnitNormal } from "../geometry3d/Plane3dByOriginAndUnitNormal";
import { Ray3d } from "../geometry3d/Ray3d";
import { Plane3dByOriginAndVectors } from "../geometry3d/Plane3dByOriginAndVectors";
import { GeometryHandler, IStrokeHandler } from "../geometry3d/GeometryHandler";
import { StrokeOptions } from "./StrokeOptions";
import { CurvePrimitive } from "./CurvePrimitive";
import { GeometryQuery } from "./GeometryQuery";
import { CurveLocationDetail } from "./CurveLocationDetail";
import { AnnounceNumberNumberCurvePrimitive } from "./CurvePrimitive";
import { LineString3d } from "./LineString3d";
import { Clipper } from "../clipping/ClipUtils";
/* tslint:disable:variable-name no-empty*/
/**
 * A LineSegment3d is:
 *
 * * A 3d line segment represented by
 *
 * ** startPoint
 * ** endPoint
 * parameterized with fraction 0 at the start and fraction 1 at the end, i.e. either of these equivalent forms:
 *
 * **  `X(f) = startPoint + f * (endPoint - startPoint)`
 * ** `X(f) = (1-f)*startPoint  + f * endPoint`
 */
export class LineSegment3d extends CurvePrimitive implements BeJSONFunctions {
  public isSameGeometryClass(other: GeometryQuery): boolean { return other instanceof LineSegment3d; }
  private _point0: Point3d;
  private _point1: Point3d;
  public get point0Ref(): Point3d { return this._point0; }
  public get point1Ref(): Point3d { return this._point1; }
  private constructor(point0: Point3d, point1: Point3d) { super(); this._point0 = point0; this._point1 = point1; }
  /** Set the start and endpoints by capturing input references. */
  public setRefs(point0: Point3d, point1: Point3d) { this._point0 = point0; this._point1 = point1; }
  /** Set the start and endponits by cloning the input parameters. */
  public set(point0: Point3d, point1: Point3d) { this._point0 = point0.clone(); this._point1 = point1.clone(); }
  /** copy (clone) data from other */
  public setFrom(other: LineSegment3d) { this._point0.setFrom(other._point0); this._point1.setFrom(other._point1); }
  /** @returns Return a (clone of) the start point. */
  public startPoint(result?: Point3d): Point3d {
    if (result) { result.setFrom(this._point0); return result; }
    return this._point0.clone();
  }
  /** @returns Return a (clone of) the end point. */
  public endPoint(result?: Point3d): Point3d {
    if (result) { result.setFrom(this._point1); return result; }
    return this._point1.clone();
  }
  /** @returns Return the point at fractional position along the line segment. */
  public fractionToPointAndDerivative(fraction: number, result?: Ray3d): Ray3d {
    result = result ? result : Ray3d.createZero();
    result.direction.setStartEnd(this._point0, this._point1);
    this._point0.interpolate(fraction, this._point1, result.origin);
    return result;
  }
  /** Construct a plane with
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
  public clone(): LineSegment3d { return LineSegment3d.create(this._point0, this._point1); }
  /** Clone and apply transform to the clone. */
  public cloneTransformed(transform: Transform): CurvePrimitive {  // we know tryTransformInPlace succeeds.
    const c = this.clone();
    c.tryTransformInPlace(transform);
    return c;
  }
  /** Create with start and end points.  The ponit contents are cloned into the LineSegment3d. */
  public static create(point0: Point3d, point1: Point3d, result?: LineSegment3d) {
    if (result) {
      result.set(point0, point1);  // and this will clone them !!
      return result;
    }
    return new LineSegment3d(point0.clone(), point1.clone());
  }
  /** create a LineSegment3d from xy coordinates of start and end, with common z.
   * @param x0 start point x coordinate.
   * @param y0 start point y coordinate.
   * @param x1 end point x coordinate.
   * @param y1 end point y coordinate.
   * @param z z coordinate to use for both points.
   * @param result optional existing LineSegment to be reinitiazlized.
   */
  public static createXYXY(x0: number, y0: number, x1: number, y1: number, z: number = 0, result?: LineSegment3d) {
    if (result) {
      result._point0.set(x0, y0, z);
      result._point1.set(x1, y1, z);
      return result;
    }
    return new LineSegment3d(Point3d.create(x0, y0, z), Point3d.create(x1, y1, z));
  }

  /** create a LineSegment3d from xy coordinates of start and end, with common z.
   * @param x0 start point x coordinate.
   * @param y0 start point y coordinate.
   * @param x1 end point x coordinate.
   * @param y1 end point y coordinate.
   * @param z z coordinate to use for both points.
   * @param result optional existing LineSegment to be reinitiazlized.
   */
  public static createXYZXYZ(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, result?: LineSegment3d) {
    if (result) {
      result._point0.set(x0, y0, z0);
      result._point1.set(x1, y1, z1);
      return result;
    }
    return new LineSegment3d(Point3d.create(x0, y0, z0), Point3d.create(x1, y1, z1));
  }

  /** @returns Return the point at fractional position along the line segment. */
  public fractionToPoint(fraction: number, result?: Point3d): Point3d { return this._point0.interpolate(fraction, this._point1, result); }
  public curveLength(): number { return this._point0.distance(this._point1); }
  public quickLength(): number { return this.curveLength(); }

  /**
   * @param spacePoint point in space
   * @param extend if false, only return points within the bounded line segment. If true, allow the point to be on the unbounded line that contains the bounded segment.
   * @returns Returns a curve location detail with both xyz and fractional coordinates of the closest point.
   */
  public closestPoint(spacePoint: Point3d, extend: boolean, result?: CurveLocationDetail): CurveLocationDetail {
    let fraction = spacePoint.fractionOfProjectionToLine(this._point0, this._point1, 0.0);
    if (!extend) {
      if (fraction > 1.0)
        fraction = 1.0;
      else if (fraction < 0.0)
        fraction = 0.0;
    }
    result = CurveLocationDetail.create(this, result);
    result.fraction = fraction;
    this._point0.interpolate(fraction, this._point1, result.point);
    this._point0.vectorTo(this._point1, result.vector);
    result.a = result.point.distance(spacePoint);
    return result;
  }
  public reverseInPlace(): void {
    const a = this._point0;
    this._point0 = this._point1;
    this._point1 = a;
  }
  public tryTransformInPlace(transform: Transform): boolean {
    this._point0 = transform.multiplyPoint3d(this._point0, this._point0);
    this._point1 = transform.multiplyPoint3d(this._point1, this._point1);
    return true;
  }
  public isInPlane(plane: Plane3dByOriginAndUnitNormal): boolean {
    return Geometry.isSmallMetricDistance(plane.altitude(this._point0))
      && Geometry.isSmallMetricDistance(plane.altitude(this._point1));
  }
  public appendPlaneIntersectionPoints(plane: PlaneAltitudeEvaluator, result: CurveLocationDetail[]): number {
    const h0 = plane.altitude(this._point0);
    const h1 = plane.altitude(this._point1);
    const fraction = Order2Bezier.solveCoffs(h0, h1);
    let numIntersection = 0;
    if (fraction !== undefined) {
      numIntersection++;
      result.push(CurveLocationDetail.createCurveFractionPoint(this, fraction, this.fractionToPoint(fraction)));
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
    } else if (json.startPoint && json.endPoint) { // {startPoint:JSONPOINT, endPoint:JSONPOINT}
      this._point0.setFromJSON(json.startPoint);
      this._point1.setFromJSON(json.endPoint);
    } else if (Array.isArray(json)
      && json.length > 1) { // [JSONPOINT, JSONPOINT]
      this._point0.setFromJSON(json[0]);
      this._point1.setFromJSON(json[1]);
    }
  }

  /**
   * Place the lineSegment3d start and points in a json object
   * @return {*} [[x,y,z],[x,y,z]]
   */
  public toJSON(): any { return [this._point0.toJSON(), this._point1.toJSON()]; }
  public static fromJSON(json?: any): LineSegment3d {
    const result = new LineSegment3d(Point3d.createZero(), Point3d.create());
    result.setFromJSON(json);
    return result;
  }
  public isAlmostEqual(other: GeometryQuery): boolean {
    if (other instanceof LineSegment3d) {
      const ls = other as LineSegment3d;
      return this._point0.isAlmostEqual(ls._point0) && this._point1.isAlmostEqual(ls._point1);
    }
    return false;
  }

  /** Emit strokes to caller-supplied linestring */
  public emitStrokes(dest: LineString3d, options?: StrokeOptions): void {
    dest.appendStrokePoint(this._point0);

    if (options) {
      let numStroke = 1;
      if (options.maxEdgeLength)
        numStroke = options.applyMaxEdgeLength(numStroke, this.curveLength());
      numStroke = options.applyMinStrokesPerPrimitive(numStroke);
      dest.appendFractionalStrokePoints(this, numStroke, 0.0, 1.0, false);
    }
    dest.appendStrokePoint(this._point1);
  }
  /** Emit strokes to caller-supplied handler */
  public emitStrokableParts(handler: IStrokeHandler, options?: StrokeOptions): void {
    handler.startCurvePrimitive(this);
    const tangent = this._point0.vectorTo(this._point1);
    let numStroke = 1;
    if (options) {
      if (options.maxEdgeLength)
        numStroke = options.applyMaxEdgeLength(numStroke, tangent.magnitude());
      numStroke = options.applyMinStrokesPerPrimitive(numStroke);
    }
    handler.announceSegmentInterval(this, this._point0, this._point1, numStroke, 0.0, 1.0);
    handler.endCurvePrimitive(this);
  }

  public dispatchToGeometryHandler(handler: GeometryHandler): any {
    return handler.handleLineSegment3d(this);
  }

  /**
   * Find intervals of this curveprimitve that are interior to a clipper
   * @param clipper clip structure (e.g. clip planes)
   * @param announce function to be called announcing fractional intervals"  ` announce(fraction0, fraction1, curvePrimitive)`
   */
  public announceClipIntervals(clipper: Clipper, announce?: AnnounceNumberNumberCurvePrimitive): boolean {
    return clipper.announceClippedSegmentIntervals(0.0, 1.0, this._point0, this._point1,
      announce ? (fraction0: number, fraction1: number) => announce(fraction0, fraction1, this) : undefined);
  }

  /** Return (if possible) a curve primitive which is a portion of this curve.
   * @param fractionA [in] start fraction
   * @param fractionB [in] end fraction
   */
  public clonePartialCurve(fractionA: number, fractionB: number): CurvePrimitive | undefined {
    return LineString3d.create(this.fractionToPoint(fractionA), this.fractionToPoint(fractionB));
  }
}
