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
import { SmallSystem } from "../../../numerics/SmallSystem";

/**
 * An UnboundedLine2dByPointAndNormal represents an infinite line by a single point on the line and a normal vector.
 * * The normal vector is NOT required to be a unit (normalized) vector.
 * * Use method `cloneNormalizedFromOrigin` to create a line with unit normal.
 */
export class UnboundedLine2dByPointAndNormal extends ImplicitCurve2d {
  /** The Cartesian coordinates of any point on the line. */
  public point: Point2d;
  /** The vector perpendicular to the line */
  public normal: Vector2d;
  /* Constructor - CAPTURE given point and normal */
  private constructor(point: Point2d, normal: Vector2d) {
    super();
    this.point = point;
    this.normal = normal;
  }
  /** Return a clone of this line. */
  public clone(): UnboundedLine2dByPointAndNormal {
    // the create method clones the inputs
    return UnboundedLine2dByPointAndNormal.createPointNormal(this.point, this.normal);
  }
  /**
   * Create an UnboundedLine2dByPointAndNormal from XY parts of a point on the line and the normal vector.
   * @param pointX x coordinate of a reference point on the line
   * @param pointY y coordinate of the reference point
   * @param normalX x component of normal vector
   * @param normalY y component of normal vector
   * @returns new line object.
   */
  public static createPointXYNormalXY(pointX: number, pointY: number, normalX: number, normalY: number): UnboundedLine2dByPointAndNormal | undefined {
    const unitVector = Vector2d.create(normalX, normalY).normalize();
    if (unitVector === undefined)
      return undefined;
    return new UnboundedLine2dByPointAndNormal(Point2d.create(pointX, pointY), unitVector);
  }
  /**
   * Create an UnboundedLine2dByPointAndNormal from a point on the line and a normal vector.
   * * The xy data from the inputs is copied to the line.
   * * i.e. the inputs are NOT captured.
   * @param point any point on the line
   * @param normal the normal vector
   * @returns new line object.
   */
  public static createPointNormal(point: Point2d, normal: Vector2d): UnboundedLine2dByPointAndNormal {
    return new UnboundedLine2dByPointAndNormal(Point2d.create(point.x, point.y), Vector2d.create(normal.x, normal.y));
  }
  /**
   * Create an UnboundedLine2dByPointAndNormal from XY parts of a point on the line and a vector along the line
   * @param pointX x coordinate of a reference point on the line
   * @param pointY y coordinate of the reference point
   * @param directionX x component of the vector along the line
   * @param directionY y component of the vector along the line
   * @returns new line object.
   */
  public static createPointXYDirectionXY(pointX: number, pointY: number, directionX: number, directionY: number): UnboundedLine2dByPointAndNormal {
    return new UnboundedLine2dByPointAndNormal(Point2d.create(pointX, pointY), Vector2d.create(directionY, -directionX));
  }
  /**
   * Create an UnboundedLine2dByPointAndNormal from XY parts of two points on the line.
   * * The nominal origin is at pointA.
   * * The line direction is from pointA to pointB, converted to a normal by createPointXYDirectionXY.
   * @param pointAX x coordinate of first point on the line
   * @param pointAY y coordinate of first point on the line
   * @param pointBX x coordinate of second point on the line
   * @param pointBY y component of second point on the line
   * @returns new line object.
   */
  public static createPointXYPointXY(pointAX: number, pointAY: number, pointBX: number, pointBY: number): UnboundedLine2dByPointAndNormal {
    return this.createPointXYDirectionXY(pointAX, pointAY, pointBX - pointAX, pointBY - pointAY);
  }
  /**
   * Create an UnboundedLine2dByPointAndNormal from two points on the line.
   * @param pointA first point on the line
   * @param pointB second point on the line
   * @returns new line object.
   */
  public static createPointPoint(pointA: XAndY, pointB: XAndY): UnboundedLine2dByPointAndNormal {
    return this.createPointXYDirectionXY(pointA.x, pointA.y, pointB.x - pointA.x, pointB.y - pointA.y);
  }
  /** Return true if the normal vector has zero length. */
  // eslint-disable-next-line @itwin/prefer-get
  public override isDegenerate(): boolean {
    return this.normal.isAlmostZero;
  }
  /**
   * Return the implicit function value at xy.
   * @param xy space point for evaluation
   * @returns dot product of the line normal with the vector from the line's point to the space point.
   */
  public override functionValue(xy: XAndY): number {
    return this.normal.dotProductStartEnd(this.point, xy);
  }
  /**
   * Returns gradient of the implicit function.
   * @param xy space point
   * @returns unit normal of the line.
   */
  public override gradient(_xy: XAndY): Vector2d {
    const unit = this.normal.normalize();
    if (unit !== undefined)
      return unit;
    return Vector2d.create(0, 0);
  }
  /** Returns a vector along the line, i.e., rotated 90 degrees from the normal vector, with normal to the left. */
  public vectorAlongLine(): Vector2d {
    return this.normal.rotate90CWXY();
  }
  /**
   * Rotate the line normal by 90 degrees counterclockwise and normalize it
   * @returns the unit vector, or undefined if the normal is zero length.
   */
  public unitVectorAlongLine(): Vector2d | undefined {
    return this.normal.rotate90CCWXY().normalize();
  }
  /**
   * Return unit vector for the line normal.
   * @returns the unit vector, or undefined if the normal is zero length.
   */
  public unitNormal(): Vector2d | undefined {
    return this.normal.normalize();
  }
  /**
   * Drop a perpendicular from spacePoint to the line. Emit that point to the handler.
   * @param spacePoint the space point to be projected.
   * @handler the handler to receive the projection point.
   */
  public override emitPerpendiculars(
    spacePoint: Point2d,
    handler: (curvePoint: Point2d, radians: number | undefined) => any,
  ): any {
    const fraction = Geometry.fractionOfProjectionToVectorXYXY(
      spacePoint.x - this.point.x, spacePoint.y - this.point.y, this.normal.x, this.normal.y,
    );
    handler(spacePoint.plusScaled(this.normal, -fraction), undefined);
  }
  /**
   * Return a new implicit line with its reference point given relative to newOrigin, and its perpendicular vector normalized.
   * @return undefined if perpendicular vector has zero length.
   * @param newOrigin origin coordinates to subtract from existing origin.
  */
  public cloneNormalizedFromOrigin(newOrigin?: Point2d): UnboundedLine2dByPointAndNormal | undefined {
    const unitNormal = this.normal.normalize();
    if (unitNormal === undefined)
      return undefined;
    if (newOrigin === undefined)
      return new UnboundedLine2dByPointAndNormal(this.point.clone(), Vector2d.create(unitNormal.x, unitNormal.y));
    return new UnboundedLine2dByPointAndNormal(
      Point2d.create(this.point.x - newOrigin.x, this.point.y - newOrigin.y),
      Vector2d.create(unitNormal.x, unitNormal.y));
  }
  /**
   * Return a new implicit line with given origin and unit normal based on this.
   * * WARNING: Beware of confusing related function cloneNormalizedFromOrigin, which has different origin logic.
   * @return undefined if perpendicular vector has zero length.
  */
  public cloneNormalizedWithOrigin(newOrigin?: Point2d): UnboundedLine2dByPointAndNormal | undefined {
    const unitNormal = this.normal.normalize();
    if (unitNormal === undefined)
      return undefined;
    if (newOrigin === undefined)
      return new UnboundedLine2dByPointAndNormal(this.point, unitNormal);
    return new UnboundedLine2dByPointAndNormal(
      Point2d.create(newOrigin.x, newOrigin.y), Vector2d.create(unitNormal.x, unitNormal.y),
    );
  }
  /**
   * Return a new implicit line with its reference point shifted by given multiple of its normal vector.
   * * The shift is applied to the point, and the normal copied unchanged-- no normalization or test for zero.
   * @param shiftFactor multiplier for normal.
   * @return shifted line
  */
  public cloneShifted(shiftFactor: number): UnboundedLine2dByPointAndNormal | undefined {
    return UnboundedLine2dByPointAndNormal.createPointNormal(
      this.point.plusScaled(this.normal, shiftFactor),
      this.normal);
  }
  /**
   * Compute the intersection of two lines.
   * * Each can be offset.
   * * Offsets are in units of the dot products with normal vectors.
   *   * If normal vectors are unit vectors, the offsets are simple distance.
   *   * Otherwise the offset scaling is scaled --- use carefully.
   * @param other the other line.
   * @param thisOffset target function value for dot products with this line
   * @param otherOffset target function value for dot products with other line
   */
  public intersectUnboundedLine2dByPointAndNormalWithOffsets(
    other: UnboundedLine2dByPointAndNormal, thisOffset: number = 0, otherOffset: number = 0,
  ): Point2d | undefined {
    // points p = (x,y) on the line satisfies equation "normal dot (p−point​) = 0" and
    // points p = (x,y) on the  offset line satisfies equation "normal dot (p−point​) = offset"
    // therefore:
    // normal.x ​(x−point.x​) + normal.y ​(y−point.y​) = thisOffset
    // normal.x ​x + normal.y ​y = thisOffset + normal dot point.x​
    const xy = Vector2d.create();
    if (SmallSystem.linearSystem2d(
      this.normal.x, this.normal.y,
      other.normal.x, other.normal.y,
      thisOffset + this.normal.dotProduct(this.point), otherOffset + other.normal.dotProduct(other.point),
      xy)) {
      return Point2d.create(xy.x, xy.y);
    }
    return undefined;
  }
}
