/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Views */

import { assert } from "@bentley/bentleyjs-core";
import { MapLayerSettings, MapSubLayerProps } from "@bentley/imodeljs-common";
import { IModelApp } from "../../IModelApp";
import { IModelConnection } from "../../IModelConnection";
import { ImageryMapLayerTreeReference, internalMapLayerImageryFormats, MapLayerImageryProvider, MapLayerSourceStatus, MapLayerTileTreeReference } from "../internal";
import { RequestBasicCredentials } from "@bentley/itwin-client";

/** @internal */
export class MapLayerFormat {
  public static formatId: string;
  public static register() { IModelApp.mapLayerFormatRegistry.register(this); }
  public static createImageryProvider(_settings: MapLayerSettings): MapLayerImageryProvider | undefined { assert(false); }
  public static createMapLayerTree(_layerSettings: MapLayerSettings, _layerIndex: number, _iModel: IModelConnection): MapLayerTileTreeReference | undefined {
    assert(false);
    return undefined;
  }
  public static async validateSource(_url: string, _credentials?: RequestBasicCredentials): Promise<MapLayerSourceValidation> { return { status: MapLayerSourceStatus.Valid }; }
}

/** @internal */
export type MapLayerFormatType = typeof MapLayerFormat;

/** @internal */
export interface MapLayerSourceValidation {
  status: MapLayerSourceStatus;
  subLayers?: MapSubLayerProps[];
}

/** @internal */
export class MapLayerFormatRegistry {
  constructor() {
    internalMapLayerImageryFormats.forEach((format) => this.register(format));
  }
  private _formats = new Map<string, MapLayerFormatType>();
  public register(formatClass: MapLayerFormatType) {
    if (formatClass.formatId.length === 0)
      return; // must be an abstract class, ignore it

    this._formats.set(formatClass.formatId, formatClass);
  }

  public createImageryMapLayerTree(layerSettings: MapLayerSettings, layerIndex: number, iModel: IModelConnection): ImageryMapLayerTreeReference | undefined {
    const format = this._formats.get(layerSettings.formatId);
    return format !== undefined ? (format.createMapLayerTree(layerSettings, layerIndex, iModel) as ImageryMapLayerTreeReference) : undefined;
  }
  public createImageryProvider(layerSettings: MapLayerSettings): MapLayerImageryProvider | undefined {
    const format = this._formats.get(layerSettings.formatId);
    return (format === undefined) ? undefined : format.createImageryProvider(layerSettings);
  }
  public async validateSource(formatId: string, url: string, credentials?: RequestBasicCredentials): Promise<MapLayerSourceValidation> {
    const format = this._formats.get(formatId);
    return (format === undefined) ? { status: MapLayerSourceStatus.InvalidFormat } : format.validateSource(url, credentials);
  }
}
