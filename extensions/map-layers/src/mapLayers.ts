/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { IModelApp } from "@itwin/core-frontend";
import { MapLayersUiItemsProvider, MapLayersWidgetControl } from "./ui/MapLayersUiItemsProvider";
import { UiItemsManager } from "@itwin/appui-abstract";
import { ConfigurableUiManager } from "@itwin/appui-react";

/**
 * MapLayersApi is use when the package is used as a dependency to another app and not used as an extension.
 * '''ts
 *  // if registerItemsProvider is false the MapLayersWidgetControl control will be registered with appui-react's ConfigurableUiManager
 *  // so it can be explicitly added to a stage via a FrontstageDef.
 *  await MapLayersUI.initialize (registerItemsProvider);
 * '''
 * @beta
 */
export class MapLayersUI {
  private static _defaultNs = "mapLayers";
  private static _uiItemsProvider: MapLayersUiItemsProvider;

  /** Used to initialize the MapLayersAPI when used as a package. If `registerItemsProvider` is true then the
   * UiItemsProvider will automatically insert the UI items into the host applications UI. If it is false then
   * explicitly add widget definition to a specific FrontStage definition using the following syntax.
   * ``` tsx
   * <Widget id={MapLayersWidgetControl.id} label={MapLayersWidgetControl.label} control={MapLayersWidgetControl}
   *   iconSpec={MapLayersWidgetControl.iconSpec} />,
   * ```
   */
  public static async initialize(registerItemsProvider = true): Promise<void> {
    // register namespace containing localized strings for this package
    await IModelApp.localization.registerNamespace(this.localizationNamespace);

    // _uiItemsProvider always created to provide access to localization.
    MapLayersUI._uiItemsProvider = new MapLayersUiItemsProvider(IModelApp.localization);
    if (registerItemsProvider)
      UiItemsManager.register(MapLayersUI._uiItemsProvider);
    else
      ConfigurableUiManager.registerControl(MapLayersWidgetControl.id, MapLayersWidgetControl);
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
