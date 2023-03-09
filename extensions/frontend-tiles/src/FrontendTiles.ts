/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { IModelConnection, SpatialTileTreeReferences, SpatialViewState } from "@itwin/core-frontend";
import { createBatchedSpatialTileTreeReferences } from "./BatchedSpatialTileTreeRefs";

/** Options supplied to [[initializeFrontendTiles]].
 * @alpha
 */
export interface FrontendTilesOptions {
  /** Given an iModel, provide the base URL where the tiles are stored representing all of the spatial models in the iModel.
   * It is expected that baseUrl/tileset.json exists and contains a 3d tileset in which all relative URLs are relative to baseUrl.
   */
  computeSpatialTilesetBaseUrl: (iModel: IModelConnection) => URL;
}

/** Initialize the frontend-tiles package to obtain tiles for spatial views.
 * @alpha
 */
export function initializeFrontendTiles(options: FrontendTilesOptions): void {
  SpatialTileTreeReferences.create = (view: SpatialViewState) => createBatchedSpatialTileTreeReferences(view.iModel, options.computeSpatialTilesetBaseUrl);
}
