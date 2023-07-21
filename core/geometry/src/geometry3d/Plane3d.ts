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

/**
 * Plane3d is the abstract base class for multiple 3d plane representations:
 * * [[Plane3dByOriginAndUnitNormal]] -- plane defined by origin and normal, with no preferred in-plane directions
 * * [[Plane3dByOriginAndVectors]] -- plane defined by origin and 2 vectors in the plane, with normal implied by the vectors' cross product
 * * [[Point4d]] -- homogeneous form of xyzw plane.
 * * [[ClipPlane]] -- implicit plane with additional markup as used by compound clip structures such as [[ConvexClipPlaneSet]] and [[UnionOfConvexClipPlaneSets]]
 *
 * As an abstract base class, Plane3d demands that its derived classes implement queries to answer questions
 * about the plane's normal and the altitude of points above or below the plane.  (Altitude is measured perpendicular to the plane.)
 * These abstract methods are:
 * * altitude(Point3d), altitudeXYZ(x,y,z), and altitudeXYZW(Point4d) -- evaluate altitude
 * * normalX(), normalY(), normalZ() -- return components of the plane's normal vector.
 * * velocity(Vector3d), velocityXYZ(x,y,z) -- return dot product of the input vector with the plane normal.
 * * projectPointToPlane (spacePoint: Point3d) -- return projection of spacePoint into the plane.
 *
 * The Plane3d base class also provides implementations of several queries which it can implement by calling the abstract queries.
 * * Derived classes may choose to override these default implementations using private knowledge of what they have stored.
 * * isPointInPlane(spacePoint, tolerance?) -- test if spacePoint is in the plane with tolerance.  Default tolerance is small metric distance
 * * classifyAltitude (spacePoint, tolerance?), classifyAltitudeXYZ (x,y,z,tolerance?) -- return -1,0,1 indicating if spacePoint's altitude
 *     is negative, near zero, or positive.
 *
 * Notes about scaling and signs in methods that compute altitudes, normal components and velocities:
 * * The term "altitude" indicates a _signed_ distance from the plane.
 *   * altitude zero is _on_ the plane
 *   * positive altitudes are on one side
 *   * negatives are on the other.
 *  * Altitude values and normal components are not strictly required to be true cartesian distance.   If the calling code happens to use "distance scaled by 1000X" it
 *     understands that it can be OK for its plane implementation to have that scaling.
 *  * By convention, derived classes whose definitions (normals and vectors in plane) are simple cartesian are expected
 *    to return true distances.  This applies to:
 *    * [[Plane3dByOriginAndUnitNormal]] and [[ClipPlane]]
 *       * These maintain a stored unit normal so the altitude calculations are inherently true cartesian distance.
 *    * [[Plane3dByOriginAndVectors]] -- this is a bit expensive because
 *       * the normal is the cross product of the defining vectors.
 *       * that cross product is not typically unit
 *       * normalization adds to the cost of computing off-plane distances
 *       * Since a main purpose of using this class is often to navigate a skewed, non-unit grid, occasional off-plane queries are not likely to be important.
 *  * "4 dimensional" (homogeneous coordinate planes) ([[Point4d]] and [[PlaneByOriginAndVectors4d]])
 *     * typically do _not_ force their coefficients to any distance-based normalization
 *     * are typically used for calculations in spaces with skewing effects do to perspective, and true distances are not required.
 *  * In all classes, the `weightedAltitude` method is free to be scaled distance.
 * @public
 */
