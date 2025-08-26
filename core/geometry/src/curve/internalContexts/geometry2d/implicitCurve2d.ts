/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module CartesianGeometry
 */

import { Point2d, Vector2d } from "../../../geometry3d/Point2dVector2d";
import { XAndY } from "../../../geometry3d/XYZProps";
import { SmallSystem } from "../../../numerics/SmallSystem";
/**
 * Abstract base class for curves with an implicit 2d function.
 * * Curves in the class are required to have an implicit function f(x,y)=0.
 * * They MAY (but are not required to) implement a parametric evaluator radiansToPoint2d.
 * @internal
 */
export abstract class ImplicitCurve2d {
  /**
   * Return the implicit function value at xy, i.e, f(x,y).
   * @param xy point for evaluation.
   */
  public abstract functionValue(xy: XAndY): number;
  /**
   * Return the implicit function gradient at xy.
   * @param xy point for evaluation.
   */
  public abstract gradient(xy: XAndY): Vector2d;
  /** Map a gradient vector (du,dv) from its local frame to global. */
  public static gradientLocalToGlobal(du: number, dv: number, vectorU: Vector2d, vectorV: Vector2d): Vector2d {
    const result = Vector2d.create();
    // use INVERSE of TRANSPOSE of [UV] matrix to map gradient terms
    if (SmallSystem.linearSystem2d(vectorU.x, vectorU.y, vectorV.x, vectorV.y, du, dv, result))
      return result;
    return Vector2d.create(0, 0);
  }
  /**
   * Find all perpendiculars from space point to the curve.
   * Pass each in turn to the handler.
   * @param spacePoint the space point.
   * @handler the handler to receive all the points on the curve and radians where perpendicular happens.
   */
  public abstract emitPerpendiculars(
    spacePoint: Point2d, handler: (curvePoint: Point2d, radians: number | undefined) => any,
  ): any;
  /**
   * Call emitPerpendiculars. Return the closest of the perpendiculars.
   * * Return undefined if no perpendiculars are received.
   * @param spacePoint the space point.
   */
  public closestPoint(spacePoint: Point2d): Point2d | undefined {
    let minDistanceSquared: number = Number.MAX_SAFE_INTEGER;
    let point: Point2d | undefined;
    // console.log ({space: spacePoint.toJSON()});
    this.emitPerpendiculars(
      spacePoint,
      (curvePoint: Point2d, _radians: number | undefined) => {
        const distanceSquared = curvePoint.distanceSquared(spacePoint);
        // console.log ({distanceSquared, xy: curvePoint.toJSON(), minD: minDistanceSquared});
        if (distanceSquared < minDistanceSquared) {
          point = curvePoint.clone();
          minDistanceSquared = distanceSquared;
        }
      }
    );
    return point;
  }
  /** Return true if the item has degenerate defining data. */
  public abstract isDegenerate(): boolean;
  /** Return a clone of the curve. */
  public abstract clone(): ImplicitCurve2d;
  /**
   * OPTIONAL method to return a Point2d at given radians value.
   * * The default implementation returns undefined.
   * * Concrete classes that can be expressed as a function of radians should implement this.
   */
  public radiansToPoint2d(_radians: number): Point2d | undefined {
    return undefined;
  }
  /**
   * OPTIONAL method to return the tangent at given radians value.
   * * The default implementation returns undefined.
   * * Concrete classes that can be expressed as a function of radians should implement this.
   */
  public radiansToTangentVector2d(_radians: number): Vector2d | undefined {
    return undefined;
  }
}

export class Point2dImplicitCurve2d {
  public point: Point2d;
  public curve: ImplicitCurve2d;
  /**
   * CAPTURE a point and curve.
   * @param point point member
   * @param curve curve member
   */
  public constructor(point: Point2d, curve: ImplicitCurve2d) {
    this.point = point;
    this.curve = curve;
  }
}
/**
 * Carrier class containing:
 * * a curve which is a subclass of ImplicitCurve2d
 * * an array of paired point and ImplicitCurve2d.
 */
export class ImplicitGeometryMarkup<GeometryType extends ImplicitCurve2d> {
  public curve: GeometryType;
  public data: Point2dImplicitCurve2d[];
  /**
   * Construct a new carrier. The data array is created empty.
   * @param curve curve to CAPTURE
   */
  public constructor(curve: GeometryType) {
    this.curve = curve;
    this.data = [];
  }
  /** Create an ImplicitGeometryMarkup with a specified curve and empty data array. */
  public static createCapture<GeometryTypeA extends ImplicitCurve2d>(circle: GeometryTypeA): ImplicitGeometryMarkup<GeometryTypeA> {
    return new ImplicitGeometryMarkup<GeometryTypeA>(circle);
  }
  /**
   * * Use the otherCurve's emitPerpendiculars method to examine all perpendiculars from spacePoint to the curve.
   * * For each such point, compute distance from bias point.
   * * Choose the one whose distance is closest to biasDistance.
   * * push the chosen point on the data array.
   * @param spacePoint point to project to otherCurve
   * @param otherCurve target curve for projection
   * @param referencePoint reference point for point selection
   * @param biasDistance preferred distance.
   * @returns
   */
  public appendClosePoint(
    spacePoint: Point2d, otherCurve: ImplicitCurve2d, referencePoint: XAndY, biasDistance: number,
  ): boolean {
    let dMin: undefined | number;
    let closestPoint;
    otherCurve.emitPerpendiculars(
      spacePoint,
      (curvePoint: Point2d, _radians: number | undefined) => {
        const d = Math.abs(curvePoint.distance(referencePoint) - Math.abs(biasDistance));
        if (dMin === undefined || d < dMin) {
          dMin = d;
          closestPoint = curvePoint.clone();
        }
      }
    );
    if (closestPoint !== undefined)
      this.data.push(new Point2dImplicitCurve2d(closestPoint, otherCurve));
    return true;
  }
  /**
   * Find closest points of an array of curves.
   * @param spacePoint point to project to otherCurve
   * @param referencePoint reference point for point selection
   * @param biasDistance preferred distance.
   * @param otherCurves array of curves to check.
   */
  public closePointsOfGeometry(
    spacePoint: Point2d, referencePoint: Point2d, biasRadius: number, otherCurves: ImplicitCurve2d[],
  ): void {
    for (const c of otherCurves) {
      this.appendClosePoint(spacePoint, c, referencePoint, biasRadius);
    }
  }
}
