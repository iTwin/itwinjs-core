/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module CartesianGeometry
 */



import { Geometry } from "../../../Geometry";
import { Point2d, Vector2d } from "../../../geometry3d/Point2dVector2d";
import { ImplicitCurve2d } from "./implicitCurve2d";
import { XAndY } from "../../../geometry3d/XYZProps";

/**
 * An UnboundedLine2dByPointAndNormal represents an infinite line by
 * a single point on the line and a normal vector.
 * * The normal vector is NOT required to be a unit (normalized) vector.
 * * Use method `cloneNormalizedFromOrigin` to create a line with unit normal.
 */
export class UnboundedLine2dByPointAndNormal extends ImplicitCurve2d {
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
   * Create an UnboundedLine2dByPointAndNormal from XY parts of a point on the line and the normal vector.
   * @param pointX x coordinate of a reference point on the line
   * @param pointY y coordinate of the reference point
   * @param normalX x component of normal vector
   * @param normalY y componnet of normal vector
   * @returns new line object.
   */
  public static createPointXYNormalXY (pointX: number, pointY: number, normalX: number, normalY: number): UnboundedLine2dByPointAndNormal{
    return new UnboundedLine2dByPointAndNormal (Point2d.create (pointX, pointY), Vector2d.create (normalX, normalY));
  }
  /**
   * Create an UnboundedLine2dByPointAndNormal from a point on the line and a normal vector.
   * @param point any point on the line
   * @param normal the normal vector
   * @returns new line object.
   */
  public static createPointNormal (point: Point2d, normal: Vector2d): UnboundedLine2dByPointAndNormal{
    return new UnboundedLine2dByPointAndNormal (
      Point2d.create (point.x, point.y), Vector2d.create (normal.x, normal.y));
  }
    /**
   * Create an UnboundedLine2dByPointAndNormal from XY parts of a point on the line and a vector along the line
   * @param pointX x coordinate of a reference point on the line
   * @param pointY y coordinate of the reference point
   * @param directionX x component of the vector along the line
   * @param directionY y componnet of the vector along the line
   * @returns new line object.
   */
    public static createPointXYDirectionXY (pointX: number, pointY: number, directionX: number, directionY: number): UnboundedLine2dByPointAndNormal{
        return new UnboundedLine2dByPointAndNormal (Point2d.create (pointX, pointY), Vector2d.create (directionY, -directionX));
      }
    /**
   * Create an UnboundedLine2dByPointAndNormal from XY parts of two points on the line.
   * @param pointAX x coordinate of first point on the line
   * @param pointAY y coordinate of first point on the line
   * @param pointBX x coordinate of second point on the line
   * @param pointBY y componnet of second pont on the line
   * @returns new line object.
   * @returns
   */
    public static createPointXYPointXY (pointAX: number, pointAY: number, pointBX: number, pointBY: number): UnboundedLine2dByPointAndNormal{
        return this.createPointXYDirectionXY (pointAX, pointAY, pointBX-pointAX, pointBY-pointAY);
      }
    /**
   * Create an UnboundedLine2dByPointAndNormal from two points on the line.
   * @param pointA first point on the line
   * @param pointB second point on the line
   * @returns new line object.
   */
    public static createPointPoint (pointA: XAndY, pointB: XAndY): UnboundedLine2dByPointAndNormal{
      return this.createPointXYDirectionXY (pointA.x, pointA.y, pointB.x-pointA.x, pointB.y-pointA.y);
    }
    /**
     * Return a clone of this line.
     */
    public clone () : UnboundedLine2dByPointAndNormal {
      // (The create method clones the inputs . . .)
      return  UnboundedLine2dByPointAndNormal.createPointNormal (this.point, this.normal);
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
   *
   * @param xy space paoint
   * @returns unnit normal of the line.
   */
  public override gradiant (_xy: XAndY) : Vector2d {
    const unit = this.normal.normalize ();
    if (unit !== undefined)
      return unit;
    return Vector2d.create (0,0);
    }

    /**
     * @returns a vector along the line, i.e. rotated 90 degrees from the normal vector, with normal to the left
     */
    public vectorAlongLine () : Vector2d {return this.normal.rotate90CWXY();}
    public override emitPerpendiculars(spacePoint: Point2d,
      handler :(curvePoint: Point2d)=>any):any{
        const fraction = Geometry.fractionOfProjectionToVectorXYXY (
          spacePoint.x - this.point.x, spacePoint.y-this.point.y, this.normal.x, this.normal.y);
        handler (spacePoint.plusScaled (this.normal, -fraction));
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
public cloneNormalizedFromOrigin (newOrigin: Point2d): UnboundedLine2dByPointAndNormal | undefined{
const unitNormal = this.normal.normalize ();
if (unitNormal === undefined)
    return undefined;
return new UnboundedLine2dByPointAndNormal (
    Point2d.create (this.point.x - newOrigin.x, this.point.y - newOrigin.y),
    Vector2d.create (unitNormal.x, unitNormal.y));
}
}