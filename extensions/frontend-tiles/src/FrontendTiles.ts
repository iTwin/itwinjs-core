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
}

/** @internal */
export const createFallbackSpatialTileTreeReferences = SpatialTileTreeReferences.create;

/** Initialize the frontend-tiles package to obtain tiles for spatial views.
 * @alpha
 */
export function initializeFrontendTiles(options: FrontendTilesOptions): void {
  SpatialTileTreeReferences.create = (view: SpatialViewState) => createBatchedSpatialTileTreeReferences(view, options.computeSpatialTilesetBaseUrl);
}
