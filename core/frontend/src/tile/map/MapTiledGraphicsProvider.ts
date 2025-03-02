/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import { Id64String } from "@itwin/core-bentley";
import { BaseMapLayerSettings, MapImagerySettings, MapLayerSettings } from "@itwin/core-common";
import { DisplayStyleState } from "../../DisplayStyleState";
import { ViewState } from "../../ViewState";
import { Viewport } from "../../Viewport";
import { DisclosedTileTreeSet, MapLayerImageryProvider, MapLayerInfoFromTileTree, MapTileTreeReference, TiledGraphicsProvider, TileTree, TileTreeOwner, TileTreeReference } from "../internal";
import { IModelApp } from "../../IModelApp";

/** Position of a map-layer in the display style's map (i.e. background/overlay map)
 * @public
 */
export interface MapLayerIndex {
  /** True if map-layer is part of [[DisplayStyleState]]'s overlay map, otherwise map-layer is part of [[DisplayStyleState]]'s background map
  * @see [[DisplayStyleState.mapLayerAtIndex]].
  */
  isOverlay: boolean;

  /** Index of the map-layer in [[DisplayStyleState]]'s background/overlay map
   * @see [[DisplayStyleState.mapLayerAtIndex]].
  */
  index: number;
}

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
  constructor(viewportId: number, displayStyle: DisplayStyleState) {
    const mapSettings = displayStyle.backgroundMapSettings;
    const mapImagery = displayStyle.settings.mapImagery;
    this.backgroundMap = new MapTileTreeReference(mapSettings, mapImagery.backgroundBase, mapImagery.backgroundLayers, displayStyle.iModel, viewportId, false, false, () => displayStyle.overrideTerrainDisplay());
    this.overlayMap = new MapTileTreeReference(mapSettings, undefined, mapImagery.overlayLayers, displayStyle.iModel, viewportId, true, false);
    this.backgroundDrapeMap = new MapTileTreeReference(mapSettings, mapImagery.backgroundBase, mapImagery.backgroundLayers, displayStyle.iModel, viewportId, false, true);

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

    // We need to clear imagery tiles assigned to map tiles every time a new ImageryTileTree is loaded,
    // otherwise the imagery tiles won't refresh correctly.
    const clearMapLayers = (loadedTileTree: TileTree, mapTileTreeToClear: MapTileTreeReference) => {
      const trees = new DisclosedTileTreeSet();
      mapTileTreeToClear.discloseTileTrees(trees);
      if (trees.has(loadedTileTree)) {
        mapTileTreeToClear.clearLayers();
      }
    };
    removals.push(IModelApp.tileAdmin.onTileTreeLoad.addListener((tileTree: TileTreeOwner) => {
      if (tileTree.tileTree !== undefined) {
        clearMapLayers(tileTree.tileTree, this.backgroundMap);
        clearMapLayers(tileTree.tileTree, this.overlayMap);
      }
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
      || (mapImagery.backgroundBase instanceof BaseMapLayerSettings && !layersMatch([mapImagery.backgroundBase], this.backgroundDrapeMap.layerSettings))) {
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
  public getMapLayerImageryProvider(mapLayerIndex: MapLayerIndex): MapLayerImageryProvider | undefined {
    const imageryTreeRef = mapLayerIndex.isOverlay ? this.overlayMap.getLayerImageryTreeRef(mapLayerIndex.index) : this.backgroundMap.getLayerImageryTreeRef(mapLayerIndex.index);
    return imageryTreeRef?.imageryProvider;
  }

  public resetMapLayer(mapLayerIndex: MapLayerIndex) {
    const imageryTreeRef = mapLayerIndex.isOverlay ? this.overlayMap.getLayerImageryTreeRef(mapLayerIndex.index) : this.backgroundMap.getLayerImageryTreeRef(mapLayerIndex.index);
    imageryTreeRef?.resetTreeOwner();
  }

  /** Return a list of map-layers indexes matching a given MapTile tree Id and a layer imagery tree id.
   * @internal
   */
  public getMapLayerIndexesFromIds(mapTreeId: Id64String, layerTreeId: Id64String): MapLayerIndex[] {
    const layers = new Array<MapLayerIndex>();
    if (mapTreeId === this.backgroundMap.treeOwner.tileTree?.id) {
      for (let i = 0; i < this.backgroundMap.layerSettings.length; i++) {
        if (this.backgroundMap.getLayerImageryTreeRef(i)?.treeOwner.tileTree?.id === layerTreeId) {
          layers.push({ index: i, isOverlay: false });
        }
      }
    } else if (mapTreeId === this.overlayMap.treeOwner.tileTree?.id) {
      for (let i = 0; i < this.overlayMap.layerSettings.length; i++) {
        if (this.overlayMap.getLayerImageryTreeRef(i)?.treeOwner.tileTree?.id === layerTreeId) {
          layers.push({ index: i, isOverlay: true });
        }
      }
    }
    return layers;
  }

  /** @internal */
  public mapLayerFromIds(mapTreeId: Id64String, layerTreeId: Id64String): MapLayerInfoFromTileTree[] {
    const bgMapLayers = this.backgroundMap.layerFromTreeModelIds(mapTreeId, layerTreeId);
    const ovlMapLayers = this.overlayMap.layerFromTreeModelIds(mapTreeId, layerTreeId);
    return [...bgMapLayers, ...ovlMapLayers];
  }
}

