/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module MapLayers
 */

import { assert, BeEvent } from "@itwin/core-bentley";
import { Base64EncodedString, Cartographic, ImageMapLayerSettings, ImageSource, ImageSourceFormat } from "@itwin/core-common";
import { Angle } from "@itwin/core-geometry";
import { IModelApp } from "../../IModelApp";
import { NotifyMessageDetails, OutputMessagePriority } from "../../NotificationManager";
import { ScreenViewport } from "../../Viewport";
import { GeographicTilingScheme, ImageryMapTile, ImageryMapTileTree, MapCartoRectangle, MapLayerFeatureInfo, MapTilingScheme, QuadId, WebMercatorTilingScheme } from "../internal";
import { HitDetail } from "../../HitDetail";

/** @internal */
const tileImageSize = 256, untiledImageSize = 256;
const earthRadius = 6378137;
const doDebugToolTips = false;

/** The status of the map layer imagery provider that lets you know if authentication is needed to request tiles.
 * @public
 */
export enum MapLayerImageryProviderStatus {
  Valid,
  RequireAuth,
}

/** Abstract class for map layer imagery providers.
 * Map layer imagery providers request and provide tile images and other data. Each map layer from a separate source needs its own imagery provider object.
 * @beta
 */
export abstract class MapLayerImageryProvider {
  protected _hasSuccessfullyFetchedTile = false;
  public readonly onStatusChanged = new BeEvent<(provider: MapLayerImageryProvider) => void>();

  /** @internal */
  private readonly _mercatorTilingScheme = new WebMercatorTilingScheme();

  /** @internal */
  private readonly _geographicTilingScheme = new GeographicTilingScheme();

  /** @internal */
  private _status = MapLayerImageryProviderStatus.Valid;

  /** @internal */
  public get status() { return this._status; }

  /** @alpha */
  public get supportsMapFeatureInfo() { return false; }

  public resetStatus() { this.setStatus(MapLayerImageryProviderStatus.Valid); }

  /** @internal */
  public get tileSize(): number { return this._usesCachedTiles ? tileImageSize : untiledImageSize; }

  /** @internal */
  public get maximumScreenSize() { return 2 * this.tileSize; }

  public get minimumZoomLevel(): number { return this.defaultMinimumZoomLevel; }

  public get maximumZoomLevel(): number { return this.defaultMaximumZoomLevel; }

  /** @internal */
  public get usesCachedTiles() { return this._usesCachedTiles; }

  public get mutualExclusiveSubLayer(): boolean { return false; }

  /** @internal */
  public get useGeographicTilingScheme() { return false; }

  public cartoRange?: MapCartoRectangle;

  // Those values are used internally for various computation, this should not get overriden.
  /** @internal */
  protected readonly defaultMinimumZoomLevel = 0;

  /** @internal */
  protected readonly defaultMaximumZoomLevel = 22;

  /** @internal */
  protected get _filterByCartoRange() { return true; }

  constructor(protected readonly _settings: ImageMapLayerSettings, protected _usesCachedTiles: boolean) {
    this._mercatorTilingScheme = new WebMercatorTilingScheme();
    this._geographicTilingScheme = new GeographicTilingScheme(2, 1, true);
  }

  /** @internal */
  public async initialize(): Promise<void> {
    this.loadTile(0, 0, this.defaultMaximumZoomLevel).then((tileData: ImageSource | undefined) => { // eslint-disable-line @typescript-eslint/no-floating-promises
      if (tileData !== undefined)
        this._missingTileData = tileData.data as Uint8Array;
    });
  }

  public abstract constructUrl(row: number, column: number, zoomLevel: number): Promise<string>;

  public get tilingScheme(): MapTilingScheme { return this.useGeographicTilingScheme ? this._geographicTilingScheme : this._mercatorTilingScheme; }

  /** @internal */
  public addLogoCards(_cards: HTMLTableElement, _viewport: ScreenViewport): void { }

  /** @internal */
  protected _missingTileData?: Uint8Array;

  /** @internal */
  public get transparentBackgroundString(): string { return this._settings.transparentBackground ? "true" : "false"; }

  /** @internal */
  protected async _areChildrenAvailable(_tile: ImageryMapTile): Promise<boolean> { return true; }

