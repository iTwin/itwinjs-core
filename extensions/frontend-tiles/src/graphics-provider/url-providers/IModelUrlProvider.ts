/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { IModelConnection } from "@itwin/core-frontend";
import { AccessToken, Logger } from "@itwin/core-bentley";
import { loggerCategory } from "../../LoggerCategory";
import { getGraphicRepresentationUrl, GetGraphicRepresentationUrlArgs } from "./GraphicUrlProvider";

/** Represents a data source for an iModel.
 * @beta
 */
export interface IModelDataSource {
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
export interface GetIModelTilesetUrlArgs {
  /** The data source that the representation originates from. For example, a GraphicRepresentation in the 3D Tiles format might have a dataSource that is a specific iModel changeset. */
  dataSource: IModelDataSource;

  /** The token used to access the mesh export service. */
  accessToken: AccessToken;

  /** The options for the iModel tileset. */
  options: IModelTilesetOptions;
}

/**
 * Obtains the URL for an iModel tileset from the provider.
 * @beta
 */
export async function getIModelTilesetUrl(args: GetIModelTilesetUrlArgs): Promise<URL | undefined> {
  const graphicsArgs: GetGraphicRepresentationUrlArgs = {
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

  return getGraphicRepresentationUrl(graphicsArgs);
}

/** Arguments supplied  to [[obtainMeshExportTilesetUrl]].
 * @beta
 */
export interface GetIModelTilesetUrlFromConnectionArgs {
  /** The iModel for which to obtain a tileset URl. */
  iModel: IModelConnection;

  /** The token used to access the mesh export service. */
  accessToken: AccessToken;

  /** The options for the iModel tileset. */
  options: IModelTilesetOptions;
}

/** Obtains a URL pointing to a tileset appropriate for visualizing a specific iModel.
 * [[queryCompletedMeshExports]] is used to obtain a list of available exports. By default, the list is sorted from most to least recently-exported.
 * The first export matching the iModel's changeset is selected; or, if no such export exists, the first export in the list is selected.
 * @returns A URL from which the tileset can be loaded, or `undefined` if no appropriate URL could be obtained.
 * @beta
 */
export async function getIModelTilesetUrlFromConnection(args: GetIModelTilesetUrlFromConnectionArgs): Promise<URL | undefined> {
  if (!args.iModel.iModelId) {
    Logger.logInfo(loggerCategory, "Cannot obtain Graphics Data for an iModel with no iModelId");
    return undefined;
  }

  if (!args.iModel.iTwinId) {
    Logger.logInfo(loggerCategory, "Cannot obtain Graphics Data for an iModel with no iTwinId");
    return undefined;
  }

  const graphicsArgs: GetIModelTilesetUrlArgs = {
    accessToken: args.accessToken,
    dataSource: {
      iTwinId: args.iModel.iTwinId,
      iModelId: args.iModel.iModelId,
      changesetId: args.iModel.changeset.id,
    },
    options: args.options,
  };

  return getIModelTilesetUrl(graphicsArgs);
}
