/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import { Id64String } from "@itwin/core-bentley";
import { ImageryMapTileTree, ImageryTileTreeState, ModelMapLayerTileTreeReference, RealityTile, RealityTileTree, TileDrawArgs } from "./internal";
import { MapLayerSettings } from "@itwin/core-common";
import { RenderPlanarClassifier } from "../render/RenderPlanarClassifier";
import { SceneContext } from "../ViewContext";

// ###TODO this is a duplicate from MapTileTree.ts!
/** Utility interface that ties an imagery tile tree to its corresponding map-layer settings object.
 * @internal
 */
interface MapLayerTreeSetting {
  tree: ImageryMapTileTree;
  settings: MapLayerSettings;
  baseImageryLayer: boolean;
}

export class LayerTileTree extends RealityTileTree {
  public layerImageryTrees: MapLayerTreeSetting[] = [];
  protected _layerSettings = new Map<Id64String, MapLayerSettings>();
  protected _imageryTreeState = new Map<Id64String, ImageryTileTreeState>();
  protected _modelIdToIndex = new Map<Id64String, number>();
  /** @internal */
  public layerClassifiers = new Map<number, RenderPlanarClassifier>();

  /** Add a new imagery tile tree / map-layer settings pair and initialize the imagery tile tree state.
   * @internal
   */
  public addImageryLayer(tree: ImageryMapTileTree, settings: MapLayerSettings, index: number, baseImageryLayer: boolean) {
    this.layerImageryTrees.push({ tree, settings, baseImageryLayer });
    this._layerSettings.set(tree.modelId, settings);
    if (!this._imageryTreeState.has(tree.modelId))
      this._imageryTreeState.set(tree.modelId, new ImageryTileTreeState());
    this._modelIdToIndex.set(tree.modelId, index);
  }

  /** @internal */
  public addModelLayer(layerTreeRef: ModelMapLayerTileTreeReference, context: SceneContext) {
    const classifier = context.addPlanarClassifier(`MapLayer ${this.modelId}-${layerTreeRef.layerIndex}`, layerTreeRef);
    if (classifier)
      this.layerClassifiers.set(layerTreeRef.layerIndex, classifier);
  }

  /** @internal */
  public clearLayers() {
    this._rootTile.clearLayers();
  }

  /** @internal */
  protected override collectClassifierGraphics(args: TileDrawArgs, selectedTiles: RealityTile[]) {
    super.collectClassifierGraphics(args, selectedTiles);

    this.layerClassifiers.forEach((layerClassifier: RenderPlanarClassifier) => {
      // if (!(args instanceof GraphicsCollectorDrawArgs))
      layerClassifier.collectGraphics(args.context, { modelId: this.modelId, tiles: selectedTiles, location: args.location, isPointCloud: this.isPointCloud });

    });
  }
}
