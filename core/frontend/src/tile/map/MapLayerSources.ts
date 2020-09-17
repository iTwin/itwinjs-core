/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Views */

import { compareStrings } from "@bentley/bentleyjs-core";
import { Point2d } from "@bentley/geometry-core";
import { BackgroundMapProps, BackgroundMapSettings, BackgroundMapType, MapLayerProps, MapLayerSettings, MapSubLayerProps } from "@bentley/imodeljs-common";
import { getJson, RequestBasicCredentials } from "@bentley/itwin-client";
import { FrontendRequestContext } from "../../FrontendRequestContext";
import { IModelApp } from "../../IModelApp";
import { IModelConnection } from "../../IModelConnection";
import { ArcGisUtilities, MapCartoRectangle, MapLayerSourceValidation } from "../internal";
import { MapLayerSettingsService } from "./MapLayerSettingsService";
import { NotifyMessageDetails, OutputMessagePriority } from "../../NotificationManager";

/** @internal */
export enum MapLayerSourceStatus {
  Valid,
  InvalidFormat,
  InvalidUrl,
}

/** A source for map layers.  These may be catalogued for convenient use by users or applications.
 * @internal
 */
export class MapLayerSource implements MapLayerProps {
  public subLayers?: MapSubLayerProps[];
  private constructor(public formatId: string, public name: string, public url: string, public baseMap = false, public transparentBackground?: boolean, public maxZoom?: number, public userName?: string, public password?: string) { }
  public static fromJSON(json: any): MapLayerSource | undefined {
    const baseMap = json.baseMap === true || (json.url && json.url.toLowerCase().indexOf("basemap") >= 0);
    return (typeof json.name === "string" && typeof json.url === "string" && typeof json.formatId === "string") ? new MapLayerSource(json.formatId, json.name, json.url, baseMap, json.transparentBackground === undefined ? true : json.transparentBackground, json.maxZoom, json.userName, json.password) : undefined;
  }

  public async validateSource(): Promise<MapLayerSourceValidation> {
    return IModelApp.mapLayerFormatRegistry.validateSource(this.formatId, this.url, this.getCredentials());
  }
  public static fromBackgroundMapProps(props: BackgroundMapProps) {
    const settings = BackgroundMapSettings.fromJSON(props);
    if (undefined !== settings) {
      const layerSettings = MapLayerSettings.fromMapSettings(settings);
      if (undefined !== layerSettings) {
        const source = MapLayerSource.fromJSON(layerSettings);
        source!.baseMap = true;
        return source;
      }
    }
    return undefined;
  }
  public toJSON() {
    return { url: this.url, name: this.name, formatId: this.formatId, maxZoom: this.maxZoom, transparentBackground: this.transparentBackground };
  }
  private getCredentials(): RequestBasicCredentials | undefined {
    return this.userName && this.password ? { user: this.userName, password: this.password } : undefined;
  }
}
/** A collection of [[MapLayerSource]] objects.
 * @internal
 */

export class MapLayerSources {
  private static _instance?: MapLayerSources;
  private constructor(private _sources: MapLayerSource[]) { }

  public findByName(name: string, baseMap: boolean = false): MapLayerSource | undefined {
    const nameTest = name.toLowerCase();
    for (const source of this._sources)
      if (source.baseMap === baseMap && source.name.toLowerCase().indexOf(nameTest) !== -1)
        return source;

    return undefined;
  }
  public get layers(): MapLayerSource[] {
    const layers = new Array<MapLayerSource>();
    this._sources.forEach((source) => { if (!source.baseMap) layers.push(source); });
    return layers;
  }
  public get allSource() { return this._sources; }
  public get bases(): MapLayerSource[] {
    const layers = new Array<MapLayerSource>();
    this._sources.forEach((source) => { if (source.baseMap) layers.push(source); });
    return layers;
  }

