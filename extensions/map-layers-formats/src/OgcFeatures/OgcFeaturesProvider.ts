/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { FeatureGraphicsRenderer, HitDetail, ImageryMapTileTree, MapCartoRectangle, MapFeatureInfoOptions, MapLayerFeatureInfo, MapLayerImageryProvider, QuadId, WGS84Extent } from "@itwin/core-frontend";
import { EsriPMS, EsriPMSProps, EsriRenderer, EsriSFS, EsriSFSProps, EsriSLS, EsriSLSProps, EsriSymbol } from "../ArcGisFeature/EsriSymbology";
import { Cartographic, ColorDef, ImageMapLayerSettings, ImageSource, ImageSourceFormat, ServerError, SubLayerId } from "@itwin/core-common";
import { Matrix4d, Point3d, Range2d } from "@itwin/core-geometry";
import { ArcGisSymbologyCanvasRenderer } from "../ArcGisFeature/ArcGisSymbologyRenderer";
import { FeatureCanvasRenderer } from "../Feature/FeatureCanvasRenderer";
import { base64StringToUint8Array, IModelStatus, Logger } from "@itwin/core-bentley";
import * as Geojson from "geojson";
import { FeatureDefaultSymbology } from "../Feature/FeatureSymbology";
import { OgcFeaturesReader } from "./OgcFeaturesReader";
import { RandomMapColor } from "../Feature/RandomMapColor";
import { DefaultMarkerIcon } from "../Feature/DefaultMarkerIcon";

const loggerCategory = "MapLayersFormats.OgcFeatures";
const dataUrlHeaderToken = "base64,";

/**  Provide tiles from a ESRI ArcGIS Feature service
* @internal
*/
export class DefaultOgcSymbology implements FeatureDefaultSymbology {

  private static readonly _defaultPMSProps: Omit<EsriPMSProps, "imageData" | "contentType"> = {
    type: "esriPMS",
    url: "",
    width: 16,
    height: 24,
    // We want the anchor point to be the bottom of the push pin, so apply offset on the y-axis (anchor point is already in the center of the icon)
    xoffset: 0,
    yoffset: -12,
  };
  private _defaultPMS: EsriPMS;

  private static readonly _defaultSLSProps: EsriSLSProps = {
    type: "esriSLS",
    color: [0, 0, 255, 255],
    width: 1,
    style: "esriSLSSolid",
  };
  private _defaultSLS: EsriSLS;

  private static readonly _defaultSFSProps: EsriSFSProps = {
    type: "esriSFS",
    color:  [0, 0, 255, 255],   // blue fill
    style: "esriSFSSolid",
    outline: DefaultOgcSymbology._defaultSLSProps,
  };
  private _defaultSFS = EsriSFS.fromJSON(DefaultOgcSymbology._defaultSFSProps);

  public constructor(randomColor?: RandomMapColor) {
    const color = randomColor ? randomColor.getColorDef() : ColorDef.blue;
    this._defaultPMS = EsriPMS.fromJSON( {
      ...DefaultMarkerIcon.getContent(color),
      type: "esriPMS",
      url: "",
      width: 16,
      height: 24,
      xoffset: 0,
      yoffset: -12,
    });

    const randomColors = color.colors;
    const newSLSProps = {
      ...DefaultOgcSymbology._defaultSLSProps,
      color: [randomColors.r, randomColors.g, randomColors.b, 255],
    };
    this._defaultSLS = EsriSLS.fromJSON(newSLSProps);
    this._defaultSFS = EsriSFS.fromJSON({
      ...DefaultOgcSymbology._defaultSFSProps,
      color: [randomColors.r, randomColors.g, randomColors.b, 255],
      outline: {
        ...DefaultOgcSymbology._defaultSLSProps,
        color: [0, 0, 0, 255],
      },
    });
  }

  public async initialize() {
    // Marker image need to be loaded upfront;
    await this._defaultPMS.loadImage();
  }

