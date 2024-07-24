/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { Logger } from "@itwin/core-bentley";
import { IModelApp } from "@itwin/core-frontend";
import { loggerCategory } from "../../LoggerCategory";
import { BaseGeoscienceArgs, getGeoscienceTilesetUrl } from "../url-providers/GeoscienceUrlProvider";

/**
 * Represents the arguments required to initialize geoscience tileset.
 * @alpha
 */
export type AttachGeoscienceTilesetArgs = BaseGeoscienceArgs;

/** Initialize the geoscience tileset by attaching it as a Reality Model.
 * @alpha
 */
export async function attachGeoscienceTileset(args: AttachGeoscienceTilesetArgs): Promise<void> {
  try {
    const url = await getGeoscienceTilesetUrl(args);
    if (!url) {
      Logger.logInfo(loggerCategory, `No data available for Geoscience Object ${args.geoscienceObjectId}`);
      return;
    } else {
      const vp = IModelApp.viewManager.selectedView;
      if (!vp) {
        Logger.logInfo(loggerCategory, "Reality Model not successfully attached.");
        return;
      }

      vp.displayStyle.attachRealityModel({ tilesetUrl: url });
      return;
    }
  } catch (error) {
    throw error;
  }
}
