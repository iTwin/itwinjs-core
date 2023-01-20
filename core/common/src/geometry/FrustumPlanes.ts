/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Geometry
 */

import { assert } from "@itwin/core-bentley";
import { ClipPlane, Point3d, Vector3d } from "@itwin/core-geometry";
import { Frustum } from "../Frustum";
import { BoundingSphere } from "./BoundingSphere";

const planePointIndices = [
  [1, 3, 5],  // right
  [0, 4, 2],  // left
  [2, 6, 3],  // top
  [0, 1, 4],  // bottom
  [0, 2, 1],  // back
  [4, 5, 6],  // front
];

function computeFrustumPlanes(frustum: Frustum): ClipPlane[] {
  const planes = [];
  const points = frustum.points;
  const expandPlaneDistance = 1e-6;

  for (const indices of planePointIndices) {
    const i0 = indices[0], i1 = indices[1], i2 = indices[2];
    const normal = Vector3d.createCrossProductToPoints(points[i2], points[i1], points[i0]);
    normal.normalizeInPlace();

    const plane = ClipPlane.createNormalAndDistance(normal, normal.dotProduct(points[i0]) - expandPlaneDistance);
    if (!plane)
      return [];

    planes.push(plane);
  }

  assert(planes.length === 6);
  return planes;
}

// Scratch variable used by FrustumPlanes.computeContainment.
const planesContainingSphere = [false, false, false, false, false, false];

/** Represents a the planes of a [[Frustum]] for testing containment and intersection.
 * A valid frustum produces six planes. A degenerate frustum produces zero planes.
 * @public
 * @extensions
 */
export class FrustumPlanes {
  private _planes: ClipPlane[];

  private constructor(planes: ClipPlane[]) {
    this._planes = planes;
  }

  /** Compute the six planes of the specified frustum.
   * If the frustum is degenerate - that is, its points do not represent a truncated pyramid - then the returned `FrustumPlanes` will contain zero planes.
   * @see [[isValid]] to test this condition.
   */
  public static fromFrustum(frustum: Frustum): FrustumPlanes {
    const planes = computeFrustumPlanes(frustum);
    return new FrustumPlanes(planes);
  }

  /** Create an empty set of frustum planes. [[isValid]] will be `true`. This can be useful when you want to create a `FrustumPlanes` object and initialize it later via [[init]] -
   * for example, if you intend to use the same object repeatedly with different [[Frustum]]s.
   */
  public static createEmpty(): FrustumPlanes {
    return new FrustumPlanes([]);
  }

  /** Returns true if [[planes]] consists of six planes. This may return `false` if a degenerate [[Frustum]] was supplied to [[fromFrustum]], or if this object was created
   * via [[createEmpty]] - in either case, [[planes]] will be an empty array.
   */
  public get isValid(): boolean {
    return this._planes.length === 6;
  }

  /** Obtain the list of planes defining the frustum. If [[isValid]] is `true`, it will have a length of six, with the planes ordered as
   * right, left, top, bottom, back, front. Otherwise, it will be empty.
   */
  public get planes(): ClipPlane[] {
    return this._planes;
  }

  /** Recompute the planes from the specified frustum.
   * @returns true upon success, or false if the input frustum was degenerate, in which case [[isValid]] will be `false`.
   */
  public init(frustum: Frustum): boolean {
    this._planes = computeFrustumPlanes(frustum);
    return this.isValid;
  }

  /** Compute to what degree a [[Frustum]] is contained with these frustum planes.
   * @param box The frustum to test for containment.
   * @param sphere An optional spherical bounding volume fully containing `box`. If supplied, this can reduce the amount of computation required.
   * @returns the degree to which `box` is contained within the clipping planes.
   */
  public computeFrustumContainment(box: Frustum, sphere?: BoundingSphere): FrustumPlanes.Containment {
    return this.computeContainment(box.points, sphere);
  }