  public getSymbology(geometryType: string): EsriSymbol {
    if (geometryType === "LineString"|| geometryType === "MultiLineString" )
      return this._defaultSLS;
    else if (geometryType === "Polygon"|| geometryType === "MultiPolygon" )
      return this._defaultSFS;
    else if (geometryType === "Point"|| geometryType === "MultiPoint" )
      return this._defaultPMS;

    throw new Error(`Could not get default symbology for geometry type ${geometryType}`);
  }
}
/** @internal */
export class OgcFeaturesProvider extends MapLayerImageryProvider {

  // Debug flags, should always be committed to FALSE !
  private readonly _drawDebugInfo = false;
  /// ////////////////////////////

  private readonly _limitParamMaxValue = 10000; // This is documented in OGC Features specification; a single items request never returns more than 10 000 items
  private readonly _tiledModeMinLod = 14;
  private readonly _staticModeFetchTimeout = 10000;
  private readonly _tileModeFetchTimeout = 10000;
  private readonly _forceTileMode = false;
  private _spatialIdx: any;
  private _defaultSymbol = new DefaultOgcSymbology(new RandomMapColor());
  private _renderer: EsriRenderer|undefined;
  private _collectionUrl = "";
  private _itemsUrl = "";
  private readonly _itemsCrs = "http://www.opengis.net/def/crs/OGC/1.3/CRS84";   // Fixed fow now
  private _queryables: any;

  public serviceJson: any;
  private _staticData: Geojson.FeatureCollection|undefined;

  constructor(settings: ImageMapLayerSettings) {
    super(settings, true);
  }

  public override get supportsMapFeatureInfo() { return true;}
  public override get minimumZoomLevel(): number { return this.staticMode ? super.minimumZoomLevel : this._tiledModeMinLod; }
  public get staticMode(): boolean { return !!(this._spatialIdx && this._staticData && !this._forceTileMode); }

