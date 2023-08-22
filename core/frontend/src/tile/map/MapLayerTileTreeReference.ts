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
 * A reference to a [[TileTree]] to be used for map layer tiles.
 * @beta
 */
export abstract class MapLayerTileTreeReference extends TileTreeReference {
  constructor(protected _layerSettings: MapLayerSettings, protected _layerIndex: number, public iModel: IModelConnection) {
    super();
  }
  protected get _transparency() { return this._layerSettings.transparency ? this._layerSettings.transparency : undefined; }

  public get isOpaque() {
    return this._layerSettings.visible && (!this._layerSettings.allSubLayersInvisible) && !this._layerSettings.transparentBackground && 0 === this._layerSettings.transparency;
  }
  public get layerName() { return this._layerSettings.name; }
  public get imageryProvider(): MapLayerImageryProvider | undefined { return undefined; }
  public set layerSettings(layerSettings: MapLayerSettings) { this._layerSettings = layerSettings; }
  public get layerSettings(): MapLayerSettings { return this._layerSettings; }
  public get layerIndex(): number { return this._layerIndex; }
  public get transparency() { return this._transparency; }
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

/** @internal */
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
