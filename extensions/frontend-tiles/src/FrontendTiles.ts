/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { queryGraphicRepresentations } from "./GraphicsProvider/url-providers/GraphicUrlProvider";
import { AccessToken } from "@itwin/core-bentley";
import { GraphicsProvider, InitIModelTilesArgs, ObtainIModelTilesetUrlArgs } from './GraphicsProvider/GraphicsProvider';

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
  return GraphicsProvider.getInstance().getIModelTilesetUrlFromConnection(args);
}

/** Arguments supplied to [[InitIModelTilesArgs]].
 * @beta
 */
export type FrontendTilesOptions = InitIModelTilesArgs;

/** Initialize the frontend-tiles package to obtain tiles for spatial views.
 * @beta
 */
export function initializeFrontendTiles(options: FrontendTilesOptions): void {
  GraphicsProvider.getInstance().createIModelTileset(options);
}
