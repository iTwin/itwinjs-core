/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Tile */

import { assert } from "@bentley/bentleyjs-core";
import { TileTreeProps, TileProps, TileId, Cartographic, ImageSource, ImageSourceFormat, RenderTexture, EcefLocation } from "@bentley/imodeljs-common";
import { Id64Props, Id64, JsonUtils } from "@bentley/bentleyjs-core";
import { Range3dProps, Range3d, TransformProps, Transform, Point3d, Vector3d, Angle } from "@bentley/geometry-core";
import { TileLoader, TileTree, Tile, MissingNodes } from "./TileTree";
import { BentleyError, IModelStatus } from "@bentley/bentleyjs-core";
import { request, Response, RequestOptions } from "@bentley/imodeljs-clients";
import { ImageUtil } from "../ImageUtil";
import { IModelApp } from "../IModelApp";
import { RenderSystem } from "../render/System";
import { IModelConnection } from "../IModelConnection";
import { SceneContext } from "../ViewContext";

function longitudeToMercator(longitude: number) { return (longitude + Angle.piRadians) / Angle.pi2Radians; }
function latitudeToMercator(latitude: number) {
  const sinLatitude = Math.sin(latitude);
  return (0.5 - Math.log((1.0 + sinLatitude) / (1.0 - sinLatitude)) / (4.0 * Angle.piRadians));   // https://msdn.microsoft.com/en-us/library/bb259689.aspx
}

function ecefToMercator(point: Point3d) {
  const cartoGraphic = Cartographic.fromEcef(point) as Cartographic;
  return Point3d.create(longitudeToMercator(cartoGraphic.longitude), latitudeToMercator(cartoGraphic.latitude), 0.0);
}

class QuadId {
  public level: number;
  public column: number;
  public row: number;
  public isValid() { return this.level >= 0; }

  public constructor(stringId: string) {
    const idParts = stringId.split("_");
    if (3 !== idParts.length) {
      assert(false, "Invalid quadtree ID");
      this.level = this.row = this.column = -1;
      return;
    }

    this.level = parseInt(idParts[0], 10);
    this.column = parseInt(idParts[1], 10);
    this.row = parseInt(idParts[2], 10);
  }
  public getMercatorCorners(): Point3d[] {
    const nTiles = (1 << this.level);
    const scale = 1.0 / nTiles;

    const corners: Point3d[] = [];             //    ----x----->
    corners.push(Point3d.create(scale * this.column, scale * this.row, 0.0));   //  | [0]     [1]
    corners.push(Point3d.create(scale * (this.column + 1), scale * this.row, 0.0));   //  y
    corners.push(Point3d.create(scale * this.column, scale * (this.row + 1), 0.0));   //  | [2]     [3]
    corners.push(Point3d.create(scale * (this.column + 1), scale * (this.row + 1), 0.0));   //  v

    return corners;
  }
  public getCorners(mercatorToDb: Transform): Point3d[] {
    const corners = this.getMercatorCorners();
    mercatorToDb.multiplyPoint3dArrayInPlace(corners);
    return corners;
  }
  public getRange(mercatorToDb: Transform): Range3d {
    const corners = this.getCorners(mercatorToDb);
    return Range3d.createArray(corners);
  }
}
class WebMercatorTileTreeProps implements TileTreeProps {
  /** The unique identifier of this TileTree within the iModel */
  public id: Id64Props = "";
  /** Metadata describing the tree's root Tile. */
  public rootTile: TileProps;
  /** Transform tile coordinates to iModel world coordinates. */
  public location: TransformProps;
  public yAxisUp: boolean = true;
  public isTerrain: boolean = true;
  public constructor(mercatorToDb: Transform) {
    this.rootTile = new WebMercatorTileProps("0_0_0", mercatorToDb);
    this.location = Transform.createIdentity();
  }
}
class WebMercatorTileProps implements TileProps {
  public id: TileId;
  public parentId?: string;
  public range: Range3dProps;
  public contentRange?: Range3dProps;
  public maximumSize: number;

  public childIds: string[];
  public hasContents: boolean = true;
  public geometry?: any;

