/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import { Id64String } from "@bentley/bentleyjs-core";
import { BackgroundMapSettings, MapImagerySettings, MapLayerSettings } from "@bentley/imodeljs-common";
import { MapLayerImageryProvider, MapTileTree, Viewport } from "../../imodeljs-frontend";
import { TiledGraphicsProvider } from "../TiledGraphicsProvider";
import { TileTreeReference } from "../TileTreeReference";
import { MapTileTreeReference } from "./MapTileTree";

/** @internal */
export class MapTiledGraphicsProvider implements TiledGraphicsProvider {
  private _backgroundMap: MapTileTreeReference;
  private _overlayMap: MapTileTreeReference;

  public forEachTileTreeRef(viewport: Viewport, func: (ref: TileTreeReference) => void): void {
    if (viewport.viewFlags.backgroundMap) {
      func(this._backgroundMap);
      func(this._overlayMap);
    }
  }
  constructor(private readonly _vp: Viewport) {
    const displayStyle = _vp.displayStyle;
    const mapSettings = displayStyle.backgroundMapSettings;
    const mapImagery = displayStyle.settings.mapImagery;
    this._backgroundMap = new MapTileTreeReference(mapSettings, mapImagery.backgroundBase, mapImagery.backgroundLayers, displayStyle.iModel, false, false, () => displayStyle.overrideTerrainDisplay());
    this._overlayMap = new MapTileTreeReference(mapSettings, undefined, mapImagery.overlayLayers, displayStyle.iModel, true, false);
    displayStyle.onMapSettingsChanged.addListener((settings: BackgroundMapSettings) => {
      this._backgroundMap.setBaseLayerSettings( MapLayerSettings.fromMapSettings(settings));
      this._backgroundMap.clearLayers();
    });
    displayStyle.onMapImageryChanged.addListener((imagery: MapImagerySettings) => {
      this._backgroundMap.setBaseLayerSettings(imagery.backgroundBase);
      this._backgroundMap.setLayerSettings(imagery.backgroundLayers);
      this._overlayMap.setLayerSettings(imagery.overlayLayers);
    });
    displayStyle.settings.onBackgroundMapChanged.addListener((settings: BackgroundMapSettings) => {
      this._backgroundMap.settings = this._overlayMap.settings = settings;
    });
  }
  /** @internal */
  public getMapLayerImageryProvider(index: number, isOverlay: boolean): MapLayerImageryProvider | undefined {
    const imageryTreeRef = isOverlay ? this._overlayMap.getLayerImageryTreeRef(index) : this._backgroundMap.getLayerImageryTreeRef(index);
    return imageryTreeRef?.imageryProvider;
  }

  /** @internal */
  public mapLayerFromIds(mapTreeId: Id64String, layerTreeId: Id64String): MapLayerSettings | undefined {
    let mapLayer;
    if (undefined === (mapLayer = this._backgroundMap.layerFromTreeModelIds(mapTreeId, layerTreeId)))
      mapLayer = this._overlayMap.layerFromTreeModelIds(mapTreeId, layerTreeId);

    return mapLayer;
  }
  /** @internal */
  public get backgroundMapElevationBias(): number {
    let bimElevationBias = this._vp.displayStyle.backgroundMapSettings.groundBias;
    const mapTree = this._backgroundMap.treeOwner.load() as MapTileTree;

    if (mapTree !== undefined)
      bimElevationBias = mapTree.bimElevationBias;    // Terrain trees calculate their bias when loaded (sea level or ground offset).

    return bimElevationBias;
  }
}

