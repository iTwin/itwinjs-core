/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { Logger } from "@itwin/core-bentley";
import { loggerCategory } from "../../LoggerCategory";

/**
 * Represents the arguments required for geoscience operations.
 * @alpha
 */
export interface BaseGeoscienceArgs {
  /**
   * The access token for authentication.
   */
  accessToken: string;

  /**
   * The organization ID.
   */
  organizationId: string;

  /**
   * The workspace ID.
   */
  workspaceId: string;

  /**
   * The geoscience object ID.
   */
  geoscienceObjectId: string;
}

/**
 * Represents the arguments for obtaining a geoscience tileset.
 * @alpha
 */
export interface GetGeoscienceTilesetArgs extends BaseGeoscienceArgs {
  /**
   * The URL prefix for the tileset.
   */
  urlPrefix?: string;

  /**
   * Specifies whether to enable the Content Delivery Network (CDN) for the tileset.
   */
  enableCDN?: boolean;
}

/**
 * Obtains the URL for a geoscience tileset.
 * @alpha
 */
export async function getGeoscienceTilesetUrl(args: GetGeoscienceTilesetArgs): Promise<string | undefined> {
  const headers = {
    /* eslint-disable-next-line @typescript-eslint/naming-convention */
    Authorization: args.accessToken,
  };

  const baseUrl = "https://351mt.api.integration.seequent.com";
  const url = `${baseUrl}/visualization/orgs/${args.organizationId}/workspaces/${args.workspaceId}/geoscience-object/${args.geoscienceObjectId}`;
  const response = await fetch(url, { headers });
  const result = await response.json();

  const objUrl = URL.createObjectURL(new Blob([JSON.stringify(result)], { type: "application/json" }));
  if ((!result) || (!objUrl)) {
    Logger.logInfo(loggerCategory, `No data available for Geoscience Object ${args.geoscienceObjectId}`);
    return undefined;
  }

  return objUrl;
}