  /** @internal */
  public getPotentialChildIds(tile: ImageryMapTile): QuadId[] {
    const childLevel = tile.quadId.level + 1;
    return tile.quadId.getChildIds(this.tilingScheme.getNumberOfXChildrenAtLevel(childLevel), this.tilingScheme.getNumberOfYChildrenAtLevel(childLevel));
  }

  /** @internal */
  protected _generateChildIds(tile: ImageryMapTile, resolveChildren: (childIds: QuadId[]) => void) {
    resolveChildren(this.getPotentialChildIds(tile));
  }

  /** @internal */
  public generateChildIds(tile: ImageryMapTile, resolveChildren: (childIds: QuadId[]) => void) {
    if (tile.depth >= this.maximumZoomLevel || (undefined !== this.cartoRange && this._filterByCartoRange && !this.cartoRange.intersectsRange(tile.rectangle))) {
      tile.setLeaf();
      return;
    }
    this._generateChildIds(tile, resolveChildren);
  }

  /** @internal */
  public async getToolTip(strings: string[], quadId: QuadId, _carto: Cartographic, tree: ImageryMapTileTree): Promise<void> {
    if (doDebugToolTips) {
      const range = quadId.getLatLongRangeDegrees(tree.tilingScheme);
      strings.push(`QuadId: ${quadId.debugString}, Lat: ${range.low.x} - ${range.high.x} Long: ${range.low.y} - ${range.high.y}`);
    }
  }

  /** @internal */
  public async getFeatureInfo(featureInfos: MapLayerFeatureInfo[], _quadId: QuadId, _carto: Cartographic, _tree: ImageryMapTileTree, _hit: HitDetail): Promise<void> {
    // default implementation; simply return an empty feature info
    featureInfos.push({ layerName: this._settings.name });
  }

  /** @internal */
  protected async getImageFromTileResponse(tileResponse: Response, zoomLevel: number) {
    const arrayBuffer = await tileResponse.arrayBuffer();
    const byteArray: Uint8Array = new Uint8Array(arrayBuffer);
    if (!byteArray || (byteArray.length === 0))
      return undefined;
    if (this.matchesMissingTile(byteArray) && zoomLevel > 8)
      return undefined;

    const contentType = tileResponse.headers.get("content-type")?.toLowerCase();
    let imageFormat: ImageSourceFormat | undefined;
    if (contentType) {
      // Note: 'includes' is used here instead of exact comparison because we encountered
      // some servers that would give content type such as 'image/png;charset=UTF-8'.
      if (contentType.includes("image/jpeg"))
        imageFormat = ImageSourceFormat.Jpeg;
      else if (contentType.includes("image/png"))
        imageFormat = ImageSourceFormat.Png;
    }

    if (imageFormat !== undefined)
      return new ImageSource(byteArray, imageFormat);

    assert(false, "Invalid tile content type");
    return undefined;
  }

  /** Change the status of this provider.
   * Sub-classes should override 'onStatusUpdated' instead of this method.
   * @internal
   */
  public setStatus(status: MapLayerImageryProviderStatus) {
    if (this._status !== status) {
      this.onStatusUpdated(status);
      this._status = status;
      this.onStatusChanged.raiseEvent(this);
    }
  }

  /** Method called whenever the status changes, giving the opportunity to sub-classes to have a custom behavior.
   *  @internal
   */
  protected onStatusUpdated(_newStatus: MapLayerImageryProviderStatus) { }

  /** @internal */
  protected setRequestAuthorization(headers: Headers) {
    if (this._settings.userName && this._settings.password) {
      headers.set("Authorization", `Basic ${Base64EncodedString.encode(`${this._settings.userName}:${this._settings.password}`)}`);
    }
  }

  /** @internal */
  public async makeTileRequest(url: string) {
    let headers: Headers | undefined;
    if (this._settings.userName && this._settings.password) {
      headers = new Headers();
      this.setRequestAuthorization(headers);
    }
    return fetch(url, { method: "GET", headers });
  }

