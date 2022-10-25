/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import { getJson, request, RequestOptions, Response } from "../../../request/Request";
import { Cartographic, ImageMapLayerSettings, ImageSource, IModelStatus, ServerError } from "@itwin/core-common";
import { IModelApp } from "../../../IModelApp";
import { NotifyMessageDetails, OutputMessagePriority } from "../../../NotificationManager";
import {
  ArcGisErrorCode, ArcGISTileMap, ArcGisUtilities,
  ImageryMapTile, ImageryMapTileTree, MapCartoRectangle, MapFeatureInfoRecord, MapLayerAccessClient, MapLayerAccessToken, MapLayerFeatureInfo,
  MapLayerImageryProvider, MapLayerImageryProviderStatus, MapSubLayerFeatureInfo, QuadId,
} from "../../internal";
import { PropertyValueFormat, StandardTypeNames } from "@itwin/appui-abstract";
import { Range2d } from "@itwin/core-geometry";
import { isArray } from "lodash";

/** @internal */
export class ArcGISMapLayerImageryProvider extends MapLayerImageryProvider {
  private _maxDepthFromLod = 0;
  private _minDepthFromLod = 0;
  private _copyrightText = "Copyright";
  private _querySupported = false;
  private _tileMapSupported = false;
  private _tileMap: ArcGISTileMap|undefined;
  private _accessClient: MapLayerAccessClient|undefined;
  private _lastAccessToken: MapLayerAccessToken|undefined;
  public serviceJson: any;
  constructor(settings: ImageMapLayerSettings) {
    super(settings, false);
    this._accessClient = IModelApp.mapLayerFormatRegistry.getAccessClient(settings.formatId);
  }

  protected override get _filterByCartoRange() { return false; }      // Can't trust footprint ranges (USGS Hydro)

  public override get minimumZoomLevel() { return Math.max(super.minimumZoomLevel, this._minDepthFromLod); }
  public override get maximumZoomLevel() { return this._maxDepthFromLod > 0 ? this._maxDepthFromLod : super.maximumZoomLevel; }

  public uintToString(uintArray: any) {
    return Buffer.from(uintArray).toJSON();

  }

  private async fetchTile(row: number, column: number, zoomLevel: number): Promise<Response | undefined> {
    const tileRequestOptions: RequestOptions = { method: "GET", responseType: "arraybuffer" };
    tileRequestOptions.auth = this.getRequestAuthorization();
    const tileUrl: string = await this.constructUrl(row, column, zoomLevel);
    if (tileUrl.length === 0)
      return undefined;

    return request(tileUrl, tileRequestOptions);
  }

  public override async loadTile(row: number, column: number, zoomLevel: number): Promise<ImageSource | undefined> {

    if ((this.status === MapLayerImageryProviderStatus.RequireAuth)) {
      return undefined;
    }

    try {
      let tileResponse = await this.fetchTile(row, column, zoomLevel);
      if (tileResponse === undefined)
        return undefined;

      // Check the content type from the response, it might contain an authentication error that need to be reported.
      // Skip if the layer state was already invalid
      if (ArcGisUtilities.hasTokenError(tileResponse)) {

        if (this._accessClient?.invalidateToken !== undefined && this._lastAccessToken !== undefined)
          this._accessClient.invalidateToken(this._lastAccessToken);

        // Token might have expired, make a second attempt by forcing new token.
        if (this._settings.userName && this._settings.userName.length > 0 && this._lastAccessToken) {
          tileResponse = await this.fetchTile(row, column, zoomLevel);
          if (tileResponse === undefined)
            return undefined;
        }

        // OK at this point, if response still contain a token error, we assume end-user will
        // have to provide credentials again.  Change the layer status so we
        // don't make additional invalid requests..
        if (tileResponse && ArcGisUtilities.hasTokenError(tileResponse)) {
          // Check again layer status, it might have change during await.
          if (this.status === MapLayerImageryProviderStatus.Valid) {
            this.status = MapLayerImageryProviderStatus.RequireAuth;
            this.onStatusChanged.raiseEvent(this);

            // Only report error to end-user if we were previously able to fetch tiles
            // and then encountered an error, otherwise I assume an error was already reported
            // through the source validation process.
            if (this._hasSuccessfullyFetchedTile) {
              const msg = IModelApp.localization.getLocalizedString("iModelJs:MapLayers.Messages.LoadTileTokenError", { layerName: this._settings.name });
              IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Warning, msg));
            }
          }

          return undefined;
        }
      }

