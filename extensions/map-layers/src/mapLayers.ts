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

export type MapHitEvent = BeEvent<(hit: HitDetail) => void>;
export interface FeatureInfoOpts {
  // HitDetail Event whenever the map is clicked. t
  // Typically the HitDetail object is provided by ElementLocateManager.doLocate.
  // Every time this event is raised, FeatureInfoWidget will attempt to retrieve data from MapLayerImageryProviders.
  onMapHit: MapHitEvent;
}

/** MapLayersUI is use when the package is used as a dependency to another app.
 * '''ts
 *  await MapLayersUI.initialize(registerItemsProvider);
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

  /** Used to initialize the Map Layers.
   *
   * If an iTwinConfig is provided, it will be used to load the MapLayerSources that are stored.
   */
  public static async initialize(
    localization?: Localization,
    iTwinConfig?: UserPreferencesAccess,
    fInfoOps?: FeatureInfoOpts
  ): Promise<void> {
    // register namespace containing localized strings for this package
    MapLayersUI.localization = localization ?? IModelApp.localization;
    await MapLayersUI.localization.registerNamespace(this.localizationNamespace);

    MapLayersUI._iTwinConfig = iTwinConfig;

    MapLayersUI._uiItemsProviders.push(
      new MapLayersUiItemsProvider(MapLayersUI.localization)
    );

    // Register the FeatureInfo widget only if MapHit was provided.
    if (fInfoOps?.onMapHit) {
      MapLayersUI._uiItemsProviders.push(new FeatureInfoUiItemsProvider());
    }

    MapLayersUI._uiItemsProviders.forEach((uiProvider) => {
      UiItemsManager.register(uiProvider);
    });
  }

  /** Unregisters internationalization service namespace and UiItemManager / control */
  public static terminate() {
    IModelApp.localization.unregisterNamespace(this.localizationNamespace);

    MapLayersUI._uiItemsProviders.forEach((uiProvider) => {
      UiItemsManager.unregister(uiProvider.id);
    });
  }

  /** The internationalization service namespace. */
  public static get localizationNamespace(): string {
    return this._defaultNs;
  }
}
