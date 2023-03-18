/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module CartesianGeometry
 */
import { Geometry, PlaneAltitudeEvaluator } from "../Geometry";
import { Point4d } from "../geometry4d/Point4d";
import { Point3d, Vector3d } from "./Point3dVector3d";

export abstract class AbstractPlane3d implements PlaneAltitudeEvaluator {
  /** Return the altitude of spacePoint above or below the plane.  (Below is negative) */
  public abstract altitude(spacePoint: Point3d): number;

  /** Returns true of spacePoint is within distance tolerance of the plane. */
  public isPointInPlane(spacePoint: Point3d): boolean { return Geometry.isSmallMetricDistance(this.altitude(spacePoint)); }
  /** return a value -1, 0, 1 giving a signed indicator of whether the toleranced altitude pf the point is
   *    negative, near zero, or positive.
   *
  */
  public classifyAltitude(point: Point3d, tolerance: number = Geometry.smallMetricDistance): -1 | 0 | 1 {
    return Geometry.split3Way01(this.altitude(point), tolerance);
  }
  /** return a value -1, 0, 1 giving a signed indicator of whether the toleranced altitude of x,y,z is
   *    negative, near zero, or positive.
   *
  */
  public classifyAltitudeXYZ(x: number, y: number, z: number, tolerance: number = Geometry.smallMetricDistance): -1 | 0 | 1 {
    return Geometry.split3Way01(this.altitudeXYZ(x, y, z), tolerance);
  }
  /**
    * Return the x component of the normal used to evaluate altitude.
    */
  public abstract normalX(): number;
  /**
   * Return the x component of the normal used to evaluate altitude.
   */
  public abstract normalY(): number;
  /**
   * Return the z component of the normal used to evaluate altitude.
   */
  public abstract normalZ(): number;

  /** Return the altitude of weighted spacePoint above or below the plane.  (Below is negative) */
  public abstract weightedAltitude(spacePoint: Point4d): number;

  /** Return the dot product of spaceVector with the plane's unit normal.  This tells the rate of change of altitude
   * for a point moving at speed one along the spaceVector.
   */
  public abstract velocityXYZ(x: number, y: number, z: number): number;
  /** Return the dot product of spaceVector with the plane's unit normal.  This tells the rate of change of altitude
   * for a point moving at speed one along the spaceVector.
   */
  public abstract velocity(spaceVector: Vector3d): number;
  /** Return the altitude of a point given as separate x,y,z components. */
  public abstract altitudeXYZ(x: number, y: number, z: number): number;

  /** Return the projection of spacePoint onto the plane. */
  public abstract projectPointToPlane(spacePoint: Point3d, result?: Point3d): Point3d;
}
