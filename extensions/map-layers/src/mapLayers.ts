/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Extension, IModelApp } from "@bentley/imodeljs-frontend";
import { I18NNamespace } from "@bentley/imodeljs-i18n";
import { MapLayersUiItemsProvider } from "./ui/MapLayersUiItemsProvider";
import { UiItemsManager } from "@bentley/ui-abstract";

/**
 * MapLayersApi is use when the package is use as a dependency to another app and not used as an extension.
 * '''ts
 *  await MapLayersUI.initialize ();
 * '''
 * @beta
 */
export class MapLayersUI {
  private static _defaultNs = "mapLayers";

  /** Used to initialize the MapLayersAPI when used as a package. */
  public static async initialize(): Promise<void> {
    // register namespace containing localized strings for this package
    const namespace = IModelApp.i18n.registerNamespace(MapLayersUI._defaultNs);
    await namespace.readFinished;
    UiItemsManager.register(new MapLayersUiItemsProvider(IModelApp.i18n));
  }
}

/**
 * Extension that provides MapLayers widget
 */
class MapLayersExtension extends Extension {
  protected _defaultNs = "mapLayers";
  private _i18NNamespace?: I18NNamespace;
  /** The uiProvider will add a widget to any stage with its usage set to "General" in the host AppUi compatible application */
  public uiProvider?: MapLayersUiItemsProvider;

  public constructor(name: string) {
    super(name);
  }

  /** Invoked the first time this extension is loaded. */
  public async onLoad(_args: string[]): Promise<void> {
    this._i18NNamespace = this.i18n.getNamespace(this._defaultNs);
    await this._i18NNamespace!.readFinished;
    UiItemsManager.register(new MapLayersUiItemsProvider(this.i18n));
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
