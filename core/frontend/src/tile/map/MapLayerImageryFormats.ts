/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import { BeEvent, ClientRequestContext, Dictionary, IModelStatus } from "@bentley/bentleyjs-core";
import { Point2d } from "@bentley/geometry-core";
import { Cartographic, ImageSource, ImageSourceFormat, MapLayerSettings, MapSubLayerProps, ServerError } from "@bentley/imodeljs-common";
import { getJson, request, RequestBasicCredentials, RequestOptions, Response } from "@bentley/itwin-client";
import { IModelApp } from "../../IModelApp";
import { IModelConnection } from "../../IModelConnection";
import { ArcGisErrorCode, NotifyMessageDetails, OutputMessagePriority } from "../../imodeljs-frontend";
import { ScreenViewport } from "../../Viewport";
import { ArcGisTokenClientType, BingMapsImageryLayerProvider, ImageryMapLayerTreeReference, ImageryMapTile, ImageryMapTileTree, MapLayerFormat, MapLayerSourceStatus, MapLayerSourceValidation, MapLayerTileTreeReference, QuadId, WmsUtilities } from "../internal";
import { ArcGisTokenManager } from "./ArcGisTokenManager";
import { ArcGisUtilities } from "./ArcGisUtilities";
import { MapCartoRectangle } from "./MapCartoRectangle";
import { WmsCapabilities, WmsCapability } from "./WmsCapabilities";
import { WmtsCapabilities, WmtsCapability } from "./WmtsCapabilities";

const tileImageSize = 256, untiledImageSize = 256;
// eslint-disable-next-line prefer-const
let doToolTips = true;

/** @internal */
export enum MapLayerImageryProviderStatus {
  Valid,
  RequireAuth,
}

const scratchPoint2d = Point2d.createZero();

/** Base class imagery map layer formats.  Subclasses should override formatId and [[MapLayerFormat.createImageryProvider]].
 * @internal
 */
export class ImageryMapLayerFormat extends MapLayerFormat {
  public static createMapLayerTree(layerSettings: MapLayerSettings, layerIndex: number, iModel: IModelConnection): MapLayerTileTreeReference | undefined {
    return new ImageryMapLayerTreeReference(layerSettings, layerIndex, iModel);
  }
}

/** Base class for map layer imagery providers.
 * @internal
 */
export abstract class MapLayerImageryProvider {
  public status: MapLayerImageryProviderStatus = MapLayerImageryProviderStatus.Valid;
  public readonly onStatusChanged = new BeEvent<(provider: MapLayerImageryProvider) => void>();

  public get tileSize(): number { return this._usesCachedTiles ? tileImageSize : untiledImageSize; }
  public get maximumScreenSize() { return 2 * this.tileSize; }
  public get minimumZoomLevel(): number { return 4; }
  public get maximumZoomLevel(): number { return 22; }
  public get usesCachedTiles() { return this._usesCachedTiles; }
  public get mutualExclusiveSubLayer(): boolean { return false; }
  public cartoRange?: MapCartoRectangle;
  protected get _filterByCartoRange() { return true; }
  constructor(protected readonly _settings: MapLayerSettings, protected _usesCachedTiles: boolean) { }

  public async initialize(): Promise<void> {
    this.loadTile(0, 0, 22).then((tileData: ImageSource | undefined) => { // eslint-disable-line @typescript-eslint/no-floating-promises
      if (tileData !== undefined) this._missingTileData = tileData.data as Uint8Array;
    });
  }
  protected _requestContext = new ClientRequestContext("");
  public abstract async constructUrl(row: number, column: number, zoomLevel: number): Promise<string>;

  public getLogo(_viewport: ScreenViewport): HTMLTableRowElement | undefined { return undefined; }
  protected _missingTileData?: Uint8Array;
  public get transparentBackgroundString(): string { return this._settings.transparentBackground ? "true" : "false"; }

  protected async _areChildrenAvailable(_tile: ImageryMapTile): Promise<boolean> { return true; }
  protected _testChildAvailability(_tile: ImageryMapTile, resolveChildren: () => void) { resolveChildren(); }

  public testChildAvailability(tile: ImageryMapTile, resolveChildren: () => void) {
    if (tile.depth >= this.maximumZoomLevel || (undefined !== this.cartoRange && this._filterByCartoRange && !this.cartoRange.intersectsRange(tile.rectangle))) {
      tile.setLeaf();
      return;
    }
    this._testChildAvailability(tile, resolveChildren);
  }

  public async getToolTip(_strings: string[], _quadId: QuadId, _carto: Cartographic, _tree: ImageryMapTileTree): Promise<void> {
  }

  protected getRequestAuthorization(): RequestBasicCredentials | undefined {
    return (this._settings.userName && this._settings.password) ? { user: this._settings.userName, password: this._settings.password } : undefined;
  }

