/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Geometry
 */

import {
  Geometry, Point3d, Transform, Vector3d, XYAndZ,
} from "@itwin/core-geometry";

const scratchDistanceSquared = new Point3d();
const scratchDir = new Vector3d();

/** Describes a spherical volume of space as an approximation of the shape of some more complex geometric entity fully contained within that volume.
 * When performing tests for intersection or containment, the approximation can be used as a first, quick check.
 * @see [[FrustumPlanes.computeContainment]], for example.
 * @public
 */
export class BoundingSphere {
  /** The point at the center of the sphere. */
  public center: Point3d;
  /** The radius of the sphere. */
  public radius: number;

  /** Create a new bounding sphere with the specified center and radius. */
  constructor(center: Point3d = Point3d.createZero(), radius = 0) {
    this.center = center;
    this.radius = Math.max(0, radius);
  }

  /** Change the center and radius of the sphere. */
  public init(center: Point3d, radius: number): void {
    this.center = center;
    this.radius = radius;
  }

  /** Applies the specified transformation matrix to produce a new bounding sphere.
   * @param transform The transformation matrix to apply.
   * @param result An optional preallocated object to hold the result, to avoid allocating a new object. May be the same object as `this`.
   * @returns A bounding sphere equivalent to `this` with the specified transform applied.
   */
  public transformBy(transform: Transform, result?: BoundingSphere): BoundingSphere {
    result = result ?? new BoundingSphere();
    transform.multiplyPoint3d(this.center, result.center);
    result.radius = this.radius * Math.max(transform.matrix.columnXMagnitude(), Math.max(transform.matrix.columnYMagnitude(), (transform.matrix.columnZMagnitude())));
    return result;
  }

  /** Apply the specified transform to this bounding sphere. */
  public transformInPlace(transform: Transform): void {
    this.transformBy(transform, this);
  }

  /** Computes the distance from the given point to the closest point on the surface of the bounding sphere, or zero if the point is on or inside the sphere.
   */
  public distanceToPoint(point: XYAndZ): number {
    const diff = this.center.minus(point, scratchDistanceSquared);
    const dist = diff.magnitude() - this.radius;
    return dist <= 0 ? 0 : dist;
  }

  public distanceSquaredToPoint(point: XYAndZ): number {
    const distance = this.distanceToPoint(point);
    return distance * distance;
  }

  public closestPointOnSurface(point: XYAndZ, result?: Point3d): Point3d | undefined {
    const dir = Vector3d.createStartEnd(this.center, point, scratchDir);
    if (dir.magnitudeSquared() < this.radius * this.radius)
      return undefined;

    dir.normalizeInPlace();
    dir.scaleInPlace(this.radius);
    dir.plus(this.center, dir);
    return Point3d.create(dir.x, dir.y, dir.z, result);
  }

  public isAlmostEqual(other: BoundingSphere): boolean {
    return this.center.isAlmostEqual(other.center) && Geometry.isSameCoordinate(this.radius, other.radius);
  }
}
