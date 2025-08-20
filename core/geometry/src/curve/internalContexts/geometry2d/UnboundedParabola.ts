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
 *    * Let c=co(theta) and s = sin(theta)
 *    * The parabola is (u,v) =  (s/ (1+c), (1-c)/(1+c) )
 *    * The uv derivative is (u',v') = (1/(c+1), 2s/(c+1) )
 * * Basic trig identities confirm that u^2 = v as expected for a parabola
 * * This traces the parabola in a full theta range (-2PI < theta < 2PI)
 * * The angle theta = 2PI is the singular point.
 * * In XY coordinates the mapped parabola is
 *    *         x = A + Uu + Vv
 *    *         X = A + U * s / (1+c) + V * (1  - 2 * c / (1+c))
 *    *         X' = U * (1/(c+1) + V * 2s / (c+1)
 * *
 * *
 */
export class UnboundedParabola2d extends ImplicitCurve2d {
  /** The Cartesian coordinates of any center on the line. */
  public pointA: Point2d;
  /** The local u axis direction. */
  public vectorU: Vector2d;
  /** The local v axis direction. */
  public vectorV: Vector2d;
  /* Constructor - CAPTURE given center and axis vectors */
  private constructor(pointA: Point2d, vectorU: Vector2d, vectorV: Vector2d) {
    super();
    this.pointA = pointA;
    this.vectorU = vectorU;
    this.vectorV = vectorV;
  }
  /**
   * Return a clone of this Parabola.
   */
  public clone(): UnboundedParabola2d {
    // (The create method clones the inputs . . .)
    return UnboundedParabola2d.createCenterAndAxisVectors(this.pointA, this.vectorU, this.vectorV);
  }
  /**
   * Return a clone of this circle, with radius negated
   */

