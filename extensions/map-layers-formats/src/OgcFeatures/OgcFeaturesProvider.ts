/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { MapCartoRectangle, MapLayerImageryProvider } from "@itwin/core-frontend";
import { EsriPMS, EsriPMSProps, EsriRenderer, EsriSFS, EsriSFSProps, EsriSLS, EsriSLSProps, EsriSymbol } from "../ArcGisFeature/EsriSymbology";
import { ImageMapLayerSettings, ImageSource, ImageSourceFormat } from "@itwin/core-common";
import { Matrix4d, Point3d } from "@itwin/core-geometry";
import { ArcGisSymbologyRenderer } from "../ArcGisFeature/ArcGisSymbologyRenderer";
import { ArcGisCanvasRenderer } from "../ArcGisFeature/ArcGisCanvasRenderer";
import { ArcGisJsonFeatureReader } from "../ArcGisFeature/ArcGisJsonFeatureReader";
import { ArcGisFeatureReader } from "../ArcGisFeature/ArcGisFeatureReader";
import { base64StringToUint8Array, Logger } from "@itwin/core-bentley";
import { OgcFeaturesReader } from "../ArcGisFeature/OgcFeaturesReader";
import { samplePolygon } from "./GeoJsonSampleGeometries";
import { ArcGisFeatureGeometryType } from "../ArcGisFeature/ArcGisFeatureQuery";

const loggerCategory = "MapLayersFormats.OgcFeatures";

/**  Provide tiles from a ESRI ArcGIS Feature service
* @internal
*/
export class OgcFeaturesProvider extends MapLayerImageryProvider {

  // Debug flags, should always be committed to FALSE !
  private _drawDebugInfo = true;
  /// ////////////////////////////

  private _defaultSymbol: EsriSymbol|undefined;
  private _renderer: EsriRenderer|undefined;

  private static readonly _nbSubTiles = 2;     // Number of subtiles for a single axis
  public serviceJson: any;
  private _data: any;

  private static readonly defaultPMS: EsriPMSProps = {
    type: "esriPMS",
    url: "",
    contentType: "image/png",
    imageData: "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAAXNSR0IArs4c6QAAAmBJREFUOE+Nk01IVFEUx//n3jfvOZOaJkMtiiJ7o9RG3LgoqKhFSFJBTS1ahFBBi0ijfJXCIyQr+hBbSIsoW7iQoKKFCw2CkAI3tZAgy8Ei+xhoTCbnje/NPfHGnA816KzuPR+/c8/HJRQJE7o+VUhym0DcCOYGgBQEXjOLlyqo+nHanCkMoaL4rslKjZwOQLT4ek3Mmz3FACFNLB67ut6M1nWphbg8wI6VyJK5KEH0EQFVJRKbwzokAW++p/ErraAYSQK3u47bC3vLnA+ZB9i2gHF0oyQMCfCGNaUa+vauxs71wWz2V18cnBj8gQ8J1/eeBnHUa4sMFQDGdGno+4gwEAoQzjVUon3rqlx1KY9x7+0MWobjAPg3QJ2eZV4tAEyFNCN5FkSXyw2B3j1hRGvLcgBXMV5MptA4MOXr0gT0u5bZnAf0jBsyiSgJPAxqhON1K3FlRxUMvwFAtv7u0Wl0jvwEmJNEuOhakTt5wKEBifr6Oo14BIBRpgt07w6jcVMIngKGY7NofR5HwlF+zDcpsC193vyYB/innvHywCzdZfAR/+onX1segBTAxHzzfPE7/8yzzIPLjJE1LTixHZx5CtCK4gXLzovBiDPUsYxVM7gUkB3nWKlm6DYEnQGzXARxCOK+a1WfKtQXb6LNAvr7iCboCUA1Ocdsdv5KLPe7F6pH/w3wLbc+BwOuc5IZ1wEE/jonQbjptZn24tKKX7BgvR2r0NKZRwDvAqCI+Z30VJPTURv7P4A9psuQcYAUPwAoReBLrmX2Lmls7i8sZ7kWLwuoxA1FVJGxzMPLufi6P2r+2xFbOUjGAAAAAElFTkSuQmCC",
    width: 16,
    height: 16,
    xoffset: -8,
    yoffset: -16,
  };

