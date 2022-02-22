/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { HitDetail, IModelApp, UserPreferencesAccess } from "@itwin/core-frontend";
import { MapLayersUiItemsProvider } from "./ui/MapLayersUiItemsProvider";
import { UiItemsManager } from "@itwin/appui-abstract";
import { BeEvent } from "@itwin/core-bentley";
import { FeatureInfoUiItemsProvider } from "./ui/FeatureInfoUiItemsProvider";

export type MapHitEvent = BeEvent<(hit: HitDetail) => void>;
export interface FeatureInfoOpts
{
  // HitDetail Event whenever the map is clicked.
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
  private static _mapLayersItemsProvider: MapLayersUiItemsProvider;
  private static _mapFeatureInfoItemsProvider: FeatureInfoUiItemsProvider;
  private static _uiItemsProvider: MapLayersUiItemsProvider;
  private static _itemsProviderRegistered?: boolean;

  private static _iTwinConfig?: UserPreferencesAccess;
  private static _onMapHit?: MapHitEvent;

  public static get iTwinConfig(): UserPreferencesAccess | undefined { return this._iTwinConfig; }
  public static get onMapHit(): MapHitEvent | undefined { return this._onMapHit; }

  /** Used to initialize the Map Layers.
   *
   * If `registerItemsProvider` is true, the UiItemsProvider will automatically insert the UI items into the host applications UI.
   * If it is false, explicitly add widget definition to a specific FrontStage definition using the following syntax.
   *
   *   ```tsx
   *   <Widget id={MapLayersWidgetControl.id} label={MapLayersWidgetControl.label} control={MapLayersWidgetControl}
   *   iconSpec={MapLayersWidgetControl.iconSpec} />,
   *   ```
   *
   * If an iTwinConfig is provided, it will be used to load the MapLayerSources that are stored.
   */
  public static async initialize(
    registerItemsProvider = true,
    iTwinConfig?: UserPreferencesAccess,
    fInfoOps?: FeatureInfoOpts
  ): Promise<void> {

    MapLayersUI._iTwinConfig = iTwinConfig;
    MapLayersUI._onMapHit = fInfoOps?.onMapHit;

    // register namespace containing localized strings for this package
    await IModelApp.localization.registerNamespace(this.localizationNamespace);

    // _uiItemsProvider always created to provide access to localization.
    MapLayersUI._mapLayersItemsProvider = new MapLayersUiItemsProvider(IModelApp.localization);
    MapLayersUI._mapFeatureInfoItemsProvider = new FeatureInfoUiItemsProvider(IModelApp.localization);
    if (registerItemsProvider) {
      UiItemsManager.register(MapLayersUI._mapLayersItemsProvider);

      // Register the FeatureInfo widget only if MapHit was provided.
      if (MapLayersUI._onMapHit) {
        UiItemsManager.register(MapLayersUI._mapFeatureInfoItemsProvider);
      }
    }

    MapLayersUI._itemsProviderRegistered = registerItemsProvider;
  }

  /** Unregisters internationalization service namespace and UiItemManager / control */
  public static terminate() {
    IModelApp.localization.unregisterNamespace(this.localizationNamespace);

    if (MapLayersUI._itemsProviderRegistered !== undefined) {
      if (MapLayersUI._itemsProviderRegistered) {
        UiItemsManager.unregister(MapLayersUI._mapLayersItemsProvider.id);

        if (MapLayersUI._onMapHit) {
          UiItemsManager.unregister(MapLayersUI._mapFeatureInfoItemsProvider.id);
        }
      }
      MapLayersUI._itemsProviderRegistered = undefined;
    }
  }

  /** The internationalization service namespace. */
  public static get localizationNamespace(): string {
    return this._defaultNs;
  }
}
