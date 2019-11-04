/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { compareNumbers } from "@bentley/bentleyjs-core";
import {
  createTileTreeFromImageryProvider,
  ImageryProviderEPSG3857,
  IModelApp,
  IModelConnection,
  MapTileTreeReference,
  NotifyMessageDetails,
  OutputMessagePriority,
  Plugin,
  PluginAdmin,
  ScreenViewport,
  TiledGraphicsProvider,
  TileTree,
  Viewport,
} from "@bentley/imodeljs-frontend";
import { I18N, I18NNamespace } from "@bentley/imodeljs-i18n";

const enum WMSImageryType { Temperature, Precipitation }

/** Supplies imagery based on weather forecast. */
class WMSImageryProvider extends ImageryProviderEPSG3857 {
  private _baseUrl: string;
  private _copyrightMessage?: HTMLElement;

  constructor(imageryType: WMSImageryType, private _i18n: I18N, private _i18NNamespace: I18NNamespace, private _logoImage?: HTMLImageElement) {
    super();

    // this url should be generated from a user interface that allows selection of forecast parameters.
    const date: Date = new Date();
    date.setDate(date.getDate() - 1);
    const timeString = date.toISOString();
    this._baseUrl = "";

    if (WMSImageryType.Temperature === imageryType) {
      this._baseUrl =
        "http://wms.actionmodulers.com/wms/wms?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&FORMAT=image%2Fpng&" +
        `TRANSPARENT=true&LAYERS=TM_WORLD_BORDERS-0.3%2CHRRR_USA_0.03_SubHourly%20%5Bair%20temperature%5D&TILED=true&MAP_TYPE=DEF&TIME=${timeString}` +
        "&WIDTH=256&HEIGHT=256&CRS=EPSG%3A3857&STYLES=&BBOX={BoundingBox}";
    } else {
      this._baseUrl =
        "http://wms.actionmodulers.com/wms/wms?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&FORMAT=image%2Fpng&" +
        `TRANSPARENT=true&LAYERS=TM_WORLD_BORDERS-0.3%2CHRRR_USA_0.03_SubHourly%20%5Bprecipitation%5D&TILED=true&MAP_TYPE=DEF&TIME=${timeString}` +
        "&WIDTH=256&HEIGHT=256&CRS=EPSG%3A3857&STYLES=&BBOX={BoundingBox}";
    }
  }

  public get tileWidth(): number { return 256; }
  public get tileHeight(): number { return 256; }
  public get minimumZoomLevel(): number { return 4; }
  public get maximumZoomLevel(): number { return 20; }

  // construct the Url from the desired Tile
  public constructUrl(row: number, column: number, zoomLevel: number): string {
    const tileExtent = this.getEPSG3857Extent(row, column, zoomLevel);
    const bboxString = `${tileExtent.left},${tileExtent.bottom},${tileExtent.right},${tileExtent.top}`;

    // from the template url, construct the tile url.
    return this._baseUrl.replace("{BoundingBox}", bboxString);
  }

  /** Supplies a logo to be displayed in the Viewport whenever imagery from this provider is displayed. */
  public getCopyrightImage(_tileProvider: MapTileTreeReference): HTMLImageElement | undefined { return this._logoImage; }

  /** Supplies a copyright message to be displayed in the Viewport whenever imagery from this provider is displayed. */
  public getCopyrightMessage(_tileProvider: MapTileTreeReference, _viewport: ScreenViewport): HTMLElement | undefined {
    return this._copyrightMessage!;
  }

  /** Initialize the copyright info. */
  public async initialize(): Promise<void> {
    const copyrightElement: HTMLSpanElement = document.createElement("span");
    copyrightElement.className = "bgmap-copyright";
    await this._i18NNamespace.readFinished;
    copyrightElement.innerText = this._i18n.translate("WmsPlugin:Messages.Copyright");
    this._copyrightMessage = copyrightElement;
  }
}

/** Supplies a TileTree that can load and draw tiles based on our imagery provider.
 * The TileTree is uniquely identified by its imagery type.
 */
class WMSTreeSupplier implements TileTree.Supplier {
  private readonly _plugin: WMSPlugin;

  public constructor(plugin: WMSPlugin) {
    this._plugin = plugin;
  }

  /** Return a numeric value indicating how two tree IDs are ordered relative to one another.
   * This allows the ID to serve as a lookup key to find the corresponding TileTree.
   */
  public compareTileTreeIds(lhs: WMSImageryType, rhs: WMSImageryType): number {
    return compareNumbers(lhs, rhs);
  }

