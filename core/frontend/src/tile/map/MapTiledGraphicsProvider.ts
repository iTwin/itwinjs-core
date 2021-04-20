/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import { Id64String } from "@bentley/bentleyjs-core";
import { BackgroundMapSettings, MapImagerySettings, MapLayerSettings } from "@bentley/imodeljs-common";
import { MapLayerImageryProvider, Viewport } from "../../imodeljs-frontend";
import { TiledGraphicsProvider } from "../TiledGraphicsProvider";
import { TileTreeReference } from "../TileTreeReference";
import { MapTileTreeReference } from "./MapTileTree";

/** @internal */
export class MapTiledGraphicsProvider implements TiledGraphicsProvider {
  public readonly backgroundMap: MapTileTreeReference;
  public readonly overlayMap: MapTileTreeReference;
  public readonly  backgroundDrapeMap: MapTileTreeReference;

  public forEachTileTreeRef(viewport: Viewport, func: (ref: TileTreeReference) => void): void {
    if (viewport.viewFlags.backgroundMap) {
      func(this.backgroundMap);
      func(this.overlayMap);
    }
  }
  constructor(private readonly _vp: Viewport) {
    const displayStyle = _vp.displayStyle;
    const mapSettings = displayStyle.backgroundMapSettings;
    const mapImagery = displayStyle.settings.mapImagery;
    this.backgroundMap = new MapTileTreeReference(mapSettings, mapImagery.backgroundBase, mapImagery.backgroundLayers, displayStyle.iModel, _vp.viewportId, false, false, () => displayStyle.overrideTerrainDisplay());
    this.overlayMap = new MapTileTreeReference(mapSettings, undefined, mapImagery.overlayLayers, displayStyle.iModel, _vp.viewportId, true, false);
    this.backgroundDrapeMap = new MapTileTreeReference(mapSettings, mapImagery.backgroundBase, mapImagery.backgroundLayers, displayStyle.iModel,  _vp.viewportId, false, true);
    displayStyle.onMapSettingsChanged.addListener((settings: BackgroundMapSettings) => {
      const mapBase = MapLayerSettings.fromMapSettings(settings);
      this.backgroundMap.setBaseLayerSettings(mapBase);
      this.backgroundDrapeMap.setBaseLayerSettings(mapBase);
      this.backgroundMap.clearLayers();
      this.backgroundDrapeMap.clearLayers();
    });
    displayStyle.onMapImageryChanged.addListener((imagery: MapImagerySettings) => {
      this.backgroundMap.setBaseLayerSettings(imagery.backgroundBase);
      this.backgroundMap.setLayerSettings(imagery.backgroundLayers);
      this.backgroundDrapeMap.setBaseLayerSettings(mapImagery.backgroundBase);
      this.backgroundDrapeMap.setLayerSettings(mapImagery.backgroundLayers);
      this.overlayMap.setLayerSettings(imagery.overlayLayers);
    });
    displayStyle.settings.onBackgroundMapChanged.addListener((settings: BackgroundMapSettings) => {
      this.backgroundMap.settings = this.overlayMap.settings = settings;
      this.backgroundDrapeMap.settings = mapSettings;
    });
  }
  /** @internal */
  public getMapLayerImageryProvider(index: number, isOverlay: boolean): MapLayerImageryProvider | undefined {
    const imageryTreeRef = isOverlay ? this.overlayMap.getLayerImageryTreeRef(index) : this.backgroundMap.getLayerImageryTreeRef(index);
    return imageryTreeRef?.imageryProvider;
  }

  /** @internal */
  public mapLayerFromIds(mapTreeId: Id64String, layerTreeId: Id64String): MapLayerSettings | undefined {
    let mapLayer;
    if (undefined === (mapLayer = this.backgroundMap.layerFromTreeModelIds(mapTreeId, layerTreeId)))
      mapLayer = this.overlayMap.layerFromTreeModelIds(mapTreeId, layerTreeId);

    return mapLayer;
  }
}