  private static readonly defaultSLS: EsriSLSProps = {
    type: "esriSLS",
    color: [0, 0, 0, 255],
    width: 1,
    style: "esriSLSSolid",
  };

  private static readonly defaultSFS: EsriSFSProps = {
    type: "esriSFS",
    color:  [0, 0, 255, 255],   // blue fill
    style: "esriSFSSolid",
    outline: this.defaultSLS,
  };

  constructor(settings: ImageMapLayerSettings) {
    super(settings, true);
  }

  public override async initialize(): Promise<void> {

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

    const url = "http://localhost:8081/collections/public.countries/items?limit=1000&f=geojson";
    try {
      const response = await this.makeTileRequest(url);
      this._data = await response.json();
    } catch  {
      Logger.logError(loggerCategory, "Could not fetch OgcFeatures data.");
    }
  }

  public static getDefaultSymbology(geomType: ArcGisFeatureGeometryType) {
    if (geomType) {
      if (geomType === "esriGeometryPoint" || geomType === "esriGeometryMultipoint") {
        return EsriPMS.fromJSON(OgcFeaturesProvider.defaultPMS);
      } else if (geomType === "esriGeometryLine" || geomType === "esriGeometryPolyline") {
        return EsriSLS.fromJSON(OgcFeaturesProvider.defaultSLS);
      } else if (geomType === "esriGeometryPolygon") {
        return EsriSFS.fromJSON(OgcFeaturesProvider.defaultSFS);
      }
    }
    return undefined;
  }

  public override get tileSize(): number { return 512; }
  // public override get tileSize(): number { return 100; }

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

    const canvas = document.createElement("canvas");
    canvas.width = this.tileSize;
    canvas.height = this.tileSize;

    const extent4326Str = this.getEPSG4326ExtentString(row, column, zoomLevel, false);
    const extent4326 = this.getEPSG4326Extent(row, column, zoomLevel);
    const cartoRange = MapCartoRectangle.fromDegrees(extent4326.longitudeLeft, extent4326.latitudeTop, extent4326.longitudeRight, extent4326.latitudeTop);
    const url = `http://localhost:8081/collections/public.countries/items?f=geojson&bbox=${extent4326Str}&bbox-crs=http://www.opengis.net/def/crs/EPSG/0/4326&limit=1000`;

    let data: any;
    try {
      const response = await this.makeTileRequest(url);
      data = await response.json();
    } catch  {
      Logger.logError(loggerCategory, "Could not fetch OgcFeatures data.");
    }

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
      this._defaultSymbol = OgcFeaturesProvider.getDefaultSymbology("esriGeometryPolygon");
      const symbRenderer = ArcGisSymbologyRenderer.create(this._renderer, this._defaultSymbol!);
      const renderer = new ArcGisCanvasRenderer(ctx, symbRenderer, transfo);
      const featureReader  = new OgcFeaturesReader(this._settings);

      // await featureReader.readAndRender(samplePolygon, renderer);
      await featureReader.readAndRender(data, renderer);
      const cartoCenter = cartoRange.cartoCenter;
      const transformedPoint = transfo!.multiplyPoint2d({ x: cartoCenter.longitudeDegrees, y: cartoCenter.latitudeDegrees });
      console.log(transformedPoint);

      if (this._drawDebugInfo)
        this.drawTileDebugInfo(row, column, zoomLevel, ctx);
    } catch (e) {
      Logger.logError(loggerCategory, `Exception occurred while loading tile (${zoomLevel}/${row}/${column}) : ${e}`);
    }

    try {
      const dataUrl = canvas.toDataURL("image/png");
      const header = "data:image/png;base64,";
      const dataUrl2 = dataUrl.substring(header.length);
      return new ImageSource(base64StringToUint8Array(dataUrl2), ImageSourceFormat.Png);
    } catch (e) {
      Logger.logError(loggerCategory, `Exception occurred while rendering tile (${zoomLevel}/${row}/${column}) : ${e}.`);
    }

    return undefined;
  }

}

