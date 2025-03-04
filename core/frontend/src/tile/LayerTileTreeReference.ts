/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import { BaseLayerSettings, ColorDef, MapLayerSettings } from "@itwin/core-common";
import { SceneContext } from "../ViewContext";
import { createMapLayerTreeReference, ImageryMapLayerTreeReference, ImageryMapTileTree, LayerTileTree, MapLayerTileTreeReference, ModelMapLayerTileTreeReference, TileTreeLoadStatus, TileTreeReference } from "./internal";
import { IModelConnection } from "../IModelConnection";

export abstract class LayerTileTreeReference extends TileTreeReference {
  protected readonly _layerTrees = new Array<MapLayerTileTreeReference | undefined>();
  public isOverlay: boolean;
  protected _baseImageryLayerIncluded = false;
  protected _baseLayerSettings?: BaseLayerSettings;
  protected _baseTransparent = false;
  protected _baseColor?: ColorDef;
  protected _layerSettings: MapLayerSettings[];
  protected _iModel: IModelConnection;
  private _shouldDrapeLayerFunc: (layerTreeRef?: MapLayerTileTreeReference) => boolean;

  public constructor(pIsOverlay: boolean, iModel: IModelConnection, shouldDrapeLayerFunc: (layerTreeRef?: MapLayerTileTreeReference) => boolean, baseLayerSettings?: BaseLayerSettings, layerSettings?: MapLayerSettings[]) {
    super();

    this._baseLayerSettings = baseLayerSettings;
    this._layerSettings = layerSettings ? layerSettings : [];
    this.isOverlay = pIsOverlay;
    this._iModel = iModel;
    this._shouldDrapeLayerFunc = shouldDrapeLayerFunc;

    let tree;
    if (!this.isOverlay && this._baseLayerSettings !== undefined) {
      if (this._baseLayerSettings instanceof MapLayerSettings) {
        tree = createMapLayerTreeReference(this._baseLayerSettings, 0, iModel);
        this._baseTransparent = this._baseLayerSettings.transparency > 0;
      } else {
        this._baseColor = this._baseLayerSettings;
        this._baseTransparent = this._baseColor?.getTransparency() > 0;
      }
    }

    if (this._baseImageryLayerIncluded = (undefined !== tree))
      this._layerTrees.push(tree);

    if (undefined !== this._layerSettings) {
      for (let i = 0; i < this._layerSettings.length; i++)
        if (undefined !== (tree = createMapLayerTreeReference(this._layerSettings[i], i + 1, this._iModel)))
          this._layerTrees.push(tree);
    }
  }

  public initializeLayers(context: SceneContext): boolean {
    let hasLoadedTileTree = false;
    const tree = this.treeOwner.load() as LayerTileTree;
    if (undefined === tree) {
      return hasLoadedTileTree;     // Not loaded yet.
    }

    tree.layerImageryTrees.length = 0;
    if (0 === this._layerTrees.length) {
      return !this.isOverlay;
    }

    let treeIndex = this._layerTrees.length - 1;
    // Start displaying at the highest completely opaque layer...
    for (; treeIndex >= 1; treeIndex--) {
      const layerTreeRef = this._layerTrees[treeIndex];
      if (layerTreeRef?.isOpaque)
        break;    // This layer is completely opaque and will obscure all others so ignore lower ones.
    }

    for (; treeIndex < this._layerTrees.length; treeIndex++) {
      const layerTreeRef = this._layerTrees[treeIndex];
      const hasValidTileTree = layerTreeRef && TileTreeLoadStatus.NotFound !== layerTreeRef.treeOwner.loadStatus;
      const isImageryMapLayer = layerTreeRef instanceof ImageryMapLayerTreeReference;
      const isLayerVisible = (isImageryMapLayer || (!isImageryMapLayer && layerTreeRef?.layerSettings.visible));

      if (!this._shouldDrapeLayerFunc(layerTreeRef)) {
        // If the layer is not to be displayed, then we should skip adding it to the tile tree.
        // The _shouldDrapeLayerFunc() function is sent in from MapTileTreeReference or RealityTileTree.
        hasLoadedTileTree = true; // ###TODO had to set this to true so addToScene actually works. alternative?
        continue;
      }

      // Load tile tree for each configured layer.
      // Note: Non-visible imagery layer are always added to allow proper tile tree scale range visibility reporting.
      if (hasValidTileTree
        && isLayerVisible
        && !layerTreeRef.layerSettings.allSubLayersInvisible) {
        const layerTree = layerTreeRef.treeOwner.load();
        if (layerTree !== undefined) {
          hasLoadedTileTree = true;
        } else {
          // Let's continue, there might be loaded tile tree in the list
          continue;
        }

        // Add loaded TileTree
        const baseImageryLayer = this._baseImageryLayerIncluded && (treeIndex === 0);
        if (layerTree instanceof ImageryMapTileTree) {
          tree.addImageryLayer(layerTree, layerTreeRef.layerSettings, treeIndex, baseImageryLayer);
        } else if (layerTreeRef instanceof ModelMapLayerTileTreeReference)
          tree.addModelLayer(layerTreeRef, context);
      }
    }

    return hasLoadedTileTree;
  }
}
