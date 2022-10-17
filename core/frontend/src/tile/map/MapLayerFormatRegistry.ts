/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module MapLayers
 */

import { assert } from "@itwin/core-bentley";
import { ImageMapLayerSettings, MapLayerKey, MapLayerSettings, MapSubLayerProps } from "@itwin/core-common";
import { IModelApp } from "../../IModelApp";
import { IModelConnection } from "../../IModelConnection";
import {
  ImageryMapLayerTreeReference,
  internalMapLayerImageryFormats,
  MapLayerAccessClient,
  MapLayerAuthenticationInfo,
  MapLayerImageryProvider,
  MapLayerSourceStatus,
  MapLayerTileTreeReference,
} from "../internal";
import { RequestBasicCredentials } from "../../request/Request";

/** @beta */
export class MapLayerFormat {
  public static formatId: string;
  public static register() {
    IModelApp.mapLayerFormatRegistry.register(this);
  }

  /** @internal */
  public static createImageryProvider(_settings: MapLayerSettings): MapLayerImageryProvider | undefined {
    assert(false);
  }
  /** @internal */
  public static createMapLayerTree(
    _layerSettings: MapLayerSettings,
    _layerIndex: number,
    _iModel: IModelConnection
  ): MapLayerTileTreeReference | undefined {
    assert(false);
    return undefined;
  }
  public static async validateSource(
    _url: string,
    _credentials?: RequestBasicCredentials,
    _ignoreCache?: boolean
  ): Promise<MapLayerSourceValidation> {
    return { status: MapLayerSourceStatus.Valid };
  }
}

/** @beta */
export type MapLayerFormatType = typeof MapLayerFormat;

/** @public */
export interface MapLayerSourceValidation {
  status: MapLayerSourceStatus;
  subLayers?: MapSubLayerProps[];

  /** @beta */
  authInfo?: MapLayerAuthenticationInfo;
}

/**
 * Options supplied at startup via [[IModelAppOptions.mapLayerOptions]] to specify access keys for various map layer formats.
 * 'BingMaps' must have it's key value set to 'key'
 * 'MapboxImagery' must have it's key value set to 'access_token'
 *
 * @beta
 */
export interface MapLayerOptions {
  /** Access key for Azure Maps in the format `{ key: "subscription-key", value: "your-azure-maps-key" }`. */
  // eslint-disable-next-line @typescript-eslint/naming-convention
  AzureMaps?: MapLayerKey;
  /** Access key for Mapbox in the format `{ key: "access_token", value: "your-mapbox-key" }`. */
  // eslint-disable-next-line @typescript-eslint/naming-convention
  MapboxImagery?: MapLayerKey;
  /** Access key for Bing Maps in the format `{ key: "key", value: "your-bing-maps-key" }`. */
  // eslint-disable-next-line @typescript-eslint/naming-convention
  BingMaps?: MapLayerKey;
  /** Access keys for additional map layer formats. */
  [format: string]: MapLayerKey | undefined;
}

/** @internal */
export interface MapLayerFormatEntry {
  type: MapLayerFormatType;
  accessClient?: MapLayerAccessClient;
}

/** @beta */
export class MapLayerFormatRegistry {
  private _configOptions: MapLayerOptions;
  constructor(opts?: MapLayerOptions) {
    this._configOptions = opts ?? {};
    internalMapLayerImageryFormats.forEach((format) => this.register(format));
  }
  private _formats = new Map<string, MapLayerFormatEntry>();
  public register(formatClass: MapLayerFormatType, accessClient?: MapLayerAccessClient) {
    if (formatClass.formatId.length === 0) return; // must be an abstract class, ignore it

    this._formats.set(formatClass.formatId, { type: formatClass, accessClient });
  }

  public setAccessClient(formatId: string, accessClient: MapLayerAccessClient): boolean {
    const entry = this._formats.get(formatId);
    if (entry !== undefined) {
      entry.accessClient = accessClient;
      return true;
    }
    return false;
  }

  public getAccessClient(formatId: string): MapLayerAccessClient | undefined {
    if (formatId.length === 0) return undefined;

    return this._formats.get(formatId)?.accessClient;
  }

  public get configOptions(): MapLayerOptions {
    return this._configOptions;
  }

  /** @internal */
  public createImageryMapLayerTree(
    layerSettings: ImageMapLayerSettings,
    layerIndex: number,
    iModel: IModelConnection
  ): ImageryMapLayerTreeReference | undefined {
    const entry = this._formats.get(layerSettings.formatId);
    const format = entry?.type;
    return format !== undefined ? (format.createMapLayerTree(layerSettings, layerIndex, iModel) as ImageryMapLayerTreeReference) : undefined;
  }

  /** @internal */
  public createImageryProvider(layerSettings: ImageMapLayerSettings): MapLayerImageryProvider | undefined {
    const entry = this._formats.get(layerSettings.formatId);
    const format = entry?.type;
    if (this._configOptions[layerSettings.formatId] !== undefined) {
      const keyValuePair = this._configOptions[layerSettings.formatId]!;
      const key: MapLayerKey = { key: keyValuePair.key, value: keyValuePair.value };
      layerSettings = layerSettings.clone({ accessKey: key });
    }
    return format === undefined ? undefined : format.createImageryProvider(layerSettings);
  }

  public async validateSource(
    formatId: string,
    url: string,
    credentials?: RequestBasicCredentials,
    ignoreCache?: boolean
  ): Promise<MapLayerSourceValidation> {
    const entry = this._formats.get(formatId);
    const format = entry?.type;
    return format === undefined ? { status: MapLayerSourceStatus.InvalidFormat } : format.validateSource(url, credentials, ignoreCache);
  }
}