  /** The first time a tree of a particular imagery type is requested, this function creates it. */
  public async createTileTree(type: WMSImageryType, iModel: IModelConnection): Promise<TileTree | undefined> {
    return createTileTreeFromImageryProvider(this._plugin.imageryProviders[type], 0.0, false, iModel);
  }
}

/** A reference to one of our tile trees. The specific TileTree drawn may change when the desired imagery type or target iModel changes. */
class WMSTreeRef extends MapTileTreeReference {
  private readonly _plugin: WMSPlugin;
  public iModel: IModelConnection;

  public constructor(plugin: WMSPlugin, iModel: IModelConnection) {
    super();
    this._plugin = plugin;
    this.iModel = iModel;
  }

  /** Draw our tiles on top of all other geometry (semi-transparent). */
  protected get _graphicType() { return TileTree.GraphicType.Overlay; }
  /** Draw our tiles at sea level. */
  protected get _groundBias() { return 0.0; }
  protected get _imageryProvider() { return this._plugin.currentImageryProvider; }
  protected get _transparency() { return 0.7; }

  /** Return the owner of the TileTree to draw. */
  public get treeOwner(): TileTree.Owner {
    return this.iModel.tiles.getTileTreeOwner(this._plugin.currentImageryType, this._plugin.treeSupplier);
  }
}

/** Integrates with a Viewport to inject our own tiled graphics for display. */
class WMSGraphicsProvider implements TiledGraphicsProvider {
  private readonly _tree: WMSTreeRef;

  public constructor(iModel: IModelConnection, plugin: WMSPlugin) {
    this._tree = new WMSTreeRef(plugin, iModel);
  }

  /** Returns the tree containing the tiles to be drawn in the specified viewport. */
  public forEachTileTreeRef(vp: Viewport, func: (ref: TileTree.Reference) => void): void {
    // In case the user opened a view from a different iModel, make sure the tree reference uses the current iModel.
    this._tree.iModel = vp.iModel;
    func(this._tree);
  }
}

class WMSPlugin extends Plugin {
  public readonly imageryProviders: WMSImageryProvider[] = [];
  public readonly treeSupplier: TileTree.Supplier;
  private _currentImageryType = WMSImageryType.Precipitation;
  private _i18NNamespace?: I18NNamespace;
  private _logoImage?: HTMLImageElement;
  private _graphicsProvider?: WMSGraphicsProvider;

  public get currentImageryType() { return this._currentImageryType; }
  public get currentImageryProvider() { return this.imageryProviders[this.currentImageryType]; }

  public constructor(name: string) {
    super(name);
    this.treeSupplier = new WMSTreeSupplier(this);
  }

  /** Invoked the first time this plugin is loaded. */
  public onLoad(_args: string[]): void {
    this._i18NNamespace = this.i18n.registerNamespace("WmsPlugin");
    this._logoImage = new Image();
    this._logoImage.src = this.resolveResourceUrl("wmsPlugin.svg");
    this._logoImage.width = this._logoImage.height = 64;

    this.imageryProviders.push(new WMSImageryProvider(WMSImageryType.Temperature, this.i18n, this._i18NNamespace, this._logoImage));
    this.imageryProviders.push(new WMSImageryProvider(WMSImageryType.Precipitation, this.i18n, this._i18NNamespace, this._logoImage));
  }

  /** Invoked each time this plugin is loaded. */
  public onExecute(_args: string[]): void {
    const selectedView: ScreenViewport | undefined = IModelApp.viewManager.selectedView;
    if (undefined === selectedView)
      return;

    if (undefined === this._graphicsProvider)
      this._graphicsProvider = new WMSGraphicsProvider(selectedView.iModel, this);

    // Register our provider to supply tiles into the selected viewport (if not already registered)
    selectedView.addTiledGraphicsProvider(this._graphicsProvider);

    // For demonstration purposes, switch the imagery type each time the plugin is loaded.
    this._currentImageryType = (WMSImageryType.Temperature === this._currentImageryType) ? WMSImageryType.Precipitation : WMSImageryType.Temperature;

    // Output a message indicating the current imagery type.
    const weatherType = (WMSImageryType.Temperature === this._currentImageryType) ? "temperature" : "precipitation";
    this._i18NNamespace!.readFinished.then(() => {
      const message: string = this.i18n.translate("WmsPlugin:Messages.DisplayType", { weatherType });
      const msgDetails: NotifyMessageDetails = new NotifyMessageDetails(OutputMessagePriority.Info, message);
      IModelApp.notifications.outputMessage(msgDetails);
    }).catch(() => { });
  }
}

declare var PLUGIN_NAME: string;

PluginAdmin.register(new WMSPlugin(PLUGIN_NAME));
