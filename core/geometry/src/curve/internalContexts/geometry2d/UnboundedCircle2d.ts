/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module CartesianGeometry
 */


import { Geometry } from "../../../Geometry";
import { Point2d, Vector2d } from "../../../geometry3d/Point2dVector2d";
import { XAndY } from "../../../geometry3d/XYZProps";
import { Degree2PowerPolynomial } from "../../../numerics/Polynomials";
import { ImplicitCurve2d } from "./implicitCurve2d";
import { UnboundedLine2dByPointAndNormal } from "./UnboundedLine2d.";

/**
 * Internal class for a complete circle in the xy plane, with center and radius stored.
 */
export class UnboundedCircle2dByCenterAndRadius extends ImplicitCurve2d {
  /** The Cartesian coordinates of any center on the line. */
  public center: Point2d;
  /** The circle radius */
  public radius: number;
  /* Constructor - CAPTURE given center and normal */
  private constructor(center: Point2d, radius: number) {
    super();
    this.center = center;
    this.radius = radius;
  }
    /**
     * Return a clone of this circle.
     */
    public clone () : UnboundedCircle2dByCenterAndRadius {
      // (The create method clones the inputs . . .)
      return  UnboundedCircle2dByCenterAndRadius.createPointRadius (this.center, this.radius);
    }
  /**
   * Create an ImplicitCircle2d from XY parts of its center and its radius
   * @param centerX x coordinate of center
   * @param centerY y coordinate of center
   * @param radius circle radius
   * @returns
   */
  public static createXYRadius(centerX: number, centerY: number, radius: number): UnboundedCircle2dByCenterAndRadius {
    return new UnboundedCircle2dByCenterAndRadius(Point2d.create(centerX, centerY), radius);
  }

  /**
   * Create an ImplicitCircle2d from an xy object and a radius.
   * @param center xy coordinates of center
   * @param radius circle radius
   * @returns
   */
  public static createPointRadius(center: XAndY, radius: number): UnboundedCircle2dByCenterAndRadius {
    return new UnboundedCircle2dByCenterAndRadius(Point2d.create(center.x, center.y), radius);
  }
  /**
   *
   * @param xy space paoint
   * @returns squared distance to center minus squared radius
   */
public override functionValue (xy: XAndY) : number {
  return Geometry.distanceSquaredXYXY (xy.x, xy.y, this.center.x, this.center.y) - this.radius * this.radius;
}
  /**
   *
   * @param xy space paoint
   * @returns squared distance to center minus squared radius
   */
  public override gradiant (xy: XAndY) : Vector2d {
    return Vector2d.createStartEnd (this.center, xy);
  }

public override emitPerpendiculars(spacePoint: Point2d,
   handler :(curvePoint: Point2d)=>any):any{
  const radialVector = Vector2d.createStartEnd (this.center, spacePoint).scaleToLength (this.radius);
  if (radialVector !== undefined){
    handler (this.center.plus (radialVector));
    handler(this.center.minus(radialVector));
  }
}

/**
 * @returns true if the circle radius is near zero.
 */
// eslint-disable-next-line @itwin/prefer-get
public override isDegenerate ():boolean{
  return Geometry.isSameCoordinate (this.radius, 0);
}
/**
 * Test if the centers and radii of two circles are close.
 * @param other second circle
 * @returns true if identical to tolerance.
 */
public isSameCircle (other: UnboundedCircle2dByCenterAndRadius, negatedRadiiAreEqual: boolean):boolean{
  if (negatedRadiiAreEqual)
    return Geometry.isSameCoordinate (Math.abs (this.radius), Math.abs (other.radius))
  && Geometry.isSamePoint2d (this.center, other.center);
return Geometry.isSameCoordinate (this.radius, other.radius)
    && Geometry.isSamePoint2d (this.center, other.center);
}
/**
 * Compute intersectionsn with another circle.
 * @param other second circle
 * @return array of 0, 1, or 2 points of intersection
 */
public intersectCircle (other: UnboundedCircle2dByCenterAndRadius): Point2d[]{
  const vectorAB = Vector2d.createStartEnd (this.center, other.center);
  const unitAB = vectorAB.normalize ();
  if (unitAB === undefined)
    return [];
  const d = vectorAB.magnitude();
  const rA2 = Geometry.square(this.radius);
  const rB2 = Geometry.square (other.radius);
  const b = Geometry.conditionalDivideCoordinate (rA2 - rB2 - d * d, -2 * d);
  const points = [];
  if (b !== undefined){
    const c2 = rB2 - b * b;
    if (Math.abs(c2) < Geometry.smallMetricDistanceSquared)
      points.push (other.center.plusScaled(unitAB, - b));
    else if (c2 > 0){
      const c = Math.sqrt (c2);
      points.push (other.center.addForwardLeft (-b, c, unitAB));
      points.push (other.center.addForwardLeft (-b, -c, unitAB));
    }
  }
  return points;
  }
/**
 * Compute intersectionsn with another circle.
 * @param other second circle
 * @return array of 0, 1, or 2 points of intersection
 */
public intersectLine (line: UnboundedLine2dByPointAndNormal): Point2d[]{
  const vectorU = line.vectorAlongLine ();
  // Point on line is X = P + alpha * U
  //   where P is line.point and U is the vector along line.
  // Vector from X to center is (X-C) = ((P-C) + alpha* U)
  // Match distance squared to center with this.radius squared
  // (define P-C = V)
  //       (V + alpha U) dot (V + alpha U) = r^2
  const vectorV = Vector2d.createStartEnd (this.center, line.point);
  const uDotV = vectorU.dotProduct (vectorV);
  const vDotV = vectorV.dotProduct(vectorV);
  const uDotU = vectorU.dotProduct (vectorU);
  const fractions = Degree2PowerPolynomial.solveQuadratic (uDotU, 2 * uDotV, vDotV - this.radius * this.radius);
  const points = [];
  if (fractions !== undefined)
    for (const f of fractions){
      points.push (line.point.plusScaled (vectorU, f));
      }
  return points;
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
export class TaggedArray<TagType,MemberType> {
  public tag: TagType;
  public data: MemberType[];
  /** CAPTURE tag and (optional) array.
   * * If he data array is not given, an empty array is created.
  */
  public constructor  (tag: TagType, data?: MemberType[]){
this.tag = tag;
this.data = data !== undefined ? data : [];

  }
}
