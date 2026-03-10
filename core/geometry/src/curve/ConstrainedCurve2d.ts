/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module CartesianGeometry
 */

import { Arc3d } from "./Arc3d";
import { CurvePrimitive } from "./CurvePrimitive";
import { LineSegment3d } from "./LineSegment3d";
import { ConstrainedImplicitCurve2d } from "./internalContexts/geometry2d/ConstrainedImplicitCurve2d";
import { ImplicitCurve2dConverter } from "./internalContexts/geometry2d/ImplicitCurve2dConverter";
import { UnboundedCircle2dByCenterAndRadius } from "./internalContexts/geometry2d/UnboundedCircle2d";
import { UnboundedLine2dByPointAndNormal } from "./internalContexts/geometry2d/UnboundedLine2d";

// return true if the input is not a circular arc
function isNotArcOrCircular(cp: CurvePrimitive | CurvePrimitive[] | undefined): boolean {
  return !(cp instanceof Arc3d) || !cp.isCircular;
}

// return true if the curve primitive is not a circle or a point
function isNotCircularNorPoint(arc: Arc3d): boolean {
  return arc.circularRadius() === undefined && !arc.isPoint;
}

/**
 * The class has static methods to compute circles and lines with specified constrained (tangent to other lines/circles,
 * perpendicular to other lines/circles, or a specified circle radius).
 * * z components of the input curves are completely ignored.
 * * In this API, a `LineSegment3d` input identifies the underlying unbounded line by its endpoints.
 * The segment itself is bounded, but the geometric line constraint is applied as unbounded.
 * @alpha
 */
