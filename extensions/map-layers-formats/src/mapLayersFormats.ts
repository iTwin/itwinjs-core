/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { IModelApp } from "@itwin/core-frontend";
import { ArcGisFeatureMapLayerFormat } from "./ArcGisFeature/ArcGisFeatureFormat";

/** Class used to load various providers in the registry
 * @beta
 */
export class MapLayersFormats {

  public static initialize() {
    IModelApp.mapLayerFormatRegistry.register(ArcGisFeatureMapLayerFormat);
  }
}
