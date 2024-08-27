/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { IModelApp, IModelConnection, SpatialTileTreeReferences, SpatialViewState } from "@itwin/core-frontend";
import { createBatchedSpatialTileTreeReferences } from "./BatchedSpatialTileTreeRefs";
import { queryGraphicRepresentations } from "./GraphicsProvider/GraphicRepresentationProvider";
import { AccessToken } from "@itwin/core-bentley";
import { obtainIModelTilesetUrl, ObtainIModelTilesetUrlArgs} from "./GraphicsProvider/GraphicsProvider";

/** A function that can provide the base URL where a tileset representing all of the spatial models in a given iModel are stored.
 * The tileset is expected to reside at "baseUrl/tileset.json" and to have been produced by the [mesh export service](https://developer.bentley.com/apis/mesh-export/).
 * If no such tileset exists for the given iModel, return `undefined`.
 * @see [[FrontendTilesOptions.computeSpatialTilesetBaseUrl]].
 * @beta
 */
export type ComputeSpatialTilesetBaseUrl = (iModel: IModelConnection) => Promise<URL | undefined>;

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
  /** The iTwinId associated with the Mesh Export */
  iTwinId: string;
  /** The Id of the iModel for which to query exports. */
  iModelId: string;
  /** If defined, constrains the query to exports produced from the specified changeset. */
  changesetId?: string;
  /** Chiefly used in testing environments. */
  urlPrefix?: string;
  /** If true, exports whose status is not "Complete" (indicating the export successfully finished) will be included in the results. */
  includeIncomplete?: boolean;
  /** If true, enables a CDN (content delivery network) to access tiles faster. */
  enableCDN?: boolean;
}

/** Query the [mesh export service](https://developer.bentley.com/apis/mesh-export/operations/get-exports/) for exports of type "IMODEL" matching
 * the specified criteria.
 * The exports are sorted from most-recently- to least-recently-produced.
 * @beta
 */
export async function* queryMeshExports(args: QueryMeshExportsArgs): AsyncIterableIterator<MeshExport> {
  const graphicsArgs = {
    accessToken: args.accessToken,
    sessionId: IModelApp.sessionId,
    dataSource: {
      iTwinId: args.iTwinId,
      id: args.iModelId,
      changeId: args.changesetId,
      type: "IMODEL",
    },
    format: "IMDL",
    urlPrefix: args.urlPrefix,
    enableCDN: args.enableCDN,
  };

  for await (const data of queryGraphicRepresentations(graphicsArgs)) {
    const meshExport = {
      id: data.representationId,
      displayName: data.displayName,
      status: "Complete",
      request: {
        iModelId: data.dataSource.id,
        changesetId: data.dataSource.changeId ?? "",
        exportType: data.dataSource.type,
        geometryOptions: {},
        viewDefinitionFilter: {},
      },

      /* eslint-disable-next-line @typescript-eslint/naming-convention */
      _links: {
        mesh: {
          href: data.url ?? "",
        },
      },
    };

    yield meshExport;
  }
}