  constructor(thisId: string, mercatorToDb: Transform) {
    this.id = new TileId(new Id64(), thisId);
    const quadId = new QuadId(thisId);
    this.range = quadId.getRange(mercatorToDb);
    this.childIds = [];
    const level = quadId.level + 1;
    const column = quadId.column * 2;
    const row = quadId.row * 2;
    this.maximumSize = (0 === quadId.level) ? 0.0 : 256;
    for (let i = 0; i < 2; ++i) {
      for (let j = 0; j < 2; ++j) {
        this.childIds.push(level + "_" + (column + i) + "_" + (row + j));
      }
    }
  }
}
class WebMercatorTileLoader extends TileLoader {
  private providerInitialized: boolean = false;
  public mercatorToDb: Transform;
  constructor(private imageryProvider: ImageryProvider, private iModel: IModelConnection, groundBias: number) {
    super();
    const ecefLocation = iModel.ecefLocation as EcefLocation;
    const dbToEcef = Transform.createOriginAndMatrix(ecefLocation.origin, ecefLocation.orientation.toRotMatrix());

    const projectExtents = iModel.projectExtents;
    const projectCenter = projectExtents.getCenter();
    const projectEast = Point3d.create(projectCenter.x + 1.0, projectCenter.y, groundBias);
    const projectNorth = Point3d.create(projectCenter.x, projectCenter.y + 1.0, groundBias);

    const mercatorOrigin = ecefToMercator(dbToEcef.multiplyPoint3d(projectCenter));
    const mercatorX = ecefToMercator(dbToEcef.multiplyPoint3d(projectEast));
    const mercatorY = ecefToMercator(dbToEcef.multiplyPoint3d(projectNorth));

    const deltaX = Vector3d.createStartEnd(mercatorOrigin, mercatorX);
    const deltaY = Vector3d.createStartEnd(mercatorOrigin, mercatorY);

    const dbToMercator = Transform.createOriginAndMatrixColumns(mercatorOrigin, deltaX, deltaY, Vector3d.create(0.0, 0.0, 1.0)).multiplyTransformTransform(Transform.createTranslationXYZ(-projectCenter.x, -projectCenter.y, -groundBias));
    this.mercatorToDb = dbToMercator.inverse() as Transform;
  }
  public tileRequiresLoading(params: Tile.Params): boolean { return 0.0 !== params.maximumSize; }
  public async getTileProps(tileIds: string[]): Promise<TileProps[]> {
    const props: WebMercatorTileProps[] = [];
    for (const tileId of tileIds) { props.push(new WebMercatorTileProps(tileId, this.mercatorToDb)); }

    return props;
  }
  public async loadTileContents(missingTiles: MissingNodes): Promise<void> {
    const missingArray = missingTiles.extractArray();
    await Promise.all(missingArray.map(async (missingTile) => {
      if (missingTile.isNotLoaded) {
        missingTile.setIsQueued();
        if (!this.providerInitialized) {
          await this.imageryProvider.initialize();
          this.providerInitialized = true;
        }

        const quadId = new QuadId(missingTile.id);
        const corners = quadId.getCorners(this.mercatorToDb);
        const imageSource = await this.imageryProvider.loadTile(quadId.row, quadId.column, quadId.level);
        if (undefined === imageSource) {
          missingTile.setNotFound();
        } else {
          const textureLoad = this.loadTextureImage(imageSource as ImageSource, this.iModel, IModelApp.renderSystem);
          textureLoad.catch((_err) => missingTile.setNotFound());
          textureLoad.then((result) => {
            missingTile.setGraphic(IModelApp.renderSystem.createTile(result as RenderTexture, corners as Point3d[]));
          });
        }
      }
    }));
  }

  private async loadTextureImage(imageSource: ImageSource, iModel: IModelConnection, system: RenderSystem): Promise<RenderTexture | undefined> {
    try {
      const isCanceled = false;  // Tbd...
      const textureParams = new RenderTexture.Params(undefined, RenderTexture.Type.TileSection);
      return ImageUtil.extractImage(imageSource)
        .then((image) => isCanceled ? undefined : system.createTextureFromImage(image, ImageSourceFormat.Png === imageSource.format, iModel, textureParams))
        .catch((_) => undefined);
    } catch (e) {
      return undefined;
    }
  }

  public get maxDepth(): number { return this.providerInitialized ? this.imageryProvider.maximumZoomLevel : 32; }
}

// The type of background map
enum MapType { Street = 0, Aerial = 1, Hybrid = 2 }

// Represents the service that is providing map tiles for Web Mercator models (background maps).
abstract class ImageryProvider {
  public mapType: MapType;

  constructor(mapType: MapType) {
    this.mapType = mapType;
  }

