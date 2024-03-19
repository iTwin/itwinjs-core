/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { MapLayerImageryProvider } from "@itwin/core-frontend";
import { EsriPMS, EsriRenderer, EsriSFS, EsriSLS, EsriSLSProps, EsriSMS, EsriSymbol } from "../ArcGisFeature/EsriSymbology";
import { ImageMapLayerSettings, ImageSource, ImageSourceFormat } from "@itwin/core-common";
import { Matrix4d, Point3d, Range2d } from "@itwin/core-geometry";
import { ArcGisSymbologyCanvasRenderer } from "../ArcGisFeature/ArcGisSymbologyRenderer";
import { FeatureCanvasRenderer } from "../Feature/FeatureCanvasRenderer";
import { base64StringToUint8Array, Logger } from "@itwin/core-bentley";
import { OgcFeaturesReader } from "../ArcGisFeature/OgcFeaturesReader";
// import Flatbush from "flatbush";
import * as Geojson from "geojson";
import { FeatureDefaultSymbology } from "../Feature/FeatureSymbology";
const loggerCategory = "MapLayersFormats.OgcFeatures";

/**  Provide tiles from a ESRI ArcGIS Feature service
* @internal
*/
export class DefaultOgcSymbology implements FeatureDefaultSymbology {
  private static readonly defaultPMS = EsriPMS.fromJSON( {
    type: "esriPMS",
    url: "",
    contentType: "image/png",
    imageData: "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAAXNSR0IArs4c6QAAAmBJREFUOE+Nk01IVFEUx//n3jfvOZOaJkMtiiJ7o9RG3LgoqKhFSFJBTS1ahFBBi0ijfJXCIyQr+hBbSIsoW7iQoKKFCw2CkAI3tZAgy8Ei+xhoTCbnje/NPfHGnA816KzuPR+/c8/HJRQJE7o+VUhym0DcCOYGgBQEXjOLlyqo+nHanCkMoaL4rslKjZwOQLT4ek3Mmz3FACFNLB67ut6M1nWphbg8wI6VyJK5KEH0EQFVJRKbwzokAW++p/ErraAYSQK3u47bC3vLnA+ZB9i2gHF0oyQMCfCGNaUa+vauxs71wWz2V18cnBj8gQ8J1/eeBnHUa4sMFQDGdGno+4gwEAoQzjVUon3rqlx1KY9x7+0MWobjAPg3QJ2eZV4tAEyFNCN5FkSXyw2B3j1hRGvLcgBXMV5MptA4MOXr0gT0u5bZnAf0jBsyiSgJPAxqhON1K3FlRxUMvwFAtv7u0Wl0jvwEmJNEuOhakTt5wKEBifr6Oo14BIBRpgt07w6jcVMIngKGY7NofR5HwlF+zDcpsC193vyYB/innvHywCzdZfAR/+onX1segBTAxHzzfPE7/8yzzIPLjJE1LTixHZx5CtCK4gXLzovBiDPUsYxVM7gUkB3nWKlm6DYEnQGzXARxCOK+a1WfKtQXb6LNAvr7iCboCUA1Ocdsdv5KLPe7F6pH/w3wLbc+BwOuc5IZ1wEE/jonQbjptZn24tKKX7BgvR2r0NKZRwDvAqCI+Z30VJPTURv7P4A9psuQcYAUPwAoReBLrmX2Lmls7i8sZ7kWLwuoxA1FVJGxzMPLufi6P2r+2xFbOUjGAAAAAElFTkSuQmCC",
    // Black square
    // imageData: "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsEAAA7BAbiRa+0AAAAiSURBVDhPY2RgYPgPxGQDJihNNhg1YNQAEBg1YOANYGAAAE1AAR90Oy6aAAAAAElFTkSuQmCC",
    width: 16,
    height: 16,
    // We want the anchor point to be the bottom of the push pin, so apply offset on the y-axis (anchor point is already in the center of the icon)
    xoffset: 0,
    yoffset: -8,
  });

  private static readonly defaultSMS = EsriSMS.fromJSON( {
    type : "esriSMS",
    style : "esriSMSCircle",
    color : [0, 0, 0, 255],
    size : 16,
    outline : { // if outline has been specified
      type: "esriSLS",
      color : [0, 0, 0, 255],
      width : 1,
      style:"esriSLSSolid",
    },
  });

  private static readonly defaultSLSProps: EsriSLSProps = {
    type: "esriSLS",
    color: [0, 0, 255, 255],
    width: 1,
    style: "esriSLSSolid",
  };
  private static readonly defaultSLS = EsriSLS.fromJSON(this.defaultSLSProps);