  protected getImageFromTileResponse(tileResponse: Response, zoomLevel: number) {
    const byteArray: Uint8Array = new Uint8Array(tileResponse.body);
    if (!byteArray || (byteArray.length === 0))
      return undefined;
    if (this.matchesMissingTile(byteArray) && zoomLevel > 8)
      return undefined;
    let imageFormat: ImageSourceFormat;
    switch (tileResponse.header["content-type"]) {
      case "image/jpeg":
        imageFormat = ImageSourceFormat.Jpeg;
        break;
      case "image/png":
        imageFormat = ImageSourceFormat.Png;
        break;
      default:
        return undefined;
    }

    return new ImageSource(byteArray, imageFormat);
  }

  public async loadTile(row: number, column: number, zoomLevel: number): Promise<ImageSource | undefined> {
    const tileRequestOptions: RequestOptions = { method: "GET", responseType: "arraybuffer" };
    tileRequestOptions.auth = this.getRequestAuthorization();
    try {
      const tileUrl: string = await this.constructUrl(row, column, zoomLevel);
      if (tileUrl.length === 0)
        return undefined;

      const tileResponse: Response = await request(this._requestContext, tileUrl, tileRequestOptions);
      return this.getImageFromTileResponse(tileResponse, zoomLevel);
    } catch (error) {
      return undefined;
    }
  }

  protected async toolTipFromUrl(strings: string[], url: string): Promise<void> {

    const requestOptions: RequestOptions = {
      method: "GET",
      responseType: "text",
      auth: this.getRequestAuthorization(),
    }; // spell-checker: disable-line

    try {
      const response: Response = await request(this._requestContext, url, requestOptions);
      if (undefined !== response.text) {
        strings.push(response.text);
      }
    } catch {
    }
  }
  protected async toolTipFromJsonUrl(_strings: string[], url: string): Promise<void> {
    try {
      const json = await getJson(this._requestContext, url);
      if (undefined !== json) {

      }
    } catch { }
  }

  public matchesMissingTile(tileData: Uint8Array): boolean {
    if (!this._missingTileData)
      return false;
    if (tileData.length !== this._missingTileData.length)
      return false;
    for (let i: number = 0; i < tileData.length; i += 10) {
      if (this._missingTileData[i] !== tileData[i]) {
        return false;
      }
    }
    return true;
  }
  // calculates the projected x cartesian coordinate in EPSG:3857from the longitude in EPSG:4326 (WGS84)
  public getEPSG3857X(longitude: number): number {
    return longitude * 20037508.34 / 180.0;
  }

  // calculates the projected y cartesian coordinate in EPSG:3857from the latitude in EPSG:4326 (WGS84)
  public getEPSG3857Y(latitude: number): number {
    const y = Math.log(Math.tan((90.0 + latitude) * Math.PI / 360.0)) / (Math.PI / 180.0);
    return y * 20037508.34 / 180.0;
  }

  // Map tile providers like Bing and Mapbox allow the URL to be constructed directory from the zoom level and tile coordinates.
  // However, WMS-based servers take a bounding box instead. This method can help get that bounding box from a tile.
  public getEPSG3857Extent(row: number, column: number, zoomLevel: number): { left: number, right: number, top: number, bottom: number } {
    const mapSize = 256 << zoomLevel;
    const leftGrid = 256 * column;
    const topGrid = 256 * row;

    const longitudeLeft = 360 * ((leftGrid / mapSize) - 0.5);
    const y0 = 0.5 - ((topGrid + 256) / mapSize);
    const latitudeBottom = 90.0 - 360.0 * Math.atan(Math.exp(-y0 * 2 * Math.PI)) / Math.PI;

    const longitudeRight = 360 * (((leftGrid + 256) / mapSize) - 0.5);
    const y1 = 0.5 - (topGrid / mapSize);
    const latitudeTop = 90.0 - 360.0 * Math.atan(Math.exp(-y1 * 2 * Math.PI)) / Math.PI;

    const left = this.getEPSG3857X(longitudeLeft);
    const right = this.getEPSG3857X(longitudeRight);
    const bottom = this.getEPSG3857Y(latitudeBottom);
    const top = this.getEPSG3857Y(latitudeTop);

    return { left, right, bottom, top };
  }
  public getEPSG3857ExtentString(row: number, column: number, zoomLevel: number) {
    const tileExtent = this.getEPSG3857Extent(row, column, zoomLevel);
    return `${tileExtent.left.toFixed(2)},${tileExtent.bottom.toFixed(2)},${tileExtent.right.toFixed(2)},${tileExtent.top.toFixed(2)}`;
  }
}

