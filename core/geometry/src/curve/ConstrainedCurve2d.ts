/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module CartesianGeometry
 */

import { Geometry } from "../Geometry";
import { Point2d } from "../geometry3d/Point2dVector2d";
import { Point3d } from "../geometry3d/Point3dVector3d";
import { Arc3d } from "./Arc3d";
import { CurveLocationDetail, CurveLocationDetailPair } from "./CurveLocationDetail";
import { CurvePrimitive } from "./CurvePrimitive";
import { ConstrainedImplicitCurve2d } from "./internalContexts/geometry2d/ConstrainedImplicitCurve2d";
import { ImplicitCurve2d, ImplicitGeometryMarkup } from "./internalContexts/geometry2d/ImplicitCurve2d";
import { ImplicitCurve2dConverter } from "./internalContexts/geometry2d/ImplicitCurve2dConverter";
import { UnboundedCircle2dByCenterAndRadius } from "./internalContexts/geometry2d/UnboundedCircle2d";
import { UnboundedLine2dByPointAndNormal } from "./internalContexts/geometry2d/UnboundedLine2d";
import { LineSegment3d } from "./LineSegment3d";

/**
 * The class has static methods to compute circles and lines with specified constrained (tangent to other lines/circles,
 * perpendicular to other lines/circles, or a specified circle radius).
 * * z components of the input curves are completely ignored.
 * * In this API, a `LineSegment3d` input identifies the underlying unbounded line by its endpoints. The segment
 * itself is bounded, but the geometric line constraint is applied as unbounded.
 * * Each API not only returns the circles or lines that satisfy the constraints but also captures the input curve
 * location details where the tangency/perpendicularity happens. Each returned element contains:
 *   * the curve (circle or line) that satisfies the constraints.
 *   * an array of {@link CurveLocationDetailPair} objects, where each pair holds:
 *     * `detailA`: the result curve with the contact point and fraction on the curve.
 *     * `detailB`: the input constraint curve with the same contact point and fraction on the constraint curve.
 * @alpha
 */
