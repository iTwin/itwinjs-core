/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import { Id64String } from "@itwin/core-bentley";
import { MapImagerySettings, MapLayerSettings } from "@itwin/core-common";
import { Viewport } from "../../Viewport";
import { ViewState } from "../../ViewState";
import { MapLayerImageryProvider, MapTileTreeReference, TiledGraphicsProvider, TileTreeReference } from "../internal";

/** @internal */
export class MapTiledGraphicsProvider implements TiledGraphicsProvider {
  public readonly backgroundMap: MapTileTreeReference;
  public readonly overlayMap: MapTileTreeReference;
  public readonly backgroundDrapeMap: MapTileTreeReference;
  private readonly _detachFromDisplayStyle: VoidFunction[] = [];

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
    this.backgroundDrapeMap = new MapTileTreeReference(mapSettings, mapImagery.backgroundBase, mapImagery.backgroundLayers, displayStyle.iModel, _vp.viewportId, false, true);

    const removals = this._detachFromDisplayStyle;
    removals.push(displayStyle.settings.onBackgroundMapChanged.addListener((settings) => {
      this.backgroundMap.settings = settings;
      this.overlayMap.settings = settings;
      this.backgroundDrapeMap.settings = settings;
    }));

    removals.push(displayStyle.settings.onMapImageryChanged.addListener((imagery: Readonly<MapImagerySettings>) => {
      this.backgroundMap.setBaseLayerSettings(imagery.backgroundBase);
      this.backgroundMap.setLayerSettings(imagery.backgroundLayers);
      this.backgroundDrapeMap.setBaseLayerSettings(mapImagery.backgroundBase);
      this.backgroundDrapeMap.setLayerSettings(mapImagery.backgroundLayers);
      this.overlayMap.setLayerSettings(imagery.overlayLayers);
    }));
  }

  // This is used in inital view setup and when views are synchronized.  If view is being synchronized
  // we need to clear the layers which purges tile graphics if the settings or layers are changed.
  public setView(newView: ViewState) {
    const layersMatch = ((layers1: MapLayerSettings[], layers2: MapLayerSettings[]): boolean => {
      if (layers1.length !== layers2.length)
        return false;

      for (let i = 0; i < layers1.length; i++)
        if (!layers1[i].displayMatches(layers2[i]))
          return false;

      return true;
    });
    const mapImagery = newView.displayStyle.settings.mapImagery;
    if (!newView.displayStyle.backgroundMapSettings.equals(this.backgroundMap.settings)
      || !layersMatch(mapImagery.backgroundLayers, this.backgroundMap.layerSettings)
      || (mapImagery.backgroundBase instanceof MapLayerSettings && !layersMatch([mapImagery.backgroundBase], this.backgroundDrapeMap.layerSettings))) {
      this.backgroundMap.clearLayers();
      this.backgroundDrapeMap.clearLayers();
    }
    if (!layersMatch(mapImagery.overlayLayers, this.overlayMap.layerSettings))
      this.overlayMap.clearLayers();
  }

  public detachFromDisplayStyle(): void {
    this._detachFromDisplayStyle.forEach((f) => f());
    this._detachFromDisplayStyle.length = 0;
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

