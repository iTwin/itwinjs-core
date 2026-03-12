/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module CartesianGeometry
 */

import { Point2d } from "../geometry3d/Point2dVector2d";
import { Vector3d } from "../geometry3d/Point3dVector3d";
import { Ray3d } from "../geometry3d/Ray3d";
import { Arc3d } from "./Arc3d";
import { CurvePrimitive } from "./CurvePrimitive";
import { ConstrainedImplicitCurve2d } from "./internalContexts/geometry2d/ConstrainedImplicitCurve2d";
import { ImplicitCurve2d, ImplicitGeometryMarkup } from "./internalContexts/geometry2d/ImplicitCurve2d";
import { ImplicitCurve2dConverter } from "./internalContexts/geometry2d/ImplicitCurve2dConverter";
import { UnboundedCircle2dByCenterAndRadius } from "./internalContexts/geometry2d/UnboundedCircle2d";
import { UnboundedLine2dByPointAndNormal } from "./internalContexts/geometry2d/UnboundedLine2d";
import { LineSegment3d } from "./LineSegment3d";

// return true if the input is not a circular arc
function isNotCircularArc(cp: CurvePrimitive): boolean {
  return !(cp instanceof Arc3d) || !cp.isCircular;
}
// return true if the curve primitive is not a circle or a point
function isNotCircularOrPoint(arc: Arc3d): boolean {
  return arc.circularRadius() === undefined && !arc.isDegenerateCircle;
}
// convert a LineSegment3d to a Ray3d with the same start point and direction
function lineSegmentToRay3d(segment: LineSegment3d): Ray3d {
  const start = segment.startPoint();
  const end = segment.endPoint();
  const direction = Vector3d.createFrom(end.minus(start));
  return Ray3d.create(start, direction);
}
// return markups with captured circles or lines and their data
function getCircleOrLineMarkups(
  markups: ImplicitGeometryMarkup<ImplicitCurve2d>[], expectCircle: boolean,
): GeometryMarkup<Arc3d | Ray3d>[] | undefined {
  const result = [];
  for (const markup of markups) {
    const cp = ImplicitCurve2dConverter.createCurvePrimitiveFromImplicitCurve(markup.curve) as CurvePrimitive | undefined;
    if (cp === undefined)
      return undefined;
    if (expectCircle && isNotCircularArc(cp))
      return undefined;
    let newMarkup: GeometryMarkup<Arc3d | Ray3d>;
    if (expectCircle)
      newMarkup = new GeometryMarkup<Arc3d>(cp as Arc3d);
    else
      newMarkup = new GeometryMarkup<Ray3d>(lineSegmentToRay3d(cp as LineSegment3d));
    for (const implicitData of markup.data) {
      let curve: Arc3d | Ray3d | undefined;
      curve = ImplicitCurve2dConverter.createCurvePrimitiveFromImplicitCurve(implicitData.curve) as Arc3d | undefined;
      if (curve === undefined)
        return undefined;
      if (curve instanceof LineSegment3d)
        curve = lineSegmentToRay3d(curve);
      newMarkup.data.push(new Point2dCurve2d(implicitData.point, curve as Arc3d | Ray3d));
    }
    result.push(newMarkup);
  }
  return result.length > 0 ? result : undefined;
}

/**
 * The class has static methods to compute circles and lines with specified constrained (tangent to other lines/circles,
 * perpendicular to other lines/circles, or a specified circle radius).
 * * z components of the input curves are completely ignored.
 * * In this API, a line is represented by Ray3d with the ray origin as the point on the line and the ray direction
 * as the line direction. The line is unbounded in both directions.
 * @alpha
 */