  private static readonly defaultSFS = EsriSFS.fromJSON({
    type: "esriSFS",
    color:  [0, 0, 255, 100],   // blue fill
    style: "esriSFSSolid",
    outline: this.defaultSLSProps,
  });

  public async initialize() {
    // Marker image need to be loaded upfront;
    await DefaultOgcSymbology.defaultPMS.loadImage();
  }

  public getSymbology(geometryType: string): EsriSymbol {
    if (geometryType === "LineString"|| geometryType === "MultiLineString" )
      return DefaultOgcSymbology.defaultSLS;
    else if (geometryType === "Polygon"|| geometryType === "MultiPolygon" )
      return DefaultOgcSymbology.defaultSFS;
    else if (geometryType === "Point"|| geometryType === "MultiPoint" )
      // return DefaultOgcSymbology.defaultSMS;
      return DefaultOgcSymbology.defaultPMS;

    throw new Error(`Could not get default symbology for geometry type ${geometryType}`);
  }
}

// export type FeatureGeometryType = GeoJSONGeometryType | EsriGeometryType;
// export class SimpleSymbologyProvider {
//   public getSymbology(geometryType: string);
// }

export class OgcFeaturesProvider extends MapLayerImageryProvider {

  // Debug flags, should always be committed to FALSE !
  private readonly _drawDebugInfo = false;
  /// ////////////////////////////

  private readonly _limitParamMaxValue = 10000; // This is docmented in OGC Features specification; a single items request never returns more than 10 000 items
  private readonly _tiledModeMinLod = 12;
  private readonly _staticModeFetchTimeout = 30000;
  private readonly _tileModeFetchTimeout = 30000;
  private readonly _forceTileMode = false;
  private _spatialIdx: any;
  private _defaultSymbol = new DefaultOgcSymbology();
  private _renderer: EsriRenderer|undefined;
  private _baseUrl = "";
  private _format = "";

  public serviceJson: any;
  private _staticData: Geojson.FeatureCollection|undefined;

  constructor(settings: ImageMapLayerSettings) {
    super(settings, true);
  }

  public override get minimumZoomLevel(): number { return this.staticMode ? super.minimumZoomLevel : this._tiledModeMinLod; }
  public get staticMode(): boolean { return !!(this._spatialIdx && this._staticData && !this._forceTileMode); }

  public override async initialize(): Promise<void> {

    // TODO: Correct format url
    this._baseUrl = this._settings.url;
    // Find metadata for proper format, this can also be "json"
    this._format = "geojson";

    // this.cartoRange = MapCartoRectangle.fromDegrees(west, south, east, north);
    // const metadata = await this.getServiceJson();

    // if (this._layerMetadata.supportedQueryFormats) {
    //   const formats: string[] = this._layerMetadata.supportedQueryFormats.split(", ");
    //   if (formats.includes("PBF") && this._supportsCoordinatesQuantization) {
    //     this._format = "PBF";
    //   } else if (formats.includes("JSON")) {
    //     this._format = "JSON";
    //   }
    // }

    // if (!this._format) {
    //   Logger.logError(loggerCategory, "Could not get request format from service JSON");
    //   throw new ServerError(IModelStatus.ValidationFailed, "");
    // }

    // Read range using full extent from service metadata
    // if (this._layerMetadata?.extent) {
    //   const layerExtent = this._layerMetadata.extent;
    //   if (layerExtent.spatialReference.latestWkid === 3857 || layerExtent.spatialReference.wkid === 102100) {
    //     this.setCartoRangeFromExtentJson(layerExtent);
    //   }
    // }

    if (!this._forceTileMode) {
      const status = await this.fetchAllItems();
      if (status) {
        await this.indexStaticData();
      }
    }

    await this._defaultSymbol.initialize(); // images must be loaded upfront
  }

  private async fetchAllItems() {
    // const url = `http://localhost:8081/collections/public.countries/items?f=geojson&limit=${this._limitParamMaxValue}`;
    const url = `${this._baseUrl}/items?f=geojson&limit=${this._limitParamMaxValue}`;
    this._staticData = await this.fetchItems(url, this._staticModeFetchTimeout);
    return this._staticData ? true : false;
  }