class WmsMapLayerImageryProvider extends MapLayerImageryProvider {
  private _capabilities?: WmsCapabilities;
  private _allLayersRange?: MapCartoRectangle;
  private _subLayerRanges = new Map<string, MapCartoRectangle>();
  private _baseUrl: string;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  private _isVersion1_1 = false;
  constructor(settings: MapLayerSettings) {
    super(settings, false);
    this._baseUrl = WmsUtilities.getBaseUrl(this._settings.url);
  }

  public async initialize(): Promise<void> {
    try {
      this._capabilities = await WmsCapabilities.create(this._baseUrl);
      if (undefined !== this._capabilities) {
        this._allLayersRange = this._capabilities.cartoRange;
        this._isVersion1_1 = this._capabilities.version !== undefined && 0 === this._capabilities.version.indexOf("1.1");
        if (this._capabilities.layer && Array.isArray(this._capabilities.layer.subLayers)) {
          const mapCartoRanges = ((subLayer: WmsCapability.SubLayer) => {
            if (Array.isArray(subLayer.children))
              subLayer.children.forEach((child) => mapCartoRanges(child));
            else if (subLayer.cartoRange)
              this._subLayerRanges.set(subLayer.name, subLayer.cartoRange);
          });
          this._capabilities.layer.subLayers.forEach((subLayer) => mapCartoRanges(subLayer));
          this._settings.subLayers.forEach((subLayer) => {
            if (subLayer.isNamed && this._settings.isSubLayerVisible(subLayer)) {
              const subLayerRange = this._subLayerRanges.get(subLayer.name);
              if (subLayerRange)
                if (this.cartoRange)
                  this.cartoRange.extendRange(subLayerRange);
                else
                  this.cartoRange = subLayerRange.clone();
            }
          });
        }

        if (!this.cartoRange)
          this.cartoRange = this._allLayersRange;
      }
    } catch (error) {
      throw new ServerError(IModelStatus.ValidationFailed, "");
    }
  }

  private getVisibleLayerString() {
    const layerNames = this.getVisibleLayers();
    return layerNames.join("%2C");
  }
  private getVisibleLayers(): string[] {
    const layerNames = new Array<string>();
    this._settings.subLayers.forEach((subLayer) => { if (this._settings.isSubLayerVisible(subLayer) && subLayer.isNamed) layerNames.push(subLayer.name); });
    return layerNames;
  }

  private getQueryableLayers(): string[] {
    const layerNames = new Array<string>();
    const getQueryableSubLayers = ((subLayer: WmsCapability.SubLayer) => {
      if (!subLayer)
        return;

      if (subLayer.queryable)
        layerNames.push(subLayer.name);

      subLayer.children?.forEach((childSubLayer) => { getQueryableSubLayers(childSubLayer); });
    });
    this._capabilities?.layer?.subLayers?.forEach((subLayer) => { getQueryableSubLayers(subLayer); });
    return layerNames;
  }

  private getVisibleQueryableLayersString(): string {
    const layers = new Array<string>();
    const queryables = this.getQueryableLayers();
    const visibles = this.getVisibleLayers();
    queryables.forEach((layer: string) => { if (visibles.includes(layer)) layers.push(layer); });
    return layers.join("%2C");
  }

  // construct the Url from the desired Tile
  public async constructUrl(row: number, column: number, zoomLevel: number): Promise<string> {
    const bboxString = this.getEPSG3857ExtentString(row, column, zoomLevel);
    const layerString = this.getVisibleLayerString();
    return `${this._baseUrl}?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&FORMAT=image%2Fpng&TRANSPARENT=${this.transparentBackgroundString}&LAYERS=${layerString}&WIDTH=${this.tileSize}&HEIGHT=${this.tileSize}&CRS=EPSG%3A3857&STYLES=&BBOX=${bboxString}`;
  }

  public async getToolTip(strings: string[], quadId: QuadId, carto: Cartographic, tree: ImageryMapTileTree): Promise<void> {
    await super.getToolTip(strings, quadId, carto, tree);
    const infoFormats = this._capabilities?.featureInfoFormats;
    if (!doToolTips || undefined === infoFormats)
      return;
    let formatString = infoFormats.find((format) => format === "text/html");
    if (!formatString) formatString = infoFormats[0];

    const bboxString = this.getEPSG3857ExtentString(quadId.row, quadId.column, quadId.level);
    const layerString = this.getVisibleQueryableLayersString();
    if (layerString.length === 0)
      return;
    const rectangle = tree.getTileRectangle(quadId);
    const fraction = rectangle.worldToLocal(Point2d.create(carto.longitude, carto.latitude, scratchPoint2d))!;
    const x = Math.floor(.5 + fraction.x * this.tileSize);
    const y = Math.floor(.5 + (1.0 - fraction.y) * this.tileSize);
    const coordinateString = (false && this._isVersion1_1) ? `&x=${x}&y=${y}` : `&i=${x}&j=${y}`;
    const getFeatureUrl = `${this._baseUrl}?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetFeatureInfo&LAYERS=${layerString}&WIDTH=${this.tileSize}&HEIGHT=${this.tileSize}&CRS=EPSG%3A3857&BBOX=${bboxString}&QUERY_LAYERS=${layerString}${coordinateString}&info_format=${formatString}`;
    return this.toolTipFromUrl(strings, getFeatureUrl);
  }
}
class WmtsMapLayerImageryProvider extends MapLayerImageryProvider {
  private _baseUrl: string;
  private _capabilities?: WmtsCapabilities;
  private _preferredLayerTileMatrixSet = new Map<string, WmtsCapability.TileMatrixSet>();
  private _preferredLayerStyle = new Map<string, WmtsCapability.Style>();