export class ConstrainedCurve2d {
  /**
   * Return all (i.e., up to 4) circles that are tangent to 3 given lines plus data about tangent points.
   * @param lineA first line
   * @param lineB second line
   * @param lineC third line
   */
  public static circlesTangentLineLineLine(
    lineA: LineSegment3d,
    lineB: LineSegment3d,
    lineC: LineSegment3d,
  ): GeometryMarkup<Arc3d>[] | undefined {
    const implicitLineA = ImplicitCurve2dConverter.createImplicitCurve2dFromCurvePrimitiveXY(lineA);
    const implicitLineB = ImplicitCurve2dConverter.createImplicitCurve2dFromCurvePrimitiveXY(lineB);
    const implicitLineC = ImplicitCurve2dConverter.createImplicitCurve2dFromCurvePrimitiveXY(lineC);
    if (!(implicitLineA instanceof UnboundedLine2dByPointAndNormal)
      || !(implicitLineB instanceof UnboundedLine2dByPointAndNormal)
      || !(implicitLineC instanceof UnboundedLine2dByPointAndNormal))
      return undefined;
    const markups = ConstrainedImplicitCurve2d.circlesTangentLLL(implicitLineA, implicitLineB, implicitLineC);
    if (markups === undefined)
      return undefined;
    return getCircleOrLineMarkups(markups, true) as GeometryMarkup<Arc3d>[] | undefined;
  }
  /**
   * Return all (i.e., up to 2) unbounded lines perpendicular to a line and tangent to a circle plus data about
   * perp/tangent points.
   * @param line the line
   * @param circle the circle
   */
  public static linesPerpLineTangentCircle(
    line: LineSegment3d,
    circle: Arc3d,
  ): GeometryMarkup<Ray3d>[] | undefined {
    if (isNotCircularOrPoint(circle))
      return undefined;
    const implicitLine = ImplicitCurve2dConverter.createImplicitCurve2dFromCurvePrimitiveXY(line);
    const implicitCircle = ImplicitCurve2dConverter.createImplicitCurve2dFromCurvePrimitiveXY(circle);
    if (!(implicitLine instanceof UnboundedLine2dByPointAndNormal)
      || !(implicitCircle instanceof UnboundedCircle2dByCenterAndRadius))
      return undefined;
    const markups = ConstrainedImplicitCurve2d.linesPerpLTangentC(implicitLine, implicitCircle);
    if (markups === undefined)
      return undefined;
    return getCircleOrLineMarkups(markups, false) as GeometryMarkup<Ray3d>[] | undefined;
  }
  /**
   * Return all (i.e., 4) variants of the line perpendicular to 2 circles (line between centers, with ends at
   * crossing points on respective circles) plus data about perp points.
   * @param circleA first circle
   * @param circleB second circle
   */
  public static linesPerpCirclePerpCircle(
    circleA: Arc3d,
    circleB: Arc3d,
  ): GeometryMarkup<Ray3d>[] | undefined {
    if (!circleA.isCircular || !circleB.isCircular)
      return undefined;
    const implicitCircleA = ImplicitCurve2dConverter.createImplicitCurve2dFromCurvePrimitiveXY(circleA);
    const implicitCircleB = ImplicitCurve2dConverter.createImplicitCurve2dFromCurvePrimitiveXY(circleB);
    if (!(implicitCircleA instanceof UnboundedCircle2dByCenterAndRadius)
      || !(implicitCircleB instanceof UnboundedCircle2dByCenterAndRadius))
      return undefined;
    const markups = ConstrainedImplicitCurve2d.linesPerpCPerpC(implicitCircleA, implicitCircleB);
    if (markups === undefined)
      return undefined;
    return getCircleOrLineMarkups(markups, false) as GeometryMarkup<Ray3d>[] | undefined;
  }
  /**
   * Return all (i.e., up to 2) unbounded lines perpendicular to a line and a circle plus data about perp points.
   * @param line the line
   * @param circle the circle
   */
  public static linesPerpLinePerpCircle(
    line: LineSegment3d,
    circle: Arc3d,
  ): GeometryMarkup<Ray3d>[] | undefined {
    if (isNotCircularOrPoint(circle))
      return undefined;
    const implicitLine = ImplicitCurve2dConverter.createImplicitCurve2dFromCurvePrimitiveXY(line);
    const implicitCircle = ImplicitCurve2dConverter.createImplicitCurve2dFromCurvePrimitiveXY(circle);
    if (!(implicitLine instanceof UnboundedLine2dByPointAndNormal)
      || !(implicitCircle instanceof UnboundedCircle2dByCenterAndRadius))
      return undefined;
    const markups = ConstrainedImplicitCurve2d.linesPerpLPerpC(implicitLine, implicitCircle);
    if (markups === undefined)
      return undefined;
    return getCircleOrLineMarkups(markups, false) as GeometryMarkup<Ray3d>[] | undefined;
  }
  /**
   * Return all (i.e., up to 4) unbounded lines perpendicular to a circle and tangent to a circle plus data about
   * perp/tangent points.
   * Note that multiple colinear lines are returned tagged with diametrically opposing points of circleA.
   * @param circleA first circle (for perpendicular constraint)
   * @param circleB second circle (for tangent constraint)
   */
  public static linesPerpCircleTangentCircle(
    circleA: Arc3d,
    circleB: Arc3d,
  ): GeometryMarkup<Ray3d>[] | undefined {
    if (isNotCircularOrPoint(circleA) || isNotCircularOrPoint(circleB))
      return undefined;
    const implicitCircleA = ImplicitCurve2dConverter.createImplicitCurve2dFromCurvePrimitiveXY(circleA);
    const implicitCircleB = ImplicitCurve2dConverter.createImplicitCurve2dFromCurvePrimitiveXY(circleB);
    if (!(implicitCircleA instanceof UnboundedCircle2dByCenterAndRadius)
      || !(implicitCircleB instanceof UnboundedCircle2dByCenterAndRadius))
      return undefined;
    const markups = ConstrainedImplicitCurve2d.linesPerpCTangentC(implicitCircleA, implicitCircleB);
    if (markups === undefined)
      return undefined;
    return getCircleOrLineMarkups(markups, false) as GeometryMarkup<Ray3d>[] | undefined;
  }
  /**
   * Return all (i.e., up to 4) unbounded lines tangent to 2 circles plus data about tangent points.
   * * There are 4 lines if there is neither intersection nor containment between the circles
   * * There are 2 lines if the circles intersect
   * * There are no lines if one circle is entirely inside the other.
   * @param circleA first circle
   * @param circleB second circle
   */
  public static linesTangentCircleCircle(
    circleA: Arc3d,
    circleB: Arc3d,
  ): GeometryMarkup<Ray3d>[] | undefined {
    if (isNotCircularOrPoint(circleA) || isNotCircularOrPoint(circleB))
      return undefined;
    const implicitCircleA = ImplicitCurve2dConverter.createImplicitCurve2dFromCurvePrimitiveXY(circleA);
    const implicitCircleB = ImplicitCurve2dConverter.createImplicitCurve2dFromCurvePrimitiveXY(circleB);
    if (!(implicitCircleA instanceof UnboundedCircle2dByCenterAndRadius)
      || !(implicitCircleB instanceof UnboundedCircle2dByCenterAndRadius))
      return undefined;
    const markups = ConstrainedImplicitCurve2d.linesTangentCC(implicitCircleA, implicitCircleB);
    if (markups === undefined)
      return undefined;
    return getCircleOrLineMarkups(markups, false) as GeometryMarkup<Ray3d>[] | undefined;
  }
  /**
   * Return all (i.e., up to 8) circles tangent to two lines and a circle plus data about tangent points.
   * @param lineA first line
   * @param lineB second line
   * @param circle the circle
   */
  public static circlesTangentLineLineCircle(
    lineA: LineSegment3d,
    lineB: LineSegment3d,
    circle: Arc3d,
  ): GeometryMarkup<Arc3d>[] | undefined {
    if (isNotCircularOrPoint(circle))
      return undefined;
    const implicitLineA = ImplicitCurve2dConverter.createImplicitCurve2dFromCurvePrimitiveXY(lineA);
    const implicitLineB = ImplicitCurve2dConverter.createImplicitCurve2dFromCurvePrimitiveXY(lineB);
    const implicitCircle = ImplicitCurve2dConverter.createImplicitCurve2dFromCurvePrimitiveXY(circle);
    if (!(implicitLineA instanceof UnboundedLine2dByPointAndNormal)
      || !(implicitLineB instanceof UnboundedLine2dByPointAndNormal)
      || !(implicitCircle instanceof UnboundedCircle2dByCenterAndRadius))
      return undefined;
    const markups = ConstrainedImplicitCurve2d.circlesTangentLLC(implicitLineA, implicitLineB, implicitCircle);
    if (markups === undefined)
      return undefined;
    return getCircleOrLineMarkups(markups, true) as GeometryMarkup<Arc3d>[] | undefined;
  }
  /**
   * Return all (i.e., up to 4) circles tangent to 2 circles and a line plus data about tangent points.
   * @param circleA first circle
   * @param circleB second circle
   * @param line the line
   */
  public static circlesTangentCircleCircleLine(
    circleA: Arc3d,
    circleB: Arc3d,
    line: LineSegment3d,
  ): GeometryMarkup<Arc3d>[] | undefined {
    if (isNotCircularOrPoint(circleA) || isNotCircularOrPoint(circleB))
      return undefined;
    const implicitCircleA = ImplicitCurve2dConverter.createImplicitCurve2dFromCurvePrimitiveXY(circleA);
    const implicitCircleB = ImplicitCurve2dConverter.createImplicitCurve2dFromCurvePrimitiveXY(circleB);
    const implicitLine = ImplicitCurve2dConverter.createImplicitCurve2dFromCurvePrimitiveXY(line);
    if (!(implicitCircleA instanceof UnboundedCircle2dByCenterAndRadius)
      || !(implicitCircleB instanceof UnboundedCircle2dByCenterAndRadius)
      || !(implicitLine instanceof UnboundedLine2dByPointAndNormal))
      return undefined;
    const markups = ConstrainedImplicitCurve2d.circlesTangentCCL(implicitCircleA, implicitCircleB, implicitLine);
    if (markups === undefined)
      return undefined;
    return getCircleOrLineMarkups(markups, true) as GeometryMarkup<Arc3d>[] | undefined;
  }
  /**
   * Return all (i.e., up to 8) circles tangent to 3 circles plus data about tangent points.
   * @param circleA first circle
   * @param circleB second circle
   * @param circleC third circle
   */
  public static circlesTangentCircleCircleCircle(
    circleA: Arc3d,
    circleB: Arc3d,
    circleC: Arc3d,
  ): GeometryMarkup<Arc3d>[] | undefined {
    if (isNotCircularOrPoint(circleA) || isNotCircularOrPoint(circleB) || isNotCircularOrPoint(circleC))
      return undefined;
    const implicitCircleA = ImplicitCurve2dConverter.createImplicitCurve2dFromCurvePrimitiveXY(circleA);
    const implicitCircleB = ImplicitCurve2dConverter.createImplicitCurve2dFromCurvePrimitiveXY(circleB);
    const implicitCircleC = ImplicitCurve2dConverter.createImplicitCurve2dFromCurvePrimitiveXY(circleC);
    if (!(implicitCircleA instanceof UnboundedCircle2dByCenterAndRadius)
      || !(implicitCircleB instanceof UnboundedCircle2dByCenterAndRadius)
      || !(implicitCircleC instanceof UnboundedCircle2dByCenterAndRadius))
      return undefined;
    const markups = ConstrainedImplicitCurve2d.circlesTangentCCC(implicitCircleA, implicitCircleB, implicitCircleC);
    if (markups === undefined)
      return undefined;
    return getCircleOrLineMarkups(markups, true) as GeometryMarkup<Arc3d>[] | undefined;
  }
  /**
   * Compute circles of specified radius tangent to each of the lines plus data about tangent points.
   * * There are normally 4 circles.
   * * Returns undefined when the lines are parallel.
   * @param lineA first line
   * @param lineB second line
   * @param radius radius of tangent circles.
   */
  public static circlesTangentLineLineRadius(
    lineA: LineSegment3d,
    lineB: LineSegment3d,
    radius: number,
  ): GeometryMarkup<Arc3d>[] | undefined {
    const implicitLineA = ImplicitCurve2dConverter.createImplicitCurve2dFromCurvePrimitiveXY(lineA);
    const implicitLineB = ImplicitCurve2dConverter.createImplicitCurve2dFromCurvePrimitiveXY(lineB);
    if (!(implicitLineA instanceof UnboundedLine2dByPointAndNormal)
      || !(implicitLineB instanceof UnboundedLine2dByPointAndNormal))
      return undefined;
    const markups = ConstrainedImplicitCurve2d.circlesTangentLLR(implicitLineA, implicitLineB, radius);
    if (markups === undefined)
      return undefined;
    return getCircleOrLineMarkups(markups, true) as GeometryMarkup<Arc3d>[] | undefined;
  }
  /**
   * Compute circles of specified radius tangent to both a circle and a line plus data about tangent points..
   * * There can be 0 to 8 circles.
   * @param circle the circle
   * @param line the line
   * @param radius radius of tangent circles
   */
  public static circlesTangentCircleLineRadius(
    circle: Arc3d,
    line: LineSegment3d,
    radius: number,
  ): GeometryMarkup<Arc3d>[] | undefined {
    if (isNotCircularOrPoint(circle))
      return undefined;
    const implicitCircleA = ImplicitCurve2dConverter.createImplicitCurve2dFromCurvePrimitiveXY(circle);
    const implicitLineB = ImplicitCurve2dConverter.createImplicitCurve2dFromCurvePrimitiveXY(line);
    if (!(implicitCircleA instanceof UnboundedCircle2dByCenterAndRadius)
      || !(implicitLineB instanceof UnboundedLine2dByPointAndNormal))
      return undefined;
    const markups = ConstrainedImplicitCurve2d.circlesTangentCLR(implicitCircleA, implicitLineB, radius);
    if (markups === undefined)
      return undefined;
    return getCircleOrLineMarkups(markups, true) as GeometryMarkup<Arc3d>[] | undefined;
  }
  /**
   * Compute circles of specified radius tangent to both circles plus data about tangent points.
   * * There can be 0 to 8 circles.
   * @param circleA the first circle
   * @param circleB the second circle
   * @param radius radius of tangent circles
   */
  public static circlesTangentCircleCircleRadius(
    circleA: Arc3d,
    circleB: Arc3d,
    radius: number,
  ): GeometryMarkup<Arc3d>[] | undefined {
    if (isNotCircularOrPoint(circleA) || isNotCircularOrPoint(circleB))
      return undefined;
    const implicitCircleA = ImplicitCurve2dConverter.createImplicitCurve2dFromCurvePrimitiveXY(circleA);
    const implicitCircleB = ImplicitCurve2dConverter.createImplicitCurve2dFromCurvePrimitiveXY(circleB);
    if (!(implicitCircleA instanceof UnboundedCircle2dByCenterAndRadius)
      || !(implicitCircleB instanceof UnboundedCircle2dByCenterAndRadius))
      return undefined;
    const markups = ConstrainedImplicitCurve2d.circlesTangentCCR(implicitCircleA, implicitCircleB, radius);
    if (markups === undefined)
      return undefined;
    return getCircleOrLineMarkups(markups, true) as GeometryMarkup<Arc3d>[] | undefined;
  }
}

/**
 * Carrier class containing:
 * * a point
 * * the curve to which the point is related.
 * @alpha
 */
export class Point2dCurve2d {
  public point: Point2d;
  public curve: CurvePrimitive | Ray3d;
  /**
   * CAPTURE a point and curve.
   * @param point point member
   * @param curve curve member
   */
  public constructor(point: Point2d, curve: CurvePrimitive | Ray3d) {
    this.point = point;
    this.curve = curve;
  }
}

/**
 * Carrier class containing:
 * * a curve which is a subclass of CurvePrimitive.
 * * an array of paired point and CurvePrimitive.
 * @alpha
 */
export class GeometryMarkup<GeometryType extends CurvePrimitive | Ray3d> {
  public curve: GeometryType;
  public data: Point2dCurve2d[];
  /**
   * Construct a new carrier. The data array is created empty.
   * @param curve curve to CAPTURE
   */
  public constructor(curve: GeometryType) {
    this.curve = curve;
    this.data = [];
  }
}