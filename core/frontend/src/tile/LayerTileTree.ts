/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import { Id64String } from "@itwin/core-bentley";
import { ImageryMapTileTree, ImageryTileTreeState, ModelMapLayerTileTreeReference, Tile, TileDrawArgs } from "./internal";
import { MapLayerSettings } from "@itwin/core-common";
import { RenderPlanarClassifier } from "../internal/render/RenderPlanarClassifier";
import { SceneContext } from "../ViewContext";

/** Utility interface that ties an imagery tile tree to its corresponding map-layer settings object.
 * @internal
 */
export interface MapLayerTreeSetting {
  tree: ImageryMapTileTree;
  settings: MapLayerSettings;
  baseImageryLayer: boolean;
}

interface LayerTileTree {
  modelId: Id64String;
  rootTile: Tile;
  isPointCloud: boolean;
  layerImageryTrees: MapLayerTreeSetting[];
}

/** @internal */
export class LayerTileTreeHandler {
  protected _layerSettings = new Map<Id64String, MapLayerSettings>();
  protected _imageryTreeState = new Map<Id64String, ImageryTileTreeState>();
  protected _modelIdToIndex = new Map<Id64String, number>();
  public layerClassifiers = new Map<number, RenderPlanarClassifier>();
  private _ref: LayerTileTree;

  public get imageryTreeState() { return this._imageryTreeState; }
  public get layerSettings() { return this._layerSettings; }
  public get modelIdToIndex() { return this._modelIdToIndex; }
  public get layerImageryTrees() { return this._ref.layerImageryTrees; }

  constructor(ref: LayerTileTree) {
    this._ref = ref;
  }

  /** Add a new imagery tile tree / map-layer settings pair and initialize the imagery tile tree state.
   * @internal
   */
  public addImageryLayer(tree: ImageryMapTileTree, settings: MapLayerSettings, index: number, baseImageryLayer: boolean) {
    this._ref.layerImageryTrees.push({ tree, settings, baseImageryLayer });
    this._layerSettings.set(tree.modelId, settings);
    if (!this._imageryTreeState.has(tree.modelId))
      this._imageryTreeState.set(tree.modelId, new ImageryTileTreeState());
    this._modelIdToIndex.set(tree.modelId, index);
  }

  /** @internal */
  public addModelLayer(layerTreeRef: ModelMapLayerTileTreeReference, context: SceneContext) {
    const classifier = context.addPlanarClassifier(`MapLayer ${this._ref.modelId}-${layerTreeRef.layerIndex}`, layerTreeRef);
    if (classifier)
      this.layerClassifiers.set(layerTreeRef.layerIndex, classifier);
  }

  /** @internal */
  public clearLayers() {
    this._ref.rootTile.clearLayers();
  }

  /** @internal */
  public collectClassifierGraphics(args: TileDrawArgs, selectedTiles: Tile[]) {
    this.layerClassifiers.forEach((layerClassifier: RenderPlanarClassifier) => {
      layerClassifier.collectGraphics(args.context, { modelId: this._ref.modelId, tiles: selectedTiles, location: args.location, isPointCloud: this._ref.isPointCloud });
    });
  }
}