  public get mutualExclusiveSubLayer(): boolean { return true; }

  constructor(settings: MapLayerSettings) {
    super(settings, true);
    this._baseUrl = WmsUtilities.getBaseUrl(this._settings.url);
  }

  public async initialize(): Promise<void> {
    try {
      this._capabilities = await WmtsCapabilities.create(this._baseUrl);
      this.initPreferredTileMatrixSet();
      this.initPreferredStyle();
      this.initCartoRange();

      if (this._preferredLayerTileMatrixSet.size === 0 || this._preferredLayerStyle.size === 0)
        throw new ServerError(IModelStatus.ValidationFailed, "");

    } catch (_error) {
      throw new ServerError(IModelStatus.ValidationFailed, "");
    }

  }

  // Each layer can be served in multiple tile matrix set (i.e. TileTree).
  // We have to pick one for each layer: for now we look for a Google Maps compatible tile tree.
  private initPreferredTileMatrixSet() {
    const googleMapsTms = this._capabilities?.contents?.getGoogleMapsCompatibleTileMatrixSet();

    const wellGoogleKnownTms = googleMapsTms?.find((tms) => { return tms.wellKnownScaleSet?.toLowerCase().includes(WmtsCapability.Constants.GOOGLEMAPS_COMPATIBLE_WELLKNOWNNAME); });

    this._capabilities?.contents?.layers.forEach((layer) => {

      if (wellGoogleKnownTms && layer.tileMatrixSetLinks.some((tmsl) => { return (tmsl.tileMatrixSet === wellGoogleKnownTms.identifier); })) {
        // Favor tile matrix set that was explicitly marked as GoogleMaps compatible
        this._preferredLayerTileMatrixSet.set(layer.identifier, wellGoogleKnownTms);
      } else {
        // Search all compatible tile set matrix if previous attempt didn't work.
        // If more than one candidate is found, pick the tile set with the most LODs.
        const tileMatrixSets = googleMapsTms?.filter((tms) => {
          return layer.tileMatrixSetLinks.some((tmsl) => { return (tmsl.tileMatrixSet === tms.identifier); });
        });

        let preferredTms: WmtsCapability.TileMatrixSet | undefined;
        if (tileMatrixSets && tileMatrixSets.length === 1)
          preferredTms = tileMatrixSets[0];
        else if (tileMatrixSets && tileMatrixSets?.length > 1)
          preferredTms = tileMatrixSets.reduce((prev, current) => (prev.tileMatrix.length > current.tileMatrix.length) ? prev : current);

        if (preferredTms)
          this._preferredLayerTileMatrixSet.set(layer.identifier, preferredTms);
      }
    });
  }

  // Each layer can be published different style.  We look for a style flagged as 'Default'.
  private initPreferredStyle() {
    this._capabilities?.contents?.layers.forEach((layer) => {
      let preferredStyle: WmtsCapability.Style | undefined;
      if (layer.styles.length === 1)
        preferredStyle = layer.styles[0];
      else if (layer.styles.length > 1) {
        // If more than style is available, takes the default one, otherwise the first one.
        const defaultStyle = layer.styles.find((style) => style.isDefault);
        if (defaultStyle)
          preferredStyle = defaultStyle;
        else
          preferredStyle = layer.styles[0];
      }

      if (preferredStyle)
        this._preferredLayerStyle.set(layer.identifier, preferredStyle);
    });
  }

  private initCartoRange() {
    this._capabilities?.contents?.layers.forEach((layer) => {

      if (layer.wsg84BoundingBox) {
        if (this.cartoRange)
          this.cartoRange.extendRange(layer.wsg84BoundingBox);
        else
          this.cartoRange = layer.wsg84BoundingBox.clone();
      }
    });
  }