// In theory, this function is ony called after we're waiting for the first export of a given iModel or changeset
// So we just wait for the first (only?) export to complete
export async function queryMeshExportsAndWaitForCompletion(args: QueryMeshExportsArgs): Promise<MeshExport[]> {
  const exports: MeshExport[] = [];
  const completedExports: { exportId: string, success: boolean }[] = [];

  try {
    // Start export
    // const response = await startExport(args);

    // Get export status
    let currentExport;
    const start = Date.now();
    while ((Date.now() - start) < 900000) { // Wait for 15 minutes before stopping the loop
      // Get export status
      // currentExport = await queryMeshExports(args).next();
      for await (const data of queryMeshExports(args)) {
        currentExport = data;
        break;
      }

      if (currentExport !== undefined && currentExport.status === "Complete") {
        console.log(`Export ${response.export.id} completed! Time Elapsed: ${Date.now() - start} milliseconds`);
        completedExports.push({ exportId: response.export.id, success: true });
        return exports;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Sleep for 1 second
    }

    let msg = `Export ${response.export.id} failed to complete within 15 minutes.`;
    if (currentExport)
      msg += ` Last Status: ${currentExport.status}`;
    console.log(msg);

    completedExports.push({ exportId: response.export.id, success: false });
  } catch (error: any) {
    console.error(`Failed to start export: ${error.message}`);
  }

  return exports;
}

export async function startExport(args: QueryMeshExportsArgs) {
  const exportPrefix = args.urlPrefix ?? "";

  const headers = {
    "Authorization": args.accessToken,
    "Accept": "application/vnd.bentley.itwin-platform.v1+json",
    "Content-Type": "application/json",
    "use-new-exporter": "true",
  };

  const reqBody = {
    iModelId: args.iModelId,
    changesetId: args.changesetId ?? "",
    exportType: "IMODEL",
  };

  console.log("starting export");

  const response = await fetch(
    `https://${exportPrefix}api.bentley.com/mesh-export/`,
    {
      headers,
      method: "POST",
      body: JSON.stringify(reqBody),
    },
  );
  const responseJson = await (response).json();
  console.log(responseJson);

  return responseJson;
};

/** Arguments supplied  to [[obtainMeshExportTilesetUrl]].
 * @beta
 */
export type ObtainMeshExportTilesetUrlArgs = ObtainIModelTilesetUrlArgs;

/** Obtains a URL pointing to a tileset appropriate for visualizing a specific iModel.
 * [[queryCompletedMeshExports]] is used to obtain a list of available exports. By default, the list is sorted from most to least recently-exported.
 * The first export matching the iModel's changeset is selected; or, if no such export exists, the first export in the list is selected.
 * @returns A URL from which the tileset can be loaded, or `undefined` if no appropriate URL could be obtained.
 * @beta
 */
export async function obtainMeshExportTilesetUrl(args: ObtainMeshExportTilesetUrlArgs): Promise<URL | undefined> {
  return obtainIModelTilesetUrl(args);
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
  /** Specifies whether to enable a CDN (content delivery network) to access tiles faster.
   * This option is only used if computeSpatialTilesetBaseUrl is not defined.
   * @beta
   */
  enableCDN?: boolean;
  /** Specifies whether to enable an IndexedDB database for use as a local cache.
  * Requested tiles will then first be search for in the database, and if not found, fetched as normal.
  * @internal
  */
  useIndexedDBCache?: boolean;

  /** If true, an empty tile tree will be used as fallback if the tileset is not found or invalid.
   * If false or not defined, the default tiles will be used as a fallback.
   * @internal
   */
  nopFallback?: boolean;
}

/** Global configuration initialized by [[initializeFrontendTiles]].
 * @internal
 */
export const frontendTilesOptions = {
  maxLevelsToSkip: 4,
  enableEdges: false,
  useIndexedDBCache: false,
};

/** Initialize the frontend-tiles package to obtain tiles for spatial views.
 * @beta
 */
export function initializeFrontendTiles(options: FrontendTilesOptions): void {
  if (undefined !== options.maxLevelsToSkip && options.maxLevelsToSkip >= 0)
    frontendTilesOptions.maxLevelsToSkip = options.maxLevelsToSkip;

  if (options.enableEdges)
    frontendTilesOptions.enableEdges = true;

  if (options.useIndexedDBCache)
    frontendTilesOptions.useIndexedDBCache = true;

  const computeUrl = options.computeSpatialTilesetBaseUrl ?? (
    async (iModel: IModelConnection) => obtainMeshExportTilesetUrl({ iModel, accessToken: await IModelApp.getAccessToken(), enableCDN: options.enableCDN })
  );

  SpatialTileTreeReferences.create = (view: SpatialViewState) => createBatchedSpatialTileTreeReferences(view, computeUrl, options.nopFallback ?? false);
}
