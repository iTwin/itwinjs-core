/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tile
 */

import {
  assert,
  BentleyError,
  IModelStatus,
  ClientRequestContext,
} from "@bentley/bentleyjs-core";
import { Range2d } from "@bentley/geometry-core";
import {
  BackgroundMapProviderName,
  BackgroundMapType,
  ImageSource,
  ImageSourceFormat,
} from "@bentley/imodeljs-common";
import {
  request,
  RequestOptions,
  Response,
} from "@bentley/imodeljs-clients";
import { ScreenViewport } from "../Viewport";
import { IModelApp } from "../IModelApp";
import {
  MapTileTreeReference,
  MapTilingScheme,
  QuadId,
  Tile,
  WebMercatorTilingScheme,
} from "./internal";

/** @internal */
export interface MapTileGeometryAttributionProvider {
  getGeometryLogo(tileProvider: MapTileTreeReference, viewport: ScreenViewport): HTMLTableRowElement | undefined;
}

/** Represents a service that can provide background map tiles.
 * @internal
 */
export abstract class ImageryProvider {
  protected _requestContext = new ClientRequestContext("");
  public geometryAttributionProvider?: MapTileGeometryAttributionProvider;

  public abstract get tileWidth(): number;
  public abstract get tileHeight(): number;
  public abstract get minimumZoomLevel(): number;
  public abstract get maximumZoomLevel(): number;
  public abstract constructUrl(row: number, column: number, zoomLevel: number): string;
  public abstract getImageryLogo(tileProvider: MapTileTreeReference, viewport: ScreenViewport): HTMLTableRowElement | undefined;

  // initialize the subclass of ImageryProvider
  public abstract async initialize(): Promise<void>;

  // returns true if the tile data matches the tile data of a "missing tile". See BingImageryProvider.initialize.
  public matchesMissingTile(_tileData: Uint8Array): boolean {
    return false;
  }

  // returns a Uint8Array with the contents of the tile.
  public async loadTile(row: number, column: number, zoomLevel: number): Promise<ImageSource | undefined> {
    const tileUrl: string = this.constructUrl(row, column, zoomLevel);
    const tileRequestOptions: RequestOptions = { method: "GET", responseType: "arraybuffer" }; // spell-checker: disable-line
    try {
      const tileResponse: Response = await request(this._requestContext, tileUrl, tileRequestOptions);
      const byteArray: Uint8Array = new Uint8Array(tileResponse.body);
      if (!byteArray || (byteArray.length === 0))
        return undefined;
      if (this.matchesMissingTile(byteArray))
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
          assert(false, "Unknown image type");
          return undefined;
      }

      return new ImageSource(byteArray, imageFormat);
    } catch (error) {
      return undefined;
    }
  }

  public static fromNameAndType(name: BackgroundMapProviderName, type: BackgroundMapType): ImageryProvider | undefined {
    switch (name) {
      case "BingProvider":
        return new BingImageryProvider(type);
      case "MapBoxProvider":
        return new MapBoxImageryProvider(type);
      default:
        return undefined;
    }
  }
}

/** this class provides a method for converting the tile row, column, and zoom level to the EPSG3857 cartesian coordinates that some
 * tile servers require. The getEPSG3857Extent method is usually used in the constructUrl method.
 * @internal
 */
export abstract class ImageryProviderEPSG3857 extends ImageryProvider {
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
}

// Represents one range of geography and tile zoom levels for a bing data provider
class Coverage {
  constructor(private _lowerLeftLatitude: number,
    private _lowerLeftLongitude: number,
    private _upperRightLatitude: number,
    private _upperRightLongitude: number,
    private _minimumZoomLevel: number,
    private _maximumZoomLevel: number) { }

  public overlaps(quadId: QuadId, tilingScheme: MapTilingScheme): boolean {
    const range: Range2d = quadId.getLatLongRange(tilingScheme);
    if (quadId.level < this._minimumZoomLevel)
      return false;
    if (quadId.level > this._maximumZoomLevel)
      return false;
    if (range.low.x > this._upperRightLongitude)
      return false;
    if (range.low.y > this._upperRightLatitude)
      return false;
    if (range.high.x < this._lowerLeftLongitude)
      return false;
    if (range.high.y < this._lowerLeftLatitude)
      return false;

    return true;
  }
}

// Represents the copyright message and an array of coverage data for one of bing's data providers (HERE for example).
class BingAttribution {
  constructor(public copyrightMessage: string, private _coverages: Coverage[]) { }

  public matchesTile(tile: Tile, tilingScheme: MapTilingScheme): boolean {
    const quadId = QuadId.createFromContentId(tile.contentId);
    for (const coverage of this._coverages) {
      if (coverage.overlaps(quadId, tilingScheme))
        return true;
    }
    return false;
  }
}

