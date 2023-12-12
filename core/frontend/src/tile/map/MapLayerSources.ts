/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module MapLayers
 */

import { compareStrings } from "@itwin/core-bentley";
import {
  BackgroundMapProvider, BackgroundMapType, BaseMapLayerSettings, DeprecatedBackgroundMapProps, ImageMapLayerSettings, MapSubLayerProps,
} from "@itwin/core-common";
import { Point2d } from "@itwin/core-geometry";
import { IModelApp } from "../../IModelApp";
import { IModelConnection } from "../../IModelConnection";
import { request, RequestBasicCredentials } from "../../request/Request";
import { ArcGisUtilities, MapCartoRectangle, MapLayerSourceValidation } from "../internal";

/** Values for return codes from [[MapLayerSource.validateSource]]
 * @public
 */
export enum MapLayerSourceStatus {
  /** Layer source is valid */
  Valid,
  /** Authorization has failed when accessing this layer source. */
  InvalidCredentials,
  /** Provided format id could not be resolved in [[MapLayerFormatRegistry]] */
  InvalidFormat,
  /** The tiling schema of the source is not supported */
  InvalidTileTree,
  /** Could not not connect to remote server using the provided URL.*/
  InvalidUrl,
  /** Authorization is required to access this map layer source. */
  RequireAuth,
  /** Map-layer coordinate system is not supported */
  InvalidCoordinateSystem,
  /** Format is not compatible with the URL provided.
   */
  IncompatibleFormat,
}

/** JSON representation of a map layer source.
 * @see [ImageryMapLayerFormatId]($common)
 * @public
 */
export interface MapLayerSourceProps {
  /** Identifies the map layers source. Defaults to 'WMS'. */
  formatId?: string;
  /** Name */
  name: string;
  /** URL of the source's endpoint. */
  url: string;
  /** True to indicate background is transparent.  Defaults to 'true'. */
  transparentBackground?: boolean;
  /** Indicate if this source definition should be used as a base map. Defaults to false. */
  baseMap?: boolean;

  /** List of query parameters that will get appended to the source.
   * @beta
  */
  queryParams?: { [key: string]: string };
}

/** A source for map layers. These may be catalogued for convenient use by users or applications.
 * @public
 */
export class MapLayerSource {
  public formatId: string;
  public name: string;
  public url: string;
  public baseMap = false;
  public transparentBackground?: boolean;
  public userName?: string;
  public password?: string;

  /** List of query parameters that will get appended to the source URL that should be be persisted part of the JSON representation.
   * @beta
  */
  public savedQueryParams?: { [key: string]: string };

  /** List of query parameters that will get appended to the source URL that should *not* be be persisted part of the JSON representation.
   * @beta
  */
  public unsavedQueryParams?: { [key: string]: string };

  private constructor(formatId = "WMS", name: string, url: string, baseMap = false, transparentBackground = true, savedQueryParams?: { [key: string]: string}) {
    this.formatId = formatId;
    this.name = name;
    this.url = url;
    this.baseMap = baseMap;
    this.transparentBackground = transparentBackground;
    this.savedQueryParams = savedQueryParams;
  }

  public static fromJSON(json: MapLayerSourceProps): MapLayerSource | undefined {
    if (json === undefined)
      return undefined;

    return new MapLayerSource(json.formatId, json.name, json.url, json.baseMap, json.transparentBackground, json.queryParams);
  }

  public async validateSource(ignoreCache?: boolean): Promise<MapLayerSourceValidation> {
    return IModelApp.mapLayerFormatRegistry.validateSource({source: this, ignoreCache});
  }

  /** @internal*/
  public static fromBackgroundMapProps(props: DeprecatedBackgroundMapProps) {
    const provider = BackgroundMapProvider.fromBackgroundMapProps(props);
    const layerSettings = BaseMapLayerSettings.fromProvider(provider);
    if (undefined !== layerSettings) {
      const source = MapLayerSource.fromJSON(layerSettings);
      if (source) {
        source.baseMap = true;
        return source;
      }
    }

    return undefined;
  }
  public toJSON(): Omit<MapLayerSourceProps, "formatId"> & {formatId: string}  {
    return { url: this.url, name: this.name, formatId: this.formatId, transparentBackground: this.transparentBackground, queryParams: this.savedQueryParams };
  }

  public toLayerSettings(subLayers?: MapSubLayerProps[]): ImageMapLayerSettings | undefined {
    // When MapLayerSetting is created from a MapLayerSource, sub-layers and credentials need to be set separately.
    const layerSettings = ImageMapLayerSettings.fromJSON({ ...this, subLayers });
    if (this.userName !== undefined || this.password !== undefined) {
      layerSettings?.setCredentials(this.userName, this.password);
    }

    if (this.savedQueryParams) {
      layerSettings.savedQueryParams = {...this.savedQueryParams};
    }

    if (this.unsavedQueryParams) {
      layerSettings.unsavedQueryParams = {...this.unsavedQueryParams};
    }
    return layerSettings;
  }

  private getCredentials(): RequestBasicCredentials | undefined {
    return this.userName && this.password ? { user: this.userName, password: this.password } : undefined;
  }

  /** Collect all query parameters
 * @beta
 */
  public collectQueryParams() {
    let queryParams: {[key: string]: string} = {};

    if (this.savedQueryParams)
      queryParams = {...this.savedQueryParams};
    if (this.unsavedQueryParams)
      queryParams = {...queryParams, ...this.unsavedQueryParams};
    return queryParams;
  }

}

/** A collection of [[MapLayerSource]] objects.
 * @beta
 */
export class MapLayerSources {
  private static _instance?: MapLayerSources;
  private constructor(private _sources: MapLayerSource[]) { }