  /**
   * Create an UnboundedParabola2d from an xy object and a radius.
   * @param pointA xy coordinates of center
   * @param vectorU vector from pointA to to theta=0 vertex, i.e. along axis on the "inside" of the curve
   * @param vectorV vector from pointA to the transverse direction.
   * @returns
   */
  public static createCenterAndAxisVectors(center: XAndY, vectorU: XAndY, vectorV: XAndY): UnboundedParabola2d {
    return new UnboundedParabola2d(Point2d.create(center.x, center.y),
      Vector2d.create(vectorU.x, vectorU.y),
      Vector2d.create(vectorV.x, vectorV.y));
  }
  /**
   * Return the local (uv) coordinate of a global point.
   * @param spacePoint
   */
  public globalToLocal(spacePoint: XAndY): Vector2d | undefined {
    const result = Vector2d.create();
    if (SmallSystem.linearSystem2d(
      this.vectorU.x, this.vectorV.x,
      this.vectorU.y, this.vectorV.y,
      spacePoint.x - this.pointA.x, spacePoint.y - this.pointA.y, result))
      return result;
    return undefined;
  }
  /**
   *
   * @param radians parametric angle on the Parabola
   * @returns xy coordinate on the Parabola
   */
  public override radiansToPoint2d(radians: number): Point2d | undefined {
    const c = Math.cos(radians);
    const s = Math.sin(radians);
    const q = 1 + c;
    if (Geometry.isSmallMetricDistance(Math.abs(q)))
      return undefined;
    return this.pointA.plus2Scaled(this.vectorU, s / q, this.vectorV, (1 - c) / q);
  }
  /** OPTIONAL method to return a tangent at given radians value.
 * * The default implementaiton returns undefined.
 * * Concrete classes that can be expressed as a function of radians should implement this.
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
   * Return the implicit function value v - u*u
   * @param xy space paoint
   */
  public override functionValue(xy: XAndY): number {
    const vectorUV = this.globalToLocal(xy);
    if (vectorUV === undefined)
      return 0;
    return vectorUV.y - vectorUV.x * vectorUV.x;
  }
  /**
   * Evaluate the (global coordinates) gradiant (steepest descent) of the implicit function.
   * @param xy space paoint
   * @returns gradiant vector for the implicit function
   */
  public override gradient(xy: XAndY): Vector2d {
    const vectorUV = this.globalToLocal(xy);
    const result = Vector2d.create();
    // Use INVERSE of TRANSPOSE of [UV] matrix to map gradiant terms !!!!
    if (vectorUV !== undefined && SmallSystem.linearSystem2d(
      this.vectorU.x, this.vectorU.y,
      this.vectorV.x, this.vectorV.y,
      - 2 * vectorUV.x, 1.0, result))
      return result;
    return Vector2d.create(0, 0);
  }
  /**
   * At specified radians in the A + U sec(theta) + V sin(theta) parameterization,
   * evaluate the trigonometric polynomial which is used in emitPerpendiculars.
   * This expression should be zero for all radians values.  Hence this code is commented uot,
   * to be revivied only for experiments with the complicated expression.
   * @param radians
   * @returns
  public radiansToPerpFunction (radians: number): number{
    const curvePoint = this.radiansToPoint2d (radians)!;
        const vectorW = Vector2d.createStartEnd (curvePoint, this.pointA);
      // Coefficients of c and s in the parameterization . . ..
      const dotWU = vectorW.dotProduct(this.vectorU);
      const dotWV = vectorW.dotProduct(this.vectorV);
  
      const dotUU = this.vectorU.dotProduct (this.vectorU);
      const dotVV = this.vectorV.dotProduct (this.vectorV);
      const dotUV = this.vectorU.dotProduct (this.vectorV);
  
      const coff1 =dotWU;
      const coffC = 2 * dotWU;
      const coffS = 2 * dotWV + dotUU + 2 * dotVV;
      const coffCC = dotWU;
      const coffSC = 2 * dotWV + dotUU - 2 * dotVV;
      const coffSS = 3 * dotUV;const c = Math.cos(radians)
  const s = Math.sin(radians);
  const f1 = coffCC * c * c + coffSC * s * c + coffC * c + coffS * s + coff1 + coffSS * s * s;
  return f1;
  
  const pointX = this.pointA.plus2Scaled (this.vectorU, 1/c, this.vectorV, s/c);
  const vectorPart = Point2d.createZero ().plus2Scaled(this.vectorU, 1/c, this.vectorV, s/c);
  
  const cc = c * c;
  const vectorSpacePointToX = Vector2d.createStartEnd (curvePoint, pointX);
  const tangentX = Vector2d.createZero().plus2Scaled (this.vectorU, s/ cc, this.vectorV, 1.0 / cc );
  const f0 = vectorSpacePointToX.dotProduct(tangentX);
  // eslint-disable-next-line no-console
  console.log ({radians, f0, f1, vectorSpacePointToX, spaceToCurve: vectorSpacePointToX.toJSON ()});
  // eslint-disable-next-line no-console
  console.log ({vectorW, vectorPart});
  
  return f0;
  }
  */
  /**
   * Solve for parametric radians at Parabola points which are perpendicular projections of spacePoint.
   * * Up to 4 solutionis are possible.
   * @param spacePoint
   * @param handler
   */
  public override emitPerpendiculars(spacePoint: Point2d,
    handler: (curvePoint: Point2d, radians: number | undefined) => any): void {
    const vectorW = Vector2d.createStartEnd(spacePoint, this.pointA);
    // Coefficients of c and s in the parameterization . . ..
    const dotWU = vectorW.dotProduct(this.vectorU);
    const dotWV = vectorW.dotProduct(this.vectorV);

    const dotUU = this.vectorU.dotProduct(this.vectorU);
    const dotVV = this.vectorV.dotProduct(this.vectorV);
    const dotUV = this.vectorU.dotProduct(this.vectorV);
    /*
        const coff1 = dotWU + dotUV;
        const coffC =  dotWU - dotUV;
        const coffS = 2 * dotWV + 2 * dotVV + dotUU;
        const coffCC = 0;
        const coffSC = 2 * dotWV - 2 * dotVV;
        const coffSS = 2 * dotUV;
    */
    const coff1 = dotWU;
    const coffC = 2 * dotWU;
    const coffS = 2 * dotWV + dotUU + 2 * dotVV;
    const coffCC = dotWU;
    const coffSC = 2 * dotWV + dotUU - 2 * dotVV;
    const coffSS = 3 * dotUV;

    const radiansSolutions: number[] = [];
    TrigPolynomial.solveUnitCircleImplicitQuadricIntersection(
      coffCC, coffSC, coffSS, coffC, coffS, coff1, radiansSolutions);
    for (const radians of radiansSolutions) {
      const curvePoint = this.radiansToPoint2d(radians);
      if (curvePoint !== undefined)
        handler(curvePoint, radians);
    }
  }


  /**
   * @returns true if the circle radius is near zero.
   */
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
    if (Geometry.isSamePoint2d(this.pointA, other.pointA)) {
      if (!negatedAndExchangedAxesAreEqual) {
        // simple equality test on the vectors . .
        return this.vectorU.isAlmostEqualMetric(other.vectorU)
          && this.vectorV.isAlmostEqualMetric(other.vectorV);
      }
      // test negated and exchanged combinations ...
      const uuCode = almostEqualOrNegated(this.vectorU, other.vectorU);
      const vvCode = almostEqualOrNegated(this.vectorV, other.vectorV);
      //
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
/**
 * return
 *   1 if vectors are almost equal (metric tolerance)
 *   -1 if almost negated (metric tolerance)
 *   0 if neither condition holds.
 * @param vectorU
 * @param vectorV
 */
function almostEqualOrNegated(vectorU: Vector2d, vectorV: Vector2d): -1 | 0 | 1 {
  if (Geometry.isSameCoordinate(vectorU.x, vectorV.x)
    && Geometry.isSameCoordinate(vectorU.y, vectorV.y))
    return 1;
  if (Geometry.isSameCoordinate(vectorU.x, -vectorV.x)
    && Geometry.isSameCoordinate(vectorU.y, -vectorV.y))
    return -1;
  return 0;
}