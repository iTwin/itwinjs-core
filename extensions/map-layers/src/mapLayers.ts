/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Localization } from "@itwin/core-common";
import { IModelApp, UserPreferencesAccess } from "@itwin/core-frontend";
import { MapLayersUiItemsProvider } from "./ui/MapLayersUiItemsProvider";
import { UiItemProviderOverrides, UiItemsManager } from "@itwin/appui-abstract";
import { FeatureInfoUiItemsProvider } from "./ui/FeatureInfoUiItemsProvider";
import { MapFeatureInfoOptions, MapLayerOptions } from "./ui/Interfaces";

export interface MapLayersConfig {
  localization?: Localization;
  /** If an iTwinConfig is provided, it will be used to load the MapLayerSources that are stored. */
  iTwinConfig?: UserPreferencesAccess;
  mapLayerOptions?: MapLayerOptions;
  featureInfoOpts?: MapFeatureInfoOptions;
  delayItemsProviderRegister?: boolean;
}
/** Configuration for registering UiItemsProviders for the MapLayers package */
export interface MapLayersUiProviderConfig {
  mapLayerProviderOverrides?: UiItemProviderOverrides; // eslint-disable-line deprecation/deprecation
  featureInfoProviderOverrides?: UiItemProviderOverrides; // eslint-disable-line deprecation/deprecation
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
  private static _uiItemsProvidersId: string[] = [];
  private static _iTwinConfig?: UserPreferencesAccess;
  private static _featureInfoOpts?: MapFeatureInfoOptions;
  private static  _mapLayerOptions?: MapLayerOptions;

  public static get iTwinConfig(): UserPreferencesAccess | undefined {
    return this._iTwinConfig;
  }

  /** Used to initialize the Map Layers */
  public static async initialize(config?: MapLayersConfig): Promise<void> {
    // register namespace containing localized strings for this package
    MapLayersUI.localization = config?.localization ?? IModelApp.localization;
    await MapLayersUI.localization.registerNamespace(
      MapLayersUI.localizationNamespace
    );

    MapLayersUI._iTwinConfig = config?.iTwinConfig;
    MapLayersUI._featureInfoOpts = config?.featureInfoOpts;
    MapLayersUI._mapLayerOptions = config?.mapLayerOptions;

    if (!config?.delayItemsProviderRegister)
      MapLayersUI.registerUiItemsProviders();
  }

  /** Registers the UiItemsProviders for MapLayers with optional overrides
   * This is useful for an app that wants to defer UiItemsProvider registration so that it
   * may limit the MapLayers widgets to a specific workflow
   * @beta
   */
  public static registerUiItemsProviders(config?: MapLayersUiProviderConfig) {
    const mlProvider = new MapLayersUiItemsProvider({ ...MapLayersUI._mapLayerOptions });
    const mlProviderId = config?.mapLayerProviderOverrides?.providerId ?? mlProvider.id;
    MapLayersUI._uiItemsProvidersId.push(mlProviderId);
    UiItemsManager.register(mlProvider, config?.mapLayerProviderOverrides); // eslint-disable-line deprecation/deprecation

    // Register the FeatureInfo widget only if MapHit was provided.
    if (MapLayersUI._featureInfoOpts?.onMapHit) {
      const fiProvider = new FeatureInfoUiItemsProvider({ ...MapLayersUI._featureInfoOpts });
      const fiProviderId = config?.featureInfoProviderOverrides?.providerId ?? fiProvider.id;
      MapLayersUI._uiItemsProvidersId.push(fiProviderId);
      UiItemsManager.register(fiProvider,  config?.featureInfoProviderOverrides); // eslint-disable-line deprecation/deprecation
    }
  }

  /** Unregisters internationalization service namespace and UiItemManager  */
  public static terminate() {
    IModelApp.localization.unregisterNamespace(MapLayersUI.localizationNamespace);

    MapLayersUI._uiItemsProvidersId.forEach((uiProviderId) => {
      UiItemsManager.unregister(uiProviderId); // eslint-disable-line deprecation/deprecation
    });
  }

  /** The internationalization service namespace. */
  public static get localizationNamespace(): string {
    return MapLayersUI._defaultNs;
  }
}
