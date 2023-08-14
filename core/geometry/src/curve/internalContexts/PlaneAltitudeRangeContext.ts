/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Curve
 */

import { BSplineCurve3d } from "../../bspline/BSplineCurve";
import { BSplineCurve3dH } from "../../bspline/BSplineCurve3dH";
import { Geometry, PlaneAltitudeEvaluator } from "../../Geometry";
import { Angle } from "../../geometry3d/Angle";
import { RecurseToCurvesGeometryHandler } from "../../geometry3d/GeometryHandler";
import { GrowableXYZArray } from "../../geometry3d/GrowableXYZArray";
import { Plane3dByOriginAndUnitNormal } from "../../geometry3d/Plane3dByOriginAndUnitNormal";
import { Point3d, Vector3d } from "../../geometry3d/Point3dVector3d";
import { Range1d } from "../../geometry3d/Range";
import { Ray3d } from "../../geometry3d/Ray3d";
import { SineCosinePolynomial } from "../../numerics/Polynomials";
import { Arc3d } from "../Arc3d";
import { GeometryQuery } from "../GeometryQuery";
import { LineSegment3d } from "../LineSegment3d";
import { LineString3d } from "../LineString3d";
import { StrokeOptions } from "../StrokeOptions";

/**
 * Accumulator context for searching for extrema of geometry along a plane.
 * @internal
 */
export class PlaneAltitudeRangeContext extends RecurseToCurvesGeometryHandler {
  public plane: PlaneAltitudeEvaluator;
  public range: Range1d;
  public lowPoint: Point3d | undefined;
  public highPoint: Point3d | undefined;
  private constructor(plane: PlaneAltitudeEvaluator) {
    super();
    this.plane = plane;
    this.range = Range1d.createNull();
    this.resetRange();
  }

  public resetRange() {
    this.range.setNull();
  }

  public announcePoint(point: Point3d) {
    const h = this.plane.altitude(point);
    if (this.range.extendLow(h))
      this.lowPoint = point.clone(this.lowPoint);
    if (this.range.extendHigh(h))
      this.highPoint = point.clone(this.highPoint);
  }

  public announcePoints(points: GrowableXYZArray) {
    for (let i = 0; i < points.length; i++) {
      const h = points.evaluateUncheckedIndexPlaneAltitude(i, this.plane);
      if (this.range.extendLow(h))
        this.lowPoint = points.getPoint3dAtUncheckedPointIndex(i, this.lowPoint);
      if (this.range.extendHigh(h))
        this.highPoint = points.getPoint3dAtUncheckedPointIndex(i, this.highPoint);
    }
  }

  public static createCapture(plane: PlaneAltitudeEvaluator): PlaneAltitudeRangeContext {
    const context = new PlaneAltitudeRangeContext(plane);
    return context;
  }

  public override handleLineSegment3d(segment: LineSegment3d) {
    this.announcePoint(segment.point0Ref);
    this.announcePoint(segment.point1Ref);
  }

  public override handleLineString3d(lineString: LineString3d) {
    this.announcePoints(lineString.packedPoints);
  }

  private _strokeOptions?: StrokeOptions;

  private initStrokeOptions() {
    // TODO: compute the exact extrema; until then stroke aggressively
    if (undefined === this._strokeOptions) {
      this._strokeOptions = new StrokeOptions();
      this._strokeOptions.angleTol = Angle.createDegrees(1);
    }
  }

  public override handleBSplineCurve3d(bcurve: BSplineCurve3d) {
    // ugh.   The point MUST be on the curve -- usual excess-range of poles is not ok.
    this.initStrokeOptions();
    const ls = LineString3d.create();
    bcurve.emitStrokes(ls, this._strokeOptions);
    this.handleLineString3d(ls);
  }

  public override handleBSplineCurve3dH(bcurve: BSplineCurve3dH) {
    // ugh.   The point MUST be on the curve -- usual excess-range of poles is not ok.
    this.initStrokeOptions();
    const ls = LineString3d.create();
    bcurve.emitStrokes(ls, this._strokeOptions);
    this.handleLineString3d(ls);
  }

  private _sineCosinePolynomial?: SineCosinePolynomial;

  private _workPoint?: Point3d;