  private async fetchItems(url: string, timeout: number) {
    let data: any;
    let success = true;
    try {
      const fetchBegin = performance.now();
      let response = await this.makeTileRequest(url, timeout);
      let json = await response.json();
      data = json;
      // Follow "next" link if any
      let nextLink = json.links?.find((link: any)=>link.rel === "next");
      while (nextLink && (performance.now() - fetchBegin) < timeout && success) {
        response = await this.makeTileRequest(nextLink.href, this._staticModeFetchTimeout);
        json = await response.json();
        if (json?.features)
          data!.features = [...this._staticData!.features, ...json.features];
        else
          success = false;
        nextLink = json.links?.find((link: any)=>link.rel === "next");
      }
      if (performance.now() - fetchBegin >= this._staticModeFetchTimeout) {
        // We ran out of time, let switch to tile mode
        success = false;
      }
    } catch (e)  {
      success = false;
      if (e instanceof DOMException && e.name === "AbortError") {
        Logger.logInfo(loggerCategory, "Request to fetch all features time out, switching to tile mode.");
      } else {
        Logger.logError(loggerCategory, "Unkown error occured when fetching OgcFeatures data.");
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
            Logger.logInfo(loggerCategory, `Unkown error occured indexing feature: ${e.message}`);
            success = false;
          }
        });

        if (success) {
          this._spatialIdx.finish();
        }
      }

    } catch (_e)  {
      Logger.logError(loggerCategory, "Unkown error occured when index static data");
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

    // Canvas origin is uppler left corner, so we need to flip the y axsis
    const yTranslate = canvasTileExtentOffset.y;     // y-axis flip
    const yWorld2CanvasRatio = -1 * world2CanvasRatioY; // y-axis flip

    const matrix = Matrix4d.createTranslationAndScaleXYZ(xTranslate, yTranslate, 0, world2CanvasRatioX, yWorld2CanvasRatio, 1);
    return matrix.asTransform;
  }

  public override async loadTile(row: number, column: number, zoomLevel: number): Promise<ImageSource | undefined> {
    // const begin = performance.now();

    const extent4326 = this.getEPSG4326Extent(row, column, zoomLevel);

    let data: any;
    if (this.staticMode) {
      // Static data mode
      const filteredData: Geojson.FeatureCollection = {type: this._staticData!.type, features: []};

      this._spatialIdx.search(extent4326.longitudeLeft, extent4326.latitudeBottom, extent4326.longitudeRight, extent4326.latitudeTop,
        (index: number) => {
          filteredData.features.push(this._staticData!.features[index]);
          return true;
        });

      data = filteredData;
    } else {
      // Tiled data mode
      const extent4326Str = this.getEPSG4326ExtentString(row, column, zoomLevel, false);
      // const url = `http://localhost:8081/collections/public.countries/items?f=geojson&bbox=${extent4326Str}&bbox-crs=http://www.opengis.net/def/crs/EPSG/0/4326&items=10000`;
      const url = `${this._baseUrl}/items?f=${this._format}&bbox=${extent4326Str}&bbox-crs=http://www.opengis.net/def/crs/EPSG/0/4326&limite=${this._limitParamMaxValue}`;

      try {
        data = await this.fetchItems(url, this._tileModeFetchTimeout);
      } catch (_e) {
      }
      if (!data) {
        Logger.logError(loggerCategory, "Could not fetch OgcFeatures data.");
      }
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
      // this._defaultSymbol = OgcFeaturesProvider.getDefaultSymbology("esriGeometryPolygon");
      // const transfoRow = transfo!.toRows();
      // ctx.setTransform(transfoRow[0][0], transfoRow[1][0], transfoRow[0][1], transfoRow[1][1], transfoRow[0][3], transfoRow[1][3]);
      const symbRenderer = ArcGisSymbologyCanvasRenderer.create(this._renderer, this._defaultSymbol);
      const renderer = new FeatureCanvasRenderer(ctx, symbRenderer, transfo);

      const featureReader  = new OgcFeaturesReader(this._settings);

      await featureReader.readAndRender(data, renderer);
      if (this._drawDebugInfo)
        this.drawTileDebugInfo(row, column, zoomLevel, ctx);
    } catch (e) {
      Logger.logError(loggerCategory, `Exception occurred while loading tile (${zoomLevel}/${row}/${column}) : ${e}`);
    }

    try {
      const tileRasterformat = "image/png";
      const dataUrl = canvas.toDataURL(tileRasterformat);
      const header = `data:${tileRasterformat};base64,`;
      const dataUrl2 = dataUrl.substring(header.length);
      // const end  = performance.now();
      // console.log(`${data.features.length} feature(s) Overall: ${(end-begin).toFixed(0)}ms`);
      return new ImageSource(base64StringToUint8Array(dataUrl2), ImageSourceFormat.Png);
    } catch (e) {
      Logger.logError(loggerCategory, `Exception occurred while rendering tile (${zoomLevel}/${row}/${column}) : ${e}.`);
    }

    return undefined;
  }

}