// in deployed applications, we can only make https requests, but the Bing Maps metadata request returns templates with "http:".
// This function fixes those.
function replaceHttpWithHttps(originalUrl: string) {
  return originalUrl.startsWith("http:") ? "https:".concat(originalUrl.slice(5)) : originalUrl;
}

// Our ImageryProvider for Bing Maps.
class BingImageryProvider extends ImageryProvider {
  private _urlTemplate?: string;
  private _urlSubdomains?: string[];
  private _zoomMin: number;
  private _zoomMax: number;
  private _tileHeight: number;
  private _tileWidth: number;
  private _attributions?: BingAttribution[]; // array of Bing's data providers.
  private _missingTileData?: Uint8Array;
  private _mapTilingScheme: MapTilingScheme;
  public readonly mapType: BackgroundMapType;

  constructor(mapType: BackgroundMapType) {
    super();
    this.mapType = mapType;
    this._zoomMin = this._zoomMax = 0;
    this._tileHeight = this._tileWidth = 0;
    this._mapTilingScheme = new WebMercatorTilingScheme();
  }

  public get tileWidth(): number { return this._tileWidth; }
  public get tileHeight(): number { return this._tileHeight; }
  public get minimumZoomLevel(): number { return this._zoomMin; }
  public get maximumZoomLevel(): number { return this._zoomMax; }

  private tileXYToQuadKey(tileX: number, tileY: number, zoomLevel: number) {
    // from C# example in bing documentation https://msdn.microsoft.com/en-us/library/bb259689.aspx
    let quadKey: string = "";

    // Root tile is not displayable. Returns 0 for _GetMaximumSize(). Should not end up here.
    assert(0 !== zoomLevel);

    for (let i: number = zoomLevel; i > 0; i--) {
      let digit: number = 0x30; // '0'
      const mask: number = 1 << (i - 1);
      if ((tileX & mask) !== 0) {
        digit++;
      }
      if ((tileY & mask) !== 0) {
        digit++;
        digit++;
      }
      quadKey = quadKey.concat(String.fromCharCode(digit));
    }
    return quadKey;
  }

  // construct the Url from the desired Tile
  public constructUrl(row: number, column: number, zoomLevel: number): string {
    // From the tile, get a "quadKey" the Microsoft way.
    const quadKey: string = this.tileXYToQuadKey(column, row, zoomLevel);
    const subdomain: string = this._urlSubdomains![(row + column) % this._urlSubdomains!.length];

    // from the template url, construct the tile url.
    let url: string = this._urlTemplate!.replace("{subdomain}", subdomain);
    url = url.replace("{quadkey}", quadKey);

    return url;
  }

  // gets the attributions that match the tile set.
  private getMatchingAttributions(tiles: Set<Tile> | undefined): BingAttribution[] {
    const matchingAttributions: BingAttribution[] = new Array<BingAttribution>();
    if (!this._attributions || !tiles)
      return matchingAttributions;

    const unmatchedSet: BingAttribution[] = this._attributions.slice();
    for (const tile of tiles) {
      // compare to the set of Bing attributions that we have not yet matched.
      for (let iAttr = 0; iAttr < unmatchedSet.length; iAttr++) {
        const attribution = unmatchedSet[iAttr];
        if (attribution && attribution.matchesTile(tile, this._mapTilingScheme)) {
          matchingAttributions.push(attribution);
          delete unmatchedSet[iAttr];
        }
      }
    }
    return matchingAttributions;
  }