  public async constructUrl(row: number, column: number, zoomLevel: number): Promise<string> {
    // WMTS support a single layer per tile request, so we pick the first visible layer.
    const layerString = this._settings.subLayers.find((subLayer) => subLayer.visible)?.name;
    let tileMatrix, tileMatrixSet, style;
    if (layerString) {
      tileMatrixSet = this._preferredLayerTileMatrixSet.get(layerString);

      style = this._preferredLayerStyle.get(layerString);

      // Matrix identifier might be something other than standard 0..n zoom level,
      // so lookup the matrix identifier just in case.
      if (tileMatrixSet && tileMatrixSet.tileMatrix.length > zoomLevel)
        tileMatrix = tileMatrixSet.tileMatrix[zoomLevel].identifier;
    }

    if (layerString !== undefined && tileMatrix !== undefined && tileMatrixSet !== undefined && style !== undefined)
      return `${this._baseUrl}?Service=WMTS&Version=1.0.0&Request=GetTile&Format=image%2Fpng&layer=${layerString}&style=${style.identifier}&TileMatrixSet=${tileMatrixSet.identifier}&TileMatrix=${tileMatrix}&TileCol=${column}&TileRow=${row} `;
    else
      return "";

  }
}

const scratchQuadId = new QuadId(0, 0, 0);

class ArcGISMapLayerImageryProvider extends MapLayerImageryProvider {
  private _hasSuccessfullyFetchedTile = false;
  private _maxDepthFromLod = 0;
  private _copyrightText = "Copyright";
  private _querySupported = false;
  private _tileMapSupported = false;
  private _availabilityMap = new Dictionary<QuadId, boolean>((lhs: QuadId, rhs: QuadId) => lhs.compare(rhs));
  public serviceJson: any;
  constructor(settings: MapLayerSettings) {
    super(settings, false);
  }

  protected get _filterByCartoRange() { return false; }      // Can't trust footprint ranges (USGS Hydro)
  public get maximumZoomLevel() { return this._maxDepthFromLod > 0 ? this._maxDepthFromLod : super.maximumZoomLevel; }

  public uintToString(uintArray: any) {
    return Buffer.from(uintArray).toJSON();

  }

  private async fetchTile(row: number, column: number, zoomLevel: number): Promise<Response | undefined> {
    const tileRequestOptions: RequestOptions = { method: "GET", responseType: "arraybuffer" };
    tileRequestOptions.auth = this.getRequestAuthorization();
    const tileUrl: string = await this.constructUrl(row, column, zoomLevel);
    if (tileUrl.length === 0)
      return undefined;

    return request(this._requestContext, tileUrl, tileRequestOptions);
  }

