/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module CartesianGeometry
 */

import { SmallSystem } from "../../../numerics/SmallSystem";
import { Geometry } from "../../../Geometry";
import { Point2d, Vector2d } from "../../../geometry3d/Point2dVector2d";
import { XAndY } from "../../../geometry3d/XYZProps";
import { TrigPolynomial } from "../../../numerics/Polynomials";
import { ImplicitCurve2d } from "./implicitCurve2d";

/**
 * Class for an ellipse in the xy plane.The ellipse equation in angular parameterization is
 * * X = A + U * cos(theta) + V * sin(theta)
 * which means that in the (skewed and scaled) coordinate system with origin at A and local u and v as
 * multiples of U and V the implicit equation is u^2 + v^2 = 1
 * * Note that the U and V vectors DO NOT need to be perpendicular or have any particular length relationship.
 * * If U and V ARE perpendicular, their lengths are commonly called the major and minor axis lengths,
 * and the major and minor axis points are in the U and V directions.
 * * If U and V are NOT perpendicular, the major and minor axis points are at other directions.
 * @internal
 */
export class UnboundedEllipse2d extends ImplicitCurve2d {
  /** The Cartesian coordinates of any center on the line. */
  public center: Point2d;
  /** The local u axis direction. */
  public vectorU: Vector2d;
  /** The local v axis direction. */
  public vectorV: Vector2d;
  /* Constructor - CAPTURE given center and axis vectors */
  private constructor(center: Point2d, vectorU: Vector2d, vectorV: Vector2d) {
    super();
    this.center = center;
    this.vectorU = vectorU;
    this.vectorV = vectorV;
  }
  /** Return a clone of this circle. */
  public clone(): UnboundedEllipse2d {
    // the create method clones the inputs
    return UnboundedEllipse2d.createCenterAndAxisVectors(this.center, this.vectorU, this.vectorV);
  }
  /**
   * Create an axis-aligned UnboundedEllipse2d with axis lengths.
   * * The implicit equation is (x/scaleU)^2 + (y/scaleV)^2 = 1
   * @param centerX x coordinate of center
   * @param centerY y coordinate of center
   * @param scaleX x axis radius
   * @param scaleY y axis radius
   */
  public static createFromCenterAndScales(centerX: number, centerY: number, scaleX: number, scaleY: number): UnboundedEllipse2d {
    return new UnboundedEllipse2d(Point2d.create(centerX, centerY),
      Vector2d.create(scaleX, 0), Vector2d.create(0, scaleY));
  }
  /**
   * Create an UnboundedEllipse2d from xy coordinates and axis vectors.
   * @param center xy coordinates of center
   * @param vectorU vector from center to to theta=0 point
   * @param vectorV vector from center to the theta=90 point
   */
  public static createCenterAndAxisVectors(center: XAndY, vectorU: XAndY, vectorV: XAndY): UnboundedEllipse2d {
    return new UnboundedEllipse2d(
      Point2d.create(center.x, center.y),
      Vector2d.create(vectorU.x, vectorU.y),
      Vector2d.create(vectorV.x, vectorV.y),
    );
  }
  /**
   * Convert the coordinates of spacePoint to local coordinates relative to the ellipse vectors.
   * @param spacePoint point for coordinate conversion
   */
  public globalToLocal(spacePoint: XAndY): Vector2d | undefined {
    const result = Vector2d.create();
    if (SmallSystem.linearSystem2d(
      this.vectorU.x, this.vectorV.x,
      this.vectorU.y, this.vectorV.y,
      spacePoint.x - this.center.x, spacePoint.y - this.center.y,
      result))
      return result;
    return undefined;
  }
  /**
   * Return the implicit function value at xy.
   * @param xy space point
   * @returns squared local (uv) coordinates minus 1
   */
  public override functionValue(xy: XAndY): number {
    const vectorUV = this.globalToLocal(xy);
    if (vectorUV === undefined)
      return 0;
    return vectorUV.x * vectorUV.x + vectorUV.y * vectorUV.y - 1.0;
  }
  /**
   * Returns gradient of the implicit function.
   * @param xy space point
   */
  public override gradient(xy: XAndY): Vector2d {
    const vectorUV = this.globalToLocal(xy);
    if (vectorUV === undefined)
      return Vector2d.create(0, 0);
    return ImplicitCurve2d.gradientLocalToGlobal(2 * vectorUV.x, 2 * vectorUV.y, this.vectorU, this.vectorV);
  }
  /**
   * Find points that are on the ellipse at foot of perpendiculars to the space point.
   * Pass each point to the handler.
   * * 0 to 4 handler calls are possible.
   * @param spacePoint the space point.
   * @handler the handler to receive all the points on the curve and radians where perpendicular happens.
   */
  public override emitPerpendiculars(spacePoint: Point2d,
    handler: (curvePoint: Point2d, radians: number | undefined) => void): void {
    const vectorW = Vector2d.createStartEnd(spacePoint, this.center);
    // vector from space point to point on ellipse is
    //    R = center + U*c + V * s - spacePoint
    //      = W + Uc * Vs           where W = center - spacePOInt
    // curve tangent is X' = (-U*s + V * c)
    // dot product R and X' is
    //    0 = (W + Uc + Vs ) dot (-Us + Vc)
    // coefficients of c and s and combinations are:
    const coffC = vectorW.dotProduct(this.vectorV);
    const coffS = -vectorW.dotProduct(this.vectorU);
    const coff1 = 0;
    const dotUV = this.vectorU.dotProduct(this.vectorV);
    const coffCC = dotUV;
    const coffSC = this.vectorV.dotProduct(this.vectorV) - this.vectorU.dotProduct(this.vectorU);
    const coffSS = -dotUV;
    const radiansSolutions: number[] = [];
    TrigPolynomial.solveUnitCircleImplicitQuadricIntersection(coffCC, coffSC, coffSS, coffC, coffS, coff1, radiansSolutions);
    for (const radians of radiansSolutions) {
      const curvePoint = this.radiansToPoint2d(radians)!;
      handler(curvePoint, radians);
    }
  }
  /**
   * Evaluate the curve point at parametric angle given in radians.
   * * Note that the radians is as it appears in sin(radians) and cos( radians),
   * and this is NOT a geometric angle in the xy plane.
   * * The radians value is only geometric if the U and V are perpendicular and of equal length,
   * i.e., the ellipse is a circle.
   * @param radians angular coordinate in the ellipse.
   */
  public override radiansToPoint2d(radians: number): Point2d | undefined {
    return this.center.plus2Scaled(this.vectorU, Math.cos(radians), this.vectorV, Math.sin(radians));
  }
  /**
   * Returns the tangent at given radians value.
   * @param radians parametric angle on the ellipse
   */
  public override radiansToTangentVector2d(radians: number): Vector2d | undefined {
    const c = Math.cos(radians);
    const s = Math.sin(radians);
    return Vector2d.createAdd2Scaled(this.vectorU, -s, this.vectorV, c);
  }
  /** Returns true if the ellipse is collapsed to a point or line.*/
  // eslint-disable-next-line @itwin/prefer-get
  public override isDegenerate(): boolean {
    return undefined === this.globalToLocal(Point2d.create(0, 0));
  }
  /**
   * Test if the centers and axes of the vectors are close
   * @param other second hyperbola
   * @param negatedAndExchangedAxesAreEqual
   *   * if false, a strong equality test requiring both U and V vectors to match.
   *      * This strong test is a test for identical parameterization.
   *   * if true, a weak equality test that allows U and V to be negated and or exchanged.
   *      * The weak test is a test for the same implicit set.
   * @returns true if identical to tolerance.
   */
  public isSameEllipse(other: UnboundedEllipse2d, negatedAndExchangedAxesAreEqual: boolean = false): boolean {
    const almostEqualOrNegated = (vectorU: Vector2d, vectorV: Vector2d): -1 | 0 | 1 => {
      if (Geometry.isSameCoordinate(vectorU.x, vectorV.x) && Geometry.isSameCoordinate(vectorU.y, vectorV.y))
        return 1;
      if (Geometry.isSameCoordinate(vectorU.x, -vectorV.x) && Geometry.isSameCoordinate(vectorU.y, -vectorV.y))
        return -1;
      return 0;
    }
    if (Geometry.isSamePoint2d(this.center, other.center)) {
      if (!negatedAndExchangedAxesAreEqual)
        return this.vectorU.isAlmostEqualMetric(other.vectorU) && this.vectorV.isAlmostEqualMetric(other.vectorV);
      const uuCode = almostEqualOrNegated(this.vectorU, other.vectorU);
      const vvCode = almostEqualOrNegated(this.vectorV, other.vectorV);
      if (uuCode !== 0 && vvCode !== 0)
        return true
      const uvCode = almostEqualOrNegated(this.vectorU, other.vectorV);
      const vuCode = almostEqualOrNegated(this.vectorV, other.vectorU);
      if (uvCode !== 0 && vuCode !== 0)
        return true;
    }
    return false;
  }
}