export class ConstrainedCurve2d {
  /**
   * Return all (i.e., up to 4) circles that are tangent to 3 given lines plus data about tangent points/fractions.
   * @param lineA first line
   * @param lineB second line
   * @param lineC third line
   */
  public static circlesTangentLineLineLine(
    lineA: LineSegment3d,
    lineB: LineSegment3d,
    lineC: LineSegment3d,
  ): { curve: Arc3d, details: CurveLocationDetailPair[] }[] | undefined {
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
    return getCircleOrLineMarkups(markups, true, [lineA, lineB, lineC]);
  }
  /**
   * Return all (i.e., up to 2) unbounded lines perpendicular to a line and tangent to a circle plus data about
   * perp/tangent points/fractions.
   * @param line the line
   * @param circle the circle
   */
  public static linesPerpLineTangentCircle(
    line: LineSegment3d,
    circle: Arc3d,
  ): { curve: LineSegment3d, details: CurveLocationDetailPair[] }[] | undefined {
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
    return getCircleOrLineMarkups(markups, false, [line, circle]);
  }
  /**
   * Return all (i.e., 4) variants of the line perpendicular to 2 circles (line between centers, with ends at
   * crossing points on respective circles) plus data about perp points/fractions.
   * @param circleA first circle
   * @param circleB second circle
   */
  public static linesPerpCirclePerpCircle(
    circleA: Arc3d,
    circleB: Arc3d,
  ): { curve: LineSegment3d, details: CurveLocationDetailPair[] }[] | undefined {
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
    return getCircleOrLineMarkups(markups, false, [circleA, circleB]);
  }
  /**
   * Return all (i.e., up to 2) unbounded lines perpendicular to a line and a circle plus data about perp points/fractions.
   * @param line the line
   * @param circle the circle
   */
  public static linesPerpLinePerpCircle(
    line: LineSegment3d,
    circle: Arc3d,
  ): { curve: LineSegment3d, details: CurveLocationDetailPair[] }[] | undefined {
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
    return getCircleOrLineMarkups(markups, false, [line, circle]);
  }
  /**
   * Return all (i.e., up to 4) unbounded lines perpendicular to a circle and tangent to a circle plus data about
   * perp/tangent points/fractions.
   * Note that multiple colinear lines are returned tagged with diametrically opposing points of circleA.
   * @param circleA first circle (for perpendicular constraint)
   * @param circleB second circle (for tangent constraint)
   */
  public static linesPerpCircleTangentCircle(
    circleA: Arc3d,
    circleB: Arc3d,
  ): { curve: LineSegment3d, details: CurveLocationDetailPair[] }[] | undefined {
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
    return getCircleOrLineMarkups(markups, false, [circleA, circleB]);
  }
  /**
   * Return all (i.e., up to 4) unbounded lines tangent to 2 circles plus data about tangent points/fractions.
   * * There are 4 lines if there is neither intersection nor containment between the circles
   * * There are 2 lines if the circles intersect
   * * There are no lines if one circle is entirely inside the other.
   * @param circleA first circle
   * @param circleB second circle
   */
  public static linesTangentCircleCircle(
    circleA: Arc3d,
    circleB: Arc3d,
  ): { curve: LineSegment3d, details: CurveLocationDetailPair[] }[] | undefined {
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
    return getCircleOrLineMarkups(markups, false, [circleA, circleB]);
  }
  /**
   * Return all (i.e., up to 8) circles tangent to two lines and a circle plus data about tangent points/fractions.
   * @param lineA first line
   * @param lineB second line
   * @param circle the circle
   */
  public static circlesTangentLineLineCircle(
    lineA: LineSegment3d,
    lineB: LineSegment3d,
    circle: Arc3d,
  ): { curve: Arc3d, details: CurveLocationDetailPair[] }[] | undefined {
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
    return getCircleOrLineMarkups(markups, true, [lineA, lineB, circle]);
  }
  /**
   * Return all (i.e., up to 4) circles tangent to 2 circles and a line plus data about tangent points/fractions.
   * @param circleA first circle
   * @param circleB second circle
   * @param line the line
   */
  public static circlesTangentCircleCircleLine(
    circleA: Arc3d,
    circleB: Arc3d,
    line: LineSegment3d,
  ): { curve: Arc3d, details: CurveLocationDetailPair[] }[] | undefined {
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
    return getCircleOrLineMarkups(markups, true, [circleA, circleB, line]);
  }
  /**
   * Return all (i.e., up to 8) circles tangent to 3 circles plus data about tangent points/fractions.
   * @param circleA first circle
   * @param circleB second circle
   * @param circleC third circle
   */
  public static circlesTangentCircleCircleCircle(
    circleA: Arc3d,
    circleB: Arc3d,
    circleC: Arc3d,
  ): { curve: Arc3d, details: CurveLocationDetailPair[] }[] | undefined {
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
    return getCircleOrLineMarkups(markups, true, [circleA, circleB, circleC]);
  }
  /**
   * Compute circles of specified radius tangent to each of the lines plus data about tangent points/fractions.
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
  ): { curve: Arc3d, details: CurveLocationDetailPair[] }[] | undefined {
    const implicitLineA = ImplicitCurve2dConverter.createImplicitCurve2dFromCurvePrimitiveXY(lineA);
    const implicitLineB = ImplicitCurve2dConverter.createImplicitCurve2dFromCurvePrimitiveXY(lineB);
    if (!(implicitLineA instanceof UnboundedLine2dByPointAndNormal)
      || !(implicitLineB instanceof UnboundedLine2dByPointAndNormal))
      return undefined;
    const markups = ConstrainedImplicitCurve2d.circlesTangentLLR(implicitLineA, implicitLineB, radius);
    if (markups === undefined)
      return undefined;
    return getCircleOrLineMarkups(markups, true, [lineA, lineB]);
  }
  /**
   * Compute circles of specified radius tangent to both a circle and a line plus data about tangent points/fractions.
   * * There can be 0 to 8 circles.
   * @param circle the circle
   * @param line the line
   * @param radius radius of tangent circles
   */
  public static circlesTangentCircleLineRadius(
    circle: Arc3d,
    line: LineSegment3d,
    radius: number,
  ): { curve: Arc3d, details: CurveLocationDetailPair[] }[] | undefined {
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
    return getCircleOrLineMarkups(markups, true, [circle, line]);
  }
  /**
   * Compute circles of specified radius tangent to both circles plus data about tangent points/fractions.
   * * There can be 0 to 8 circles.
   * @param circleA the first circle
   * @param circleB the second circle
   * @param radius radius of tangent circles
   */
  public static circlesTangentCircleCircleRadius(
    circleA: Arc3d,
    circleB: Arc3d,
    radius: number,
  ): { curve: Arc3d, details: CurveLocationDetailPair[] }[] | undefined {
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
    return getCircleOrLineMarkups(markups, true, [circleA, circleB]);
  }
}

