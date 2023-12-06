/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */
import { Cartographic, ImageMapLayerSettings, ImageSource, IModelStatus, ServerError } from "@itwin/core-common";
import { IModelApp } from "../../../IModelApp";
import {
  ArcGisErrorCode, ArcGisGeometryReaderJSON, ArcGisGraphicsRenderer, ArcGISImageryProvider, ArcGISTileMap,
  ArcGisUtilities, ImageryMapTileTree, MapCartoRectangle, MapFeatureInfoOptions, MapLayerFeature,
  MapLayerFeatureInfo, MapLayerImageryProviderStatus, MapSubLayerFeatureInfo, QuadId,
} from "../../internal";
import { PropertyValueFormat, StandardTypeNames } from "@itwin/appui-abstract";
import { Point2d, Range2d, Range2dProps, XYProps } from "@itwin/core-geometry";
import { Logger } from "@itwin/core-bentley";
import { HitDetail } from "../../../HitDetail";

const loggerCategory =  "MapLayerImageryProvider.ArcGISMapLayerImageryProvider";

/** @internal */
export interface ArcGISIdentifyImageDisplayProps {
  width: number;
  height: number;
  dpi: number;
}

/** @internal */
export interface ArcGISIdentifyLayersProps {
  prefix: "top"|"visible"|"all";
  layerIds?: string[];
}

/** @internal */
export interface ArcGISIdentifyRequestUrlProps {
  /** The geometry to identify on.  Point only support */
  geometry: XYProps;

  /** The type of geometry specified by the geometry parameter. Point only support */
  geometryType: "esriGeometryPoint";

  /** The well-known ID of the spatial reference of the input and output geometries as well as the mapExtent. */
  sr?: number;

  /** The layers to perform the identify operation on. The default value is top.
   * Format: [top | visible | all]:layerId1,layerId2
  */
  layers?: ArcGISIdentifyLayersProps;

  /** The distance in screen pixels from the specified geometry within which the identify operation should be performed.
   * The value for the tolerance is an integer.
   */
  tolerance: number;

  /** The extent or bounding box of the map currently being viewed.
  * Format: <xmin>, <ymin>, <xmax>, <ymax>
   */
  mapExtent: Range2dProps;

  /** The screen image display parameters (width, height, and DPI) of the map being currently viewed. T
   * Format: <width>,<height>,<dpi>
   */
  imageDisplay: ArcGISIdentifyImageDisplayProps;

  /** If true, the result set will include the geometries associated with each result. The default is true.
   */
  returnGeometry?: boolean;

  /** This option can be used to specify the maximum allowable offset to be used for generalizing geometries returned by the identify operation.
   * The maxAllowableOffset is in the units of the sr.
   */
  maxAllowableOffset?: number;

  /** The response format. The default response format is html.
   */
  f?: "json"|"html";

}

/** @internal */
export class ArcGISIdentifyRequestUrl {
  public static fromJSON(baseUrl: URL|string, json: ArcGISIdentifyRequestUrlProps, srFractionDigits?: number): URL {

    const newUrl = new URL(baseUrl);
    newUrl.pathname = `${newUrl.pathname}/identify`;

    if (json.f) {
      newUrl.searchParams.append("f", json.f);
    }

    const geomPt = Point2d.fromJSON(json.geometry);
    newUrl.searchParams.append("geometry", `${this.toFixed(geomPt.x, srFractionDigits)},${this.toFixed(geomPt.y, srFractionDigits)}`);
    newUrl.searchParams.append("geometryType", json.geometryType);

    if (json.sr) {
      newUrl.searchParams.append("sr", `${json.sr}`);
    }

    if (json.layers) {
      newUrl.searchParams.append("layers", `${json.layers.prefix}${json.layers.layerIds?.length ? `: ${json.layers.layerIds.join(",")}` : ""}`);
    }

    newUrl.searchParams.append("tolerance", `${json.tolerance}`);

    newUrl.searchParams.append("mapExtent", ArcGISIdentifyRequestUrl.getExtentString(json.mapExtent, srFractionDigits));

    newUrl.searchParams.append("imageDisplay", `${json.imageDisplay.width},${json.imageDisplay.height},${json.imageDisplay.dpi}`);

    if (json.returnGeometry !== undefined) {
      newUrl.searchParams.append("returnGeometry", json.returnGeometry ? "true" : "false");
    }

    if (json.maxAllowableOffset !== undefined) {
      newUrl.searchParams.append("maxAllowableOffset", `${this.toFixed(json.maxAllowableOffset, srFractionDigits)}`);
    }

    return newUrl;
  }