  /** Determines whether a [[Frustum]] intersects with or is fully contained within these frustum planes.
   * @param box The frustum to test for containment.
   * @param sphere An optional spherical bounding volume fully containing `box`. If supplied, this can reduce the amount of computation required.
   * @returns true if `box` is not entirely outside of the clipping planes.
   */
  public intersectsFrustum(box: Frustum, sphere?: BoundingSphere): boolean {
    return FrustumPlanes.Containment.Outside !== this.computeFrustumContainment(box, sphere);
  }

  /** Determines whether a point is contained within these frustum planes.
   * @param point The point to test for containment.
   * @param tolerance The maximum distance from the interior of the frustum planes that will still be considered "contained".
   * @returns true if `point` is no further than `tolerance` meters outside of the clipping planes.
   */
  public containsPoint(point: Point3d, tolerance: number = 1.0e-8): boolean {
    return FrustumPlanes.Containment.Outside !== this.computeContainment([point], undefined, tolerance);
  }

  /** Compute the degree to which a set of points is contained within these frustum planes.
   * @param points The points to test for containment.
   * @param sphere An optional spherical bounding volume fully containing all of the points. If supplied, this can reduce the amount of computation required.
   * @param tolerance The maximum distance from the interior of the frustum planes a point must be to be considered "contained".
   * @returns the degree to which all of the points are contained within the clipping planes.
   */
  public computeContainment(points: Point3d[], sphere?: BoundingSphere, tolerance: number = 1.0e-8): FrustumPlanes.Containment {
    assert(this.isValid);
    if (undefined === this._planes)
      return FrustumPlanes.Containment.Outside;

    // Do the cheap test against bounding sphere first.
    if (sphere) {
      for (let i = 0; i < this._planes.length; i++) {
        const plane = this._planes[i];
        const centerDistance = plane.altitude(sphere.center);
        const tolerancePlusRadius = tolerance + sphere.radius;
        if (centerDistance < -tolerancePlusRadius)
          return FrustumPlanes.Containment.Outside;

        planesContainingSphere[i] = centerDistance > tolerancePlusRadius;
      }
    }

    // Test against points.
    let allInside = true;
    for (let i = 0; i < this._planes.length; i++) {
      if (sphere && planesContainingSphere[i])
        continue;

      const plane = this._planes[i];
      let nOutside = 0;
      for (const point of points) {
        if (plane.altitude(point) + tolerance < 0) {
          ++nOutside;
          allInside = false;
        }
      }

      if (nOutside === points.length)
        return FrustumPlanes.Containment.Outside;
    }

    return allInside ? FrustumPlanes.Containment.Inside : FrustumPlanes.Containment.Partial;
  }

  /** Computes whether a ray intersects these clipping planes.
   * @param origin The origin of the ray.
   * @param direction The direction of the ray.
   * @returns true if the ray extending from `origin` in the specified `direction` intersects at least one of the clipping planes.
   */
  public intersectsRay(origin: Point3d, direction: Vector3d): boolean {
    assert(this.isValid);
    if (undefined === this._planes) {
      return false;
    }

    let tFar = 1e37;
    let tNear = -tFar;

    for (const plane of this._planes) {
      const vD = plane.velocity(direction);
      const vN = plane.altitude(origin);
      if (0.0 === vD) {
        // ray is parallel... no need to continue testing if outside halfspace.
        if (vN < 0.0) {
          return false;
        }
      } else {
        const rayDistance = -vN / vD;
        if (vD < 0.0) {
          tFar = Math.min(rayDistance, tFar);
        } else {
          tNear = Math.max(rayDistance, tNear);
        }
      }
    }

    return tNear <= tFar;
  }
}

/** @public @extensions */
export namespace FrustumPlanes { // eslint-disable-line no-redeclare
  /** Describes the degree to which an object is contained within the planes of a [[Frustum]].
   * @see [[FrustumPlanes.computeContainment]], for example.
   */
  export enum Containment {
    /** The object is entirely outside of the frustum, intersecting none of its planes. */
    Outside = 0,
    /** The object intersects at least one of the frustum planes. placing it partially inside of the frustum. */
    Partial = 1,
    /** The object is entirely inside of the frustum, intersecting none of its planes. */
    Inside = 2,
  }
}