  public override async initialize(): Promise<void> {

    this._collectionUrl = this._settings.url;
    let layerId: SubLayerId|undefined;

    // OGC Feature service request can only serve data for a single feature
    // so if multiple sub-layer ids are specified, we pick the first one.
    if (this._settings.subLayers && this._settings.subLayers.length > 0) {
      layerId = this._settings.subLayers[0].id;
    }

    const readCollectionsPage = (data: any) => {
      const collection = data.collections.find((col: any)=> col.id === layerId);
      const collectionLinks = collection?.links;
      if (!collectionLinks) {
        const msg = `Missing layer id or matching collection could not be found`;
        Logger.logError(loggerCategory, msg);
        throw new Error(msg);
      }
      const collectionLink = collectionLinks.find((link: any)=> link.rel.includes("collection") && link.type === "application/json",
      );
      this._collectionUrl  = collectionLink.href;
    };

    const layerIdMismatch = () => {
      const msg = `Collection metadata and sub-layers id mismatch`;
      Logger.logError(loggerCategory, msg);
      throw new Error(msg);
    };
    let collectionMetadata: any;
    let json = await this.fetchMetadata(this._settings.url);
    if (json?.type === "FeatureCollection") {
      // We landed on the items page, we need to look for the collection metadata url
      if (Array.isArray(json.links)) {
        const collectionLink = json.links.find((link: any)=> link.rel.includes("collection") && link.type === "application/json");
        this._collectionUrl  = collectionLink.href;
      }
    } else if (json.itemType === "feature") {
      // We landed on a specific collection page.
      collectionMetadata = json;

      // Check if the collection id matches at least one sub-layer
      if (this._settings.subLayers && this._settings.subLayers.length > 0) {
        const subLayer = this._settings.subLayers.find((s)=>s.id === collectionMetadata.id);
        if (subLayer)
          layerId = subLayer.id;
      } else {
        // No sub-layers were specified, defaults to collection id.
        layerId = collectionMetadata.id;
      }

    } else if (Array.isArray(json.collections)) {
      // We landed in the "Collections" page
      // Find to find the specified layer id among the available collections
      readCollectionsPage(json);
    }  else if (Array.isArray(json.links)) {
      // This might be the main landing page
      // We need to find the the "Collections" page
      const collectionsLink = json.links.find((link: any)=> link.rel.includes("data") && link.type === "application/json");
      if (!collectionsLink) {
        Logger.logError(loggerCategory, "Could not find collections link");
        throw new ServerError(IModelStatus.ValidationFailed, "");
      }

      json =  await this.fetchMetadata(collectionsLink.href);
      if (Array.isArray(json.collections)) {
        readCollectionsPage(json);
      }
    }

    // Read collection metadata
    if (!collectionMetadata)
      collectionMetadata = await this.fetchMetadata(this._collectionUrl);

    if (layerId !== undefined && layerId !== collectionMetadata.id) {
      layerIdMismatch();
    }

    // Read cartographic range
    if (Array.isArray(collectionMetadata?.extent?.spatial?.bbox)
    && collectionMetadata.extent.spatial.bbox.length > 0
    && collectionMetadata.extent.spatial.crs === this._itemsCrs
    ) {
      const firstBbox = collectionMetadata.extent.spatial?.bbox[0];
      this.cartoRange = MapCartoRectangle.fromDegrees(firstBbox[0], firstBbox[1], firstBbox[2], firstBbox[3]);
    }

    // Read important links
    let queryablesHref: string|undefined;
    let itemsHref: string|undefined;
    if (Array.isArray(collectionMetadata?.links)) {
      // Items links (Mandatory)
      const itemsLink = collectionMetadata.links.find((link: any)=> link.rel.includes("items") && link.type === "application/geo+json");
      itemsHref = itemsLink.href;

      // Queryables link (Optional)
      const queryablesLink = collectionMetadata.links.find((link: any)=> link.rel.includes("queryables") && link.type === "application/schema+json");
      queryablesHref = queryablesLink.href;

    }

    if (itemsHref)
      this._itemsUrl = itemsHref;
    else {
      const msg = "Unable to find items link on collection";
      Logger.logError(loggerCategory, msg);
      throw new Error(msg);
    }
    if (queryablesHref)
      this._queryables = await this.fetchMetadata(queryablesHref);

    if (!this._forceTileMode) {
      const status = await this.fetchAllItems();
      if (status) {
        await this.indexStaticData();
      }
    }

    await this._defaultSymbol.initialize(); // images must be loaded upfront
  }

  private async fetchMetadata(url: string): Promise<any> {
    const tmpUrl = this.appendCustomParams(url);
    const response = await this.makeRequest(tmpUrl);
    return response.json();
  }

  private async fetchAllItems() {
    const urlObj = new URL(this._itemsUrl);
    urlObj.searchParams.append("limit", `${this._limitParamMaxValue}`);
    const url = this.appendCustomParams(urlObj.toString());
    this._staticData = await this.fetchItems(url, this._staticModeFetchTimeout);
    return this._staticData ? true : false;
  }

  private async fetchItems(url: string, timeout: number) {
    let data: any;
    let success = true;
    try {
      const fetchBegin = Date.now();
      let tmpUrl = this.appendCustomParams(url);
      let response = await this.makeTileRequest(tmpUrl, timeout);
      let json = await response.json();
      data = json;
      // Follow "next" link if any
      let nextLink = json.links?.find((link: any)=>link.rel === "next");
      while (nextLink && (Date.now() - fetchBegin) < timeout && success) {
        tmpUrl = this.appendCustomParams(nextLink.href);
        response = await this.makeTileRequest(tmpUrl, this._staticModeFetchTimeout);
        json = await response.json();
        if (json?.features)
          data!.features = this._staticData?.features ? [...this._staticData.features, ...json.features] : json.features;
        else
          success = false;
        nextLink = json.links?.find((link: any)=>link.rel === "next");
      }
      if (Date.now() - fetchBegin >= this._staticModeFetchTimeout) {
        // We ran out of time, let switch to tile mode
        success = false;
      }
    } catch (e)  {
      success = false;
      if (e instanceof DOMException && e.name === "AbortError") {
        Logger.logInfo(loggerCategory, "Request to fetch all features time out, switching to tile mode.");
      } else {
        Logger.logError(loggerCategory, "Unknown error occurred when fetching OgcFeatures data.");
      }
    }
    return success ? data : undefined;
  }

