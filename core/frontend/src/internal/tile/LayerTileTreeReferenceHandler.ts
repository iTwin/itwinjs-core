/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import { expectDefined } from "@itwin/core-bentley";
import { BaseLayerSettings, ColorDef, MapImagerySettings, MapLayerSettings } from "@itwin/core-common";
import { SceneContext } from "../../ViewContext";
import { compareMapLayer, createMapLayerTreeReference, DisclosedTileTreeSet, ImageryMapLayerTreeReference, ImageryMapTileTree, MapLayerTileTreeReference, ModelMapLayerTileTreeReference, TileTreeLoadStatus, TileTreeOwner } from "../../tile/internal";
import { IModelConnection } from "../../IModelConnection";

/** @internal */
export interface LayerTileTreeReference {
  iModel: IModelConnection;
  treeOwner: TileTreeOwner;
  shouldDrapeLayer: (layerTreeRef?: MapLayerTileTreeReference) => boolean;
}

/** @internal */
export class LayerTileTreeReferenceHandler {
  protected readonly _layerTrees = new Array<MapLayerTileTreeReference | undefined>();
  public isOverlay: boolean;
  protected _baseImageryLayerIncluded = false;
  protected _baseLayerSettings?: BaseLayerSettings;
  protected _baseTransparent = false;
  protected _baseColor?: ColorDef;
  protected _layerSettings: MapLayerSettings[];
  private _ref: LayerTileTreeReference;
  private readonly _mapTile: boolean;
  private readonly _detachFromDisplayStyle: VoidFunction[] = [];

  public get layerTrees() { return this._layerTrees; }
  public get baseColor() { return this._baseColor; }
  public get baseTransparent() { return this._baseTransparent; }
  public get baseImageryLayerIncluded() { return this._baseImageryLayerIncluded; }
  public get layerSettings() { return this._layerSettings; }

  public discloseTileTrees(trees: DisclosedTileTreeSet): void {
    for (const imageryTree of this.layerTrees)
      if (imageryTree)
        trees.disclose(imageryTree);
  }

  public constructor(ref: LayerTileTreeReference, pIsOverlay: boolean, baseLayerSettings?: BaseLayerSettings, layerSettings?: MapLayerSettings[], mapTile: boolean = false) {
    this._ref = ref;
    this._baseLayerSettings = baseLayerSettings;
    this._layerSettings = layerSettings ? layerSettings : [];
    this.isOverlay = pIsOverlay;
    this._mapTile = mapTile;

    let tree;
    if (!this.isOverlay && this._baseLayerSettings !== undefined) {
      if (this._baseLayerSettings instanceof MapLayerSettings) {
        tree = createMapLayerTreeReference(this._baseLayerSettings, 0, this._ref.iModel);
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
        if (undefined !== (tree = createMapLayerTreeReference(this._layerSettings[i], i + 1, this._ref.iModel)))
          this._layerTrees.push(tree);
    }
  }

  public initializeLayers(context: SceneContext): boolean {
    // Map tiles handle refresh logic differently
    if(!this._mapTile){
      const removals = this._detachFromDisplayStyle;
      const mapImagery = context.viewport.displayStyle.settings.mapImagery;
      if (0 === removals.length) {
        removals.push(context.viewport.displayStyle.settings.onMapImageryChanged.addListener((imagery: Readonly<MapImagerySettings>) => {
          this.setBaseLayerSettings(imagery.backgroundBase);
          this.setLayerSettings(imagery.backgroundLayers);
        }));
      }
      removals.push(context.viewport.onChangeView.addListener((vp, previousViewState) => {
        if(compareMapLayer(previousViewState, vp.view)){
          this.setBaseLayerSettings(mapImagery.backgroundBase);
          this.setLayerSettings(mapImagery.backgroundLayers);
        }
      }));
      removals.push(context.viewport.onViewedModelsChanged.addListener((viewport) => {
        const layers = viewport.displayStyle.settings.mapImagery.backgroundLayers;
        if (layers.length > 0) {
          this.setBaseLayerSettings(mapImagery.backgroundBase);
          this.setLayerSettings(mapImagery.backgroundLayers);
          viewport.invalidateScene();
        }
      }));
    }

    let hasLoadedTileTree = false;
    const layerHandler = this._ref.treeOwner.load()?.layerHandler;
    if (undefined === layerHandler) {
      return hasLoadedTileTree;     // Not loaded yet - or no layerHandler on tree.
    }

    layerHandler.layerImageryTrees.length = 0;
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

      if (!this._ref.shouldDrapeLayer(layerTreeRef)) {
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
          layerHandler.addImageryLayer(layerTree, layerTreeRef.layerSettings, treeIndex, baseImageryLayer);
        } else if (layerTreeRef instanceof ModelMapLayerTileTreeReference)
          layerHandler.addModelLayer(layerTreeRef, context);
      }
    }

    return hasLoadedTileTree;
  }

  public setBaseLayerSettings(baseLayerSettings: BaseLayerSettings) {
    let tree;
    this._baseLayerSettings = baseLayerSettings;

    if (baseLayerSettings instanceof MapLayerSettings) {
      tree = createMapLayerTreeReference(baseLayerSettings, 0, this._ref.iModel);
      this._baseColor = undefined;
      this._baseTransparent = baseLayerSettings.transparency > 0;
    } else {
      this._baseColor = baseLayerSettings;
      this._baseTransparent = this._baseColor.getTransparency() > 0;
    }

    if (tree) {
      if (this._baseImageryLayerIncluded)
        this._layerTrees[0] = tree;
      else
        this._layerTrees.splice(0, 0, tree);
    } else {
      if (this._baseImageryLayerIncluded)
        this._layerTrees.shift();
    }
    this._baseImageryLayerIncluded = tree !== undefined;
    this.clearLayers();
  }

  public clearLayers() {
    const layerHandler = this._ref.treeOwner.tileTree?.layerHandler;
    if (undefined !== layerHandler) {
      layerHandler.clearLayers();
    }
  }

  public setLayerSettings(layerSettings: MapLayerSettings[]) {
    this._layerSettings = layerSettings;
    const baseLayerIndex = this._baseImageryLayerIncluded ? 1 : 0;

    this._layerTrees.length = Math.min(layerSettings.length + baseLayerIndex, this._layerTrees.length);    // Truncate if number of layers reduced.
    for (let i = 0; i < layerSettings.length; i++) {
      const treeIndex = i + baseLayerIndex;
      if (treeIndex >= this._layerTrees.length || !this._layerTrees[treeIndex]?.layerSettings.displayMatches(layerSettings[i]))
        this._layerTrees[treeIndex] = expectDefined(createMapLayerTreeReference(layerSettings[i], treeIndex, this._ref.iModel));
    }
    this.clearLayers();
  }
}