  public async loadTile(row: number, column: number, zoomLevel: number): Promise<ImageSource | undefined> {

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

        // Token might have expired, make a second attempt by forcing new token.
        if (this._settings.userName && this._settings.userName.length > 0) {
          ArcGisTokenManager.invalidateToken(this._settings.url, this._settings.userName);
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
              const msg = IModelApp.i18n.translate("iModelJs:MapLayers.Messages.LoadTileTokenError", { layerName: this._settings.name });
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

  protected _testChildAvailability(tile: ImageryMapTile, resolveChildren: () => void) {
    if (!this._tileMapSupported || tile.quadId.level < 4) {
      resolveChildren();
      return;
    }

    const quadId = tile.quadId;
    let availability;
    if (undefined !== (availability = this._availabilityMap.get(tile.quadId))) {
      if (availability)
        resolveChildren();

      return;
    }

    const row = quadId.row * 2;
    const column = quadId.column * 2;
    const level = quadId.level + 1;
    const queryDim = Math.min(1 << level, 32), queryDimHalf = queryDim / 2;
    const queryRow = Math.max(0, row - queryDimHalf);
    const queryColumn = Math.max(0, column - queryDimHalf);

    getJson(this._requestContext, `${this._settings.url}/tilemap/${level}/${queryRow}/${queryColumn}/${queryDim}/${queryDim}?f=json`).then((json) => {
      availability = true;
      if (Array.isArray(json.data)) {
        let index = 0;
        const data = json.data;
        for (let iCol = 0; iCol < queryDim; iCol++) {
          for (let iRow = 0; iRow < queryDim; iRow++) {
            scratchQuadId.level = quadId.level;
            scratchQuadId.column = (queryColumn + iCol) / 2;
            scratchQuadId.row = (queryRow + iRow) / 2;
            if (0 === quadId.compare(scratchQuadId))
              availability = data[index];
            this._availabilityMap.set(scratchQuadId, data[index++]);
          }
        }
      }
      if (availability)
        resolveChildren();

    }).catch((_error) => {
      resolveChildren();
    });
  }
  private isEpsg3857Compatible(tileInfo: any) {
    if (tileInfo.spatialReference?.latestWkid !== 3857 || !Array.isArray(tileInfo.lods))
      return false;

    const zeroLod = tileInfo.lods[0];
    return zeroLod.level === 0 && Math.abs(zeroLod.resolution - 156543.03392800014) < .001;
  }

  public async initialize(): Promise<void> {
    const json = await ArcGisUtilities.getServiceJson(this._settings.url, this.getRequestAuthorization());
    if (json === undefined)
      throw new ServerError(IModelStatus.ValidationFailed, "");

    if (json !== undefined) {
      this.serviceJson = json;
      if (json.capabilities) {
        this._querySupported = json.capabilities.indexOf("Query") >= 0;
        this._tileMapSupported = json.capabilities.indexOf("Tilemap") >= 0;
      }
      if (json.copyrightText) this._copyrightText = json.copyrightText;
      if (false !== (this._usesCachedTiles = json.tileInfo !== undefined && this.isEpsg3857Compatible(json.tileInfo))) {
        if (json.maxScale !== undefined && json.maxScale !== 0 && Array.isArray(json.tileInfo.lods)) {
          for (; this._maxDepthFromLod < json.tileInfo.lods.length && json.tileInfo.lods[this._maxDepthFromLod].scale > json.maxScale; this._maxDepthFromLod++)
            ;
        }
      }
      const footprintJson = await ArcGisUtilities.getFootprintJson(this._settings.url, this.getRequestAuthorization());
      if (undefined !== footprintJson && undefined !== footprintJson.featureCollection && Array.isArray(footprintJson.featureCollection.layers)) {
        for (const layer of footprintJson.featureCollection.layers) {
          if (layer.layerDefinition && layer.layerDefinition.extent) {
            this.cartoRange = MapCartoRectangle.createFromDegrees(layer.layerDefinition.extent.xmin, layer.layerDefinition.extent.ymin, layer.layerDefinition.extent.xmax, layer.layerDefinition.extent.ymax);
            break;
          }
        }
      }
    }
  }

  public getLogo(_vp: ScreenViewport) {
    return IModelApp.makeLogoCard({ heading: "ArcGIS", notice: this._copyrightText });
  }

  public async getToolTip(strings: string[], quadId: QuadId, carto: Cartographic, tree: ImageryMapTileTree): Promise<void> {
    await super.getToolTip(strings, quadId, carto, tree);
    if (!doToolTips)
      return;

    if (!this._querySupported)
      return;

    const stringSet = new Set<string>();
    const bboxString = this.getEPSG3857ExtentString(quadId.row, quadId.column, quadId.level);
    const x = this.getEPSG3857X(carto.longitudeDegrees);
    const y = this.getEPSG3857Y(carto.latitudeDegrees);
    const tmpUrl = `${this._settings.url}/identify?f=json&tolerance=1&returnGeometry=false&sr=3857&imageDisplay=${this.tileSize},${this.tileSize},96&layers=${this.getLayerString("visible")}&geometry=${x},${y}&geometryType=esriGeometryPoint&mapExtent=${bboxString}`;
    const url = await this.appendSecurityToken(tmpUrl);

    let json = await getJson(this._requestContext, url);
    if (json?.error?.code === ArcGisErrorCode.TokenRequired || json?.error?.code === ArcGisErrorCode.InvalidToken) {
      // Token might have expired, make a second attempt by forcing new token.
      if (this._settings.userName && this._settings.userName.length > 0) {
        ArcGisTokenManager.invalidateToken(this._settings.url, this._settings.userName);
        json = await getJson(this._requestContext, url);
      }

      // OK at this point, if response still contain a token error, we assume end-user will
      // have to provide credentials again.  Change the layer status so we
      // don't make additional invalid requests..
      if (json?.error?.code === ArcGisErrorCode.TokenRequired || json?.error?.code === ArcGisErrorCode.InvalidToken) {
        // Check again layer status, it might have change during await.
        if (this.status === MapLayerImageryProviderStatus.Valid) {
          this.status = MapLayerImageryProviderStatus.RequireAuth;
          const msg = IModelApp.i18n.translate("iModelJs:MapLayers.Messages.FetchTooltipTokenError", { layerName: this._settings.name });
          IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Warning, msg));
        }

        return;
      }
    }

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
  protected getLayerString(prefix = "show"): string {
    const layers = new Array<string>();
    this._settings.subLayers.forEach((subLayer) => { if (this._settings.isSubLayerVisible(subLayer)) layers.push(subLayer.idString); });
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
    return this.appendSecurityToken(tmpUrl);
  }

  // construct the Url from the desired Tile
  private async appendSecurityToken(url: string): Promise<string> {
    // Append security token if required
    let tokenParam = "";
    if (this._settings.userName && this._settings.password) {
      try {
        const token = await ArcGisTokenManager.getToken(this._settings.url, this._settings.userName, this._settings.password,
          {
            client: ArcGisTokenClientType.referer,
          });
        if (token?.token)
          tokenParam = `&token=${token.token}`;
      } catch {
      }
    }
    return `${url}${tokenParam}`;
  }
}

class AzureMapsLayerImageryProvider extends MapLayerImageryProvider {
  constructor(settings: MapLayerSettings) { super(settings, true); }