  /** Returns a map layer tile at the specified settings. */
  public async loadTile(row: number, column: number, zoomLevel: number): Promise<ImageSource | undefined> {

    try {
      const tileUrl: string = await this.constructUrl(row, column, zoomLevel);
      if (tileUrl.length === 0)
        return undefined;

      const tileResponse: Response = await this.makeTileRequest(tileUrl);

      if (!this._hasSuccessfullyFetchedTile) {
        this._hasSuccessfullyFetchedTile = true;
      }

      return await this.getImageFromTileResponse(tileResponse, zoomLevel);
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

  /** @internal */
  protected async toolTipFromUrl(strings: string[], url: string): Promise<void> {
    const headers = new Headers();
    this.setRequestAuthorization(headers);

    try {
      const response = await fetch(url, { method: "GET", headers });
      const text = await response.text();
      if (undefined !== text) {
        strings.push(text);
      }
    } catch {
    }
  }

  /** @internal */
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

  /** @internal */
  // calculates the projected x cartesian coordinate in EPSG:3857from the longitude in EPSG:4326 (WGS84)
  public getEPSG3857X(longitude: number): number {
    return longitude * 20037508.34 / 180.0;
  }

  /** @internal */
  // calculates the projected y cartesian coordinate in EPSG:3857from the latitude in EPSG:4326 (WGS84)
  public getEPSG3857Y(latitude: number): number {
    const y = Math.log(Math.tan((90.0 + latitude) * Math.PI / 360.0)) / (Math.PI / 180.0);
    return y * 20037508.34 / 180.0;
  }

  /** @internal */
  // calculates the longitude in EPSG:4326 (WGS84) from the projected x cartesian coordinate in EPSG:3857
  public getEPSG4326Lon(x3857: number): number {
    return Angle.radiansToDegrees(x3857 / earthRadius);
  }

  /** @internal */
  // calculates the latitude in EPSG:4326 (WGS84) from the projected y cartesian coordinate in EPSG:3857
  public getEPSG4326Lat(y3857: number): number {
    const y = 2 * Math.atan(Math.exp(y3857 / earthRadius)) - (Math.PI / 2);
    return Angle.radiansToDegrees(y);
  }

  /** @internal */
  // Map tile providers like Bing and Mapbox allow the URL to be constructed directory from the zoom level and tile coordinates.
  // However, WMS-based servers take a bounding box instead. This method can help get that bounding box from a tile.
  public getEPSG4326Extent(row: number, column: number, zoomLevel: number): { longitudeLeft: number, longitudeRight: number, latitudeTop: number, latitudeBottom: number } {
    // Shift left (this.tileSize << zoomLevel) overflow when using 512 pixels tile at higher resolution,
    // so use Math.pow instead (I assume the performance lost to be minimal)
    const mapSize = this.tileSize * Math.pow(2, zoomLevel);
    const leftGrid = this.tileSize * column;
    const topGrid = this.tileSize * row;

    const longitudeLeft = 360 * ((leftGrid / mapSize) - 0.5);
    const y0 = 0.5 - ((topGrid + this.tileSize) / mapSize);
    const latitudeBottom = 90.0 - 360.0 * Math.atan(Math.exp(-y0 * 2 * Math.PI)) / Math.PI;

    const longitudeRight = 360 * (((leftGrid + this.tileSize) / mapSize) - 0.5);
    const y1 = 0.5 - (topGrid / mapSize);
    const latitudeTop = 90.0 - 360.0 * Math.atan(Math.exp(-y1 * 2 * Math.PI)) / Math.PI;

    return { longitudeLeft, longitudeRight, latitudeTop, latitudeBottom };
  }

  /** @internal */
  public getEPSG3857Extent(row: number, column: number, zoomLevel: number): { left: number, right: number, top: number, bottom: number } {
    const epsg4326Extent = this.getEPSG4326Extent(row, column, zoomLevel);

    const left = this.getEPSG3857X(epsg4326Extent.longitudeLeft);
    const right = this.getEPSG3857X(epsg4326Extent.longitudeRight);
    const bottom = this.getEPSG3857Y(epsg4326Extent.latitudeBottom);
    const top = this.getEPSG3857Y(epsg4326Extent.latitudeTop);

    return { left, right, bottom, top };
  }

  /** @internal */
  public getEPSG3857ExtentString(row: number, column: number, zoomLevel: number) {
    const tileExtent = this.getEPSG3857Extent(row, column, zoomLevel);
    return `${tileExtent.left.toFixed(2)},${tileExtent.bottom.toFixed(2)},${tileExtent.right.toFixed(2)},${tileExtent.top.toFixed(2)}`;
  }

  /** @internal */
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