  // Read features range and build in-memory spatial index
  private async indexStaticData() {
    // UGLY  IMPORT:
    // flatbush only provides ECM modules, and since mocha is not very good with ECM modules,
    // we need to have this special import, until we replace mocha with something else.
    const flatbush = (await import("flatbush")).default;
    let success = true;
    try {
      const datasetRange = new Range2d();
      const buildPositionRange = (coords: Geojson.Position, range: Range2d) => range.extendXY(coords[0], coords[1]);
      const buildPositionArrayRange = (coords: Geojson.Position[], range: Range2d) => coords.forEach((position) => buildPositionRange(position, range) );
      const buildDoublePositionRange = (coords: Geojson.Position[][], range: Range2d) => coords.forEach((position) => buildPositionArrayRange(position, range) );
      const buildTriplePositionRange = (coords: Geojson.Position[][][], range: Range2d) => coords.forEach((position) => buildDoublePositionRange(position, range) );

      const readGeomRange = (geom: Geojson.Geometry, range: Range2d) => {
        if (geom.type === "Point")
          buildPositionRange(geom.coordinates, range);
        else if (geom.type === "LineString" || geom.type === "MultiPoint")
          buildPositionArrayRange(geom.coordinates, range);
        else if (geom.type === "Polygon" || geom.type === "MultiLineString")
          buildDoublePositionRange(geom.coordinates, range);
        else if (geom.type === "MultiPolygon" )
          buildTriplePositionRange(geom.coordinates, range);
      };

      if (this._staticData && Array.isArray(this._staticData.features)) {
        this._spatialIdx = new flatbush(this._staticData.features.length);
        this._staticData.features.forEach((feature: Geojson.Feature) => {
          try {
            if (feature.geometry.type === "LineString"
            || feature.geometry.type === "MultiLineString"
            || feature.geometry.type === "Point"
            || feature.geometry.type === "MultiPoint"
            || feature.geometry.type === "Polygon"
            || feature.geometry.type === "MultiPolygon"
            ) {
              readGeomRange(feature.geometry, datasetRange);
              this._spatialIdx?.add(datasetRange.xLow, datasetRange.yLow, datasetRange.xHigh,datasetRange. yHigh);
              datasetRange.setNull();
            } else if (feature.geometry.type === "GeometryCollection") {
              feature.geometry.geometries.forEach((geom) => {
                readGeomRange(geom, datasetRange);
                this._spatialIdx?.add(datasetRange.xLow, datasetRange.yLow, datasetRange.xHigh,datasetRange. yHigh);
              });
              datasetRange.setNull();
            }
          } catch (e: any)  {
            Logger.logInfo(loggerCategory, `Unknown error occurred indexing feature: ${e.message}`);
            success = false;
          }
        });

        if (success) {
          this._spatialIdx.finish();
        }
      }

    } catch (_e)  {
      Logger.logError(loggerCategory, "Unknown error occurred when index static data");
      success = false;
    }
    return success;
  }

  public override get tileSize(): number { return 512; }

  // We don't use this method inside this provider (see constructFeatureUrl), but since this is an abstract method, we need to define something
  public async constructUrl(_row: number, _column: number, _zoomLevel: number): Promise<string> {
    return "";
  }

  public drawTileDebugInfo(row: number, column: number, zoomLevel: number, context: CanvasRenderingContext2D) {
    context.fillStyle = "cyan";
    context.strokeRect(0, 0, this.tileSize, this.tileSize);
    context.font = "30px Arial";
    context.lineWidth = 5;
    context.fillText(`${zoomLevel}-${row}-${column}`, 10, 50);
  }

