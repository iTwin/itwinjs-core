/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { AccessToken, Logger} from "@itwin/core-bentley";
import { loggerCategory} from "../LoggerCategory";

/** The format of the Graphic Representation
 * @beta
 */
export enum GraphicRepresentationFormat {
  IMDL = "IMDL",
  Tiles3D = "3DTILES",
}

/** Graphic representations are generated from Data Sources.
 * The status of a Graphic Representation indicates the progress of that generation process.
 * @beta
 */
export enum GraphicRepresentationStatus {
  InProgress = "In progress",
  Complete = "Complete",
  NotStarted = "Not started",
  Failed = "Failed",
}

/**
 * Represents a data source for a graphic representation.
 * A data source is usually higher-fidelity and contains more information, but may not be as well suited for visualization
 * as a graphic representation.
 * @beta
 */
export interface DataSource {
  /** The iTwinId associated with th data source */
  iTwinId: string;
  /** The id of the data source */
  id: string;
  /** The change id of the data source */
  changeId?: string;
  /** The type of the data source */
  type: string;
}

/** represents a visual representation of data from a data source.
 * This could be a 3D model, a map, or any other kind of graphical data.
 * @see [[queryGraphicsDataSources]].
 * @beta
 */
export interface GraphicRepresentation {
  /** The displayName of the Graphic Representation */
  displayName: string;
  /** The Id of the Graphic Representation */
  representationId: string;
  /** The status of the query from the Graphics Provider for the Graphic Representation */
  status: GraphicRepresentationStatus;
  /** The format of the Graphic Representation*/
  format: GraphicRepresentationFormat;
  /** The url of the Graphic Representation */
  url?: string;
  /** The data source that the representation originates from.
  * For example, a GraphicRepresentation in the 3D Tiles format might have a dataSource that is a specific iModel changeset.
  */
  dataSource: DataSource;
}

/** Creates a URL used to query for Graphic Representations */
function createGraphicRepresentationsQueryUrl(args: { sourceId: string, urlPrefix?: string, changeId?: string, enableCDN?: boolean }): string {
  const prefix = args.urlPrefix ?? "";
  let url = `https://${prefix}api.bentley.com/mesh-export/?iModelId=${args.sourceId}&$orderBy=date:desc`;
  if (args.changeId)
    url = `${url}&changesetId=${args.changeId}`;

  if (args.enableCDN)
    url = `${url}&cdn=1`;

  url = `${url}&tileVersion=1&exportType=IMODEL`;

  return url;
}

/** Arguments supplied to [[queryGraphicsDataSources]].
 * @beta
 */
export interface QueryGraphicRepresentationsArgs {
  /** The token used to access the mesh export service. */
  accessToken: AccessToken;
  /** The Session Id */
  sessionId: string;
  /** The Data Source for which to query */
  dataSource: DataSource;
  /** The format of the Graphics Data Source */
  format: GraphicRepresentationFormat;
  /** Chiefly used in testing environments. */
  urlPrefix?: string;
  /** If true, exports whose status is not "Complete" (indicating the export successfully finished) will be included in the results */
  includeIncomplete?: boolean;
  /** If true, enables a CDN (content delivery network) to access tiles faster. */
  enableCDN?: boolean;
}

/** Query Graphic Representations for representations matching the specified criteria.
 * The representations are sorted from most-recently- to least-recently-produced.
 * @beta
 */
export async function* queryGraphicRepresentations(args: QueryGraphicRepresentationsArgs): AsyncIterableIterator<GraphicRepresentation> {
  interface ServiceJsonResponse {
    id: string;
    displayName: string;
    status: GraphicRepresentationStatus;
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

  interface ServiceJsonResponses {
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

  let url: string | undefined = createGraphicRepresentationsQueryUrl({ sourceId: args.dataSource.id, urlPrefix: args.urlPrefix, changeId: args.dataSource.changeId, enableCDN: args.enableCDN });
  while (url) {
    let result;
    try {
      const response = await fetch(url, { headers });
      result = await response.json() as ServiceJsonResponses;
    } catch (err) {
      Logger.logException(loggerCategory, err);
      Logger.logError(loggerCategory, `Failed loading Graphics Data for Source ${args.dataSource.id}`);
      break;
    }

    const foundSources = result.exports.filter((x) => x.request.exportType === args.dataSource.type && (args.includeIncomplete || x.status === GraphicRepresentationStatus.Complete));
    for (const foundSource of foundSources) {
      const graphicRepresentation = {
        displayName: foundSource.displayName,
        representationId: foundSource.id,
        status: foundSource.status,
        format: args.format,
        url: foundSource._links.mesh.href,
        dataSource: {
          iTwinId: args.dataSource.iTwinId,
          id: foundSource.request.iModelId,
          versionId: foundSource.request.changesetId,
          type: foundSource.request.exportType,
        },
      };

      yield graphicRepresentation;
    }

    url = result._links.next?.href;
  }
}

/** Arguments supplied  to [[obtainGraphicRepresentationUrl]].
 * @beta
 */
export interface ObtainGraphicRepresentationUrlArgs {
  /** The token used to access the mesh export service. */
  accessToken: AccessToken;
  /** The Session Id */
  sessionId: string;
  /** The data source for which to query */
  dataSource: DataSource;
  /** The format of the Graphics Data Source */
  format: GraphicRepresentationFormat;
  /** Chiefly used in testing environments. */
  urlPrefix?: string;
  /** If true, only Graphics Data produced for a specific version will be considered; otherwise, if no Graphics Data Sources are found for the version,
  * the most recent source for any version will be used.
   */
  requireExactVersion?: boolean;
  /** If true, enables a CDN (content delivery network) to access tiles faster. */
  enableCDN?: boolean;
}

/** Obtains a URL pointing to a Graphic Representation.
 * [[queryGraphicRepresentations]] is used to obtain a list of available representations. By default, the list is sorted from most to least recently-created.
 * The first representation matching the source version is selected; or, if no such representation exists, the first representation in the list is selected.
 * @returns A URL from which the tileset can be loaded, or `undefined` if no appropriate URL could be obtained.
 * @beta
 */
export async function obtainGraphicRepresentationUrl(args: ObtainGraphicRepresentationUrlArgs): Promise<URL | undefined> {
  if (!args.dataSource.id) {
    Logger.logInfo(loggerCategory, "Cannot obtain Graphics Data from a source without an Id");
    return undefined;
  }

  const queryArgs: QueryGraphicRepresentationsArgs = {
    accessToken: args.accessToken,
    sessionId: args.sessionId,
    dataSource: {
      iTwinId: args.dataSource.iTwinId,
      id: args.dataSource.id,
      changeId: args.dataSource.changeId,
      type: args.dataSource.type,
    },
    format: args.format,
    urlPrefix: args.urlPrefix,
    enableCDN: args.enableCDN,
  };

  let selectedData;
  for await (const data of queryGraphicRepresentations(queryArgs)) {
    selectedData = data;
    break;
  }

  if (!selectedData && !args.requireExactVersion) {
    queryArgs.dataSource.changeId = undefined;
    for await (const data of queryGraphicRepresentations(queryArgs)) {
      selectedData = data;
      Logger.logInfo(loggerCategory, `No data for Data Source ${args.dataSource.id} for version ${args.dataSource.changeId}; falling back to most recent`);
      break;
    }
  }

  if ((!selectedData) || (!selectedData.url)) {
    Logger.logInfo(loggerCategory, `No data available for Data Source ${args.dataSource.id}`);
    return undefined;
  }

  const url = new URL(selectedData.url);
  url.pathname = `${url.pathname}/tileset.json`;
  return url;
}
