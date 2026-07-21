/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module MapLayersFormats
 */
import { assert } from "@itwin/core-bentley";
import { Localization } from "@itwin/core-common";
import { IModelApp } from "@itwin/core-frontend";
import { ArcGisFeatureMapLayerFormat } from "./ArcGisFeature/ArcGisFeatureFormat.js";
import { AzureMapsMapLayerFormat } from "./AzureMaps/AzureMapsImageryFormat.js";
import { GoogleMapsMapLayerFormat } from "./GoogleMaps/GoogleMapsImageryFormat.js";
import { OgcApiFeaturesMapLayerFormat } from "./OgcApiFeatures/OgcApiFeaturesFormat.js";
import { MapFeatureInfoTool } from "./Tools/MapFeatureInfoTool.js";
import { GoogleMapsSessionManager } from "./GoogleMaps/GoogleMapsSession.js";

/** Configuration options.
 * @beta
 */
export interface MapLayersFormatsConfig {
  localization?: Localization;
  googleMapsOpts?: GoogleMapsOptions;
  /** Azure Maps options. */
  azureMapsOpts?: AzureMapsOptions;
}

/** Google Maps options.
 * @beta
 */
export interface GoogleMapsOptions {
  sessionManager?: GoogleMapsSessionManager
}

/** Azure Maps options.
 * @beta
 */
export interface AzureMapsOptions {
  /** Azure Maps subscription key used when a layer does not supply its own access key. */
  subscriptionKey?: string;
}

/** The primary API for the `@itwin/map-layers-formats` package. It allows the package's features to be [[initialize]]d.
 * @beta
 */
export class MapLayersFormats {

  private static _defaultNs = "mapLayersFormats";
  public static localization: Localization;

  private static _googleMapsOpts?: GoogleMapsOptions;
  private static _azureMapsOpts?: AzureMapsOptions;

  /** Registers the [MapLayerFormat]($frontend)s provided by this package for use with [IModelApp]($frontend).
   * Typically, an application will call `MapLayersFormats.initialize` immediately after [IModelApp.startup]($frontend).
   * This function has no effect if called **before** [IModelApp.startup]($frontend) or **after** [IModelApp.shutdown]($frontend).
   */
  public static async initialize(config?: MapLayersFormatsConfig): Promise<void> {
    assert(IModelApp.initialized, "MapLayersFormats.initialize must be called after IModelApp.startup and before IModelApp.shutdown");
    if (IModelApp.initialized) {
      IModelApp.mapLayerFormatRegistry.register(ArcGisFeatureMapLayerFormat);
      IModelApp.mapLayerFormatRegistry.register(OgcApiFeaturesMapLayerFormat);
      IModelApp.mapLayerFormatRegistry.register(GoogleMapsMapLayerFormat);
      IModelApp.mapLayerFormatRegistry.register(AzureMapsMapLayerFormat);
    }

    // register namespace containing localized strings for this package
    MapLayersFormats.localization = config?.localization ?? IModelApp.localization;
    await MapLayersFormats.localization.registerNamespace(
      MapLayersFormats.localizationNamespace,
    );

    MapFeatureInfoTool.register(MapLayersFormats.localizationNamespace);
    MapLayersFormats._googleMapsOpts = config?.googleMapsOpts;
    MapLayersFormats._azureMapsOpts = config?.azureMapsOpts;
  }

  /** The internationalization service namespace. */
  public static get localizationNamespace(): string {
    return MapLayersFormats._defaultNs;
  }

  public static get googleMapsOpts() {
    return MapLayersFormats._googleMapsOpts;
  }

  /** Azure Maps options supplied during initialization. */
  public static get azureMapsOpts() {
    return MapLayersFormats._azureMapsOpts;
  }

}
