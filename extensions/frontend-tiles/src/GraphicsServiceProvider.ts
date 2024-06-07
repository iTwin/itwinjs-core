/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { AccessToken, Logger } from "@itwin/core-bentley";
import { loggerCategory } from "./LoggerCategory";

function createGraphicsDataSourceQueryUrl(args: { sourceId: string, urlPrefix?: string, sourceVersionId?: string, enableCDN?: boolean }): string {
  const prefix = args.urlPrefix ?? "";
  let url = `https://${prefix}api.bentley.com/mesh-export/?iModelId=${args.sourceId}&$orderBy=date:desc`;
  if (args.sourceVersionId)
    url = `${url}&changesetId=${args.sourceVersionId}`;

  if (args.enableCDN)
    url = `${url}&cdn=1`;

  url = `${url}&tileVersion=1&exportType=IMODEL`;

  return url;
}

/** Represents the result of a [mesh export](https://developer.bentley.com/apis/mesh-export/operations/get-export/#export).
 * @see [[queryGraphicsDataSources]].
 * @beta
 */
export interface GraphicsDataSource {
  id: string;
  displayName: string;
  status: string;
  sourceId: string;
  sourceVersionId: string;
  sourceType: string;
  url: string;
}

/** Arguments supplied to [[queryGraphicsDataSources]].
 * @beta
 */
export interface QueryGraphicsDataSourcesArgs {
  /** The token used to access the mesh export service. */
  accessToken: AccessToken;
  /** The Session Id */
  sessionId: string;
  /** The Id of the iModel for which to query exports. */
  sourceId: string;
  /** The type of Graphics Data Source for which to query */
  sourceType: string;
  /** If defined, constrains the query to exports produced from the specified changeset. */
  sourceVersionId?: string;
  /** Chiefly used in testing environments. */
  urlPrefix?: string;
  /** If true, exports whose status is not "Complete" (indicating the export successfully finished) will be included in the results. */
  includeIncomplete?: boolean;
  /** If true, enables a CDN (content delivery network) to access tiles faster. */
  enableCDN?: boolean;
}

/** Query the [Graphics Data Sources] for sources matching the specified criteria.
 * The sources are sorted from most-recently- to least-recently-produced.
 * @beta
 */
export async function* queryGraphicsDataSources(args: QueryGraphicsDataSourcesArgs): AsyncIterableIterator<GraphicsDataSource> {

  interface ServiceJsonResponse {
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

  interface ServiceJsonResponses{
    exports: ServiceJsonResponse[];

    /* eslint-disable-next-line @typescript-eslint/naming-convention */
    _links: {
      next?: {
        href: string;
      };
    };
  }

  const headers = {
    /* eslint-disable-next-line @typescript-eslint/naming-convention */
    Authorization: args.accessToken,
    /* eslint-disable-next-line @typescript-eslint/naming-convention */
    Accept: "application/vnd.bentley.itwin-platform.v1+json",
    /* eslint-disable-next-line @typescript-eslint/naming-convention */
    Prefer: "return=representation",
    /* eslint-disable-next-line @typescript-eslint/naming-convention */
    SessionId: args.sessionId,
  };

  let url: string | undefined = createGraphicsDataSourceQueryUrl(args);
  while (url) {
    let result;
    try {
      const response = await fetch(url, { headers });
      result = await response.json() as ServiceJsonResponses;
    } catch (err) {
      Logger.logException(loggerCategory, err);
      Logger.logError(loggerCategory, `Failed loading Graphics Data for Source ${args.sourceId}`);
      break;
    }

    const foundSources = result.exports.filter((x) => x.request.exportType === args.sourceType && (args.includeIncomplete || x.status === "Complete"));
    for (const foundSource of foundSources) {

      const graphicsDataSource = {
        id: foundSource.id,
        displayName: foundSource.displayName,
        status: foundSource.status,
        sourceId: foundSource.request.iModelId,
        sourceVersionId: foundSource.request.changesetId,
        sourceType: foundSource.request.exportType,
        url: foundSource._links.mesh.href,
      };

      yield graphicsDataSource;
    }

    url = result._links.next?.href;
  }
}

/** Arguments supplied  to [[obtainGraphicsDataSourceUrl]].
 * @beta
 */
export interface ObtainGraphicsDataSourceUrlArgs {
  /** The token used to access the mesh export service. */
  accessToken: AccessToken;
  /** The Session Id */
  sessionId: string;
  /** The Id of the source for which to query */
  sourceId: string;
  /** The Graphics Data Source type for which to query */
  sourceType: string;
  /** The version Id of the source for which to query */
  sourceVersionId?: string;
  /** Chiefly used in testing environments. */
  urlPrefix?: string;
  /** If true, only Graphics Data produced for a specific version will be considered; otherwise, if no Graphics Data Sources are found for the version,
  * the most recent source for any version will be used.
  */
  requireExactVersion?: boolean;
  /** If true, enables a CDN (content delivery network) to access tiles faster. */
  enableCDN?: boolean;
}

/** Obtains a URL pointing to a tileset.
 * [[queryGraphicsDataSources]] is used to obtain a list of available sources. By default, the list is sorted from most to least recently-created.
 * The first Graphics Data matching the source version is selected; or, if no such Graphics Data exists, the first source in the list is selected.
 * @returns A URL from which the tileset can be loaded, or `undefined` if no appropriate URL could be obtained.
 * @beta
 */
export async function obtainGraphicsDataSourceUrl(args: ObtainGraphicsDataSourceUrlArgs): Promise<URL | undefined> {
  if (!args.sourceId) {
    Logger.logInfo(loggerCategory, "Cannot obtain Graphics Data from a source without an Id");
    return undefined;
  }

  const queryArgs: QueryGraphicsDataSourcesArgs = {
    accessToken: args.accessToken,
    sessionId: args.sessionId,
    sourceId: args.sourceId,
    sourceType: args.sourceType,
    sourceVersionId: args.sourceVersionId,
    urlPrefix: args.urlPrefix,
    enableCDN: args.enableCDN,
  };

  let selectedData;
  for await (const data of queryGraphicsDataSources(queryArgs)) {
    selectedData = data;
    break;
  }

  if (!selectedData && !args.requireExactVersion) {
    queryArgs.sourceVersionId = undefined;
    for await (const data of queryGraphicsDataSources(queryArgs)) {
      selectedData = data;
      Logger.logInfo(loggerCategory, `No data for Graphics Data Source ${args.sourceId} for version ${args.sourceVersionId}; falling back to most recent`);
      break;
    }
  }

  if (!selectedData) {
    Logger.logInfo(loggerCategory, `No data available for Graphics Data Source ${args.sourceId}`);
    return undefined;
  }

  const url = new URL(selectedData.url);
  url.pathname = `${url.pathname}/tileset.json`;
  return url;
}