export class ConstrainedCurve2d {
  /**
   * Return all (i.e., up to 4) circles that are tangent to 3 given lines.
   * @param lineA first line
   * @param lineB second line
   * @param lineC third line
   */
  public static circlesTangentLLL(
    lineA: LineSegment3d,
    lineB: LineSegment3d,
    lineC: LineSegment3d,
  ): Arc3d[] | undefined {
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
    const result: Arc3d[] = [];
    for (const markup of markups) {
      const cp = ImplicitCurve2dConverter.createCurvePrimitiveFromImplicitCurve(markup.curve);
      if (isNotArcOrCircular(cp))
        return undefined;
      result.push(cp as Arc3d);
    }
    return result.length > 0 ? result : undefined;
  }
  /**
   * Return all (i.e., up to 2) unbounded lines perpendicular to a line and tangent to a circle.
   * @param line the line
   * @param circle the circle
   * @param sizeHint the size hint is used when creating the returned line segment. Larger values create a longer line
   * segment. Default is 5.
   */
  public static linesPerpLTangentC(
    line: LineSegment3d,
    circle: Arc3d,
    sizeHint: number = 5,
  ): LineSegment3d[] | undefined {
    if (isNotCircularNorPoint(circle))
      return undefined;
    const implicitLine = ImplicitCurve2dConverter.createImplicitCurve2dFromCurvePrimitiveXY(line);
    const implicitCircle = ImplicitCurve2dConverter.createImplicitCurve2dFromCurvePrimitiveXY(circle);
    if (!(implicitLine instanceof UnboundedLine2dByPointAndNormal)
      || !(implicitCircle instanceof UnboundedCircle2dByCenterAndRadius))
      return undefined;
    const markups = ConstrainedImplicitCurve2d.linesPerpLTangentC(implicitLine, implicitCircle);
    if (markups === undefined)
      return undefined;
    const result: LineSegment3d[] = [];
    for (const markup of markups) {
      const cp = ImplicitCurve2dConverter.createCurvePrimitiveFromImplicitCurve(markup.curve, sizeHint);
      if (cp instanceof LineSegment3d)
        result.push(cp);
    }
    return result.length > 0 ? result : undefined;
  }
  /**
   * Return all (i.e., 4) variants of the line perpendicular to 2 circles (line between centers, with ends at
   * crossing points on respective circles).
   * @param circleA first circle
   * @param circleB second circle
   * @param sizeHint the size hint is used when creating the returned line segment. Larger values create a longer line
   * segment. Default is 5.
   */
  public static linesPerpCPerpC(
    circleA: Arc3d,
    circleB: Arc3d,
    sizeHint: number = 5,
  ): LineSegment3d[] | undefined {
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
    const result: LineSegment3d[] = [];
    for (const markup of markups) {
      const cp = ImplicitCurve2dConverter.createCurvePrimitiveFromImplicitCurve(markup.curve, sizeHint);
      if (cp instanceof LineSegment3d)
        result.push(cp);
    }
    return result.length > 0 ? result : undefined;
  }
  /**
   * Return all (i.e., up to 2) unbounded lines perpendicular to a line and a circle.
   * @param line the line
   * @param circle the circle
   * @param sizeHint the size hint is used when creating the returned line segment. Larger values create a longer line
   * segment. Default is 5.
   */
  public static linesPerpLPerpC(
    line: LineSegment3d,
    circle: Arc3d,
    sizeHint: number = 5,
  ): LineSegment3d[] | undefined {
    if (isNotCircularNorPoint(circle))
      return undefined;
    const implicitLine = ImplicitCurve2dConverter.createImplicitCurve2dFromCurvePrimitiveXY(line);
    const implicitCircle = ImplicitCurve2dConverter.createImplicitCurve2dFromCurvePrimitiveXY(circle);
    if (!(implicitLine instanceof UnboundedLine2dByPointAndNormal)
      || !(implicitCircle instanceof UnboundedCircle2dByCenterAndRadius))
      return undefined;
    const markups = ConstrainedImplicitCurve2d.linesPerpLPerpC(implicitLine, implicitCircle);
    if (markups === undefined)
      return undefined;
    const result: LineSegment3d[] = [];
    for (const markup of markups) {
      const cp = ImplicitCurve2dConverter.createCurvePrimitiveFromImplicitCurve(markup.curve, sizeHint);
      if (cp instanceof LineSegment3d)
        result.push(cp);
    }
    return result.length > 0 ? result : undefined;
  }
  /**
   * Return all (i.e., up to 4) unbounded lines perpendicular to a circle and tangent to a circle.
   * Note that multiple colinear lines are returned tagged with diametrically opposing points of circleA.
   * @param circleA first circle (for perpendicular constraint)
   * @param circleB second circle (for tangent constraint)
   * @param sizeHint the size hint is used when creating the returned line segment. Larger values create a longer line
   * segment. Default is 5.
   */
  public static linesPerpCTangentC(
    circleA: Arc3d,
    circleB: Arc3d,
    sizeHint: number = 5,
  ): LineSegment3d[] | undefined {
    if (isNotCircularNorPoint(circleA) || isNotCircularNorPoint(circleB))
      return undefined;
    const implicitCircleA = ImplicitCurve2dConverter.createImplicitCurve2dFromCurvePrimitiveXY(circleA);
    const implicitCircleB = ImplicitCurve2dConverter.createImplicitCurve2dFromCurvePrimitiveXY(circleB);
    if (!(implicitCircleA instanceof UnboundedCircle2dByCenterAndRadius)
      || !(implicitCircleB instanceof UnboundedCircle2dByCenterAndRadius))
      return undefined;
    const markups = ConstrainedImplicitCurve2d.linesPerpCTangentC(implicitCircleA, implicitCircleB);
    if (markups === undefined)
      return undefined;
    const result: LineSegment3d[] = [];
    for (const markup of markups) {
      const cp = ImplicitCurve2dConverter.createCurvePrimitiveFromImplicitCurve(markup.curve, sizeHint);
      if (cp instanceof LineSegment3d)
        result.push(cp);
    }
    return result.length > 0 ? result : undefined;
  }
  /**
   * Return all (i.e., up to 4) unbounded lines tangent to 2 circles.
   * * There are 4 lines if there is neither intersection nor containment between the circles
   * * There are 2 lines if the circles intersect
   * * There are no lines if one circle is entirely inside the other.
   * @param circleA first circle
   * @param circleB second circle
   * @param sizeHint the size hint is used when creating the returned line segment. Larger values create a longer line
   * segment. Default is 5.
   */
  public static linesTangentCC(
    circleA: Arc3d,
    circleB: Arc3d,
    sizeHint: number = 5,
  ): LineSegment3d[] | undefined {
    if (isNotCircularNorPoint(circleA) || isNotCircularNorPoint(circleB))
      return undefined;
    const implicitCircleA = ImplicitCurve2dConverter.createImplicitCurve2dFromCurvePrimitiveXY(circleA);
    const implicitCircleB = ImplicitCurve2dConverter.createImplicitCurve2dFromCurvePrimitiveXY(circleB);
    if (!(implicitCircleA instanceof UnboundedCircle2dByCenterAndRadius)
      || !(implicitCircleB instanceof UnboundedCircle2dByCenterAndRadius))
      return undefined;
    const markups = ConstrainedImplicitCurve2d.linesTangentCC(implicitCircleA, implicitCircleB);
    if (markups === undefined)
      return undefined;
    const result: LineSegment3d[] = [];
    for (const markup of markups) {
      const cp = ImplicitCurve2dConverter.createCurvePrimitiveFromImplicitCurve(markup.curve, sizeHint);
      if (cp instanceof LineSegment3d)
        result.push(cp);
    }
    return result.length > 0 ? result : undefined;
  }
  /**
   * Return all (i.e., up to 8) circles tangent to two lines and a circle.
   * @param lineA first line
   * @param lineB second line
   * @param circle the circle
   */
  public static circlesTangentLLC(
    lineA: LineSegment3d,
    lineB: LineSegment3d,
    circle: Arc3d,
  ): Arc3d[] | undefined {
    if (isNotCircularNorPoint(circle))
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
    const result: Arc3d[] = [];
    for (const markup of markups) {
      const cp = ImplicitCurve2dConverter.createCurvePrimitiveFromImplicitCurve(markup.curve);
      if (isNotArcOrCircular(cp))
        return undefined;
      result.push(cp as Arc3d);
    }
    return result.length > 0 ? result : undefined;
  }
  /**
   * Return all (i.e., up to 4) circles tangent to 2 circles and a line.
   * @param circleA first circle
   * @param circleB second circle
   * @param line the line
   */
  public static circlesTangentCCL(
    circleA: Arc3d,
    circleB: Arc3d,
    line: LineSegment3d,
  ): Arc3d[] | undefined {
    if (isNotCircularNorPoint(circleA) || isNotCircularNorPoint(circleB))
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
    const result: Arc3d[] = [];
    for (const markup of markups) {
      const cp = ImplicitCurve2dConverter.createCurvePrimitiveFromImplicitCurve(markup.curve);
      if (isNotArcOrCircular(cp))
        return undefined;
      result.push(cp as Arc3d);
    }
    return result.length > 0 ? result : undefined;
  }
  /**
   * Return all (i.e., up to 8) circles tangent to 3 circles.
   * @param circleA first circle
   * @param circleB second circle
   * @param circleC third circle
   */
  public static circlesTangentCCC(
    circleA: Arc3d,
    circleB: Arc3d,
    circleC: Arc3d,
  ): Arc3d[] | undefined {
    if (isNotCircularNorPoint(circleA) || isNotCircularNorPoint(circleB) || isNotCircularNorPoint(circleC))
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
    const result: Arc3d[] = [];
    for (const markup of markups) {
      const cp = ImplicitCurve2dConverter.createCurvePrimitiveFromImplicitCurve(markup.curve);
      if (isNotArcOrCircular(cp))
        return undefined;
      result.push(cp as Arc3d);
    }
    return result.length > 0 ? result : undefined;
  }
  /**
   * Compute circles of specified radius tangent to each of the lines.
   * * There are normally 4 circles.
   * * Returns undefined when the lines are parallel.
   * @param lineA first line
   * @param lineB second line
   * @param radius radius of tangent circles
   * @returns array of circles, or undefined if lines are parallel.
   */
  public static circlesTangentLLR(
    lineA: LineSegment3d,
    lineB: LineSegment3d,
    radius: number,
  ): Arc3d[] | undefined {
    const implicitLineA = ImplicitCurve2dConverter.createImplicitCurve2dFromCurvePrimitiveXY(lineA);
    const implicitLineB = ImplicitCurve2dConverter.createImplicitCurve2dFromCurvePrimitiveXY(lineB);
    if (!(implicitLineA instanceof UnboundedLine2dByPointAndNormal)
      || !(implicitLineB instanceof UnboundedLine2dByPointAndNormal))
      return undefined;
    const markups = ConstrainedImplicitCurve2d.circlesTangentLLR(implicitLineA, implicitLineB, radius);
    if (markups === undefined)
      return undefined;
    const result: Arc3d[] = [];
    for (const markup of markups) {
      const cp = ImplicitCurve2dConverter.createCurvePrimitiveFromImplicitCurve(markup.curve);
      if (isNotArcOrCircular(cp))
        return undefined;
      result.push(cp as Arc3d);
    }
    return result.length > 0 ? result : undefined;
  }
  /**
   * Compute circles of specified radius tangent to both a circle and a line.
   * * There can be 0 to 8 circles.
   * @param circle the circle
   * @param line the line
   * @param radius radius of tangent circles
   * @returns array of circles with annotated tangencies
   */
  public static circlesTangentCLR(
    circle: Arc3d,
    line: LineSegment3d,
    radius: number,
  ): Arc3d[] | undefined {
    if (isNotCircularNorPoint(circle))
      return undefined;
    const implicitCircleA = ImplicitCurve2dConverter.createImplicitCurve2dFromCurvePrimitiveXY(circle);
    const implicitLineB = ImplicitCurve2dConverter.createImplicitCurve2dFromCurvePrimitiveXY(line);
    if (!(implicitCircleA instanceof UnboundedCircle2dByCenterAndRadius)
      || !(implicitLineB instanceof UnboundedLine2dByPointAndNormal))
      return undefined;
    const markups = ConstrainedImplicitCurve2d.circlesTangentCLR(implicitCircleA, implicitLineB, radius);
    if (markups === undefined)
      return undefined;
    const result: Arc3d[] = [];
    for (const markup of markups) {
      const cp = ImplicitCurve2dConverter.createCurvePrimitiveFromImplicitCurve(markup.curve);
      if (isNotArcOrCircular(cp))
        return undefined;
      result.push(cp as Arc3d);
    }
    return result.length > 0 ? result : undefined;
  }
  /**
   * Compute circles of specified radius tangent to both circles.
   * * There can be 0 to 8 circles.
   * @param circleA the first circle
   * @param circleB the second circle
   * @param radius radius of tangent circles
   * @returns array of circles with annotated tangencies
   */
  public static circlesTangentCCR(
    circleA: Arc3d,
    circleB: Arc3d,
    radius: number,
  ): Arc3d[] | undefined {
    if (isNotCircularNorPoint(circleA) || isNotCircularNorPoint(circleB))
      return undefined;
    const implicitCircleA = ImplicitCurve2dConverter.createImplicitCurve2dFromCurvePrimitiveXY(circleA);
    const implicitCircleB = ImplicitCurve2dConverter.createImplicitCurve2dFromCurvePrimitiveXY(circleB);
    if (!(implicitCircleA instanceof UnboundedCircle2dByCenterAndRadius)
      || !(implicitCircleB instanceof UnboundedCircle2dByCenterAndRadius))
      return undefined;
    const markups = ConstrainedImplicitCurve2d.circlesTangentCCR(implicitCircleA, implicitCircleB, radius);
    if (markups === undefined)
      return undefined;
    const result: Arc3d[] = [];
    for (const markup of markups) {
      const cp = ImplicitCurve2dConverter.createCurvePrimitiveFromImplicitCurve(markup.curve);
      if (isNotArcOrCircular(cp))
        return undefined;
      result.push(cp as Arc3d);
    }
    return result.length > 0 ? result : undefined;
  }
}