  // Compute transform that provides coordinates in the canvas coordinate system (pixels, origin = top-left)
  // from coordinate in world
  public computeTileWorld2CanvasTransform(row: number, column: number, zoomLevel: number) {

    const tileExtentWorld4326 = this.getEPSG4326Extent(row, column, zoomLevel);
    const worldTileWidth = tileExtentWorld4326.longitudeRight - tileExtentWorld4326.longitudeLeft;
    const worldTileHeight = tileExtentWorld4326.latitudeTop - tileExtentWorld4326.latitudeBottom;
    const canvasTileWidth = this.tileSize;
    const canvasTileHeight = this.tileSize;
    const world2CanvasRatioX = canvasTileWidth / worldTileWidth;
    const world2CanvasRatioY = canvasTileHeight / worldTileHeight;
    const worldTileOrigin = Point3d.create(tileExtentWorld4326.longitudeLeft, tileExtentWorld4326.latitudeBottom);
    const worldTileExtent = Point3d.create(tileExtentWorld4326.longitudeRight, tileExtentWorld4326.latitudeTop);
    const canvasTileOriginOffset = worldTileOrigin.clone();
    const canvasTileExtentOffset = worldTileExtent.clone();
    canvasTileOriginOffset.x *= world2CanvasRatioX;
    canvasTileOriginOffset.y *= world2CanvasRatioY;
    canvasTileExtentOffset.x *= world2CanvasRatioX;
    canvasTileExtentOffset.y *= world2CanvasRatioY;
    const xTranslate = -1 * canvasTileOriginOffset.x;

    // Canvas origin is upper left corner, so we need to flip the y axis
    const yTranslate = canvasTileExtentOffset.y;     // y-axis flip
    const yWorld2CanvasRatio = -1 * world2CanvasRatioY; // y-axis flip

    const matrix = Matrix4d.createTranslationAndScaleXYZ(xTranslate, yTranslate, 0, world2CanvasRatioX, yWorld2CanvasRatio, 1);
    return matrix.asTransform;
  }

  public override async loadTile(row: number, column: number, zoomLevel: number): Promise<ImageSource | undefined> {

    const extent4326 = this.getEPSG4326Extent(row, column, zoomLevel);

    let data: any;
    if (this.staticMode) {
      // Static data mode
      const filteredData: Geojson.FeatureCollection = {type: "FeatureCollection", features: []};

      this._spatialIdx?.search(extent4326.longitudeLeft, extent4326.latitudeBottom, extent4326.longitudeRight, extent4326.latitudeTop,
        (index: number) => {
          filteredData.features.push(this._staticData!.features[index]);
          return true;
        });

      data = filteredData;
    } else {
      // Tiled data mode
      const extent4326Str = this.getEPSG4326TileExtentString(row, column, zoomLevel, false);
      const urlObj = new URL(this._itemsUrl);
      urlObj.searchParams.append("bbox", `${extent4326Str}`);
      urlObj.searchParams.append("bbox-crs", this._itemsCrs);
      urlObj.searchParams.append("limit", `${this._limitParamMaxValue}`);
      const url = this.appendCustomParams(urlObj.toString());

      try {
        data = await this.fetchItems(url, this._tileModeFetchTimeout);
      } catch (_e) {
      }
      if (!data) {
        Logger.logError(loggerCategory, "Could not fetch OgcFeatures data.");
      }
    }

    if (!data || !Array.isArray(data.features) || data.features.length === 0) {
      Logger.logInfo(loggerCategory, `No data to render for tile (${zoomLevel}/${row}/${column}).`);
    }

    // Rendering starts here
    const canvas = document.createElement("canvas");
    canvas.width = this.tileSize;
    canvas.height = this.tileSize;
    const ctx = canvas.getContext("2d");
    if (ctx == null) {
      Logger.logError(loggerCategory, "No canvas context available for loading tile.");
      return undefined;
    }

    try {
      // Compute transform if CoordinatesQuantization is not supported by service
      const transfo = this.computeTileWorld2CanvasTransform(row, column, zoomLevel);
      if (!transfo) {
        Logger.logError(loggerCategory, `Could not compute data transformation for tile (${zoomLevel}/${row}/${column})`);
      }

      // Create the renderer

      // Instead of passing a Transform oject to the render, it should be possible
      // instead to set the Transform directly on the Canvas, when I tried the display was incorrect, floating point issue?
      // const transfoRow = transfo!.toRows();
      // ctx.setTransform(transfoRow[0][0], transfoRow[1][0], transfoRow[0][1], transfoRow[1][1], transfoRow[0][3], transfoRow[1][3]);
      const symbRenderer = ArcGisSymbologyCanvasRenderer.create(this._renderer, this._defaultSymbol);
      const renderer = new FeatureCanvasRenderer(ctx, symbRenderer, transfo);

      const featureReader  = new OgcFeaturesReader();

      await featureReader.readAndRender(data, renderer);
      if (this._drawDebugInfo)
        this.drawTileDebugInfo(row, column, zoomLevel, ctx);
    } catch (e) {
      Logger.logError(loggerCategory, `Exception occurred while loading tile (${zoomLevel}/${row}/${column}) : ${e}`);
    }

    try {
      return this.createImageSourceFromDataURL(canvas.toDataURL("image/png"), ImageSourceFormat.Png);
    } catch (e) {
      Logger.logError(loggerCategory, `Exception occurred while rendering tile (${zoomLevel}/${row}/${column}) : ${e}.`);
    }

    return undefined;
  }

