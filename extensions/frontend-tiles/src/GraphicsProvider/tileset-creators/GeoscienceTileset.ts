/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { Logger } from "@itwin/core-bentley";
import { loggerCategory } from "../../LoggerCategory";
import { BaseGeoscienceArgs, getGeoscienceTilesetUrl } from "../url-providers/GeoscienceUrlProvider";
import { createRealityModelTilesetFromUrl } from "./RealityModelTileset";
/**
 * Represents the arguments required to initialize geoscience tileset.
 * @beta
 */
export interface CreateGeoscienceTilesetArgs extends BaseGeoscienceArgs { };

/** Initialize the geoscience tileset.
 * @beta
 */
export async function createGeoscienceTileset(args: CreateGeoscienceTilesetArgs): Promise<void> {
  try {
    const url = await getGeoscienceTilesetUrl(args);
    if (!url) {
      Logger.logInfo(loggerCategory, `No data available for Geoscience Object ${args.geoscienceObjectId}`);
      return;
    } else {
      createRealityModelTilesetFromUrl(url);
      return;
    }
  } catch (error) {
    throw error;
  }
}
