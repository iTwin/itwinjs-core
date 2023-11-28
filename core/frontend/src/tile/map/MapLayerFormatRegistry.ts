/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module MapLayers
 */

import { assert, Logger } from "@itwin/core-bentley";
import { ImageMapLayerSettings, MapLayerKey, MapLayerSettings, MapSubLayerProps } from "@itwin/core-common";
import { IModelApp } from "../../IModelApp";
import { IModelConnection } from "../../IModelConnection";
import { ImageryMapLayerTreeReference, internalMapLayerImageryFormats, MapLayerAccessClient, MapLayerAuthenticationInfo, MapLayerImageryProvider, MapLayerSource, MapLayerSourceStatus, MapLayerTileTreeReference } from "../internal";
const loggerCategory = "ArcGISFeatureProvider";

/**
 * Class representing a map-layer format.
 * Each format has it's unique 'formatId' string, used to uniquely identify a format in the [[MapLayerFormatRegistry]].
 * When creating an [[ImageMapLayerSettings]] object, a format needs to be specified this 'formatId'.
 * The MapLayerFormat object can later be used to validate a source, or create a provider.
 *
 * Subclasses should override formatId, [[MapLayerFormat.createImageryProvider]], and [[MapLayerFormat.createMapLayerTree]].
 * @public
 */
export class MapLayerFormat {
  public static formatId: string;

  /** Register the current format in the [[MapLayerFormatRegistry]]. */
  public static register() { IModelApp.mapLayerFormatRegistry.register(this); }

  /** @deprecated in 4.3. Use [[validateSourceObj]]. */
  public static async validateSource(_url: string, _userName?: string, _password?: string, _ignoreCache?: boolean, _accesKey?: MapLayerKey): Promise<MapLayerSourceValidation> { return { status: MapLayerSourceStatus.Valid }; }

  /** Allow a source object to be validated before being attached as a map-layer.
    * @beta
  */
  public static async validateSourceObj(_source: MapLayerSource, _opts?: ValidateSourceOptions): Promise<MapLayerSourceValidation> { return { status: MapLayerSourceStatus.Valid }; }

  /** Create a [[MapLayerImageryProvider]] that will be used to feed data in a map-layer tile Tree.
   * @internal
  */
  public static createImageryProvider(_settings: MapLayerSettings): MapLayerImageryProvider | undefined { assert(false); }

  /** @internal */
  public static createMapLayerTree(_layerSettings: MapLayerSettings, _layerIndex: number, _iModel: IModelConnection): MapLayerTileTreeReference | undefined {
    assert(false);
    return undefined;
  }

}

/** Options for validating sources
 * @beta
 */
export interface ValidateSourceOptions {
  /** Disable cache lookup during validate process  */
  ignoreCache?: boolean;
}

/**
 * The type of a map layer format.
 * @public
 */
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
 * @public
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

/**
 * A registry of MapLayerFormats identified by their unique format IDs. The registry can be accessed via [[IModelApp.mapLayerFormatRegistry]].
 * @public
 */
export class MapLayerFormatRegistry {
  private _configOptions: MapLayerOptions;
  constructor(opts?: MapLayerOptions) {
    this._configOptions = opts ?? {};
    internalMapLayerImageryFormats.forEach((format) => this.register(format));
  }
  private _formats = new Map<string, MapLayerFormatEntry>();

  public isRegistered(formatId: string) { return this._formats.get(formatId) !== undefined; }

  public register(formatClass: MapLayerFormatType) {
    if (formatClass.formatId.length === 0)
      return; // must be an abstract class, ignore it

    this._formats.set(formatClass.formatId, { type: formatClass });
  }

  /** @beta */
  public setAccessClient(formatId: string, accessClient: MapLayerAccessClient): boolean {
    const entry = this._formats.get(formatId);
    if (entry !== undefined) {
      entry.accessClient = accessClient;
      return true;
    }
    return false;
  }

  /** @beta */
  public getAccessClient(formatId: string): MapLayerAccessClient | undefined {
    if (formatId.length === 0)
      return undefined;

    return this._formats.get(formatId)?.accessClient;
  }

  public get configOptions(): MapLayerOptions {
    return this._configOptions;
  }

  /** @internal */
  public createImageryMapLayerTree(layerSettings: ImageMapLayerSettings, layerIndex: number, iModel: IModelConnection): ImageryMapLayerTreeReference | undefined {
    const entry = this._formats.get(layerSettings.formatId);
    const format = entry?.type;
    if (format === undefined) {
      Logger.logError(loggerCategory, `Could not find format '${layerSettings.formatId}' in registry`);
      return undefined;
    }
    return format.createMapLayerTree(layerSettings, layerIndex, iModel) as ImageryMapLayerTreeReference;
  }

  /**
   * Returns a [[MapLayerImageryProvider]] based on the provided [[ImageMapLayerSettings]] object.
   * @internal
   */
  public createImageryProvider(layerSettings: ImageMapLayerSettings): MapLayerImageryProvider | undefined {
    const entry = this._formats.get(layerSettings.formatId);
    const format = entry?.type;
    if (this._configOptions[layerSettings.formatId] !== undefined) {
      const keyValuePair = this._configOptions[layerSettings.formatId]!;
      const key: MapLayerKey = { key: keyValuePair.key, value: keyValuePair.value };
      layerSettings = layerSettings.clone({ accessKey: key });
    }
    return (format === undefined) ? undefined : format.createImageryProvider(layerSettings);
  }

  /** @deprecated in 4.2. Use the overload that takes a [[MapLayerSource]]. */
  public async validateSource(formatId: string, url: string, userName?: string, password?: string, ignoreCache?: boolean): Promise<MapLayerSourceValidation> {
    const entry = this._formats.get(formatId);
    const format = entry?.type;
    if (format === undefined)
      return { status: MapLayerSourceStatus.InvalidFormat };

    const source =  MapLayerSource.fromJSON({name: "", formatId, url});
    if (source === undefined)
      return { status: MapLayerSourceStatus.InvalidFormat };
    source.userName = userName;
    source.password = password;

    return format.validateSourceObj(source, {ignoreCache});
  }

  /** Allow a source object to be validated before being attached as a map-layer.
   * @beta
   */
  public async validateSourceObj(source: MapLayerSource, opts?: ValidateSourceOptions): Promise<MapLayerSourceValidation> {
    const entry = this._formats.get(source.formatId);
    const format = entry?.type;
    return (format === undefined) ? { status: MapLayerSourceStatus.InvalidFormat } : format.validateSourceObj(source, opts);
  }
}