  public static async create(iModel?: IModelConnection, queryForPublicSources = false): Promise<MapLayerSources> {
    if (!queryForPublicSources && MapLayerSources._instance)
      return MapLayerSources._instance;

    if (!iModel)
      iModel = IModelApp.viewManager.selectedView ? IModelApp.viewManager.selectedView.iModel : undefined;

    let sourceRange = MapCartoRectangle.create();
    if (iModel) {
      const projectCenter = iModel.projectExtents.localXYZToWorld(.5, .5, .5)!;
      const cartoCenter = iModel.spatialToCartographicFromEcef(projectCenter);
      const globeRange = MapCartoRectangle.create();
      const nearDelta = Point2d.create(globeRange.xLength() / 100, globeRange.yLength() / 100);
      sourceRange = MapCartoRectangle.create(cartoCenter.longitude - nearDelta.x, cartoCenter.latitude - nearDelta.y, cartoCenter.longitude + nearDelta.x, cartoCenter.latitude + nearDelta.y);
    }

    const sources = new Array<MapLayerSource>();
    const urlSet = new Set<string>();
    const addSource = ((source: MapLayerSource) => {
      if (!urlSet.has(source.url)) {
        sources.push(source);
        urlSet.add(source.url);
      }
    });

    addSource(MapLayerSource.fromBackgroundMapProps({ providerName: "BingProvider", providerData: { mapType: BackgroundMapType.Street } })!);
    addSource(MapLayerSource.fromBackgroundMapProps({ providerName: "BingProvider", providerData: { mapType: BackgroundMapType.Aerial } })!);
    addSource(MapLayerSource.fromBackgroundMapProps({ providerName: "BingProvider", providerData: { mapType: BackgroundMapType.Hybrid } })!);

    // For now just omit the search for Mapbox sources.
    const addMapBoxSources = false;
    if (addMapBoxSources) {
      addSource(MapLayerSource.fromBackgroundMapProps({ providerName: "MapBoxProvider", providerData: { mapType: BackgroundMapType.Street } })!);
      addSource(MapLayerSource.fromBackgroundMapProps({ providerName: "MapBoxProvider", providerData: { mapType: BackgroundMapType.Aerial } })!);
      addSource(MapLayerSource.fromBackgroundMapProps({ providerName: "MapBoxProvider", providerData: { mapType: BackgroundMapType.Hybrid } })!);
    }

    const requestContext = new FrontendRequestContext();
    const sourcesJson = await getJson(requestContext, "assets/MapLayerSources.json");

    for (const sourceJson of sourcesJson) {
      const source = MapLayerSource.fromJSON(sourceJson);
      if (source)
        addSource(source);
    }

    // For now just omit the search for USGS or Disco sources.
    const queryForUSGSSources = false /* queryForPublicSources */, queryForDiscoMapSources = false /* queryForPublicSources */;

    if (queryForUSGSSources) {
      (await ArcGisUtilities.getServiceDirectorySources("https://basemap.nationalmap.gov/arcgis/rest/services")).forEach((source) => addSource(source));
      (await ArcGisUtilities.getServiceDirectorySources("https://index.nationalmap.gov/arcgis/rest/services")).forEach((source) => addSource(source));
      (await ArcGisUtilities.getServiceDirectorySources("https://hydro.nationalmap.gov/arcgis/rest/services")).forEach((source) => addSource(source));
      (await ArcGisUtilities.getServiceDirectorySources("https://carto.nationalmap.gov/arcgis/rest/services")).forEach((source) => addSource(source));
      (await ArcGisUtilities.getServiceDirectorySources("https://elevation.nationalmap.gov/arcgis/rest/services")).forEach((source) => addSource(source));
    }
    if (queryForDiscoMapSources)
      (await ArcGisUtilities.getServiceDirectorySources("https://land.discomap.eea.europa.eu/arcgis/rest/services")).forEach((source) => addSource(source));

    (await ArcGisUtilities.getSourcesFromQuery(sourceRange)).forEach((queriedSource) => addSource(queriedSource));
    if (iModel && iModel.contextId && iModel.iModelId) {
      try {
        (await MapLayerSettingsService.getSourcesFromSettingsService(iModel.contextId, iModel.iModelId)).forEach((source) => addSource(source));
      } catch (err) {
        IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Error, IModelApp.i18n.translate("mapLayers:CustomAttach.ErrorLoadingLayers"), err.toString()));
      }
    }


    sources.sort((a: MapLayerSource, b: MapLayerSource) => compareStrings(a.name.toLowerCase(), b.name.toLowerCase()));

    const mapLayerSources = new MapLayerSources(sources);
    if (!queryForUSGSSources) MapLayerSources._instance = mapLayerSources;

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
}