export abstract class Plane3d implements PlaneAltitudeEvaluator {
  /**
   * Return the altitude of spacePoint above or below the plane. (Below is negative)
   * * MUST BE IMPLEMENTED BY DERIVED CLASSES
   */
  public abstract altitude(spacePoint: Point3d): number;
  /** Returns true if spacePoint is within distance tolerance of the plane. */
  public isPointInPlane(spacePoint: Point3d, tolerance: number = Geometry.smallMetricDistance): boolean {
    return Math.abs(this.altitude(spacePoint)) <= tolerance;
  }
  /**
   * Return a value -1, 0, 1 giving a signed indicator of whether the toleranced altitude of the point is
   * negative, near zero, or positive.
   *
   */
  public classifyAltitude(point: Point3d, tolerance: number = Geometry.smallMetricDistance): -1 | 0 | 1 {
    return Geometry.split3Way01(this.altitude(point), tolerance);
  }
  /**
   * Return a value -1, 0, 1 giving a signed indicator of whether the toleranced altitude of x,y,z is
   * negative, near zero, or positive.
   *
   */
  public classifyAltitudeXYZ(
    x: number, y: number, z: number, tolerance: number = Geometry.smallMetricDistance,
  ): -1 | 0 | 1 {
    return Geometry.split3Way01(this.altitudeXYZ(x, y, z), tolerance);
  }
  /**
   * Return the x component of the normal used to evaluate altitude.
   * * MUST BE IMPLEMENTED BY DERIVED CLASSES
   * * See [[Plane3d]] note about scaling.
   */
  public abstract normalX(): number;
  /**
   * Return the y component of the normal used to evaluate altitude.
   * * MUST BE IMPLEMENTED BY DERIVED CLASSES
   * * See [[Plane3d]] note about scaling.
   */
  public abstract normalY(): number;
  /**
   * Return the z component of the normal used to evaluate altitude.
   * * MUST BE IMPLEMENTED BY DERIVED CLASSES
   * * See [[Plane3d]] note about scaling.
   */
  public abstract normalZ(): number;
  /**
   * Return the unit normal for the plane.
   * * The abstract base class implementation assembles the normal from normalX, normalY, normalZ calls.
   * * Derived classes should (but are not required to) override for maximum efficiency if the separate normal calls
   * cause repeated normalization.
   * @param result
   */
  public getUnitNormal(result?: Vector3d): Vector3d | undefined {
    return Vector3d.createNormalized(this.normalX(), this.normalY(), this.normalZ(), result);
  }
  /**
   * Return any point on the plane.
   * * Default implementation projects the origin (0,0,0) to the plane.
   * * Classes that have a preferred origin for their plane should override.
   * * Classes with a purely implicit equation of their plane can accept the default implementation
   */
  public getAnyPointOnPlane(result?: Point3d): Point3d {
    return this.projectPointToPlane(Point3d.create(0, 0, 0), result);
  }
  /**
   * Return the altitude of weighted spacePoint above or below the plane.  (Below is negative)
   * * MUST BE IMPLEMENTED BY DERIVED CLASSES
   * * See [[Plane3d]] note about scaling.
   */
  public abstract weightedAltitude(spacePoint: Point4d): number;
  /**
   * Return the dot product of spaceVector (x,y,z) with the plane's unit normal. This tells the rate of change of
   * altitude for a point moving at speed one along the spaceVector.
   * * MUST BE IMPLEMENTED BY DERIVED CLASSES
   * * See [[Plane3d]] note about scaling.
   */
  public abstract velocityXYZ(x: number, y: number, z: number): number;
  /**
   * Return the dot product of spaceVector with the plane's unit normal.  This tells the rate of change of altitude
   * for a point moving at speed one along the spaceVector.
   * * MUST BE IMPLEMENTED BY DERIVED CLASSES
   * * See [[Plane3d]] note about scaling.
   */
  public abstract velocity(spaceVector: Vector3d): number;
  /**
   * Return the altitude of a point given as separate x,y,z components.
   * * MUST BE IMPLEMENTED BY DERIVED CLASSES
   * * See [[Plane3d]] note about scaling.
   */
  public abstract altitudeXYZ(x: number, y: number, z: number): number;
  /**
   * Return the projection of spacePoint onto the plane.
   * * MUST BE IMPLEMENTED BY DERIVED CLASSES
   */
  public abstract projectPointToPlane(spacePoint: Point3d, result?: Point3d): Point3d;
}
