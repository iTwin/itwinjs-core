/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Localization } from "@itwin/core-common";
import {
  HitDetail,
  IModelApp,
  UserPreferencesAccess,
} from "@itwin/core-frontend";
import { MapLayersUiItemsProvider } from "./ui/MapLayersUiItemsProvider";
import { UiItemsManager, UiItemsProvider } from "@itwin/appui-abstract";
import { BeEvent } from "@itwin/core-bentley";
import { FeatureInfoUiItemsProvider } from "./ui/FeatureInfoUiItemsProvider";
import { MapFeatureInfoOptions, MapLayerOptions } from "./ui/Interfaces";

export type MapHitEvent = BeEvent<(hit: HitDetail) => void>;

export interface MapLayersConfig {
  localization?: Localization;
  /** If an iTwinConfig is provided, it will be used to load the MapLayerSources that are stored. */
  iTwinConfig?: UserPreferencesAccess;
  /**
   * HitDetail Event whenever the map is clicked.
   * Typically the HitDetail object is provided by ElementLocateManager.doLocate.
   * Every time this event is raised, FeatureInfoWidget will attempt to retrieve data from MapLayerImageryProviders.
   */
  onMapHit?: MapHitEvent;
  mapLayerOptions?: MapLayerOptions;
  featureInfoOpts?: MapFeatureInfoOptions;
}

/** MapLayersUI is use when the package is used as a dependency to another app.
 * '''ts
 *  await MapLayersUI.initialize({...MapLayersInitProps});
 * '''
 * @beta
 */
export class MapLayersUI {
  private static _defaultNs = "mapLayers";
  public static localization: Localization;
  private static _uiItemsProviders: UiItemsProvider[] = [];

  private static _iTwinConfig?: UserPreferencesAccess;
  private static _onMapHit?: MapHitEvent;

  public static get iTwinConfig(): UserPreferencesAccess | undefined {
    return this._iTwinConfig;
  }
  public static get onMapHit(): MapHitEvent | undefined {
    return this._onMapHit;
  }

  /** Used to initialize the Map Layers */
  public static async initialize(config?: MapLayersConfig): Promise<void> {
    // register namespace containing localized strings for this package
    MapLayersUI.localization = config?.localization ?? IModelApp.localization;
    await MapLayersUI.localization.registerNamespace(
      MapLayersUI.localizationNamespace
    );

    MapLayersUI._iTwinConfig = config?.iTwinConfig;
    MapLayersUI._onMapHit = config?.onMapHit;

    MapLayersUI._uiItemsProviders.push(
      new MapLayersUiItemsProvider({ ...config?.mapLayerOptions })
    );

    // Register the FeatureInfo widget only if MapHit was provided.
    if (config?.onMapHit) {
      MapLayersUI._uiItemsProviders.push(
        new FeatureInfoUiItemsProvider({ ...config?.featureInfoOpts })
      );
    }

    MapLayersUI._uiItemsProviders.forEach((uiProvider) => {
      UiItemsManager.register(uiProvider);
    });
  }

  /** Unregisters internationalization service namespace and UiItemManager  */
  public static terminate() {
    IModelApp.localization.unregisterNamespace(MapLayersUI.localizationNamespace);

    MapLayersUI._uiItemsProviders.forEach((uiProvider) => {
      UiItemsManager.unregister(uiProvider.id);
    });
  }

  /** The internationalization service namespace. */
  public static get localizationNamespace(): string {
    return MapLayersUI._defaultNs;
  }
}
