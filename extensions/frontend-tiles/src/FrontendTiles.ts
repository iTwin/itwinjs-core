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

function createMeshExportServiceQueryUrl(args: { iModelId: string, urlPrefix?: string, changesetId?: string }): string {
  const prefix = args.urlPrefix ?? "";
  let url = `https://${prefix}api.bentley.com/mesh-export/?iModelId=${args.iModelId}&$orderBy=date:desc`;
  if (args.changesetId)
    url = `${url}&changesetId=${args.changesetId}`;

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
  };

  /* eslint-disable-next-line @typescript-eslint/naming-convention */
  _links: {
    mesh: {
      href: string;
    };
  };
}

/** Exposed strictly for tests.
 * @internal
 */
export interface MeshExports {
  exports: MeshExport[];

  /* eslint-disable-next-line @typescript-eslint/naming-convention */
  _links: {
    next?: {
      href: string;
    };
  };
}

/** Arguments supplied to [[queryMeshExports]].
 * @beta
 */
export interface QueryMeshExportsArgs {
  /** The token used to access the mesh export service. */
  accessToken: AccessToken;
  /** The Id of the iModel for which to query exports. */
  iModelId: string;
  /** If defined, constrains the query to exports produced from the specified changeset. */
  changesetId?: string;
  /** Chiefly used in testing environments. */
  urlPrefix?: string;
  /** If true, exports whose status is not "Complete" (indicating the export successfully finished) will be included in the results. */
  includeIncomplete?: boolean;
}

/** Query the [mesh export service](https://developer.bentley.com/apis/mesh-export/operations/get-exports/) for exports of type "IMODEL" matching
 * the specified criteria.
 * The exports are sorted from most-recently- to least-recently-produced.
 * @beta
 */
export async function * queryMeshExports(args: QueryMeshExportsArgs): AsyncIterableIterator<MeshExport> {
  const headers = {
    /* eslint-disable-next-line @typescript-eslint/naming-convention */
    Authorization: args.accessToken ?? await IModelApp.getAccessToken(),
    /* eslint-disable-next-line @typescript-eslint/naming-convention */
    Accept: "application/vnd.bentley.itwin-platform.v1+json",
    /* eslint-disable-next-line @typescript-eslint/naming-convention */
    Prefer: "return=representation",
  };

  let url: string | undefined = createMeshExportServiceQueryUrl(args);
  while (url) {
    let result;
    try {
      const response = await fetch(url, { headers });
      result = await response.json() as MeshExports;
    } catch (err) {
      Logger.logException(loggerCategory, err);
      Logger.logError(loggerCategory, `Failed loading exports for iModel ${args.iModelId}`);
      break;
    }

    const foundExports = result.exports.filter((x) => x.request.exportType === "IMODEL" && (args.includeIncomplete || x.status === "Complete"));
    for (const foundExport of foundExports)
      yield foundExport;

    url = result._links.next?.href;
  }
}

/** Arguments supplied  to [[obtainMeshExportTilesetUrl]].
 * @beta
 */
export interface ObtainMeshExportTilesetUrlArgs {
  /** The iModel for which to obtain a tileset URl. */
  iModel: IModelConnection;
  /** The token used to access the mesh export service. */
  accessToken: AccessToken;
  /** Chiefly used in testing environments. */
  urlPrefix?: string;
  /** If true, only exports produced for `iModel`'s specific changeset will be considered; otherwise, if no exports are found for the changeset,
   * the most recent export for any changeset will be used.
   */
  requireExactChangeset?: boolean;
}

/** Obtains a URL pointing to a tileset appropriate for visualizing a specific iModel.
 * [[queryCompletedMeshExports]] is used to obtain a list of available exports. By default, the list is sorted from most to least recently-exported.
 * The first export matching the iModel's changeset is selected; or, if no such export exists, the first export in the list is selected.
 * @returns A URL from which the tileset can be loaded, or `undefined` if no appropriate URL could be obtained.
 * @beta
 */
export async function obtainMeshExportTilesetUrl(args: ObtainMeshExportTilesetUrlArgs): Promise<URL | undefined> {
  if (!args.iModel.iModelId) {
    Logger.logInfo(loggerCategory, "Cannot obtain exports for an iModel with no iModelId");
    return undefined;
  }

  const queryArgs: QueryMeshExportsArgs = {
    accessToken: args.accessToken,
    iModelId: args.iModel.iModelId,
    changesetId: args.iModel.changeset.id,
    urlPrefix: args.urlPrefix,
  };

  let selectedExport;
  for await (const exp of queryMeshExports(queryArgs)) {
    selectedExport = exp;
    break;
  }

  if (!selectedExport && !args.requireExactChangeset) {
    queryArgs.changesetId = undefined;
    for await (const exp of queryMeshExports(queryArgs)) {
      selectedExport = exp;
      Logger.logInfo(loggerCategory, `No exports for iModel ${args.iModel.iModelId} for changeset ${args.iModel.changeset.id}; falling back to most recent`);
      break;
    }
  }

  if (!selectedExport) {
    Logger.logInfo(loggerCategory, `No exports available for iModel ${args.iModel.iModelId}`);
    return undefined;
  }

  const url = new URL(selectedExport._links.mesh.href);
  url.pathname = `${url.pathname}/tileset.json`;
  return url;
}

/** Options supplied to [[initializeFrontendTiles]].
 * @beta
 */
export interface FrontendTilesOptions {
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
}

/** Global configuration initialized by [[initializeFrontendTiles]].
 * @internal
 */
export const frontendTilesOptions = {
  maxLevelsToSkip: 4,
  enableEdges: false,
};

/** Initialize the frontend-tiles package to obtain tiles for spatial views.
 * @beta
 */
export function initializeFrontendTiles(options: FrontendTilesOptions): void {
  if (undefined !== options.maxLevelsToSkip && options.maxLevelsToSkip >= 0)
    frontendTilesOptions.maxLevelsToSkip = options.maxLevelsToSkip;

  if (options.enableEdges)
    frontendTilesOptions.enableEdges = true;

  const computeUrl = options.computeSpatialTilesetBaseUrl ?? (
    async (iModel: IModelConnection) => obtainMeshExportTilesetUrl({ iModel, accessToken: await IModelApp.getAccessToken() })
  );

  SpatialTileTreeReferences.create = (view: SpatialViewState) => createBatchedSpatialTileTreeReferences(view, computeUrl);
}