  // construct the Url from the desired Tile
  public async constructUrl(y: number, x: number, zoom: number): Promise<string> {
    if (!this._settings.accessKey)
      return "";
    return `${this._settings.url}&${this._settings.accessKey.key}=${this._settings.accessKey.value}&api-version=2.0&zoom=${zoom}&x=${x}&y=${y}`;
  }

  public getLogo(_vp: ScreenViewport) {
    return IModelApp.makeLogoCard({ heading: "Azure Maps", notice: IModelApp.i18n.translate("iModelJs:BackgroundMap.AzureMapsCopyright") });
  }
}

class MapBoxLayerImageryProvider extends MapLayerImageryProvider {
  private _zoomMin: number;
  private _zoomMax: number;
  private _baseUrl: string;

  constructor(settings: MapLayerSettings) {
    super(settings, true);
    this._baseUrl = settings.url;
    this._zoomMin = 1; this._zoomMax = 20;
  }

  public get tileWidth(): number { return 256; }
  public get tileHeight(): number { return 256; }
  public get minimumZoomLevel(): number { return this._zoomMin; }
  public get maximumZoomLevel(): number { return this._zoomMax; }

  // construct the Url from the desired Tile
  public async constructUrl(row: number, column: number, zoomLevel: number): Promise<string> {
    if (!this._settings.accessKey) {
      return "";
    }

    // from the template url, construct the tile url.
    let url: string = this._baseUrl.concat(zoomLevel.toString());
    url = url.concat("/").concat(column.toString()).concat("/").concat(row.toString());
    url = url.concat(`.jpg80?${this._settings.accessKey.key}=${this._settings.accessKey.value}`);

    return url;
  }

  public getLogo(_vp: ScreenViewport): HTMLTableRowElement | undefined {
    return IModelApp.makeLogoCard({ heading: "Mapbox", notice: IModelApp.i18n.translate("iModelJs:BackgroundMap.MapBoxCopyright") });
  }

  // no initialization needed for MapBoxImageryProvider.
  public async initialize(): Promise<void> { }
}

const levelToken = "{level}";
const rowToken = "{row}";
const columnToken = "{column}";

/**  Provide tiles from a url template in the a generic format ... i.e. https://b.tile.openstreetmap.org/{level}/{column}/{row}.png */
class TileUrlImageryProvider extends MapLayerImageryProvider {
  constructor(settings: MapLayerSettings) {
    super(settings, true);
  }
  public static validateUrlTemplate(template: string): MapLayerSourceValidation {
    return { status: (template.indexOf(levelToken) > 0 && template.indexOf(columnToken) > 0 && template.indexOf(rowToken) > 0) ? MapLayerSourceStatus.Valid : MapLayerSourceStatus.InvalidUrl };
  }

  // construct the Url from the desired Tile
  public async constructUrl(row: number, column: number, level: number): Promise<string> {
    let url = this._settings.url;
    if (TileUrlImageryProvider.validateUrlTemplate(url).status !== MapLayerSourceStatus.Valid) {
      if (url.lastIndexOf("/") !== url.length - 1)
        url = `${url}/`;
      url = `${url}{level}/{column}/{row}.png`;
    }

    return url.replace(levelToken, level.toString()).replace(columnToken, column.toString()).replace(rowToken, row.toString());
  }
}

class WmsMapLayerFormat extends ImageryMapLayerFormat {
  public static formatId = "WMS";

  public static createImageryProvider(settings: MapLayerSettings): MapLayerImageryProvider | undefined {
    return new WmsMapLayerImageryProvider(settings);
  }
  public static async validateSource(url: string, credentials?: RequestBasicCredentials, ignoreCache?: boolean): Promise<MapLayerSourceValidation> {
    try {
      let subLayers: MapSubLayerProps[] | undefined;
      const maxVisibleSubLayers = 50;
      const capabilities = await WmsCapabilities.create(url, credentials, ignoreCache);
      if (capabilities !== undefined) {
        subLayers = capabilities.getSubLayers(false);
        const rootsSubLayer = subLayers?.find((sublayer) => sublayer.parent === undefined);
        const hasTooManyLayers = subLayers && subLayers.length > maxVisibleSubLayers;

        if (!Array.isArray(subLayers))
          return { status: MapLayerSourceStatus.Valid, subLayers };

        for (const subLayer of subLayers) {
          // In general for WMS, we prefer to have the children of root node visible, but not the root itself.
          // Thats simply to give more flexibility in the UI.
          // Two exceptions to this rule: If there are too many layers or the root node is not named.
          if (subLayer.id && subLayer.id === rootsSubLayer?.id
            && (!(subLayer.name && subLayer.name.length > 0) || hasTooManyLayers)) {
            subLayer.visible = true;
            break;  // if root node is visible, don't bother turning ON any other layers
          }

          // Make children of the root node visible.
          if (subLayer.parent && subLayer.parent === rootsSubLayer?.id && !hasTooManyLayers) {
            const isUnnamedGroup = (layer: MapSubLayerProps) => { return layer.children && layer.children.length > 0 && (!layer.name || layer.name.length === 0); };
            const makeChildrenVisible = (layers: MapSubLayerProps[] | undefined, layer: MapSubLayerProps) => {
              layer?.children?.forEach((childId) => {
                const childSubLayer = subLayers?.find((child) => child?.id === childId);
                if (childSubLayer) {
                  childSubLayer.visible = true;
                  if (isUnnamedGroup(childSubLayer))
                    makeChildrenVisible(layers, childSubLayer);
                }
              });
            };

            subLayer.visible = true;

            // If we got a unnamed group, make children visible recursively until we have a leaf or named group
            if (isUnnamedGroup(subLayer))
              makeChildrenVisible(subLayers, subLayer);
          }
        }
      }

      return { status: MapLayerSourceStatus.Valid, subLayers };
    } catch (err) {
      return { status: MapLayerSourceStatus.InvalidUrl };
    }
  }
}

class WmtsMapLayerFormat extends ImageryMapLayerFormat {
  public static formatId = "WMTS";

