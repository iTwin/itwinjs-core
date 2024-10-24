/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Geometry
 */

import { ClipPlane, Point3d, Vector3d } from "@itwin/core-geometry";
import { Frustum } from "../Frustum";
import { BoundingSphere } from "./BoundingSphere";

/*
The following visualizes the contents of frustum.points, which is sent to computeFrustumPlanes().
The below numbers are the indices into that array.

   2----------3
  /|         /|
 / 0--------/-1
6----------7  /
| /        | /
|/         |/
4__________5

0 = left bottom rear
1 = right bottom rear
2 = left top right
3 = right top rear
4 = left bottom front
5 = right bottom front
6 = left top front
7 = right top front
*/

// Ordering of sub-arrays is: [origin, a, b]
const planePointIndices = [
  [1, 5, 3], // right
  [0, 2, 4], // left
  [2, 3, 6], // top
  [0, 4, 1], // bottom
  [0, 1, 2], // back
  // Skip front plane because it can be too small. Instead derive it from back plane.
  // Otherwise, it would be: [4, 6, 5]
];

function computeFrustumPlanes(frustum: Frustum): ClipPlane[] {
  const planes = [];
  const points = frustum.points;
  const expandPlaneDistance = 1e-6;

  let normal: Vector3d | undefined;
  for (const indices of planePointIndices) {
    const i0 = indices[0], i1 = indices[1], i2 = indices[2];
    normal = Vector3d.createCrossProductToPoints(points[i0], points[i1], points[i2]);
    normal.normalizeInPlace();

    const plane = ClipPlane.createNormalAndDistance(normal, normal.dotProduct(points[i0]) - expandPlaneDistance);
    if (!plane)
      return [];

    planes.push(plane);
  }

  // Derive front plane from back plane due to fact that front plane can become very tiny and cause precision issues, resulting in zero frustum planes. Deriving the front plane from the rear rect resolves this problem.
  // The back plane was the last plane processed above, so we can just consult the current value of `normal`.
  if (undefined !== normal) {
    normal.negate(normal); // negate the back plane
    // NB: Below, we make sure we calculate the distance based on a point on the front rect, not the rear rect!
    const plane = ClipPlane.createNormalAndDistance(normal, normal.dotProduct(points[4]) - expandPlaneDistance);
    if (!plane)
      return [];

    planes.push(plane);
  } else
    return [];

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
   * @note This method assumes that the front plane is parallel to the back plane.
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
   * @note This method assumes that the front plane is parallel to the back plane.
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
export namespace FrustumPlanes {
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