  public abstract get tileWidth(): number;
  public abstract get tileHeight(): number;
  public abstract get minimumZoomLevel(): number;
  public abstract get maximumZoomLevel(): number;
  public abstract constructUrl(row: number, column: number, zoomLevel: number): string;
  public abstract getCopyrightMessage(): string;
  public abstract getCopyrightImage(): Uint8Array | undefined;

  // initialize the subclass of ImageryProvider
  public abstract async initialize(): Promise<void>;

  // returns true if the tile data matches the tile data of a "missing tile". See BingMapProvider.initialize.
  public matchesMissingTile(_tileData: Uint8Array): boolean {
    return false;
  }

  // returns a Uint8Array with the contents of the tile.
  public async loadTile(row: number, column: number, zoomLevel: number): Promise<ImageSource | undefined> {
    const tileUrl: string = this.constructUrl(row, column, zoomLevel);
    const tileRequestOptions: RequestOptions = { method: "GET", responseType: "arraybuffer" };
    try {
      const tileResponse: Response = await request(tileUrl, tileRequestOptions);
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
}

// Represents one range of geography and tile zoom levels for a bing data provider
class Coverage {
  constructor(public lowerLeftLongitude: number,
    public lowerLeftLatitude: number,
    public upperRightLongitude: number,
    public upperRightLatitude: number,
    public minimumZoomLevel: number,
    public maximumZoomLevel: number) { }
}

// Represents the copyright message and an array of coverage data for one of bing's data providers (HERE for example).
class BingAttribution {
  constructor(public copyrightMessage: string, public coverages: Coverage[]) { }
}

// Our ImageryProvider for Bing Maps.
class BingMapProvider extends ImageryProvider {
  private _urlTemplate?: string;
  private _urlSubdomains?: string[];
  private _logoUrl?: string;
  private _zoomMin: number;
  private _zoomMax: number;
  private _tileHeight: number;
  private _tileWidth: number;
  private _attributions?: BingAttribution[]; // array of Bing's data providers.
  private _missingTileData?: Uint8Array;
  public _logoByteArray?: Uint8Array;

  constructor(mapType: MapType) {
    super(mapType);
    this._zoomMin = this._zoomMax = 0;
    this._tileHeight = this._tileWidth = 0;
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

  public getCopyrightImage(): Uint8Array | undefined { return this._logoByteArray; }
  public getCopyrightMessage(): string { return ""; }    // NEEDSWORK

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

  // initializes the BingMapProvider by reading the templateUrl, logo image, and attribution list.
  public async initialize(): Promise<void> {
    // get the template url
    // NEEDSWORK - should get bing key from server.
    const bingKey = "AtaeI3QDNG7Bpv1L53cSfDBgBKXIgLq3q-xmn_Y2UyzvF-68rdVxwAuje49syGZt";

    let imagerySet = "Road";
    if (MapType.Aerial === this.mapType)
      imagerySet = "Aerial";
    else if (MapType.Hybrid === this.mapType)
      imagerySet = "AerialWithLabels";

    let bingRequestUrl: string = "http://dev.virtualearth.net/REST/v1/Imagery/Metadata/{imagerySet}?o=json&incl=ImageryProviders&key={bingKey}";
    bingRequestUrl = bingRequestUrl.replace("{imagerySet}", imagerySet);
    bingRequestUrl = bingRequestUrl.replace("{bingKey}", bingKey);
    const requestOptions: RequestOptions = {
      method: "GET",
    };
    try {
      const response: Response = await request(bingRequestUrl, requestOptions);
      const bingResponseProps: any = response.body;
      this._logoUrl = bingResponseProps.brandLogoUri;

      const thisResourceSetProps = bingResponseProps.resourceSets[0];
      const thisResourceProps = thisResourceSetProps.resources[0];
      this._zoomMin = thisResourceProps.zoomMin;
      this._zoomMax = thisResourceProps.zoomMax;
      this._tileHeight = thisResourceProps.imageHeight;
      this._tileWidth = thisResourceProps.imageWidth;
      this._urlTemplate = thisResourceProps.imageUrl.replace("{culture}", "en-US"); // NEEDSWORK - get locale from somewhere.
      this._urlSubdomains = thisResourceProps.imageUrlSubdomains;
      // read the list of Bing's data suppliers and the range of data they provide. Used in calculation of copyright message.
      this.readAttributions(thisResourceProps.imageryProviders);

      // read the Bing logo data, used in getCopyrightImage
      this.readLogo().then((logoByteArray) => { this._logoByteArray = logoByteArray; });

      // Bing sometimes provides tiles that have nothing but a stupid camera icon in the middle of them when you ask
      // for tiles at zoom levels where they don't have data. Their application stops you from zooming in when that's the
      // case, but we can't stop - the user might want to look at design data a closer zoom. So we intentionally load such
      // a tile, and then compare other tiles to it, rejecting them if they match.
      this.loadTile(0, 0, this._zoomMax - 1).then((tileData: ImageSource | undefined) => {
        if (tileData !== undefined) this._missingTileData = tileData.data;
      });
    } catch (error) {
      throw new BentleyError(IModelStatus.BadModel, "Error in Bing Server communications");
    }
  }

  // reads the Bing logo from the url returned as part of the first response.
  private readLogo(): Promise<Uint8Array | undefined> {
    if (!this._logoUrl || (this._logoUrl.length === 0))
      return Promise.resolve(undefined);
    const logoRequestOptions: RequestOptions = { method: "GET", responseType: "arraybuffer" };
    return request(this._logoUrl, logoRequestOptions).then((logoResponse: Response) => {
      const byteArray = new Uint8Array(logoResponse.body);
      if (!byteArray || (byteArray.length === 0))
        return undefined;
      return byteArray;
    }, (_error) => {
      return undefined;
    });
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

// Our ImageryProvider for Bing Maps.
class MapBoxProvider extends ImageryProvider {
  private _zoomMin: number;
  private _zoomMax: number;
  private _baseUrl: string;

  constructor(mapType: MapType) {
    super(mapType);
    this._zoomMin = this._zoomMax = 0;
    switch (mapType) {
      case MapType.Street:
        this._baseUrl = "http://api.mapbox.com/v4/mapbox.streets/";
        break;

      case MapType.Aerial:
        this._baseUrl = "http://api.mapbox.com/v4/mapbox.satellite/";
        break;

      case MapType.Hybrid:
        this._baseUrl = "http://api.mapbox.com/v4/mapbox.streets-satellite/";
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

  public getCopyrightImage(): Uint8Array | undefined { return undefined; }

  public getCopyrightMessage(): string { return "(c) Mapbox, (c) OpenStreetMap contributors"; }

  // no initialization needed for MapBoxProvider.
  public async initialize(): Promise<void> { }
}

/** @hidden */
export class BackgroundMapState {
  private _tileTree?: TileTree;
  private _loadStatus: TileTree.LoadStatus = TileTree.LoadStatus.NotLoaded;
  private providerName: string;
  /// private providerData: string;
  private groundBias: number;
  private mapType: MapType;

  public setTileTree(props: TileTreeProps, loader: TileLoader) {
    this._tileTree = new TileTree(TileTree.Params.fromJSON(props, this.iModel, true, loader));
    this._loadStatus = TileTree.LoadStatus.Loaded;
  }
  public constructor(json: any, private iModel: IModelConnection) {
    this.providerName = JsonUtils.asString(json.providerName, "BingProvider");
    // this.providerData = JsonUtils.asString(json.providerData, "aerial");
    this.groundBias = JsonUtils.asDouble(json.groundBias, 0.0);
    this.mapType = JsonUtils.asInt(json.mapType, MapType.Hybrid);
  }

  private loadTileTree(): TileTree.LoadStatus {
    if (TileTree.LoadStatus.NotLoaded !== this._loadStatus)
      return this._loadStatus;

    if (this.iModel.ecefLocation === undefined) {
      return this._loadStatus;
    }

    let provider: ImageryProvider | undefined;

    if ("BingProvider" === this.providerName) {
      provider = new BingMapProvider(this.mapType);
    } else if ("MapBoxProvider" === this.providerName) {
      provider = new MapBoxProvider(this.mapType);
    }
    if (provider === undefined)
      throw new BentleyError(IModelStatus.BadModel, "WebMercator provider invalid");

    const loader = new WebMercatorTileLoader(provider as ImageryProvider, this.iModel, JsonUtils.asDouble(this.groundBias, 0.0));
    const tileTreeProps = new WebMercatorTileTreeProps(loader.mercatorToDb);
    this.setTileTree(tileTreeProps, loader);
    return this._loadStatus;
  }
  public addToScene(context: SceneContext) {
    if (!context.viewFlags.backgroundMap)
      return;

    this.loadTileTree();
    if (undefined !== this._tileTree)
      this._tileTree.drawScene(context);
  }
}