  private createImageSourceFromDataURL(dataUrl: string, format: ImageSourceFormat) {
    if (!dataUrl)
      return undefined;

    const dataStartPos = dataUrl.indexOf(dataUrlHeaderToken) + dataUrlHeaderToken.length;

    if (dataStartPos < 0)
      return undefined;

    const base64Png = dataUrl.substring(dataStartPos);
    return new ImageSource(base64StringToUint8Array(base64Png), format);
  }

  public override async getFeatureInfo(featureInfos: MapLayerFeatureInfo[], quadId: QuadId, carto: Cartographic, _tree: ImageryMapTileTree, hit: HitDetail, options?: MapFeatureInfoOptions): Promise<void> {
    const tileExtent = this.getEPSG4326Extent(quadId.row, quadId.column, quadId.level);
    const tilePixelSizeX = (tileExtent.longitudeRight - tileExtent.longitudeLeft) / this.tileSize;
    const tilePixelSizeY = (tileExtent.latitudeTop - tileExtent.latitudeBottom) / this.tileSize;
    const tolerancePixel = options?.tolerance ?? 7;
    const toleranceWorldX = tilePixelSizeX * tolerancePixel;
    const toleranceWorldY = tilePixelSizeY * tolerancePixel;

    // Note: We used to pass a single point as the query 'geometry' and leverage the 'distance' parameter, turns
    // out that approach was a lot slower on some server compared to using a single envelope.
    const bbox: WGS84Extent = {
      longitudeLeft: carto.longitudeDegrees - toleranceWorldX, latitudeBottom: carto.latitudeDegrees - toleranceWorldY,
      longitudeRight: carto.longitudeDegrees + toleranceWorldX, latitudeTop: carto.latitudeDegrees + toleranceWorldY,
    };

    const bboxStr = this.getEPSG4326ExtentString(bbox, false);
    const urlObj = new URL(this._itemsUrl);
    urlObj.searchParams.append("bbox", `${bboxStr}`);
    urlObj.searchParams.append("bbox-crs", this._itemsCrs);
    urlObj.searchParams.append("limit", `${this._limitParamMaxValue}`);
    const url = this.appendCustomParams(urlObj.toString());

    let data: any;
    try {
      data = await this.fetchItems(url, this._tileModeFetchTimeout);
    } catch (_e) {
    }
    if (!data) {
      Logger.logError(loggerCategory, "Could not fetch OgcFeatures data.");
    }

    const featureReader = new OgcFeaturesReader();
    await featureReader.readFeatureInfo({
      collection:data,
      layerSettings: this._settings,
      queryables: this._queryables,
      geomRenderer: new FeatureGraphicsRenderer({viewport: hit.viewport, crs: "wgs84"})},
    featureInfos );
  }
}

