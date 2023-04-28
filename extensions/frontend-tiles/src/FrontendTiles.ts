/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { IModelConnection, SpatialTileTreeReferences, SpatialViewState } from "@itwin/core-frontend";
import { createBatchedSpatialTileTreeReferences } from "./BatchedSpatialTileTreeRefs";

/** A function that can provide the base URL where a tileset representing all of the spatial models in a given iModel are stored.
 * The tileset is expected to reside at "baseUrl/tileset.json" and to have been produced by the [mesh export service](https://developer.bentley.com/apis/mesh-export/).
 * If no such tileset exists for the given iModel, return `undefined`.
 * @see [[FrontendTilesOptions.computeSpatialTilesetBaseUrl]].
 * @alpha
 */
export type ComputeSpatialTilesetBaseUrl = (iModel: IModelConnection) => Promise<URL | undefined>;

/** Options supplied to [[initializeFrontendTiles]].
 * @alpha
 */
export interface FrontendTilesOptions {
  /** Provide the base URL for the pre-published tileset for a given iModel. */
  computeSpatialTilesetBaseUrl: ComputeSpatialTilesetBaseUrl;
  /** The maximum number of levels in the tile tree to skip loading if they do not provide the desired level of detail for the current view.
   * Default: 4.
   * Reducing this value will load more intermediate tiles, which causes more gradual refinement: low-resolution tiles will display quickly, followed more gradually by
   * successively higher-resolution ones.
   * Increasing the value jumps more directly to tiles of the exact level of detail desired, which may load more, smaller tiles up-front, leaving some areas of the view
   * vacant for longer; and when zooming out some newly-exposed areas of the view may remain vacant for longer because no lower-resolution tiles are initially available to
   * fill them. However, tiles close to the viewer (and therefore likely of most interest to them) will refine to an appropriate level of detail more quickly.
   */
  maxLevelsToSkip?: number;
}

/** @internal */
export const createFallbackSpatialTileTreeReferences = SpatialTileTreeReferences.create;

let maxLevelsToSkip = 4;

/** @internal */
export function getMaxLevelsToSkip(): number {
  return maxLevelsToSkip;
}

/** Initialize the frontend-tiles package to obtain tiles for spatial views.
 * @alpha
 */
export function initializeFrontendTiles(options: FrontendTilesOptions): void {
  if (undefined !== options.maxLevelsToSkip && options.maxLevelsToSkip >= 0) maxLevelsToSkip = options.maxLevelsToSkip;

  SpatialTileTreeReferences.create = (view: SpatialViewState) =>
    createBatchedSpatialTileTreeReferences(view, options.computeSpatialTilesetBaseUrl);
}
