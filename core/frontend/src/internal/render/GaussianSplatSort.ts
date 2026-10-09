/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** A visible occurrence of a tile. A tile can occur more than once with different transforms.
 * @internal
 */
export interface GaussianSplatSortTile {
  id: number;
  pages: number[];
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

/** Number of splats in one shared GPU page. @internal */
export const gaussianSplatsPerPage = 16384;
