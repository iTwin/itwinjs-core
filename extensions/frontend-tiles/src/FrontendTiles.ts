/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { AccessToken, Logger } from "@itwin/core-bentley";
import { IModelApp, IModelConnection, SpatialTileTreeReferences, SpatialViewState } from "@itwin/core-frontend";
import { loggerCategory } from "./LoggerCategory";
import { createBatchedSpatialTileTreeReferences } from "./BatchedSpatialTileTreeRefs";

/** A function that can provide the base URL where a tileset representing all of the spatial models in a given iModel are stored.
 * The tileset is expected to reside at "baseUrl/tileset.json" and to have been produced by the [mesh export service](https://developer.bentley.com/apis/mesh-export/).
 * If no such tileset exists for the given iModel, return `undefined`.
 * @see [[FrontendTilesOptions.computeSpatialTilesetBaseUrl]].
 * @beta
 */
export type ComputeSpatialTilesetBaseUrl = (iModel: IModelConnection) => Promise<URL | undefined>;

/** @internal exported for tests. */
export function createMeshExportServiceQueryUrl(args: ObtainTilesetUrlFromMeshExportServiceArgs): string {
  const prefix = args.urlPrefix ?? "";
  let url = `https://${prefix}api.bentley.com/mesh-export/?iModelId=${args.iModel.iModelId}`;
  if (!args.noSort)
    url = `${url}&$orderBy=date:desc`;

  return url;
}

/** Represents the result of a [mesh export](https://developer.bentley.com/apis/mesh-export/operations/get-export/#export).
 * @see [[queryCompletedMeshExports]].
 * @beta
 */
export interface MeshExport {
  id: string;
  displayName: string;
  status: string;
  request: {
    iModelId: string;
    changesetId: string;
    exportType: string;
    geometryOptions: any;
    viewDefinitionFilter: any;
  },
  _links: {
    mesh: {
      href: string,
    },
  },
}

/** Arguments supplied to [[queryCompletedMeshExports]].
 * @beta
 */
export interface QueryCompletedMeshExportsArgs {
  /** The iModel whose exports to query. */
  iModel: IModelConnection;
  /** Token used to access the mesh export service.
   * If omitted, [IModelApp.getAccessToken]($frontend) is used.
   */
  accessToken?: AccessToken;
  /** Disables sorting the results from most to least recent. */
  noSort?: boolean;
  /** Optional URL prefix, chiefly useful in testing environments. */
  urlPrefix?: string;
}

/** Queries the [mesh export service](https://developer.bentley.com/apis/mesh-export/operations/get-exports/) for completed exports associated with
 * a specific iModel.
 * @beta
 */
export async function queryCompletedMeshExports(args: QueryCompletedMeshExportsArgs): Promise<MeshExport[]> {
  let foundExports: MeshExport[] = [];

  const url = new URL(createMeshExportServiceQueryUrl(args));
  const headers = {
    Authorization: args.accessToken ?? await IModelApp.getAccessToken(),
    Accept: "application/vnd.bentley.itwin-platform.v1+json",
    Prefer: "return=representation",
  };

  try {
    const response = await fetch(url, { headers });
    const result = await response.json() as { exports: MeshExport[] };
    foundExports = result.exports.filter((x) => x.request.exportType === "IMODEL" && x.status === "Complete");
  } catch (error) {
    Logger.logException(loggerCategory, error);
    Logger.logError(loggerCategory, `Failed loading exports for iModel ${args.iModel.iModelId}`);
  }

  return foundExports;
}

/** Arguments supplied  to [[obtainTilesetUrlFromMeshExportService]].
 * @beta
 */
export type ObtainTilesetUrlFromMeshExportServiceArgs = QueryCompletedMeshExportsArgs;

/** Obtains a URL pointing to a tileset appropriate for visualizing a specific iModel.
 * [[queryCompletedMeshExports]] is used to obtain a list of available exports. By default, the list is sorted from most to least recently-exported.
 * The first export matching the iModel's changeset is selected; or, if no such export exists, the first export in the list is selected.
 * @returns A URL from which the tileset can be loaded, or `undefined` if no appropriate URL could be obtained.
 * @beta
 */
export async function obtainTilesetUrlFromMeshExportService(args: ObtainTilesetUrlFromMeshExportServiceArgs): Promise<URL | undefined> {
  const foundExports = await queryCompletedMeshExports(args);
  if (!foundExports.length) {
    Logger.logInfo(loggerCategory, `No exports available for iModel ${args.iModel.iModelId}`);
    return undefined;
  }

  let selectedExport = foundExports.find((x) => x.request.changesetId === args.iModel.changeset.id);
  if (!selectedExport) {
    Logger.logInfo(loggerCategory, `No exports for iModel ${args.iModel.iModelId} for changeset ${args.iModel.changeset.id}; falling back to most recent`);
    selectedExport = foundExports[0];
  }

  const url = new URL(selectedExport._links.mesh.href);
  url.pathname = url.pathname + "/tileset.json";
  return url;
}

/** Options supplied to [[initializeFrontendTiles]].
 * @beta
 */
export interface FrontendTilesOptions {
  /** Provide the base URL for the pre-published tileset for a given iModel.
   * If omitted, [[queryCompletedMeshExports]] will be invoked with default arguments.
   */
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
 * @beta
 */
export function initializeFrontendTiles(options: FrontendTilesOptions): void {
  if (undefined !== options.maxLevelsToSkip && options.maxLevelsToSkip >= 0)
    maxLevelsToSkip = options.maxLevelsToSkip;

  SpatialTileTreeReferences.create = (view: SpatialViewState) => createBatchedSpatialTileTreeReferences(view, options.computeSpatialTilesetBaseUrl);
}