  public static toFixed(value: number, srFractionDigits?: number) {
    return srFractionDigits === undefined ? value.toString() : value.toFixed(srFractionDigits);
  }

  public static getExtentString(range: Range2dProps, srFractionDigits?: number) {
    const extent = Range2d.fromJSON(range);
    const extentStringArray: string[] = [];
    extent.toFloat64Array().forEach((value) => extentStringArray.push(this.toFixed(value, srFractionDigits)));
    return extentStringArray.join(",");
  }
}

/** @internal */
export class ArcGISMapLayerImageryProvider extends ArcGISImageryProvider {
  private _maxDepthFromLod = 0;
  private _minDepthFromLod = 0;
  private _copyrightText = "Copyright";
  private _tileMapSupported = false;
  private _mapSupported = false;
  private _tilesOnly = false;
  private _tileMap: ArcGISTileMap|undefined;

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

  private async fetchTile(row: number, column: number, zoomLevel: number) {
    const tileUrl: string = await this.constructUrl(row, column, zoomLevel);
    if (tileUrl.length === 0)
      return undefined;
    return this.fetch(new URL(tileUrl), { method: "GET" });
  }

  public override async loadTile(row: number, column: number, zoomLevel: number): Promise<ImageSource | undefined> {
    if ((this.status === MapLayerImageryProviderStatus.RequireAuth)) {
      return undefined;
    }

    try {
      const tileResponse = await this.fetchTile(row, column, zoomLevel);
      if (tileResponse === undefined)
        return undefined;

      if (!this._hasSuccessfullyFetchedTile) {
        this._hasSuccessfullyFetchedTile = true;
      }
      return await this.getImageFromTileResponse(tileResponse, zoomLevel);
    } catch (error) {
      Logger.logError(loggerCategory, `Error occurred when loading tile(${row},${column},${zoomLevel}) : ${error}`);
      return undefined;
    }
  }

