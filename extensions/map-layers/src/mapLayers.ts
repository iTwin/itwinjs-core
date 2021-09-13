/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Extension, IModelApp } from "@bentley/imodeljs-frontend";
import { LocalizationNamespace, LocalizationProvider } from "@bentley/imodeljs-i18n";
import { MapLayersUiItemsProvider, MapLayersWidgetControl } from "./ui/MapLayersUiItemsProvider";
import { UiItemsManager } from "@bentley/ui-abstract";
import { ConfigurableUiManager } from "@bentley/ui-framework";

/**
 * MapLayersApi is use when the package is used as a dependency to another app and not used as an extension.
 * '''ts
 *  // if registerItemsProvider is false the MapLayersWidgetControl control will be registered with ui-framework's ConfigurableUiManager
 *  // so it can be explicitly added to a stage via a FrontstageDef.
 *  await MapLayersUI.initialize (registerItemsProvider);
 * '''
 * @beta
 */
export class MapLayersUI {
  private static _localizationProvider?: LocalizationProvider;
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
  public static async initialize(registerItemsProvider = true, localizationProvider?: LocalizationProvider): Promise<void> {
    // register namespace containing localized strings for this package
    this._localizationProvider = (localizationProvider ? localizationProvider : IModelApp.localizationProvider);
    const namespace = this._localizationProvider.registerNamespace(this.localizationNamespace);
    await namespace?.readFinished;

    // _uiItemsProvider always created to provide access to localizationProvider.
    MapLayersUI._uiItemsProvider = new MapLayersUiItemsProvider(this._localizationProvider);
    if (registerItemsProvider)
      UiItemsManager.register(MapLayersUI._uiItemsProvider);
    else
      ConfigurableUiManager.registerControl(MapLayersWidgetControl.id, MapLayersWidgetControl);
  }

  /** Unregisters the GeoTools internationalization service namespace */
  public static terminate() {
    if (MapLayersUI._localizationProvider)
      MapLayersUI._localizationProvider.unregisterNamespace(this.localizationNamespace);
    MapLayersUI._localizationProvider = undefined;
  }

  /** The internationalization service namespace. */
  public static get localizationNamespace(): string {
    return this._defaultNs;
  }
}

/**
 * Extension that provides MapLayers widget
 */
class MapLayersExtension extends Extension {
  private _localizationNamespace?: LocalizationNamespace;
  /** The uiProvider will add a widget to any stage with its usage set to "General" in the host AppUi compatible application */
  public uiProvider?: MapLayersUiItemsProvider;

  public constructor(name: string) {
    super(name);
  }

  /** Invoked the first time this extension is loaded. */
  public override async onLoad(_args: string[]): Promise<void> {
    this._localizationNamespace = this.localizationProvider.getNamespace(MapLayersUI.localizationNamespace);
    await this._localizationNamespace?.readFinished;
    UiItemsManager.register(new MapLayersUiItemsProvider(this.localizationProvider));
  }

  /** Invoked each time this extension is loaded. */
  public async onExecute(_args: string[]): Promise<void> {
  }
}

// extensionAdmin is undefined if an application is using it as a package and it is loaded prior to IModelApp defining extensionAdmin
if (IModelApp.extensionAdmin) {
  // Register the extension with the extensionAdmin.
  IModelApp.extensionAdmin.register(new MapLayersExtension("map-layers"));
}
