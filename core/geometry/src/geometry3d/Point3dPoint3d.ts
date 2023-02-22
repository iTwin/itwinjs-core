/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module CartesianGeometry
 */
import { Point3d } from "./Point3dVector3d";
import { XYAndZ } from "./XYZProps";
/**
 * The Point3dPoint3d class carries a pair of points labeled pointA and pointB.
 * * This is intended as a convenient way to carry the points around, NOT as formal heavyweight line segment.
 * * Use LineSegment3d.createFromPoint3dPoint3d to promote (copies of) points to LineSegment3d.
 * @public
 */
export class Point3dPoint3d {
  public pointA: Point3d;
  public pointB: Point3d;
  // CAPTURE the two given points
  private constructor(pointA: Point3d, pointB: Point3d) {
    this.pointA = pointA;
    this.pointB = pointB;
  }
  /** CAPTURE the two point objects in a new Point3dPoint3d */
  public static createCapture(pointA: Point3d, pointB: Point3d): Point3dPoint3d {
    return new Point3dPoint3d(pointA, pointB);
  }
  /** Create with CLONES of the given points in a new Point3dPoint3d*.
      Optionally replace coordinates in the caller-supplied result.
   */
  public static create(pointA: XYAndZ, pointB: XYAndZ, result?: Point3dPoint3d): Point3dPoint3d {
    if (result) {
      result.pointA.set(pointA.x, pointA.y, pointA.z);
      result.pointB.set(pointB.x, pointB.y, pointB.z);
      return result;
    }
    return new Point3dPoint3d(Point3d.create(pointA.x, pointA.y, pointA.z), Point3d.create(pointB.x, pointB.y, pointB.z));
  }

  /** Create a new Point3dPoint3d with given xyz coordinates.  Optionally replace coordinates in preallocated result*/
  public static createXYZXYZ(xA: number, yA: number, zA: number, xB: number, yB: number, zB: number, result?: Point3dPoint3d): Point3dPoint3d {
    if (result) {
      result.pointA.set(xA, yA, zA);
      result.pointB.set(xB, yB, zB);
      return result;
    }
    return new Point3dPoint3d(Point3d.create(xA, yA, zA), Point3d.create(xB, yB, zB));
  }
}
