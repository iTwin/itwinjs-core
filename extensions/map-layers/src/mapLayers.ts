/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { HitDetail, IModelApp, UserPreferencesAccess } from "@itwin/core-frontend";
import { FeatureInfoWidgetControl, MapLayersUiItemsProvider, MapLayersWidgetControl } from "./ui/MapLayersUiItemsProvider";
import { UiItemsManager } from "@itwin/appui-abstract";
import { ConfigurableUiManager } from "@itwin/appui-react";
import { BeEvent } from "@itwin/core-bentley";

export type IdentifyHitEvent = BeEvent<(hit: HitDetail) => void>;
/** MapLayersUI is use when the package is used as a dependency to another app.
 * '''ts
 *  await MapLayersUI.initialize(registerItemsProvider);
 * '''
 * @beta
 */
export class MapLayersUI {
  private static _defaultNs = "mapLayers";
  private static _uiItemsProvider: MapLayersUiItemsProvider;

  private static _iTwinConfig?: UserPreferencesAccess;
  private static _onIdentifyHit?: IdentifyHitEvent;

  public static get iTwinConfig(): UserPreferencesAccess | undefined { return this._iTwinConfig; }
  public static get onIdentifyHit(): IdentifyHitEvent | undefined { return this._onIdentifyHit; }

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
  public static async initialize(registerItemsProvider = true, iTwinConfig?: UserPreferencesAccess, onIdentifyHit?: IdentifyHitEvent): Promise<void> {
    MapLayersUI._iTwinConfig = iTwinConfig;
    MapLayersUI._onIdentifyHit = onIdentifyHit;

    // register namespace containing localized strings for this package
    await IModelApp.localization.registerNamespace(this.localizationNamespace);

    // _uiItemsProvider always created to provide access to localization.
    MapLayersUI._uiItemsProvider = new MapLayersUiItemsProvider(IModelApp.localization);
    if (registerItemsProvider)
      UiItemsManager.register(MapLayersUI._uiItemsProvider);
    else
      ConfigurableUiManager.registerControl(MapLayersWidgetControl.id, MapLayersWidgetControl);

    ConfigurableUiManager.registerControl(FeatureInfoWidgetControl.id, FeatureInfoWidgetControl);
  }

  /** Unregisters the GeoTools internationalization service namespace */
  public static terminate() {
    IModelApp.localization.unregisterNamespace(this.localizationNamespace);
  }

  /** The internationalization service namespace. */
  public static get localizationNamespace(): string {
    return this._defaultNs;
  }
}
