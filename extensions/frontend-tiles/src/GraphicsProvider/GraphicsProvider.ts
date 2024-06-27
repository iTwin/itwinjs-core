/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { AccessToken, Logger} from "@itwin/core-bentley";
import { IModelApp, IModelConnection} from "@itwin/core-frontend";
import { obtainGraphicRepresentationUrl} from "./GraphicRepresentationProvider";
import { loggerCategory} from "../LoggerCategory";
import * as util from "util";

/** Arguments supplied  to [[obtainMeshExportTilesetUrl]].
 * @beta
 */
export interface ObtainIModelTilesetUrlArgs {
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
  /** If true, enables a CDN (content delivery network) to access tiles faster. */
  enableCDN?: boolean;
}

/** Obtains a URL pointing to a tileset appropriate for visualizing a specific iModel.
 * [[queryCompletedMeshExports]] is used to obtain a list of available exports. By default, the list is sorted from most to least recently-exported.
 * The first export matching the iModel's changeset is selected; or, if no such export exists, the first export in the list is selected.
 * @returns A URL from which the tileset can be loaded, or `undefined` if no appropriate URL could be obtained.
 * @beta
 */
export async function obtainIModelTilesetUrl(args: ObtainIModelTilesetUrlArgs): Promise<URL|undefined> {
  if (!args.iModel.iModelId) {
    Logger.logInfo(loggerCategory, "Cannot obtain Graphics Data for an iModel with no iModelId");
    return undefined;
  }

  if (!args.iModel.iTwinId) {
    Logger.logInfo(loggerCategory, "Cannot obtain Graphics Data for an iModel with no iTwinId");
    return undefined;
  }

  const graphicsArgs = {
    accessToken: args.accessToken,
    sessionId: IModelApp.sessionId,
    dataSource: {
      iTwinId: args.iModel.iTwinId,
      id: args.iModel.iModelId,
      changeId: args.iModel.changeset.id,
      type: "IMODEL",
    },
    format: "IMDL",
    urlPrefix: args.urlPrefix,
    requireExactVersion: args.requireExactChangeset,
    enableCDN: args.enableCDN,
  };

  return obtainGraphicRepresentationUrl(graphicsArgs);
}

/** Arguments supplied  to [[obtainGeoscienceTilesetUrl]].
 * @beta
 */
export interface ObtainGeoscienceTilesetArgs {
  /** The token used to access the mesh export service. */
  accessToken: AccessToken;

  organizationId: string;

  workspaceId: string;

  geoscienceObjectId: string;
  /** Chiefly used in testing environments. */
  urlPrefix?: string;
  /** If true, only exports produced for `iModel`'s specific changeset will be considered; otherwise, if no exports are found for the changeset,
   * the most recent export for any changeset will be used.
   */
  enableCDN?: boolean;
}

export async function obtainGeoscienceTilesetUrl(args: ObtainGeoscienceTilesetArgs):
Promise<string|undefined> {
  const headers = {
    /* eslint-disable-next-line @typescript-eslint/naming-convention */
    Authorization: args.accessToken,
  };

  // console.log("Token: ", args.accessToken);
  const baseUrl = "https://351mt.api.integration.seequent.com";

  const url = `${baseUrl}/visualization/orgs/${args.organizationId}/workspaces/${args.workspaceId}/geoscience-object/${args.geoscienceObjectId}`;
  const response = await fetch(url, { headers });
  // console.log("response: ", response);
  // console.log("util: ", util.inspect(response, {showHidden: false, depth: null, colors: true}));
  const result = await response.json();
  // console.log("result: ", result);

  // console.log("util: ", util.inspect(result, {showHidden: false, depth: null, colors: true}));
  const objUrl = URL.createObjectURL(new Blob([result], {type: "application/json"}));
  if ((!result) || (!objUrl)) {
    Logger.logInfo(loggerCategory, `No data available for Geoscience Object ${args.geoscienceObjectId}`);
    return undefined;
  }

  return objUrl;
}