// return true if the input is not a circular arc
function isNotCircularArc(cp: CurvePrimitive): boolean {
  return !(cp instanceof Arc3d) || !cp.isCircular;
}
// return true if the curve primitive is not a circle or a point
function isNotCircularOrPoint(arc: Arc3d): boolean {
  return arc.circularRadius() === undefined && !arc.isDegenerateCircle;
}
// create a CurveLocationDetail for a point on a curve if point is on the curve
function makeLocationDetail(curve: CurvePrimitive, contact: Point2d): CurveLocationDetail | undefined {
  const contact3d = Point3d.create(contact.x, contact.y, 0);
  const detail = curve.closestPointXY(contact3d, true);
  if (detail === undefined || detail.a > Geometry.smallMetricDistance)
    return undefined;
  return detail;
}
// return markups with captured circles or lines and their data
function getCircleOrLineMarkups(
  markups: ImplicitGeometryMarkup<ImplicitCurve2d>[], expectCircle: true, originalConstraint: (Arc3d | LineSegment3d)[],
): { curve: Arc3d, details: CurveLocationDetailPair[] }[] | undefined;
function getCircleOrLineMarkups(
  markups: ImplicitGeometryMarkup<ImplicitCurve2d>[], expectCircle: false, originalConstraint: (Arc3d | LineSegment3d)[],
): { curve: LineSegment3d, details: CurveLocationDetailPair[] }[] | undefined;
function getCircleOrLineMarkups(
  markups: ImplicitGeometryMarkup<ImplicitCurve2d>[], expectCircle: boolean, originalConstraint: (Arc3d | LineSegment3d)[],
): { curve: Arc3d | LineSegment3d, details: CurveLocationDetailPair[] }[] | undefined {
  const result: { curve: Arc3d | LineSegment3d, details: CurveLocationDetailPair[] }[] = [];
  for (const markup of markups) {
    const cp = ImplicitCurve2dConverter.createCurvePrimitiveFromImplicitCurve(markup.curve) as CurvePrimitive | undefined;
    if (cp === undefined)
      return undefined;
    if (expectCircle && isNotCircularArc(cp))
      return undefined;
    const curve = expectCircle ? cp as Arc3d : cp as LineSegment3d;
    const details: CurveLocationDetailPair[] = [];
    for (const implicitData of markup.data) {
      for (const original of originalConstraint) {
        const returnedDetail = makeLocationDetail(original, implicitData.point);
        if (returnedDetail !== undefined) {
          const detailA = returnedDetail;
          const detailB = makeLocationDetail(curve, implicitData.point);
          details.push(new CurveLocationDetailPair(detailA, detailB));
        }
      }
    }
    result.push({ curve, details });
  }
  return result.length > 0 ? result : undefined;
}
