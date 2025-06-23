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
 *   multiples of U and V the implicit equation is: u^2 + v^2 = 1
 * * Note that the U and V vectors need not be perpendicular or have any particular length relationship.
 * * If U and V ARE perpendicular, their lengths are commonly called the major and minor axis lengths,
 *      and the major and minor axis points are in the U and V directions.
 * * If U and V are NOT perpendicular, the major and minor axis points are at other directions.
 * @internal
 */
export class UnboundedEllipse2d extends ImplicitCurve2d {
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
     * Return a clone of this circle.
     */
    public clone () : UnboundedEllipse2d {
      // (The create method clones the inputs . . .)
      return  UnboundedEllipse2d.createCenterAndAxisVectors (this.pointA, this.vectorU, this.vectorV);
    }
    /**
     * Return a clone of this circle, with radius negated
     */

  /**
   * Create an axis-aligned UnboundedEllipse2d with axis lengths
   * * The implicit equation is
   *     (x/scaleU)^2 + (y/scaleV)^2 = 1
   * @param centerX x coordinate of center
   * @param centerY y coordinate of center
   * @param scaleX x axis radius
   * @param scaleV y axis radius
   * @returns
   */
  public static createFromCenterAndScales(centerX: number, centerY: number, scaleX: number, scaleY
    : number): UnboundedEllipse2d {
    return new UnboundedEllipse2d(Point2d.create(centerX, centerY),
          Vector2d.create (scaleX,0), Vector2d.create (0, scaleY));
  }

  /**
   * Create an UnboundedEllipse2d from xy coordinates and axis vectors.
   * @param pointA xy coordinates of center
   * @param vectorU vector from pointA to to theta=0 point
   * @param vectorV vector from pointA to the theta=90 point
   * @returns
   */
  public static createCenterAndAxisVectors(center: XAndY, vectorU: XAndY, vectorV: XAndY): UnboundedEllipse2d {
    return new UnboundedEllipse2d(Point2d.create (center.x, center.y),
          Vector2d.create (vectorU.x, vectorU.y),
          Vector2d.create (vectorV.x, vectorV.y));
  }
  /**
   * Convert the coordinates of spacePoint to local coordinates relative to the ellipse vectors.
   * @param spacePoint point for coordinate conversion
   * @returns
   */
  public globalToLocal (spacePoint: XAndY):Vector2d | undefined{
    const result = Vector2d.create ();
    if (SmallSystem.linearSystem2d (
      this.vectorU.x, this.vectorV.x, spacePoint.x - this.pointA.x,
      this.vectorU.y, this.vectorV.y, spacePoint.y - this.pointA.y, result))
      return result;
    return undefined;
  }
  /**
   * Return the implicit function value at xy.
   * @param xy space paoint
   * @returns squared local (uv) coordinates minus 1.
   */
public override functionValue (xy: XAndY) : number {
  const vectorUV = this.globalToLocal (xy);
  if (vectorUV === undefined)
    return 0;
  return vectorUV.x * vectorUV.x + vectorUV.y * vectorUV.y - 1.0;
}
  /**
   *
   * @param xy space paoint
   * @returns gradient of the implicit function
   */
  public override gradiant (xy: XAndY) : Vector2d {
    const vectorUV = this.globalToLocal (xy);
    if (vectorUV === undefined)
      return Vector2d.create (0,0);
    return Vector2d.create (2 * vectorUV.x, 2 * vectorUV.y);
    }
/**
 * Find points that are on the ellipse at foot of perpendiculars to the space ponit.
 * Pass each point to the handler.
 * * 0 to 4 handler calls are possible.
 * @param spacePoint point to project to the ellipse
 * @param handler function to receive curve points.
 */
public override emitPerpendiculars(spacePoint: Point2d,
   handler :(curvePoint: Point2d)=>any):any{
    const centerToSpacePoint = Vector2d.createStartEnd (this.pointA, spacePoint);
    // Coefficients of C and S where C and S are the unit circle points parameterized by theta.
    const coffSC = centerToSpacePoint.dotProduct (this.vectorU);
    const coffC = centerToSpacePoint.dotProduct(this.vectorV);
    const coffS = this.vectorU.dotProduct (this.vectorU); + this.vectorV.dotProduct (this.vectorV);
    const coff1 = this.vectorU.dotProduct (this.vectorV);
    const coffSS = this.vectorV.dotProduct (this.vectorU);
    const radiansSolutions: number[] = [];
    TrigPolynomial.solveUnitCircleImplicitQuadricIntersection(
      0.0, coffSC, coffSS, coffC, coffS, coff1, radiansSolutions);
    for (const radians of radiansSolutions){
      const s = Math.sin (radians);
      const c = Math.cos (radians);
      const curvePoint = this.pointA.plus2Scaled (this.vectorU, 1.0 / c, this.vectorV, s / c);
      handler(curvePoint);
    }
  }
    /**
     * Evaluate the curve point at parametric angle given in radians.
     * * Note that the radians is as it appears in sin(radians) and cos( radians), and
     *     this is NOT a geometric angle in the xy plane.
     * * The radians value is only geometric if the U and V are perpendicular and of equal length, i.e.
     *     the ellipse is a circle.
     * @param radians angular coordinate in the ellipse.
     * @returns
     */
    public override radiansToPoint2d(radians: number): Point2d | undefined {
      return this.pointA.plus2Scaled (this.vectorU, Math.cos (radians), this.vectorV, Math.sin (radians));
    }


/**
 * @returns true if the ellipse is collapsed to a point or line.
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
public isSameEllipse (other: UnboundedEllipse2d, negatedAndExchangedAxesAreEqual: boolean = false):boolean{
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

function almostEqualOrNegated (vectorU: Vector2d, vectorV: Vector2d): -1 | 0 | 1 {
  if (Geometry.isSameCoordinate (vectorU.x, vectorV.x)
       && Geometry.isSameCoordinate (vectorU.y, vectorV.y))
      return 1;
  if (Geometry.isSameCoordinate (vectorU.x, -vectorV.x)
    && Geometry.isSameCoordinate (vectorU.y, -vectorV.y))
     return -1;
  return 0;
 }