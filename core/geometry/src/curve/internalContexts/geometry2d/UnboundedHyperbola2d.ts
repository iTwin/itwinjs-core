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
import { ImplicitCurve2d} from "./implicitCurve2d";

/**
 * Internal class for hyperbola in the xy plane.  The hyperbola equation in angular parameterization is
 * * X = A + U * sec(theta) + V * tan(theta)
 * which means that in the (skewed and scaled) coordinate system with origin at A and local u and v as
 *   multiples of U and V the implicit equation is
 * * u^2 - v^2 = 1
 * which means the hyperbola opens along the positive and negative U axis with asymptotes at 45 degrees,
 *    i.e. along the directions (U+V) and (U-V)
 */
export class UnboundedHyperbola2d extends ImplicitCurve2d  {
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
     * Return a clone of this hyperbola.
     */
    public clone () : UnboundedHyperbola2d {
      // (The create method clones the inputs . . .)
      return  UnboundedHyperbola2d.createCenterAndAxisVectors (this.pointA, this.vectorU, this.vectorV);
    }
    /**
     * Return a clone of this circle, with radius negated
     */

  /**
   * Create UnboundedHyperbola2d with scale factors
   * * The implicit equation is
   *     (x/a)^2 - (y/b)^2 = 1
   * @param centerX x coordinate of center
   * @param centerY y coordinate of center
   * @param radius circle radius
   * @returns
   */
  public static createFromCenterAndScales(centerX: number, centerY: number, scaleU: number, scaleV: number): UnboundedHyperbola2d {
    return new UnboundedHyperbola2d(Point2d.create(centerX, centerY),
          Vector2d.create (scaleU,0), Vector2d.create (0, scaleV));
  }