  public override handleArc3d(g: Arc3d) {
    this._sineCosinePolynomial = g.getPlaneAltitudeSineCosinePolynomial(this.plane, this._sineCosinePolynomial);
    let radians = this._sineCosinePolynomial.referenceMinMaxRadians();
    if (g.sweep.isRadiansInSweep(radians))
      this.announcePoint((this._workPoint = g.radiansToPoint(radians, this._workPoint)));
    radians += Math.PI;
    if (g.sweep.isRadiansInSweep(radians))
      this.announcePoint((this._workPoint = g.radiansToPoint(radians, this._workPoint)));
    this.announcePoint((this._workPoint = g.startPoint(this._workPoint)));
    this.announcePoint((this._workPoint = g.endPoint(this._workPoint)));
  }

  private static findExtremesInDirection(
    geometry: GeometryQuery | GrowableXYZArray | Point3d[], direction: Vector3d | Ray3d,
  ): PlaneAltitudeRangeContext | undefined {
    const origin = direction instanceof Ray3d ? direction.origin : Point3d.createZero();
    const vector = direction instanceof Ray3d ? direction.direction : direction;
    const plane = Plane3dByOriginAndUnitNormal.create(origin, vector);  // vector is normalized, so altitudes are distances
    if (plane) {
      const context = new PlaneAltitudeRangeContext(plane);
      if (geometry instanceof GeometryQuery) {
        geometry.dispatchToGeometryHandler(context);
      } else if (geometry instanceof GrowableXYZArray) {
        context.announcePoints(geometry);
      } else {
        for (const pt of geometry)
          context.announcePoint(pt);
      }
      return context;
    }
    return undefined;
  }
  /**
   * Compute altitudes for the geometry (via dispatch) over the plane defined by the given direction, and
   * return points at min and max altitude, packed into a `LineSegment3d`.
   * @param geometry geometry to project
   * @param direction vector or ray on which to project the instance. A `Vector3d` is treated as a `Ray3d` with
   * zero origin.
   * @param lowHigh optional receiver for output
  */
  public static findExtremePointsInDirection(
    geometry: GeometryQuery | GrowableXYZArray | Point3d[], direction: Vector3d | Ray3d, lowHigh?: LineSegment3d,
  ): LineSegment3d | undefined {
    const context = this.findExtremesInDirection(geometry, direction);
    if (context && context.highPoint && context.lowPoint)
      return LineSegment3d.create(context.lowPoint, context.highPoint, lowHigh);
    return undefined;
  }

  /**
   * Compute altitudes for the geometry (via dispatch) over the plane defined by the given direction, and return
   * the min and max altitudes, packed into a Range1d.
   * @param geometry geometry to project
   * @param direction vector or ray on which to project the instance. A `Vector3d` is treated as a `Ray3d` with
   * zero origin.
   * @param lowHigh optional receiver for output
  */
  public static findExtremeAltitudesInDirection(
    geometry: GeometryQuery | GrowableXYZArray | Point3d[], direction: Vector3d | Ray3d, lowHigh?: Range1d,
  ): Range1d | undefined {
    const context = this.findExtremesInDirection(geometry, direction);
    if (context && !context.range.isNull)
      return Range1d.createFrom(context.range, lowHigh);
    return undefined;
  }

  /**
   * Project geometry (via dispatch) onto the given ray, and return the extreme fractional parameters of projection.
   * @param geometry geometry to project
   * @param direction vector or ray onto which the instance is projected. A `Vector3d` is treated as a `Ray3d` with
   * zero origin.
   * @param lowHigh optional receiver for output
   */
  public static findExtremeFractionsAlongDirection(
    geometry: GeometryQuery | GrowableXYZArray | Point3d[], direction: Vector3d | Ray3d, lowHigh?: Range1d,
  ): Range1d | undefined {
    const range = this.findExtremeAltitudesInDirection(geometry, direction, lowHigh);
    if (undefined !== range) {
      const mag = (direction instanceof Vector3d) ? direction.magnitude() : direction.direction.magnitude();
      const scaleToFraction = Geometry.conditionalDivideCoordinate(1.0, mag);
      if (undefined !== scaleToFraction) {
        range.low *= scaleToFraction;
        range.high *= scaleToFraction;
        return range;
      }
    }
    return undefined;
  }
}
