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
import { ImplicitCurve2d } from "./implicitCurve2d";

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
