/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import { BeEvent } from "@itwin/core-bentley";
import { Cartographic, ImageSource, ImageSourceFormat, MapLayerSettings } from "@itwin/core-common";
import { getJson, request, RequestBasicCredentials, RequestOptions, Response } from "@bentley/itwin-client";
import { IModelApp } from "../../IModelApp";
import { NotifyMessageDetails, OutputMessagePriority } from "../../NotificationManager";
import { ScreenViewport } from "../../Viewport";
import { GeographicTilingScheme, ImageryMapTile, ImageryMapTileTree, MapCartoRectangle, MapTilingScheme, QuadId, WebMercatorTilingScheme } from "../internal";

const tileImageSize = 256, untiledImageSize = 256;

const doDebugToolTips = false;

/** @internal */
export enum MapLayerImageryProviderStatus {
  Valid,
  RequireAuth,
}

/** Base class for map layer imagery providers.
 * @internal
 */
export abstract class MapLayerImageryProvider {
  protected _hasSuccessfullyFetchedTile = false;
  public status: MapLayerImageryProviderStatus = MapLayerImageryProviderStatus.Valid;
  public readonly onStatusChanged = new BeEvent<(provider: MapLayerImageryProvider) => void>();
  private readonly _mercatorTilingScheme = new WebMercatorTilingScheme();
  private readonly _geographicTilingScheme = new GeographicTilingScheme();

  public get tileSize(): number { return this._usesCachedTiles ? tileImageSize : untiledImageSize; }
  public get maximumScreenSize() { return 2 * this.tileSize; }
  public get minimumZoomLevel(): number { return 0; }
  public get maximumZoomLevel(): number { return 22; }
  public get usesCachedTiles() { return this._usesCachedTiles; }
  public get mutualExclusiveSubLayer(): boolean { return false; }
  public get useGeographicTilingScheme() { return false;}
  public cartoRange?: MapCartoRectangle;
  protected get _filterByCartoRange() { return true; }
  constructor(protected readonly _settings: MapLayerSettings, protected _usesCachedTiles: boolean) {
    this._mercatorTilingScheme = new WebMercatorTilingScheme();
    this._geographicTilingScheme = new GeographicTilingScheme(2, 1, true);
  }

  public async initialize(): Promise<void> {
    this.loadTile(0, 0, 22).then((tileData: ImageSource | undefined) => { // eslint-disable-line @typescript-eslint/no-floating-promises
      if (tileData !== undefined) this._missingTileData = tileData.data as Uint8Array;
    });
  }
  public abstract constructUrl(row: number, column: number, zoomLevel: number): Promise<string>;
  public get tilingScheme(): MapTilingScheme { return this.useGeographicTilingScheme ? this._geographicTilingScheme : this._mercatorTilingScheme;  }
  public getLogo(_viewport: ScreenViewport): HTMLTableRowElement | undefined { return undefined; }
  protected _missingTileData?: Uint8Array;
  public get transparentBackgroundString(): string { return this._settings.transparentBackground ? "true" : "false"; }

  protected async _areChildrenAvailable(_tile: ImageryMapTile): Promise<boolean> { return true; }
  public getPotentialChildIds(tile: ImageryMapTile): QuadId[] {
    const childLevel = tile.quadId.level + 1;
    return tile.quadId.getChildIds(this.tilingScheme.getNumberOfXChildrenAtLevel(childLevel), this.tilingScheme.getNumberOfYChildrenAtLevel(childLevel));

  }

  protected _generateChildIds(tile: ImageryMapTile, resolveChildren: (childIds: QuadId[]) => void) {
    resolveChildren(this.getPotentialChildIds(tile));
  }

  public generateChildIds(tile: ImageryMapTile, resolveChildren: (childIds: QuadId[]) => void) {
    if (tile.depth >= this.maximumZoomLevel || (undefined !== this.cartoRange && this._filterByCartoRange && !this.cartoRange.intersectsRange(tile.rectangle))) {
      tile.setLeaf();
      return;
    }
    this._generateChildIds(tile, resolveChildren);
  }

