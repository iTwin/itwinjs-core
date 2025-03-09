/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module CartesianGeometry
 */



import { Geometry } from "../Geometry";
import { Point2d, Vector2d } from "../geometry3d/Point2dVector2d";
import { ImplicitCurve2d } from "./implicitCurve2d";
import { XAndY } from "../geometry3d/XYZProps";


export class ImplicitLine2d extends ImplicitCurve2d {
  /** The Cartesian coordinates of any point on the line. */
  public point: Point2d;
  /** The vector perpendicular to the line */
  public normal: Vector2d;
/* Constructor - CAPTURE given point and normal */
  private constructor (point: Point2d, normal: Vector2d){
    super();
    this.point = point;
    this.normal = normal;

  }
  /**
   * Create an ImplicitLine2d from XY parts of a point on the line and the normal vector.
   * @param pointX
   * @param pointY
   * @param normalX
   * @param normalY
   * @returns
   */
  public static createPointXYNormalXY (pointX: number, pointY: number, normalX: number, normalY: number): ImplicitLine2d{
    return new ImplicitLine2d (Point2d.create (pointX, pointY), Vector2d.create (normalX, normalY));
  }
  /**
   * Create an ImplicitLine2d from XY parts of a point on the line and the normal vector.
   * @param pointX
   * @param pointY
   * @param normalX
   * @param normalY
   * @returns
   */
  public static createPointNormal (point: Point2d, normal: Vector2d): ImplicitLine2d{
    return new ImplicitLine2d (point.clone(),normal.clone ());
  }
    /**
   * Create an ImplicitLine2d from XY parts of a point on the line and the normal vector.
   * * The normal vector points to the left of the direction vector.
   * @param pointX
   * @param pointY
   * @param directionX
   * @param normalY
   * @returns
   */
    public static createPointXYDirectionXY (pointX: number, pointY: number, directionX: number, directionY: number): ImplicitLine2d{
        return new ImplicitLine2d (Point2d.create (pointX, pointY), Vector2d.create (directionY, -directionX));
      }
    /**
   * Create an ImplicitLine2d from XY parts of a point on the line and the normal vector.
   * * The normal vector points to the left of the direction vector.
   * @param pointX
   * @param pointY
   * @param directionX
   * @param directionY
   * @returns
   */
    public static createPointXYPointXY (pointAX: number, pointAY: number, pointBX: number, pointBY: number): ImplicitLine2d{
        return this.createPointXYDirectionXY (pointAX, pointAY, pointBX-pointAX, pointBY-pointAY);
      }
    /**
   * Create an ImplicitLine2d from XY parts of a point on the line and the normal vector.
   * * The normal vector points to the left of the direction vector.
   * @param pointX
   * @param pointY
   * @param directionX
   * @param directionY
   * @returns
   */
    public static createPointPoint (pointA: XAndY, pointB: XAndY): ImplicitLine2d{
      return this.createPointXYDirectionXY (pointA.x, pointA.y, pointB.x-pointA.x, pointB.y-pointA.y);
    }
    /**
       * Return true if the normal vector has zero length.
       */
    // eslint-disable-next-line @itwin/prefer-get
    public override isDegenerate ():boolean{return this.normal.isAlmostZero;}
/**
 * @param xy space point for evaluation
 * @returns dot prodcut of the line normal with the vector from the line's point to the space point.
 */
    public override functionValue(xy: XAndY): number {
        return this.normal.dotProductStartEnd (this.point, xy);}
        /**
         * @returns a vector along the line, i.e. rotated 90 degrees from the normal vector.
         */
    public vectorAlongLine () : Vector2d {return this.normal.rotate90CCWXY();}

    public override closestPoint(xy: XAndY, _biasPoint?: XAndY): Point2d {
        const fraction = Geometry.fractionOfProjectionToVectorXYXY (
            xy.x - this.point.x, xy.y-this.point.y, this.normal.x, this.normal.y);
        return Point2d.create (xy.x - fraction * this.normal.x, xy.y - fraction * this.normal.y);
   }
   public  allNormalsToPoint(xy: XAndY):Point2d[] | undefined {
    const fraction = Geometry.fractionOfProjectionToVectorXYXY (
        xy.x - this.point.x, xy.y-this.point.y, this.normal.x, this.normal.y);
    return [Point2d.create (xy.x - fraction * this.normal.x, xy.y - fraction * this.normal.y)];
}
/**
 * Return a new implicit line with its reference point given relative to newOrigin, and its perpendicular vector
 *    normalized.
 * @return undefined if perpendicular vector has zero length.
 * @param newOrigin origin coordinates to subtract from existing origin.
*/
public cloneNormalizedFromOrigin (newOrigin: Point2d): ImplicitLine2d | undefined{
const unitNormal = this.normal.normalize ();
if (unitNormal === undefined)
    return undefined;
return new ImplicitLine2d (
    Point2d.create (this.point.x - newOrigin.x, this.point.y - newOrigin.y),
    Vector2d.create (unitNormal.x, unitNormal.y));
}
}