/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { Logger} from "@itwin/core-bentley";
import { IModelApp } from "@itwin/core-frontend";
import { obtainGeoscienceTilesetUrl } from "./GraphicsProvider";
import { loggerCategory} from "../LoggerCategory";

export interface InitGeoscienceTilesArgs {
  /** The token used to access the mesh export service. */
  accessToken: string;

  organizationId: string;

  workspaceId: string;

  geoscienceObjectId: string;
}

/** Initialize the geoscience tiles.
 * @beta
 */
export async function initializeGeoscienceTiles(args: InitGeoscienceTilesArgs): Promise<void> {
  const url = await obtainGeoscienceTilesetUrl(args);
  if (!url) {
    Logger.logInfo(loggerCategory, `No data available for Geoscience Object ${args.geoscienceObjectId}`);
    return;
  }
  const vp = IModelApp.viewManager.selectedView;
  if (!vp) {
    Logger.logInfo(loggerCategory, "Reality Model not succesfully attached.");
    return;
  }

  vp.displayStyle.attachRealityModel({tilesetUrl: url});
}
