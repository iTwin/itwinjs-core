/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { IModelApp, IModelConnection, SpatialTileTreeReferences, SpatialViewState } from "@itwin/core-frontend";
import { createBatchedSpatialTileTreeReferences } from "../../BatchedSpatialTileTreeRefs";
import { createRealityModelTilesetFromUrl } from "./RealityModelTileset";
import { getIModelTilesetUrlFromConnection, GetIModelTilesetUrlFromConnectionArgs } from "../url-providers/IModelUrlProvider";

/** A function that can provide the base URL where a tileset representing all of the spatial models in a given iModel are stored.
 * The tileset is expected to reside at "baseUrl/tileset.json" and to have been produced by the [mesh export service](https://developer.bentley.com/apis/mesh-export/).
 * If no such tileset exists for the given iModel, return `undefined`.
 * @see [[FrontendTilesOptions.computeSpatialTilesetBaseUrl]].
 * @alpha
 */
export type ComputeSpatialTilesetBaseUrl = (iModel: IModelConnection) => Promise<URL | undefined>;

/** Arguments supplied to [[CreateIModelTilesetAs3DTiles]]
 * @alpha
 */
export type CreateIModelTilesetAs3DTilesArgs = GetIModelTilesetUrlFromConnectionArgs;

/** Options supplied to [[createIModelTileset]].
 * @alpha
 */
export interface CreateIModelTilesetArgs {
  /** Provide the base URL for the pre-published tileset for a given iModel.
   * If omitted, [[obtainMeshExportTilesetUrl]] will be invoked with default arguments, using the access token provided by [[IModelApp]].
   */
  computeSpatialTilesetBaseUrl?: ComputeSpatialTilesetBaseUrl;
  /** The maximum number of levels in the tile tree to skip loading if they do not provide the desired level of detail for the current view.
   * Default: 4.
   * Reducing this value will load more intermediate tiles, which causes more gradual refinement: low-resolution tiles will display quickly, followed more gradually by
   * successively higher-resolution ones.
   * Increasing the value jumps more directly to tiles of the exact level of detail desired, which may load more, smaller tiles up-front, leaving some areas of the view
   * vacant for longer; and when zooming out some newly-exposed areas of the view may remain vacant for longer because no lower-resolution tiles are initially available to
   * fill them. However, tiles close to the viewer (and therefore likely of most interest to them) will refine to an appropriate level of detail more quickly.
   */
  maxLevelsToSkip?: number;
  /** Specifies whether to permit the user to enable visible edges or wireframe mode for batched tiles.
   * The currently-deployed mesh export service does not produce edges, so this currently defaults to `false` to avoid user confusion.
   * Set it to `true` if you are loading tiles created with a version of the exporter that does produce edges.
   * ###TODO delete this option once we deploy an edge-producing version of the exporter to production.
   * @internal
   */
  enableEdges?: boolean;
  /** Specifies whether to enable a CDN (content delivery network) to access tiles faster.
   * This option is only used if computeSpatialTilesetBaseUrl is not defined.
   * @alpha
   */
  enableCDN?: boolean;
  /** Specifies whether to enable an IndexedDB database for use as a local cache.
  * Requested tiles will then first be search for in the database, and if not found, fetched as normal.
  * @internal
  */
  useIndexedDBCache?: boolean;
}

/** Global configuration initialized by [[initializeFrontendTiles]].
 * @internal
 */
export const frontendTilesOptions = {
  maxLevelsToSkip: 4,
  enableEdges: false,
  useIndexedDBCache: false,
};

/**
 * Initializes the IModelTiles with the provided options.
 * @alpha
 */
export function createIModelTileset(options: CreateIModelTilesetArgs): void {
  if (undefined !== options.maxLevelsToSkip && options.maxLevelsToSkip >= 0)
    frontendTilesOptions.maxLevelsToSkip = options.maxLevelsToSkip;

  if (options.enableEdges)
    frontendTilesOptions.enableEdges = true;

  if (options.useIndexedDBCache)
    frontendTilesOptions.useIndexedDBCache = true;

  const computeUrl = options.computeSpatialTilesetBaseUrl ?? (
    async (iModel: IModelConnection) => getIModelTilesetUrlFromConnection({ iModel, accessToken: await IModelApp.getAccessToken(), options: { enableCDN: options.enableCDN, cesium3DTiles: false } })
  );

  SpatialTileTreeReferences.create = (view: SpatialViewState) => createBatchedSpatialTileTreeReferences(view, computeUrl);
}

/** Initializes the IModelTiles using 3D Tiles format, with the provided options.
 * @alpha
 */
export async function createIModelTilesetAs3DTiles(args: CreateIModelTilesetAs3DTilesArgs): Promise<void> {
  try {
    const url = await getIModelTilesetUrlFromConnection(args);
    if (url) {
      await createRealityModelTilesetFromUrl(url.toString());
    } else {
      throw new Error("Failed to obtain tileset URL");
    }
  } catch (error) {
    throw error;
  }
}