  public async getToolTip(strings: string[], quadId: QuadId, _carto: Cartographic, tree: ImageryMapTileTree): Promise<void> {
    if (doDebugToolTips) {
      const range = quadId.getLatLongRange(tree.tilingScheme);
      strings.push(`QuadId: ${quadId.debugString}, Lat: ${range.low.x} - ${range.high.x} Long: ${range.low.y} - ${range.high.y}`);
    }
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

  public setStatus(status: MapLayerImageryProviderStatus) {
    if (this.status !== status) {
      this.status = status;
      this.onStatusChanged.raiseEvent(this);
    }
  }

  public async makeTileRequest(url: string) {
    const tileRequestOptions: RequestOptions = { method: "GET", responseType: "arraybuffer" };
    tileRequestOptions.auth = this.getRequestAuthorization();
    return request(url, tileRequestOptions);
  }

  public async loadTile(row: number, column: number, zoomLevel: number): Promise<ImageSource | undefined> {

    try {
      const tileUrl: string = await this.constructUrl(row, column, zoomLevel);
      if (tileUrl.length === 0)
        return undefined;

      const tileResponse: Response = await this.makeTileRequest(tileUrl);

      if (!this._hasSuccessfullyFetchedTile) {
        this._hasSuccessfullyFetchedTile = true;
      }

      return this.getImageFromTileResponse(tileResponse, zoomLevel);
    } catch (error: any) {
      if (error?.status === 401) {
        this.setStatus(MapLayerImageryProviderStatus.RequireAuth);

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

  protected async toolTipFromUrl(strings: string[], url: string): Promise<void> {

    const requestOptions: RequestOptions = {
      method: "GET",
      responseType: "text",
      auth: this.getRequestAuthorization(),
    }; // spell-checker: disable-line

    try {
      const response: Response = await request(url, requestOptions);
      if (undefined !== response.text) {
        strings.push(response.text);
      }
    } catch {
    }
  }
  protected async toolTipFromJsonUrl(_strings: string[], url: string): Promise<void> {
    try {
      const json = await getJson(url);
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

  public getEPSG4326Extent(row: number, column: number, zoomLevel: number): { longitudeLeft: number, longitudeRight: number, latitudeTop: number, latitudeBottom: number } {
    const mapSize = 256 << zoomLevel;
    const leftGrid = 256 * column;
    const topGrid = 256 * row;

    const longitudeLeft = 360 * ((leftGrid / mapSize) - 0.5);
    const y0 = 0.5 - ((topGrid + 256) / mapSize);
    const latitudeBottom = 90.0 - 360.0 * Math.atan(Math.exp(-y0 * 2 * Math.PI)) / Math.PI;

    const longitudeRight = 360 * (((leftGrid + 256) / mapSize) - 0.5);
    const y1 = 0.5 - (topGrid / mapSize);
    const latitudeTop = 90.0 - 360.0 * Math.atan(Math.exp(-y1 * 2 * Math.PI)) / Math.PI;

    return { longitudeLeft, longitudeRight, latitudeTop, latitudeBottom };
  }

  public getEPSG3857Extent(row: number, column: number, zoomLevel: number): { left: number, right: number, top: number, bottom: number } {
    const epsg4326Extent = this.getEPSG4326Extent(row, column, zoomLevel);

    const left = this.getEPSG3857X(epsg4326Extent.longitudeLeft);
    const right = this.getEPSG3857X(epsg4326Extent.longitudeRight);
    const bottom = this.getEPSG3857Y(epsg4326Extent.latitudeBottom);
    const top = this.getEPSG3857Y(epsg4326Extent.latitudeTop);

    return { left, right, bottom, top };
  }

  public getEPSG3857ExtentString(row: number, column: number, zoomLevel: number) {
    const tileExtent = this.getEPSG3857Extent(row, column, zoomLevel);
    return `${tileExtent.left.toFixed(2)},${tileExtent.bottom.toFixed(2)},${tileExtent.right.toFixed(2)},${tileExtent.top.toFixed(2)}`;
  }

  public getEPSG4326ExtentString(row: number, column: number, zoomLevel: number, latLongAxisOrdering: boolean) {
    const tileExtent = this.getEPSG4326Extent(row, column, zoomLevel);
    if (latLongAxisOrdering) {
      return `${tileExtent.latitudeBottom.toFixed(8)},${tileExtent.longitudeLeft.toFixed(8)},
              ${tileExtent.latitudeTop.toFixed(8)},${tileExtent.longitudeRight.toFixed(8)}`;
    } else {
      return `${tileExtent.longitudeLeft.toFixed(8)},${tileExtent.latitudeBottom.toFixed(8)},
              ${tileExtent.longitudeRight.toFixed(8)},${tileExtent.latitudeTop.toFixed(8)}`;
    }
  }
}