  public getImageryLogo(_tileProvider: MapTileTreeReference, vp: ScreenViewport) {
    const tiles = IModelApp.tileAdmin.getTilesForViewport(vp)?.selected;
    const matchingAttributions = this.getMatchingAttributions(tiles);
    const copyrights: string[] = [];
    for (const match of matchingAttributions)
      copyrights.push(match.copyrightMessage);

    let copyrightMsg = "";
    for (let i = 0; i < copyrights.length; ++i) {
      if (i > 0)
        copyrightMsg += "<br>";
      copyrightMsg += copyrights[i];
    }
    return IModelApp.makeLogoCard({ iconSrc: "images/bing.svg", heading: "Microsoft Bing", notice: copyrightMsg });
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

  // initializes the BingImageryProvider by reading the templateUrl, logo image, and attribution list.
  public async initialize(): Promise<void> {
    // get the template url
    // NEEDSWORK - should get bing key from server.
    const bingKey = "AtaeI3QDNG7Bpv1L53cSfDBgBKXIgLq3q-xmn_Y2UyzvF-68rdVxwAuje49syGZt"; // spell-checker: disable-line

    let imagerySet = "Road";
    if (BackgroundMapType.Aerial === this.mapType)
      imagerySet = "Aerial";
    else if (BackgroundMapType.Hybrid === this.mapType)
      imagerySet = "AerialWithLabels";

    let bingRequestUrl: string = "https://dev.virtualearth.net/REST/v1/Imagery/Metadata/{imagerySet}?o=json&incl=ImageryProviders&key={bingKey}";
    bingRequestUrl = bingRequestUrl.replace("{imagerySet}", imagerySet);
    bingRequestUrl = bingRequestUrl.replace("{bingKey}", bingKey);
    const requestOptions: RequestOptions = {
      method: "GET",
    };

    try {
      const response: Response = await request(this._requestContext, bingRequestUrl, requestOptions);
      const bingResponseProps: any = response.body;

      const thisResourceSetProps = bingResponseProps.resourceSets[0];
      const thisResourceProps = thisResourceSetProps.resources[0];
      this._zoomMin = thisResourceProps.zoomMin;
      this._zoomMax = thisResourceProps.zoomMax;
      this._tileHeight = thisResourceProps.imageHeight;
      this._tileWidth = thisResourceProps.imageWidth;
      this._urlTemplate = replaceHttpWithHttps(thisResourceProps.imageUrl.replace("{culture}", "en-US")); // NEEDSWORK - get locale from somewhere.
      this._urlSubdomains = thisResourceProps.imageUrlSubdomains;
      // read the list of Bing's data suppliers and the range of data they provide. Used in calculation of copyright message.
      this.readAttributions(thisResourceProps.imageryProviders);

      // Bing sometimes provides tiles that have nothing but a camera icon in the middle of them when you ask
      // for tiles at zoom levels where they don't have data. Their application stops you from zooming in when that's the
      // case, but we can't stop - the user might want to look at design data a closer zoom. So we intentionally load such
      // a tile, and then compare other tiles to it, rejecting them if they match.
      this.loadTile(0, 0, this._zoomMax - 1).then((tileData: ImageSource | undefined) => { // tslint:disable-line:no-floating-promises
        if (tileData !== undefined) this._missingTileData = tileData.data as Uint8Array;
      });
    } catch (error) {
      throw new BentleyError(IModelStatus.BadModel, "Error in Bing Server communications");
    }
  }

  // reads the list of Bing data providers and the map range for which they each provide data.
  private readAttributions(attributionProps: any) {
    for (const thisAttributionProps of attributionProps) {
      const copyrightMessage: string = thisAttributionProps.attribution;
      const coverages: Coverage[] = new Array<Coverage>();
      for (const thisCoverageProps of thisAttributionProps.coverageAreas) {
        const thisCoverage = new Coverage(thisCoverageProps.bbox[0], thisCoverageProps.bbox[1], thisCoverageProps.bbox[2], thisCoverageProps.bbox[3],
          thisCoverageProps.zoomMin, thisCoverageProps.zoomMax);
        coverages.push(thisCoverage);
      }
      const thisAttribution: BingAttribution = new BingAttribution(copyrightMessage, coverages);
      if (!this._attributions)
        this._attributions = new Array<BingAttribution>();
      this._attributions.push(thisAttribution);
    }
  }
}

class MapBoxImageryProvider extends ImageryProvider {
  private _zoomMin: number;
  private _zoomMax: number;
  private _baseUrl: string;

  constructor(mapType: BackgroundMapType) {
    super();
    this._zoomMin = 1; this._zoomMax = 20;
    switch (mapType) {
      case BackgroundMapType.Street:
        this._baseUrl = "https://api.mapbox.com/v4/mapbox.streets/";
        break;

      case BackgroundMapType.Aerial:
        this._baseUrl = "https://api.mapbox.com/v4/mapbox.satellite/";
        break;

      case BackgroundMapType.Hybrid:
        this._baseUrl = "https://api.mapbox.com/v4/mapbox.streets-satellite/";
        break;

      default:
        this._baseUrl = "";
        assert(false);
    }
  }

  public get tileWidth(): number { return 256; }
  public get tileHeight(): number { return 256; }
  public get minimumZoomLevel(): number { return this._zoomMin; }
  public get maximumZoomLevel(): number { return this._zoomMax; }

  // construct the Url from the desired Tile
  public constructUrl(row: number, column: number, zoomLevel: number): string {

    // from the template url, construct the tile url.
    let url: string = this._baseUrl.concat(zoomLevel.toString());
    url = url.concat("/").concat(column.toString()).concat("/").concat(row.toString());
    url = url.concat(".jpg80?access_token=pk%2EeyJ1IjoibWFwYm94YmVudGxleSIsImEiOiJjaWZvN2xpcW00ZWN2czZrcXdreGg2eTJ0In0%2Ef7c9GAxz6j10kZvL%5F2DBHg");

    return url;
  }

  public getImageryLogo(_tileProvider: MapTileTreeReference, _vp: ScreenViewport) {
    return IModelApp.makeLogoCard({ heading: "Mapbox", notice: IModelApp.i18n.translate("iModelJs:BackgroundMap.MapBoxCopyright") });
  }

  // no initialization needed for MapBoxImageryProvider.
  public async initialize(): Promise<void> { }
}
