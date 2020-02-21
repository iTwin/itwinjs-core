/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tile
 */

import {
  BackgroundMapSettings,
  GlobeMode,
} from "@bentley/imodeljs-common";
import { IModelConnection } from "../IModelConnection";
import { IModelApp } from "../IModelApp";
import { SceneContext } from "../ViewContext";
import {
  ImageryProvider,
  MapTileTreeReference,
  TileGraphicType,
  TileTreeOwner,
  WebMapDrawArgs,
  WebMapTileLoader,
  getBackgroundMapTreeSupplier,
} from "./internal";

/** A reference to a TileTree used for drawing a background map. To change the type of tiles drawn simply modify the `settings` property.
 * @internal
 */
export class BackgroundMapTileTreeReference extends MapTileTreeReference {
  public settings: BackgroundMapSettings;
  private readonly _iModel: IModelConnection;
  private readonly _forCartoDrape: boolean;
  private readonly _filterTextures?: boolean;

  public constructor(settings: BackgroundMapSettings, iModel: IModelConnection, forCartographicDrape = false, private _forPlanarDrape = false) {
    super();
    this.settings = settings;
    this._iModel = iModel;
    this._forCartoDrape = forCartographicDrape;
    const options = IModelApp.renderSystem.options;
    this._filterTextures = (forCartographicDrape || _forPlanarDrape) ? (options.filterMapDrapeTextures === undefined || options.filterMapDrapeTextures) : options.filterMapTextures;
  }

  public get treeOwner(): TileTreeOwner {
    const id = {
      providerName: this.settings.providerName,
      mapType: this.settings.mapType,
      globeMode: this._forPlanarDrape ? GlobeMode.Plane : this.settings.globeMode,
      groundBias: this.settings.groundBias,
      forDrape: this._forCartoDrape,
      filterTextures: this._filterTextures,
    };

    return this._iModel.tiles.getTileTreeOwner(id, getBackgroundMapTreeSupplier());
  }

  protected get _groundBias() { return this.settings.groundBias; }
  protected get _graphicType() {
    return (this.settings.useDepthBuffer || GlobeMode.Ellipsoid === this.settings.globeMode) ? TileGraphicType.Scene : TileGraphicType.BackgroundMap;
  }

  protected get _transparency(): number | undefined {
    return this._forCartoDrape ? undefined : this.settings.transparencyOverride;
  }

  protected get _imageryProvider(): ImageryProvider | undefined {
    const tree = this.treeOwner.tileTree;
    return undefined !== tree ? (tree.loader as WebMapTileLoader).imageryProvider : undefined;
  }

  public createDrawArgs(context: SceneContext) {
    let args = super.createDrawArgs(context);
    if (undefined !== args)
      args = new WebMapDrawArgs(args);

    return args;
  }
}