  protected override _generateChildIds(quadId: QuadId, resolveChildren: (childIds: QuadId[]) => void) {
    const childIds = this.getPotentialChildIds(quadId);
    if (quadId.level < Math.max(1, this.minimumZoomLevel-1)) {
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

  public override async initialize(): Promise<void> {

    const metadata = await this.getServiceJson();

    if (metadata?.content === undefined)
      throw new ServerError(IModelStatus.ValidationFailed, "");

    const json = metadata.content;
    if (json?.error?.code === ArcGisErrorCode.TokenRequired || json?.error?.code === ArcGisErrorCode.InvalidToken) {
      // Check again layer status, it might have change during await.
      if (this.status === MapLayerImageryProviderStatus.Valid) {
        this.setStatus(MapLayerImageryProviderStatus.RequireAuth);
        return;  // By returning (i.e not throwing), we ensure the tileTree get created and current provider is preserved to report status.
      }
    }

    this.serviceJson = json;

    if (json.capabilities) {
      const capabilities = json.capabilities.split(",");

      this._querySupported = capabilities.includes("Query");
      this._tileMapSupported = capabilities.includes("Tilemap");
      this._mapSupported = capabilities.includes("Map");
      this._tilesOnly = capabilities.includes("TilesOnly");
    }

    if (json.copyrightText)
      this._copyrightText = json.copyrightText;

    this._usesCachedTiles = !!json.tileInfo;

    if (this._usesCachedTiles) {
      // Only EPSG:3857 is supported with pre-rendered tiles.  Fall back to 'Export' queries if possible otherwise throw.
      if (!ArcGisUtilities.isEpsg3857Compatible(json.tileInfo)) {
        if (this._mapSupported && !this._tilesOnly) {
          this._usesCachedTiles = false;
        } else {
          throw new ServerError(IModelStatus.ValidationFailed, "Invalid coordinate system");
        }
      }
    }

    if (this._usesCachedTiles) {
      // Read max LOD
      if (json.maxScale !== undefined && json.maxScale !== 0 && Array.isArray(json.tileInfo.lods)) {
        for (; this._maxDepthFromLod < json.tileInfo.lods.length && json.tileInfo.lods[this._maxDepthFromLod].scale > json.maxScale; this._maxDepthFromLod++)
          ;
      }

      // Create tile map object only if we are going to request tiles from this server and it support tilemap requests.
      if (this._tileMapSupported) {
        const fetch = async (url: URL, options?: RequestInit): Promise<Response> => {
          return this.fetch(url, options);
        };
        this._tileMap = new ArcGISTileMap(this._settings.url, this._settings, fetch, json.tileInfo?.lods?.length);
      }
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
      if (json.tileInfo?.lods !== undefined && Array.isArray(json.tileInfo.lods)) {
        for (const lod of json.tileInfo.lods) {
          if (lod.scale < minScale) {
            this._minDepthFromLod = lod.level;
            break;
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
  private async getIdentifyData(quadId: QuadId, carto: Cartographic, tolerance: number, returnGeometry?: boolean, maxAllowableOffset?: number): Promise<any>   {

    const bbox = this.getEPSG3857Extent(quadId.row, quadId.column, quadId.level);
    const layerIds = new Array<string>();
    this._settings.subLayers.forEach((subLayer) => {
      if (this._settings.isSubLayerVisible(subLayer))
        layerIds.push(subLayer.idString);
    });
    const urlObj = ArcGISIdentifyRequestUrl.fromJSON(this._settings.url, {
      f: "json",
      geometry: {x: this.getEPSG3857X(carto.longitudeDegrees), y: this.getEPSG3857Y(carto.latitudeDegrees)},
      geometryType: "esriGeometryPoint",
      tolerance,
      mapExtent: {low: {x: bbox.left, y: bbox.bottom}, high: {x: bbox.right, y: bbox.top}},
      sr: 3857,
      imageDisplay: {width: this.tileSize, height: this.tileSize, dpi: 96},
      layers: {prefix: "top", layerIds},
      returnGeometry,
      maxAllowableOffset}, 3 /* 1mm accuracy*/);

    const response = await this.fetch(urlObj, { method: "GET" } );
    return response.json();
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
  public override async getFeatureInfo(featureInfos: MapLayerFeatureInfo[], quadId: QuadId, carto: Cartographic, _tree: ImageryMapTileTree, hit: HitDetail, options?: MapFeatureInfoOptions): Promise<void> {
    if (!this._querySupported)
      return;

    const tileExtent = this.getEPSG3857Extent(quadId.row, quadId.column, quadId.level);
    const toleranceWorld = (tileExtent.top - tileExtent.bottom) / this.tileSize;
    const maxAllowableOffsetFactor = 2;
    const maxAllowableOffset = maxAllowableOffsetFactor*toleranceWorld;

    const tolerancePixel = options?.tolerance ?? 7;
    const json = await this.getIdentifyData(quadId, carto, tolerancePixel, true, maxAllowableOffset);
    if (json && Array.isArray(json.results)) {
      const renderer = new ArcGisGraphicsRenderer({viewport: hit.viewport});

      const layerInfo: MapLayerFeatureInfo = { layerName: this._settings.name, subLayerInfos: [] };

      // The 'identify' service returns us a flat/unordered list of records..
      // results may represent features for the a common subLayer.
      // For simplicity, we group together features for a given sub-layer.
      const subLayers = new Map<string, MapSubLayerFeatureInfo> ();

      for (const result of json.results) {

        let subLayerInfo = subLayers.get(result.layerName);
        if (!subLayerInfo) {
          subLayerInfo = {
            subLayerName: result.layerName ?? "",
            displayFieldName: result.displayFieldName,
            features: [],
          };
          subLayers.set(result.layerName, subLayerInfo);
        }
        const feature: MapLayerFeature = {geometries: [], attributes: []};

        // Read all feature attributes
        for (const [key, value] of Object.entries(result.attributes)) {
          // Convert everything to string for now
          const strValue = String(value);
          feature.attributes.push({
            value: { valueFormat: PropertyValueFormat.Primitive, value: strValue, displayValue: strValue },
            property: { name: key, displayLabel: key, typename: StandardTypeNames.String },
          });
        }

        // Read feature geometries
        const geomReader = new ArcGisGeometryReaderJSON(result.geometryType, renderer);
        await geomReader.readGeometry(result.geometry);
        const graphics = renderer.moveGraphics();
        feature.geometries = graphics.map((graphic) => {
          return {graphic};
        });
        subLayerInfo.features.push(feature);

      }

      for ( const value of subLayers.values()) {
        layerInfo.subLayerInfos!.push(value);
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
    return tmpUrl;
  }
}