  public static createImageryProvider(settings: MapLayerSettings): MapLayerImageryProvider | undefined {
    return new WmtsMapLayerImageryProvider(settings);
  }

  public static async validateSource(url: string, credentials?: RequestBasicCredentials, ignoreCache?: boolean): Promise<MapLayerSourceValidation> {
    try {
      const subLayers: MapSubLayerProps[] = [];
      const capabilities = await WmtsCapabilities.create(url, credentials, ignoreCache);
      if (!capabilities)
        return { status: MapLayerSourceStatus.InvalidUrl };

      // Only returns layer that can be published in the Google maps aligned tile tree.
      const googleMapsTms = capabilities?.contents?.getGoogleMapsCompatibleTileMatrixSet();
      if (!googleMapsTms)
        return { status: MapLayerSourceStatus.InvalidTileTree };

      let subLayerId = 0;
      capabilities?.contents?.layers.forEach((layer) => {
        if (googleMapsTms?.some((tms) => {
          return layer.tileMatrixSetLinks.some((tmls) => { return (tmls.tileMatrixSet === tms.identifier); });
        })) {
          subLayers.push({
            name: layer.identifier,
            title: layer.title ?? layer.identifier,
            visible: (subLayers.length === 0),   // Make the first layer visible.
            parent: undefined,
            children: undefined,
            id: subLayerId++,
          });
        }
      });

      // Return error if we could find a single compatible layer.
      if (subLayers.length === 0)
        return { status: MapLayerSourceStatus.InvalidTileTree };

      return { status: MapLayerSourceStatus.Valid, subLayers };
    } catch (err) {
      console.error(err); // eslint-disable-line no-console
      return { status: MapLayerSourceStatus.InvalidUrl };
    }
  }

}

class ArcGISMapLayerFormat extends ImageryMapLayerFormat {
  public static formatId = "ArcGIS";
  public static async validateSource(url: string, credentials?: RequestBasicCredentials, ignoreCache?: boolean): Promise<MapLayerSourceValidation> {
    return ArcGisUtilities.validateSource(url, credentials, ignoreCache);
  }
  public static createImageryProvider(settings: MapLayerSettings): MapLayerImageryProvider | undefined {
    return new ArcGISMapLayerImageryProvider(settings);
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
class AzureMapsMapLayerFormat extends ImageryMapLayerFormat {
  public static formatId = "AzureMaps";
  public static createImageryProvider(settings: MapLayerSettings): MapLayerImageryProvider | undefined {
    return new AzureMapsLayerImageryProvider(settings);
  }
}
class BingMapsMapLayerFormat extends ImageryMapLayerFormat {
  public static formatId = "BingMaps";
  public static createImageryProvider(settings: MapLayerSettings): MapLayerImageryProvider | undefined {
    return new BingMapsImageryLayerProvider(settings);
  }
}

class MapBoxImageryMapLayerFormat extends ImageryMapLayerFormat {
  public static formatId = "MapboxImagery";
  public static createImageryProvider(settings: MapLayerSettings): MapLayerImageryProvider | undefined {
    return new MapBoxLayerImageryProvider(settings);
  }
}
class TileUrlMapLayerFormat extends ImageryMapLayerFormat {
  public static formatId = "TileURL";
  public static createImageryProvider(settings: MapLayerSettings): MapLayerImageryProvider | undefined { return new TileUrlImageryProvider(settings); }
}

/** @internal */
export const internalMapLayerImageryFormats = [WmsMapLayerFormat, WmtsMapLayerFormat, ArcGISMapLayerFormat, /* AzureMapsMapLayerFormat, */ BingMapsMapLayerFormat, MapBoxImageryMapLayerFormat, TileUrlMapLayerFormat];
