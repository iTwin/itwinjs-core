/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import { assert } from "@itwin/core-bentley";
import { ImageMapLayerSettings, MapLayerSettings, ModelMapLayerSettings } from "@itwin/core-common";
import { HitDetail } from "../../HitDetail";
import { IModelApp } from "../../IModelApp";
import { IModelConnection } from "../../IModelConnection";
import { createModelMapLayerTileTreeReference, MapLayerImageryProvider, TileTreeReference } from "../internal";

/**
 * A [[TileTreeReference]] to be used specifically for [[MapTileTree]]s.
 * The reference refers to its MapTileTree by way of the tree's [[TileTreeOwner]].
 * Multiple MapLayerTileTreeReferences can refer to the same TileTree if the map layer settings are equivalent, meaning
 * they have identical format IDs, URLs, credentials, etc.
 * @beta
 */
export abstract class MapLayerTileTreeReference extends TileTreeReference {
  /* @internal */
  protected _layerSettings: MapLayerSettings;
  /* @internal */
  protected _layerIndex: number;
  /* @internal */
  public iModel: IModelConnection;

  /**
   * Constructor for a MapLayerTileTreeReference.
   * @param _layerSettings Map layer settings that are applied to the MapLayerTileTreeReference.
   * @param _layerIndex The index of the associated map layer.
   * @param iModel The iModel containing the MapLayerTileTreeReference.
   * @internal
   */
  constructor(_layerSettings: MapLayerSettings, _layerIndex: number, iModel: IModelConnection) {
    super();
    this._layerSettings = _layerSettings;
    this._layerIndex = _layerIndex;
    this.iModel = iModel;
  }

  /* @internal */
  protected get _transparency() { return this._layerSettings.transparency ? this._layerSettings.transparency : undefined; }

  /** Returns true if the associated map layer, including its sublayers, is opaque. */
  public get isOpaque() {
    return this._layerSettings.visible && (!this._layerSettings.allSubLayersInvisible) && !this._layerSettings.transparentBackground && 0 === this._layerSettings.transparency;
  }

  /* Returns the map layer name. */
  public get layerName() { return this._layerSettings.name; }

  /** Returns the imagery provider for the tile tree. */
  public get imageryProvider(): MapLayerImageryProvider | undefined { return undefined; }

  public set layerSettings(layerSettings: MapLayerSettings) { this._layerSettings = layerSettings; }

  /** Returns the layer settings for the map layer. */
  public get layerSettings(): MapLayerSettings { return this._layerSettings; }

  /** Returns the index of the map layer associated with the tile tree. */
  public get layerIndex(): number { return this._layerIndex; }

  /** Returns the transparency value of the map layer. */
  public get transparency() { return this._transparency; }

  public override canSupplyToolTip(hit: HitDetail): boolean {
    const tree = this.treeOwner.tileTree;
    return undefined !== tree && hit.iModel === tree.iModel && tree.modelId === hit.sourceId;
  }

  /* Returns a tooltip describing the hit with the map layer name. */
  public override async getToolTip(hit: HitDetail): Promise<HTMLElement | string | undefined> {
    const tree = this.treeOwner.tileTree;
    if (undefined === tree || hit.iModel !== tree.iModel || tree.modelId !== hit.sourceId)
      return undefined;

    const strings = [];
    strings.push(`Map Layer: ${this._layerSettings.name}`);
    const div = document.createElement("div");
    div.innerHTML = strings.join("<br>");
    return div;
  }
}

/**
 * Creates a MapLayerTileTreeReference.
 * @param layerSettings Model or image map layer settings that are applied to the MapLayerTileTreeReference.
 * @param layerIndex The index of the associated map layer.
 * @param iModel The iModel containing the new MapLayerTileTreeReference.
 * @returns Returns the new tile tree reference, either a ModelMapLayerTileTreeReference or an ImageryMapLayerTreeReference.
 * @internal
 */
export function createMapLayerTreeReference(layerSettings: MapLayerSettings, layerIndex: number, iModel: IModelConnection): MapLayerTileTreeReference | undefined {
  if (layerSettings instanceof ModelMapLayerSettings) {
    return createModelMapLayerTileTreeReference(layerSettings, layerIndex, iModel);
  } else if (layerSettings instanceof ImageMapLayerSettings)
    return IModelApp.mapLayerFormatRegistry.createImageryMapLayerTree(layerSettings, layerIndex, iModel);
  else {
    assert (false);
    return undefined;
  }
}
