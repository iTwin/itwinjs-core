/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { Logger } from "@itwin/core-bentley";
import { IModelApp } from "@itwin/core-frontend";
import { loggerCategory } from "../../LoggerCategory";

/** Initialize the 3d Tiles Tileset.
 * @beta
 */
export async function initRealityDataTilesetFromUrl(url: string) {
  const vp = IModelApp.viewManager.selectedView;
  if (!vp) {
    Logger.logInfo(loggerCategory, "Reality Model not successfully attached.");
    return;
  }

  vp.displayStyle.attachRealityModel({ tilesetUrl: url });
}