  public static getInstance() { return MapLayerSources._instance; }

  public findByName(name: string, baseMap: boolean = false): MapLayerSource | undefined {
    const nameTest = name.toLowerCase();
    for (const source of this._sources)
      if (source.baseMap === baseMap && source.name.toLowerCase().indexOf(nameTest) !== -1)
        return source;

    return undefined;
  }
  public get layers(): MapLayerSource[] {
    const layers = new Array<MapLayerSource>();
    this._sources.forEach((source) => {
      if (!source.baseMap)
        layers.push(source);
    });

    return layers;
  }
  public get allSource() { return this._sources; }
  public get bases(): MapLayerSource[] {
    const layers = new Array<MapLayerSource>();
    this._sources.forEach((source) => {
      if (source.baseMap)
        layers.push(source);
    });

    return layers;
  }

  private static getBingMapLayerSource(): MapLayerSource[] {
    const mapLayerSources: MapLayerSource[] = [];
    mapLayerSources.push(MapLayerSource.fromBackgroundMapProps({ providerName: "BingProvider", providerData: { mapType: BackgroundMapType.Street } })!);
    mapLayerSources.push(MapLayerSource.fromBackgroundMapProps({ providerName: "BingProvider", providerData: { mapType: BackgroundMapType.Aerial } })!);
    mapLayerSources.push(MapLayerSource.fromBackgroundMapProps({ providerName: "BingProvider", providerData: { mapType: BackgroundMapType.Hybrid } })!);
    return mapLayerSources;
  }

  private static getMapBoxLayerSource(): MapLayerSource[] {
    const mapLayerSources: MapLayerSource[] = [];
    mapLayerSources.push(MapLayerSource.fromBackgroundMapProps({ providerName: "MapBoxProvider", providerData: { mapType: BackgroundMapType.Street } })!);
    mapLayerSources.push(MapLayerSource.fromBackgroundMapProps({ providerName: "MapBoxProvider", providerData: { mapType: BackgroundMapType.Aerial } })!);
    mapLayerSources.push(MapLayerSource.fromBackgroundMapProps({ providerName: "MapBoxProvider", providerData: { mapType: BackgroundMapType.Hybrid } })!);
    return mapLayerSources;
  }

  public static async create(iModel?: IModelConnection, queryForPublicSources = false, addMapBoxSources = false): Promise<MapLayerSources> {
    if (!queryForPublicSources && MapLayerSources._instance)
      return MapLayerSources._instance;

    if (!iModel)
      iModel = IModelApp.viewManager.selectedView ? IModelApp.viewManager.selectedView.iModel : undefined;

    let sourceRange = MapCartoRectangle.createMaximum();
    if (iModel) {
      const projectCenter = iModel.projectExtents.localXYZToWorld(.5, .5, .5)!;
      const cartoCenter = iModel.spatialToCartographicFromEcef(projectCenter);
      const globeRange = MapCartoRectangle.createMaximum();
      const nearDelta = Point2d.create(globeRange.xLength() / 100, globeRange.yLength() / 100);
      sourceRange = MapCartoRectangle.fromRadians(cartoCenter.longitude - nearDelta.x, cartoCenter.latitude - nearDelta.y, cartoCenter.longitude + nearDelta.x, cartoCenter.latitude + nearDelta.y);
    }

    const sources = new Array<MapLayerSource>();
    const urlSet = new Set<string>();
    const addSource = ((source: MapLayerSource) => {
      if (!urlSet.has(source.url)) {
        sources.push(source);
        urlSet.add(source.url);
      }
    });

    this.getBingMapLayerSource().forEach((source) => {
      addSource(source);
    });

    if (addMapBoxSources) {
      this.getMapBoxLayerSource().forEach((source) => {
        addSource(source);
      });
    }

    if (queryForPublicSources) {
      const sourcesJson = await request(`${IModelApp.publicPath}assets/MapLayerSources.json`, "json");

      for (const sourceJson of sourcesJson) {
        const source = MapLayerSource.fromJSON(sourceJson);
        if (source)
          addSource(source);
      }

      (await ArcGisUtilities.getSourcesFromQuery(sourceRange)).forEach((queriedSource) => addSource(queriedSource));
    }

    sources.sort((a: MapLayerSource, b: MapLayerSource) => compareStrings(a.name.toLowerCase(), b.name.toLowerCase()));

    const mapLayerSources = new MapLayerSources(sources);
    MapLayerSources._instance = mapLayerSources;

    return mapLayerSources;
  }
  public static async addSourceToMapLayerSources(mapLayerSource?: MapLayerSource): Promise<MapLayerSources | undefined> {
    if (!MapLayerSources._instance || !mapLayerSource) {
      return undefined;
    }
    MapLayerSources._instance._sources = MapLayerSources._instance._sources.filter((source) => {
      return !(source.name === mapLayerSource.name || source.url === mapLayerSource.url);
    });

    MapLayerSources._instance._sources.push(mapLayerSource);
    MapLayerSources._instance._sources.sort((a: MapLayerSource, b: MapLayerSource) => compareStrings(a.name.toLowerCase(), b.name.toLowerCase()));
    return MapLayerSources._instance;
  }

  public static removeLayerByName(name: string): boolean {
    if (!MapLayerSources._instance) {
      return false;
    }

    // For now we only rely on the name
    const lengthBeforeRemove = MapLayerSources._instance._sources.length;
    MapLayerSources._instance._sources = MapLayerSources._instance._sources.filter((source) => {
      return (source.name !== name);
    });
    return (lengthBeforeRemove !== MapLayerSources._instance._sources.length);
  }
}
