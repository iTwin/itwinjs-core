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
 * Internal class for parabola in the xy plane, with an angular parameterization.
 * * In uv local coordinates
 *    * Let c = cos(theta) and s = sin(theta)
 *    * The parabola is (u,v) = (s/(1+c), (1-c)/(1+c))
 *    * The uv derivative is (u',v') = (1/(c+1), 2s/(c+1))
 * * Basic trig identities confirm that u^2 = v as expected for a parabola.
 * * This traces the parabola in a full theta range (-2PI < theta < 2PI).
 * * The angle theta = 2PI is the singular point.
 * * In XY coordinates the mapped parabola is
 *    *   x = A + Uu + Vv
 *    *   X = A + U*s/(1+c) + V*(1-2*c/(1+c))
 *    *   X' = U * (1/(c+1) + V*2s/(c+1))
 */
export class UnboundedParabola2d extends ImplicitCurve2d {
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
  /** Return a clone of this Parabola. */
  public clone(): UnboundedParabola2d {
    // the create method clones the inputs
    return UnboundedParabola2d.createCenterAndAxisVectors(this.center, this.vectorU, this.vectorV);
  }
  /**
   * Create an UnboundedParabola2d from an xy object and a radius.
   * @param center xy coordinates of center
   * @param vectorU vector from center to to theta=0 vertex, i.e., along axis on the "inside" of the curve
   * @param vectorV vector from center to the transverse direction.
   * @returns
   */
  public static createCenterAndAxisVectors(center: XAndY, vectorU: XAndY, vectorV: XAndY): UnboundedParabola2d {
    return new UnboundedParabola2d(Point2d.create(center.x, center.y),
      Vector2d.create(vectorU.x, vectorU.y),
      Vector2d.create(vectorV.x, vectorV.y),
    );
  }
  /**
   * Return the local (uv) coordinate of a global point.
   * @param spacePoint  point for coordinate conversion
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
   * Returns xy coordinate on the Parabola.
   * @param radians parametric angle on the Parabola
   */
  public override radiansToPoint2d(radians: number): Point2d | undefined {
    const c = Math.cos(radians);
    const s = Math.sin(radians);
    const q = 1 + c;
    if (Geometry.isSmallMetricDistance(Math.abs(q)))
      return undefined;
    return this.center.plus2Scaled(this.vectorU, s / q, this.vectorV, (1 - c) / q);
  }
  /**
   * Returns the tangent at given radians value.
   * @param radians parametric angle on the parabola
   */
  public override radiansToTangentVector2d(radians: number): Vector2d | undefined {
    const c = Math.cos(radians);
    const s = Math.sin(radians);
    const q = 1 + c;
    const u = Geometry.conditionalDivideCoordinate(1, q);
    const v = Geometry.conditionalDivideCoordinate(2 * s, q * q);
    if (u === undefined || v === undefined)
      return undefined;
    return Vector2d.createAdd2Scaled(this.vectorU, u, this.vectorV, v);
  }
  /**
   * Return the implicit function value at xy.
   * @param xy space point
   * @returns v - u*u
   */
  public override functionValue(xy: XAndY): number {
    const vectorUV = this.globalToLocal(xy);
    if (vectorUV === undefined)
      return 0;
    return vectorUV.y - vectorUV.x * vectorUV.x;
  }
  /**
   * Evaluate the (global coordinates) gradient (steepest descent) of the implicit function.
   * @param xy space point
   * @returns gradient vector for the implicit function
   */
  public override gradient(xy: XAndY): Vector2d {
    const vectorUV = this.globalToLocal(xy);
    const result = Vector2d.create();
    // use INVERSE of TRANSPOSE of [UV] matrix to map gradient terms
    if (vectorUV !== undefined && SmallSystem.linearSystem2d(
      this.vectorU.x, this.vectorU.y,
      this.vectorV.x, this.vectorV.y,
      - 2 * vectorUV.x, 1.0,
      result))
      return result;
    return Vector2d.create(0, 0);
  }
  /**
   * Solve for parametric radians at Parabola points which are perpendicular projections of spacePoint.
   * * Up to 4 solutions are possible.
   * @param spacePoint the space point.
   * @handler the handler to receive all the points on the curve and radians where perpendicular happens.
   */
  public override emitPerpendiculars(
    spacePoint: Point2d, handler: (curvePoint: Point2d, radians: number | undefined) => any,
  ): void {
    const vectorW = Vector2d.createStartEnd(spacePoint, this.center);
    // vectorW is from space point to curve origin.
    // vector to curve at an angle theta is vectorW + (s/(1=c)) U + ((1-c)/(1-s)) V
    // where c and s are cosine and sine of the parameterization angle.
    // The dot product of the curve tangent vector with the vector from spacePoint to curve
    //    has trig terms appearing at highest degree 2, hence is solved by the function
    // solveUnitCircleImplicitQuadricIntersection.
    const dotWU = vectorW.dotProduct(this.vectorU);
    const dotWV = vectorW.dotProduct(this.vectorV);
    const dotUU = this.vectorU.dotProduct(this.vectorU);
    const dotVV = this.vectorV.dotProduct(this.vectorV);
    const dotUV = this.vectorU.dotProduct(this.vectorV);
    const coff1 = dotWU;
    const coffC = 2 * dotWU;
    const coffS = 2 * dotWV + dotUU + 2 * dotVV;
    const coffCC = dotWU;
    const coffSC = 2 * dotWV + dotUU - 2 * dotVV;
    const coffSS = 3 * dotUV;
    const radiansSolutions: number[] = [];
    TrigPolynomial.solveUnitCircleImplicitQuadricIntersection(coffCC, coffSC, coffSS, coffC, coffS, coff1, radiansSolutions);
    for (const radians of radiansSolutions) {
      const curvePoint = this.radiansToPoint2d(radians);
      if (curvePoint !== undefined)
        handler(curvePoint, radians);
    }
  }
  /** Returns true if the circle radius is near zero. */
  // eslint-disable-next-line @itwin/prefer-get
  public override isDegenerate(): boolean {
    return undefined === this.globalToLocal(Point2d.create(0, 0));
  }
  /**
   * Test if the centers and axes of the vectors are close
   * @param other second Parabola
   * @param negatedAndExchangedAxesAreEqual
   *   * if false, a strong equality test requiring both U and V vectors to match
   *      * This strong test is a test for identical parameterization
   *   * if true, a weak equality test that allows U and V to be negated and or exchanged.
   *      * The weak test is a test for the same implicit set
   * @returns true if identical to tolerance.
   */
  public isSameParabola(other: UnboundedParabola2d, negatedAndExchangedAxesAreEqual: boolean = false): boolean {
    const almostEqualOrNegated = (vectorU: Vector2d, vectorV: Vector2d): -1 | 0 | 1 => {
      if (Geometry.isSameCoordinate(vectorU.x, vectorV.x)
        && Geometry.isSameCoordinate(vectorU.y, vectorV.y))
        return 1;
      if (Geometry.isSameCoordinate(vectorU.x, -vectorV.x)
        && Geometry.isSameCoordinate(vectorU.y, -vectorV.y))
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
