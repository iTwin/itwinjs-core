/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { Logger } from "@itwin/core-bentley";
import { loggerCategory } from "../../LoggerCategory";
import { BaseGeoscienceArgs, obtainGeoscienceTilesetUrl } from "../providers/GeoscienceTileset";
import { initRealityDataTilesetFromUrl } from "./RealityModelTileset";
/**
 * Represents the arguments required to initialize geoscience tileset.
 * @beta
 */
export interface InitGeoscienceTilesArgs extends BaseGeoscienceArgs { };

/** Initialize the geoscience tileset.
 * @beta
 */
export async function initGeoscienceTileset(args: InitGeoscienceTilesArgs): Promise<void> {
  try {
    const url = await obtainGeoscienceTilesetUrl(args);
    if (!url) {
      Logger.logInfo(loggerCategory, `No data available for Geoscience Object ${args.geoscienceObjectId}`);
      return;
    } else {
      initRealityDataTilesetFromUrl(url);
      return;
    }
  } catch (error) {
    throw error;
  }
}
