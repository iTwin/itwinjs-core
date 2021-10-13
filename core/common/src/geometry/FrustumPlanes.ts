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

/** Represents a frustum as 6 planes and provides containment and intersection testing
 * @internal
 */
export class FrustumPlanes {
  private _planes?: ClipPlane[];

  public constructor(frustum?: Frustum) {
    if (undefined !== frustum) {
      this.init(frustum);
    }
  }

  public get isValid(): boolean { return undefined !== this._planes; }

  // Order: right, left, top, bottom, back, front
  public get planes() { return this._planes; }

  public init(frustum: Frustum) {
    if (undefined === this._planes) {
      this._planes = [];
    } else {
      this._planes.length = 0;
    }

    FrustumPlanes.addPlaneFromPoints(this._planes, frustum.points, 1, 3, 5);  // right
    FrustumPlanes.addPlaneFromPoints(this._planes, frustum.points, 0, 4, 2);  // left
    FrustumPlanes.addPlaneFromPoints(this._planes, frustum.points, 2, 6, 3);  // top
    FrustumPlanes.addPlaneFromPoints(this._planes, frustum.points, 0, 1, 4);  // bottom
    FrustumPlanes.addPlaneFromPoints(this._planes, frustum.points, 0, 2, 1);  // back
    FrustumPlanes.addPlaneFromPoints(this._planes, frustum.points, 4, 5, 6);  // front
  }

  public computeFrustumContainment(box: Frustum, sphere?: BoundingSphere): FrustumPlanes.Containment { return this.computeContainment(box.points, sphere); }
  public intersectsFrustum(box: Frustum): boolean { return FrustumPlanes.Containment.Outside !== this.computeFrustumContainment(box); }
  public containsPoint(point: Point3d, tolerance: number = 1.0e-8): boolean { return FrustumPlanes.Containment.Outside !== this.computeContainment([point], undefined, tolerance); }

  public computeContainment(points: Point3d[], sphere?: BoundingSphere, tolerance: number = 1.0e-8): FrustumPlanes.Containment {
    assert(this.isValid);
    if (undefined === this._planes) {
      return FrustumPlanes.Containment.Outside;
    }

    let allInside = true;
    for (const plane of this._planes) {
      if (sphere) { // if sphere provide detect total inside and outside without using corners.
        const centerDistance = plane.altitude(sphere.center);
        const tolerancePlusRadius = tolerance + sphere.radius;
        if (centerDistance < -tolerancePlusRadius)
          return FrustumPlanes.Containment.Outside;
        if (centerDistance > tolerancePlusRadius)
          continue;
      }
      let nOutside = 0;
      for (const point of points) {
        if (plane.altitude(point) + tolerance < 0.0) {
          ++nOutside;
          allInside = false;
        }
      }

      if (nOutside === points.length) {
        return FrustumPlanes.Containment.Outside;
      }
    }

    return allInside ? FrustumPlanes.Containment.Inside : FrustumPlanes.Containment.Partial;
  }

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

/** @internal */
export namespace FrustumPlanes { // eslint-disable-line no-redeclare
  /** @internal */
  export enum Containment {
    Outside = 0,
    Partial = 1,
    Inside = 2,
  }

  /** @internal */
  export function addPlaneFromPoints(planes: ClipPlane[], points: Point3d[], i0: number, i1: number, i2: number, expandPlaneDistance: number = 1.0e-6): void {
    const normal = Vector3d.createCrossProductToPoints(points[i2], points[i1], points[i0]);
    normal.normalizeInPlace();
    const plane = ClipPlane.createNormalAndDistance(normal, normal.dotProduct(points[i0]) - expandPlaneDistance);
    if (undefined !== plane) {
      planes.push(plane);
    }
  }
}
