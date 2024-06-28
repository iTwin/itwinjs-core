/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { AccessToken } from "@itwin/core-bentley";
import { obtainGraphicRepresentationUrl, ObtainGraphicRepresentationUrlArgs } from "./GraphicRepresentation";

/** Represents a data source for an iModel.
 * @beta
 */
export interface DataSource {
  /** The iTwinId associated with the iModel. */
  iTwinId: string;

  /** The iModelId associated with the iModel. */
  iModelId: string;

  /** The unique identifier for a specific changeset of the iModel. */
  changesetId?: string;
}

/** Arguments for iModel tileset customization and optimization.
 * @beta
 */
export interface IModelTilesetOptions {
  /** Chiefly used in testing environments. */
  urlPrefix?: string;

  /** If true, only exports produced for `iModel`'s specific changeset will be considered; otherwise, if no exports are found for the changeset,
   * the most recent export for any changeset will be used.
   */
  requireExactChangeset?: boolean;

  /** If true, enables a CDN (content delivery network) to access tiles faster. */
  enableCDN?: boolean;

  /** If true, the format of the tileset is Cesium 3D Tiles. */
  cesium3DTiles?: boolean;
}


/** Arguments supplied  to [[obtainMeshExportTilesetUrl]].
 * @beta
 */
export interface ObtainIModelTilesetUrlFromProviderArgs {
  /** The data source that the representation originates from. For example, a GraphicRepresentation in the 3D Tiles format might have a dataSource that is a specific iModel changeset. */
  dataSource: DataSource;

  /** The token used to access the mesh export service. */
  accessToken: AccessToken;

  /** The options for the iModel tileset. */
  options: IModelTilesetOptions;
}

/**
 * Obtains the URL for an iModel tileset from the provider.
 * @beta
 */
export async function obtainIModelTilesetUrlFromProvider(args: ObtainIModelTilesetUrlFromProviderArgs): Promise<URL | undefined> {
  const graphicsArgs: ObtainGraphicRepresentationUrlArgs = {
    accessToken: args.accessToken,
    dataSource: {
      iTwinId: args.dataSource.iTwinId,
      id: args.dataSource.iModelId,
      changeId: args.dataSource.changesetId,
      type: "IMODEL",
    },
    format: args.options.cesium3DTiles === true ? "3DTILES" : "IMDL",
    urlPrefix: args.options.urlPrefix,
    requireExactVersion: args.options.requireExactChangeset,
    enableCDN: args.options.enableCDN,
  };

  return obtainGraphicRepresentationUrl(graphicsArgs);
}
