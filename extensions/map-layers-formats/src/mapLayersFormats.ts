/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module MapLayersFormats
 */
import { assert } from "@itwin/core-bentley";
import { IModelApp } from "@itwin/core-frontend";
import { ArcGisFeatureMapLayerFormat } from "./ArcGisFeature/ArcGisFeatureFormat";

/** The primary API for the `@itwin/map-layers-formats` package. It allows the package's features to be [[initialize]]d.
 * @beta
 */
export class MapLayersFormats {
  /** Registers the [MapLayerFormat]($frontend)s provided by this package for use with [IModelApp]($frontend).
   * Typically, an application will call `MapLayersFormats.initialize` immediately after [IModelApp.startup]($frontend).
   * This function has no effect if called **before** [IModelApp.startup]($frontend) or **after** [IModelApp.shutdown]($frontend).
   */
  public static initialize() {
    assert(IModelApp.initialized, "MapLayersFormats.initialize must be called after IModelApp.startup and before IModelApp.shutdown");
    if (IModelApp.initialized)
      IModelApp.mapLayerFormatRegistry.register(ArcGisFeatureMapLayerFormat);
  }
}
