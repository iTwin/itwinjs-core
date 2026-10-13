/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Geometry } from "@itwin/core-geometry";

/** A visible occurrence of a tile. A tile can occur more than once with different transforms.
 * @internal
 */
export interface GaussianSplatSortTile {
  /** The geometry whose registered sort positions the occurrence uses. */
  id: number;
  /** First logical page of this occurrence. Its splat `i` sorts as logical slot `firstPage * gaussianSplatsPerPage + i`;
   * the renderer's page table maps each logical page to an atlas row and a visible tile row.
   */
  firstPage: number;
  count: number;
  sortingMethod?: "cameraDistance" | "viewDepth";
  /** Row-major affine transform from relative means to eye coordinates, computed in double precision. */
  transform: number[];
}

/** @internal */
export interface GaussianSplatSortRequest {
  tiles: GaussianSplatSortTile[];
  perspective: boolean;
}

/** The camera a sort order was computed for, in world coordinates. @internal */
export interface GaussianSplatSortCamera {
  /** True for a perspective view, whose camera-distance keys depend on the eye position. */
  perspective: boolean;
  eye: { x: number, y: number, z: number };
  /** Unit view direction. */
  direction: { x: number, y: number, z: number };
  /** Distance from the eye to the nearest splat drawn, in world units (at least the near plane's distance). */
  nearestSplatDistance: number;
}

/** View rotation within which a view-depth order is kept: rotating by an angle a changes the depth difference of two splats
 * by at most a times their separation. A camera-distance order is kept while the eye moves less than the distance that turns
 * the direction to the nearest splat by the same angle.
 */
const gaussianSplatResortAngle = 0.25 * Math.PI / 180;
const resortCosine = Math.cos(gaussianSplatResortAngle);
const resortDistanceRatio = Math.tan(gaussianSplatResortAngle);

/** Whether an order sorted for `sorted` is still valid for `current`, for the same visible occurrences. Only what the
 * sort keys depend on is compared: camera distance (perspective, `KHR_gaussian_splatting` content) depends on the eye position alone, and
 * view depth (orthographic views and Cesium ion's draft content) on the view direction alone, since translating the eye
 * shifts every depth equally. Eye movement is judged relative to the nearest splat, where it turns viewing directions most:
 * splats that overlap on screen can swap only when their distances differ by a small fraction of that movement.
 * @internal
 */
export function isGaussianSplatSortCurrent(sorted: GaussianSplatSortCamera, current: GaussianSplatSortCamera, methods: { cameraDistance: boolean, viewDepth: boolean }): boolean {
  if (sorted.perspective !== current.perspective)
    return false;

  const usesEye = current.perspective && methods.cameraDistance;
  if (usesEye) {
    const eyeMovement = Geometry.hypotenuseXYZ(current.eye.x - sorted.eye.x, current.eye.y - sorted.eye.y, current.eye.z - sorted.eye.z);
    const nearestSplatDistance = Math.min(sorted.nearestSplatDistance, current.nearestSplatDistance);
    if (eyeMovement >= resortDistanceRatio * nearestSplatDistance)
      return false;
  }

  const usesDirection = !current.perspective || methods.viewDepth;
  if (!usesDirection)
    return true;

  const { direction: sortedDirection } = sorted;
  const { direction: currentDirection } = current;
  const rotationCosine = Geometry.dotProductXYZXYZ(sortedDirection.x, sortedDirection.y, sortedDirection.z, currentDirection.x, currentDirection.y, currentDirection.z);
  return rotationCosine > resortCosine;
}

/** Number of splats in one shared GPU page: one 256-texel row of the atlas, the unit of tile allocation. @internal */
export const gaussianSplatsPerPage = 128;