  /**
   * Create an UnboundedHyperbola2d from an xy object and a radius.
   * @param pointA xy coordinates of center
   * @param vectorU vector from pointA to to theta=0 vertex, i.e. along axis on the "inside" of the curve
   * @param vectorV vector from pointA to the transverse direction.
   * @returns
   */
  public static createCenterAndAxisVectors(center: XAndY, vectorU: XAndY, vectorV: XAndY): UnboundedHyperbola2d {
    return new UnboundedHyperbola2d(Point2d.create (center.x, center.y),
          Vector2d.create (vectorU.x, vectorU.y),
          Vector2d.create (vectorV.x, vectorV.y));
  }
  /**
   * Return the local (uv) coordinate of a global point.
   * @param spacePoint
   */
  public globalToLocal (spacePoint: XAndY):Vector2d | undefined{
    const result = Vector2d.create ();
    if (SmallSystem.linearSystem2d (
      this.vectorU.x, this.vectorV.x,
      this.vectorU.y, this.vectorV.y,
      spacePoint.x - this.pointA.x, spacePoint.y - this.pointA.y, result))
      return result;
    return undefined;
  }
  /**
   *
   * @param radians parametric angle on the hyperbola
   * @returns xy coordinate on the hyperbola
   */
  public override radiansToPoint2d (radians: number): Point2d | undefined{
    const c = Math.cos (radians);
    const s = Math.sin (radians);
    if (Geometry.isSmallMetricDistance (Math.abs (c)))
        return undefined;
    return this.pointA.plus2Scaled (this.vectorU, 1.0 / c, this.vectorV, s / c);
  }
  /**
   *
   * @param xy space paoint
   * @returns squared distance to center minus squared radius
   */
public override functionValue (xy: XAndY) : number {
  const vectorUV = this.globalToLocal (xy);
  if (vectorUV === undefined)
    return 0;
  return vectorUV.x * vectorUV.x - vectorUV.y * vectorUV.y - 1.0;
}
  /**
   * Evaluate the gradiant (steepest descent) of the implicit function.
   * @param xy space paoint
   * @returns gradiant vector for the implicit function
   */
  public override gradiant (xy: XAndY) : Vector2d {
    const vectorUV = this.globalToLocal (xy);
    const result = Vector2d.create ();
    // Use INVERSE of TRANSPOSE of [UV] matrix to map gradiant terms !!!!
    if (vectorUV !== undefined && SmallSystem.linearSystem2d (
      this.vectorU.x, this.vectorU.y,
      this.vectorV.x, this.vectorV.y,
      2 * vectorUV.x, -2 * vectorUV.y, result))
      return result;
    return Vector2d.create (0,0);
    }
/**
 * At specified radians in the A + U sec(theta) + V sin(theta) parameterization,
 * evaluate the trigonometric polynomial which is used in emitPerpendiculars.
 * This expression should be zero for all radians values.  Hence this code is commented uot,
 * to be revivied only for experiments with the complicated expression.
 * @param radians
 * @returns
public radiansToPerpFunction (radians: number): number{
  const curvePoint = this.radiansToXY (radians)!;
  const sign = 1;
  const curvePointToCoordinateCenter = Vector2d.createStartEnd (curvePoint, this.pointA);
    const coffSC =  sign *curvePointToCoordinateCenter.dotProduct (this.vectorU);
    const coffC =  sign * curvePointToCoordinateCenter.dotProduct(this.vectorV);
    const coffS = this.vectorU.dotProduct (this.vectorU) + this.vectorV.dotProduct (this.vectorV);
    const coff1 = this.vectorU.dotProduct (this.vectorV);
    const coffSS = this.vectorV.dotProduct (this.vectorU);
const c = Math.cos(radians)
const s = Math.sin(radians);
const f1 = coffSC * s * c + coffC * c + coffS * s + coff1 + coffSS * s * s;
return f1;

const pointX = this.pointA.plus2Scaled (this.vectorU, 1/c, this.vectorV, s/c);
const vectorPart = Point2d.createZero ().plus2Scaled(this.vectorU, 1/c, this.vectorV, s/c);

const cc = c * c;
const vectorSpacePointToX = Vector2d.createStartEnd (curvePoint, pointX);
const tangentX = Vector2d.createZero().plus2Scaled (this.vectorU, s/ cc, this.vectorV, 1.0 / cc );
const f0 = vectorSpacePointToX.dotProduct(tangentX);
console.log ({radians, f0, f1, vectorSpacePointToX, spaceToCurve: vectorSpacePointToX.toJSON ()});
console.log ({centerToSpacePoint: curvePointToCoordinateCenter, vectorPart});

return f0;
}
*/
/**
 * Solve for parametric radians at hyperbola points which are perpendicular projections of spacePoint.
 * * Up to 4 solutionis are possible.
 * @param spacePoint
 * @param handler
 */
    public override emitPerpendiculars(spacePoint: Point2d,
   handler :(curvePoint: Point2d)=>any):any{
    const centerToSpacePoint = Vector2d.createStartEnd (spacePoint, this.pointA);
    // Coefficients of C and S where C and S are the unit circle points parameterized by theta.

    const coffSC =  centerToSpacePoint.dotProduct (this.vectorU);
    const coffC =  centerToSpacePoint.dotProduct(this.vectorV);
    const coffS = this.vectorU.dotProduct (this.vectorU) + this.vectorV.dotProduct (this.vectorV);
    const coff1 = this.vectorU.dotProduct (this.vectorV);
    const coffSS = this.vectorV.dotProduct (this.vectorU);
    const radiansSolutions: number[] = [];
    TrigPolynomial.solveUnitCircleImplicitQuadricIntersection(
      0, coffSC, coffSS, coffC, coffS, coff1, radiansSolutions);
    for (const radians of radiansSolutions){
      const s = Math.sin (radians);
      const c = Math.cos (radians);
      const curvePoint = this.pointA.plus2Scaled (this.vectorU, 1.0 / c, this.vectorV, s / c);
      handler(curvePoint);
    }
}


/**
 * @returns true if the circle radius is near zero.
 */
// eslint-disable-next-line @itwin/prefer-get
public override isDegenerate ():boolean{
  return undefined === this.globalToLocal (Point2d.create (0,0));
}
/**
 * Test if the centers and axes of the vectors are close
 * @param other second hyperbola
 * @param negatedAndExchangedAxesAreEqual
 *   * if false, a strong equality test requiring both U and V vectors to match
 *      * This strong test is a test for identical parameterization
 *   * if true, a weak equality test that allows U and V to be negated and or exchanged.
 *      * The weak test is a test for the same implicit set
 * @returns true if identical to tolerance.
 */
public isSameHyperbola (other: UnboundedHyperbola2d, negatedAndExchangedAxesAreEqual: boolean = false):boolean{
  if (Geometry.isSamePoint2d (this.pointA, other.pointA)){
    if (!negatedAndExchangedAxesAreEqual){
      // simple equality test on the vectors . .
      return this.vectorU.isAlmostEqualMetric (other.vectorU)
         && this.vectorV.isAlmostEqualMetric (other.vectorV);
    }
    // test negated and exchanged combinations ...
    const uuCode = almostEqualOrNegated (this.vectorU, other.vectorU);
    const vvCode = almostEqualOrNegated (this.vectorV, other.vectorV);
    //
    if (uuCode !== 0 && vvCode !== 0)
        return true
      const uvCode = almostEqualOrNegated (this.vectorU, other.vectorV);
      const vuCode = almostEqualOrNegated (this.vectorV, other.vectorU);
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
function almostEqualOrNegated (vectorU: Vector2d, vectorV: Vector2d): -1 | 0 | 1 {
  if (Geometry.isSameCoordinate (vectorU.x, vectorV.x)
       && Geometry.isSameCoordinate (vectorU.y, vectorV.y))
      return 1;
  if (Geometry.isSameCoordinate (vectorU.x, -vectorV.x)
    && Geometry.isSameCoordinate (vectorU.y, -vectorV.y))
     return -1;
  return 0;
 }