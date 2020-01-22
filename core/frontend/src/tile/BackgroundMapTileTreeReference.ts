/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tile
 */

import { BackgroundMapSettings } from "@bentley/imodeljs-common";
import { IModelConnection } from "../IModelConnection";
import { IModelApp } from "../IModelApp";
import { MapTileTreeReference, ImageryProvider, TileGraphicType, getBackgroundMapTreeSupplier, TileTreeOwner } from "./internal";

/** A reference to a TileTree used for drawing a background map. To change the type of tiles drawn simply modify the `settings` property.
 * @internal
 */
export class BackgroundMapTileTreeReference extends MapTileTreeReference {
  public settings: BackgroundMapSettings;
  private readonly _iModel: IModelConnection;
  private readonly _forDrape: boolean;
  private readonly _filterTextures?: boolean;

  public constructor(settings: BackgroundMapSettings, iModel: IModelConnection, forDrape = false) {
    super();
    this.settings = settings;
    this._iModel = iModel;
    this._forDrape = forDrape;
    const options = IModelApp.renderSystem.options;
    this._filterTextures = forDrape ? (options.filterMapDrapeTextures === undefined || options.filterMapDrapeTextures) : options.filterMapTextures;
  }

  public get treeOwner(): TileTreeOwner {
    const id = {
      providerName: this.settings.providerName,
      mapType: this.settings.mapType,
      groundBias: this.settings.groundBias,
      forDrape: this._forDrape,
      filterTextures: this._filterTextures,
    };

    return this._iModel.tiles.getTileTreeOwner(id, getBackgroundMapTreeSupplier());
  }

  protected get _groundBias() { return this.settings.groundBias; }
  protected get _graphicType() {
    return this.settings.useDepthBuffer ? TileGraphicType.Scene : TileGraphicType.BackgroundMap;
  }

  protected get _transparency(): number | undefined {
    return this._forDrape ? undefined : this.settings.transparencyOverride;
  }

  protected get _imageryProvider(): ImageryProvider | undefined {
    const tree = this.treeOwner.tileTree;
    return undefined !== tree ? (tree.loader as any).imageryProvider : undefined;
  }
}