      if (!this._hasSuccessfullyFetchedTile) {
        this._hasSuccessfullyFetchedTile = true;
      }
      return this.getImageFromTileResponse(tileResponse, zoomLevel);
    } catch (error) {
      return undefined;
    }
  }
  protected override _generateChildIds(tile: ImageryMapTile, resolveChildren: (childIds: QuadId[]) => void) {
    const childIds = this.getPotentialChildIds(tile);
    if (tile.quadId.level < Math.max(1, this.minimumZoomLevel-1)) {
      resolveChildren(childIds);
      return;
    }

    if (this._tileMap) {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this._tileMap.getChildrenAvailability(childIds).then((availability) => {
        const availableChildIds = new Array<QuadId>();
        for (let i = 0; i < availability.length; i++)
          if (availability[i])
            availableChildIds.push(childIds[i]);

        resolveChildren (availableChildIds);
      });
    } else if (this._usesCachedTiles && this.cartoRange) {
      // Filter children by range
      const availableChildIds = new Array<QuadId>();
      // eslint-disable-next-line @typescript-eslint/prefer-for-of
      for (let i = 0; i < childIds.length; i++) {
        const childExtent = this.getEPSG4326Extent(childIds[i].row, childIds[i].column, childIds[i].level);

        const childRange = MapCartoRectangle.fromDegrees(childExtent.longitudeLeft, childExtent.latitudeBottom, childExtent.longitudeRight, childExtent.latitudeTop);
        if (childRange.intersectsRange(this.cartoRange)) {
          availableChildIds.push(childIds[i]);
        }
      }
      resolveChildren (availableChildIds);
    } else {
      resolveChildren (childIds);   // Resolve all children
    }
  }

  private isEpsg3857Compatible(tileInfo: any) {
    if (tileInfo.spatialReference?.latestWkid !== 3857 || !Array.isArray(tileInfo.lods))
      return false;

    const zeroLod = tileInfo.lods[0];
    return zeroLod.level === 0 && Math.abs(zeroLod.resolution - 156543.03392800014) < .001;
  }

  public override async initialize(): Promise<void> {

    const json = await ArcGisUtilities.getServiceJson(this._settings.url, this.getRequestAuthorization());
    if (json === undefined)
      throw new ServerError(IModelStatus.ValidationFailed, "");

    if (json?.error?.code === ArcGisErrorCode.TokenRequired || json?.error?.code === ArcGisErrorCode.InvalidToken) {
      // Check again layer status, it might have change during await.
      if (this.status === MapLayerImageryProviderStatus.Valid) {
        this.status = MapLayerImageryProviderStatus.RequireAuth;
        this.onStatusChanged.raiseEvent(this);
      }
    }

    if (json !== undefined) {
      this.serviceJson = json;

      if (json.capabilities) {

        this._querySupported = json.capabilities.indexOf("Query") >= 0;
        this._tileMapSupported = json.capabilities.indexOf("Tilemap") >= 0;
      }
      if (json.copyrightText)
        this._copyrightText = json.copyrightText;

      if (false !== (this._usesCachedTiles = json.tileInfo !== undefined && this.isEpsg3857Compatible(json.tileInfo))) {
        if (json.maxScale !== undefined && json.maxScale !== 0 && Array.isArray(json.tileInfo.lods)) {
          for (; this._maxDepthFromLod < json.tileInfo.lods.length && json.tileInfo.lods[this._maxDepthFromLod].scale > json.maxScale; this._maxDepthFromLod++)
            ;
        }
      }

      // Create tile map object only if we are going to request tiles from this server and it support tilemap requests.
      if (this._usesCachedTiles && this._tileMapSupported) {
        this._tileMap = new ArcGISTileMap(this._settings.url, this._settings, json.tileInfo?.lods?.length, this._accessClient);
      }

      // Read range using fullextent from service metadata
      if (json.fullExtent) {
        if (json.fullExtent.spatialReference.latestWkid === 3857 || json.fullExtent.spatialReference.wkid === 102100) {
          const range3857 = Range2d.createFrom({
            low: {x: json.fullExtent.xmin, y: json.fullExtent.ymin},
            high: {x: json.fullExtent.xmax, y: json.fullExtent.ymax} });

          const west = this.getEPSG4326Lon(range3857.xLow);
          const south = this.getEPSG4326Lat(range3857.yLow);
          const east = this.getEPSG4326Lon(range3857.xHigh);
          const north = this.getEPSG4326Lat(range3857.yHigh);
          this.cartoRange = MapCartoRectangle.fromDegrees(west, south, east, north);
        }
      }

      // Read minLOD if available
      if (json.minLOD !== undefined) {
        const minLod = parseInt(json.minLOD, 10);
        if (!Number.isNaN(minLod)) {
          this._minDepthFromLod = minLod;
        }
      } else if (json.minScale) {
        // Read min LOD using minScale
        const minScale = json.minScale;
        if (json.tileInfo?.lods !== undefined && isArray(json.tileInfo.lods)) {
          for (const lod of json.tileInfo.lods) {
            if (lod.scale < minScale) {
              this._minDepthFromLod = lod.level;
              break;
            }
          }
        }
      }
    }
  }

  public override addLogoCards(cards: HTMLTableElement): void {
    if (!cards.dataset.arcGisLogoCard) {
      cards.dataset.arcGisLogoCard = "true";
      cards.appendChild(IModelApp.makeLogoCard({ heading: "ArcGIS", notice: this._copyrightText }));
    }
  }

  // Translates the provided Cartographic into a EPSG:3857 point, and retrieve information.
  // tolerance is in pixels
  private async getIdentifyData(quadId: QuadId, carto: Cartographic, tolerance: number): Promise<any>   {
    const bboxString = this.getEPSG3857ExtentString(quadId.row, quadId.column, quadId.level);
    const x = this.getEPSG3857X(carto.longitudeDegrees);
    const y = this.getEPSG3857Y(carto.latitudeDegrees);
    const tmpUrl = `${this._settings.url}/identify?f=json&tolerance=${tolerance}&returnGeometry=false&sr=3857&imageDisplay=${this.tileSize},${this.tileSize},96&layers=${this.getLayerString("visible")}&geometry=${x},${y}&geometryType=esriGeometryPoint&mapExtent=${bboxString}`;
    const urlObj = new URL(tmpUrl);

    if (this._accessClient) {
      try {
        this._lastAccessToken = undefined;  // reset any previous accessToken, and rely on access client's cache
        this._lastAccessToken  = await ArcGisUtilities.appendSecurityToken(urlObj, this._accessClient, {mapLayerUrl: urlObj, userName: this._settings.userName, password: this._settings.password });
      } catch {
      }
    }

    let json = await getJson(urlObj.toString());
    if (json?.error?.code === ArcGisErrorCode.TokenRequired || json?.error?.code === ArcGisErrorCode.InvalidToken) {

      if (this._accessClient?.invalidateToken !== undefined && this._lastAccessToken !== undefined)
        this._accessClient.invalidateToken(this._lastAccessToken);

      // Token might have expired, make a second attempt by forcing new token.
      if (this._settings.userName && this._settings.userName.length > 0 && this._lastAccessToken ) {
        const urlObj2 = new URL(tmpUrl);
        if (this._accessClient) {
          try {
            await ArcGisUtilities.appendSecurityToken(urlObj, this._accessClient, {mapLayerUrl: urlObj, userName: this._settings.userName, password: this._settings.password });
          } catch {
          }
        }
        json = await getJson(urlObj2.toString());
      }

      // OK at this point, if response still contain a token error, we assume end-user will
      // have to provide credentials again.  Change the layer status so we
      // don't make additional invalid requests..
      if (json?.error?.code === ArcGisErrorCode.TokenRequired || json?.error?.code === ArcGisErrorCode.InvalidToken) {
      // Check again layer status, it might have change during await.
        if (this.status === MapLayerImageryProviderStatus.Valid) {
          this.status = MapLayerImageryProviderStatus.RequireAuth;
          const msg = IModelApp.localization.getLocalizedString("iModelJs:MapLayers.Messages.FetchTooltipTokenError", { layerName: this._settings.name });
          IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Warning, msg));
        }

        json =  undefined;
      }
    }

    return json;
  }

  // Makes an identify request to ESRI MapService server, and return it as a list of formatted strings
  public override async getToolTip(strings: string[], quadId: QuadId, carto: Cartographic, tree: ImageryMapTileTree): Promise<void> {
    await super.getToolTip(strings, quadId, carto, tree);

    if (!this._querySupported)
      return;

    const stringSet = new Set<string>();
    const json = await this.getIdentifyData(quadId, carto, 1);

    if (json && Array.isArray(json.results)) {
      for (const result of json.results) {
        if (result.attributes !== undefined && result.attributes[result.displayFieldName] !== undefined) {
          const thisString = `${result.displayFieldName}: ${result.attributes[result.displayFieldName]}`;
          if (!stringSet.has(thisString)) {
            strings.push(thisString);
            stringSet.add(thisString);
          }
        }
      }
    }
  }

  // Makes an identify request to ESRI MapService , and return it as a list MapLayerFeatureInfo object
  public  override async getFeatureInfo(featureInfos: MapLayerFeatureInfo[], quadId: QuadId, carto: Cartographic, _tree: ImageryMapTileTree): Promise<void> {
    if (!this._querySupported)
      return;

    const json = await this.getIdentifyData(quadId, carto,5 );
    if (json && Array.isArray(json.results)) {
      const layerInfo: MapLayerFeatureInfo = {layerName: this._settings.name};

      for (const result of json.results) {

        const subLayerInfo: MapSubLayerFeatureInfo = {
          subLayerName: result.layerName ?? "",
          displayFieldName: result.displayFieldName,
          records : [],
        };
        for (const [key, value] of Object.entries(result.attributes)) {
          // Convert everything to string for now
          const strValue = String(value);
          subLayerInfo.records?.push(new MapFeatureInfoRecord (
            {valueFormat:PropertyValueFormat.Primitive, value:strValue, displayValue: strValue},
            {name: key, displayLabel: key, typename:StandardTypeNames.String}
          ));
        }

        if (layerInfo.info === undefined) {
          layerInfo.info = [];
        }

        if (!(layerInfo.info instanceof HTMLElement)) {
          layerInfo.info.push(subLayerInfo);
        }

      }

      featureInfos.push(layerInfo);
    }
  }

  protected getLayerString(prefix = "show"): string {
    const layers = new Array<string>();
    this._settings.subLayers.forEach((subLayer) => {
      if (this._settings.isSubLayerVisible(subLayer))
        layers.push(subLayer.idString);
    });

    return `${prefix}: ${layers.join(",")} `;
  }

  // construct the Url from the desired Tile
  public async constructUrl(row: number, column: number, zoomLevel: number): Promise<string> {
    let tmpUrl;
    if (this._usesCachedTiles) {
      tmpUrl = `${this._settings.url}/tile/${zoomLevel}/${row}/${column} `;
    } else {
      const bboxString = `${this.getEPSG3857ExtentString(row, column, zoomLevel)}&bboxSR=3857`;
      tmpUrl = `${this._settings.url}/export?bbox=${bboxString}&size=${this.tileSize},${this.tileSize}&layers=${this.getLayerString()}&format=png&transparent=${this.transparentBackgroundString}&f=image&sr=3857&imagesr=3857`;
    }
    const urlObj = new URL(tmpUrl);
    try {
      if (this._accessClient) {
        this._lastAccessToken = undefined;  // reset any previous accessToken, and rely on access client's cache
        this._lastAccessToken = await ArcGisUtilities.appendSecurityToken(urlObj, this._accessClient, {
          mapLayerUrl: new URL(this._settings.url),
          userName: this._settings.userName,
          password: this._settings.password });
      }

    } catch {
    }
    return urlObj.toString();
  }
}
