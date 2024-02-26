/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Cartographic, ImageMapLayerSettings, ImageSource, ImageSourceFormat, ServerError } from "@itwin/core-common";
import { base64StringToUint8Array, IModelStatus, Logger } from "@itwin/core-bentley";
import { Matrix4d, Point3d, Range2d, Transform } from "@itwin/core-geometry";
import { ArcGisErrorCode, ArcGisGraphicsRenderer, ArcGISImageryProvider, ArcGISServiceMetadata, ArcGisUtilities, HitDetail, ImageryMapTileTree, MapCartoRectangle, MapFeatureInfoOptions, MapLayerFeatureInfo, MapLayerImageryProviderStatus, QuadId, setRequestTimeout } from "@itwin/core-frontend";
import { ArcGisSymbologyRenderer } from "./ArcGisSymbologyRenderer";
import { ArcGisExtent, ArcGisFeatureFormat, ArcGisFeatureGeometryType, ArcGisFeatureQuery, ArcGisFeatureResultType, ArcGisGeometry, FeatureQueryQuantizationParams } from "./ArcGisFeatureQuery";
import { ArcGisPbfFeatureReader } from "./ArcGisPbfFeatureReader";
import { ArcGisJsonFeatureReader } from "./ArcGisJsonFeatureReader";
import { ArcGisFeatureResponse, ArcGisResponseData } from "./ArcGisFeatureResponse";
import { ArcGisFeatureReader } from "./ArcGisFeatureReader";

import { ArcGisCanvasRenderer } from "./ArcGisCanvasRenderer";
import { EsriPMS, EsriPMSProps, EsriRenderer, EsriSFS, EsriSFSProps, EsriSLS, EsriSLSProps, EsriSymbol } from "./EsriSymbology";
const loggerCategory = "MapLayersFormats.ArcGISFeature";

/**
* @internal
*/
interface ArcGisFeatureUrl {
  url: string;
  envelope?: ArcGisExtent;    // envelope representing the current computed URL, required to refine request.
}

/**  Provide tiles from a ESRI ArcGIS Feature service
* @internal
*/
export class ArcGisFeatureProvider extends ArcGISImageryProvider {
  // Debug flags, should always be committed to FALSE !
  private _drawDebugInfo = false;
  private _debugFeatureGeom = false;

  private _supportsCoordinatesQuantization = false;

  private _layerId = 0;
  private _layerMetadata: any;
  private _format: ArcGisFeatureFormat | undefined;
  private _outSR = 102100;

  private _maxDepthFromLod = 0;
  private _minDepthFromLod = 0;

  private _defaultSymbol: EsriSymbol|undefined;
  private _renderer: EsriRenderer|undefined;

  private static readonly _nbSubTiles = 2;     // Number of subtiles for a single axis
  public serviceJson: any;

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

  public override get minimumZoomLevel(): number { return this._minDepthFromLod; }
  public override get maximumZoomLevel(): number { return this._maxDepthFromLod; }

  private static _extentCache = new Map<string, any>();

  constructor(settings: ImageMapLayerSettings) {
    super(settings, true);
  }

  public override async initialize(): Promise<void> {
    const metadata = await this.getServiceJson();
    const json = metadata?.content;

    if (json === undefined) {
      Logger.logError(loggerCategory, "Could not get service JSON");
      throw new ServerError(IModelStatus.ValidationFailed, "");
    }

    if (json?.error?.code === ArcGisErrorCode.TokenRequired || json?.error?.code === ArcGisErrorCode.InvalidToken) {
      // Check again layer status, it might have change during await.
      if (this.status === MapLayerImageryProviderStatus.Valid) {
        this.setStatus(MapLayerImageryProviderStatus.RequireAuth);
        return;
      }
    }

    if (json.capabilities) {
      this._querySupported = json.capabilities.indexOf("Query") >= 0;
      if (!this._querySupported)
        throw new ServerError(IModelStatus.ValidationFailed, "");
    }

    this.serviceJson = json;

    let foundVisibleSubLayer = false;
    if (this._settings.subLayers.length >= 0) {
      // There is more than sub-layer for this layer, pick the first visible one.
      for (const layer of this._settings.subLayers) {
        if (layer.visible && typeof layer.id === "number") {
          this._layerId = layer.id;
          foundVisibleSubLayer = true;
          break;
        }
      }
    }

    if (!foundVisibleSubLayer && json !== undefined) {
      // No suitable sublayer was specified on the layerSettings object, lets find a default one in the capabilities

      // Check layer metadata
      if (Array.isArray(this.serviceJson.layers) && this.serviceJson.layers.length >= 1) {

        const hasDefaultVisibility = Object.keys(this.serviceJson.layers[0]).includes("defaultVisibility");
        if (hasDefaultVisibility) {
          for (const layer of this.serviceJson.layers) {
            if (layer.defaultVisibility) {
              this._layerId = layer.id;
              break;
            }
          }
        } else {
          // On some older servers, the default visiblity is on the layer capabilities (i.e. not the service capabilities)
          for (const layer of this.serviceJson.layers) {
            const layerJson = await this.getLayerMetadata(layer.id);
            if (!layerJson) {
              continue;
            }

            if (layerJson.defaultVisibility) {
              this._layerId = layer.id;
              this._layerMetadata = layerJson;
              break;
            }
          }
        }

      } else {
        // There is no layer to publish? Something is off with this server..
        throw new ServerError(IModelStatus.ValidationFailed, "");
      }
    }

    // Make sure we cache layer info (i.e. rendering info)
    if (!this._layerMetadata) {

      this._layerMetadata = await this.getLayerMetadata(this._layerId);
      if (!this._layerMetadata) {
        Logger.logError(loggerCategory, "Could not layer metadata");
        throw new ServerError(IModelStatus.ValidationFailed, "");
      }
    }

    // Parse server version
    let majorVersion: number | undefined;
    if (this.serviceJson?.currentVersion) {
      try {
        majorVersion = Math.trunc(this.serviceJson?.currentVersion);
      } catch {
      }
    }

    // Coordinates Quantization:  If supported, server will transform for us the coordinates in the Tile coordinate space (pixels, origin = upper left corner
    // If not supported, transformation will be applied client side.
    // Note: For some reasons, even though 'supportsCoordinatesQuantization' is set to 'true' on the layer metadata, server will give an error message for server version < 11
    if (majorVersion && majorVersion >= 11 && this._layerMetadata.supportsCoordinatesQuantization) {
      this._supportsCoordinatesQuantization = true;
    }

    // Check supported query formats: JSON and PBF are currently implemented by this provider
    // Note: needs to be checked on the layer metadata, service metadata advertises a different set of formats
    //       Also, since PBF format does not support floating points, there is no point using this format if supportsCoordinatesQuantization is not available.
    if (this._layerMetadata.supportedQueryFormats) {
      const formats: string[] = this._layerMetadata.supportedQueryFormats.split(", ");
      if (formats.includes("PBF") && this._supportsCoordinatesQuantization) {
        this._format = "PBF";
      } else if (formats.includes("JSON")) {
        this._format = "JSON";
      }
    }

    if (!this._format) {
      Logger.logError(loggerCategory, "Could not get request format from service JSON");
      throw new ServerError(IModelStatus.ValidationFailed, "");
    }

    // Read range using full extent from service metadata
    if (this._layerMetadata?.extent) {
      const layerExtent = this._layerMetadata.extent;
      if (layerExtent.spatialReference.latestWkid === 3857 || layerExtent.spatialReference.wkid === 102100) {
        this.setCartoRangeFromExtentJson(layerExtent);
      }
    }

    if (!this.cartoRange) {
      // Range could not be found (or is not in a coordinate system we support), make a request to compute the extent
      try {
        const extentJson = await this.fetchLayerExtent();

        if (extentJson)
          this.setCartoRangeFromExtentJson(extentJson);
        else
          Logger.logWarning(loggerCategory, `Could not get features extent, disabling extent filtering`);
      } catch {
        Logger.logError(loggerCategory, `Could not get feature extent`);
      }
    }

    // Check for minScale / max scale
    const minScale = this._layerMetadata?.minScale || undefined;  // undefined, 0 -> undefined
    const maxScale = this._layerMetadata?.maxScale || undefined;  // undefined, 0 -> undefined
    const scales = ArcGisUtilities.getZoomLevelsScales(this.defaultMaximumZoomLevel, this.tileSize, minScale, maxScale, 1.0);
    if (scales.minLod)
      this._minDepthFromLod = scales.minLod;

    // Some servers advertises a max LOD of 0, it should be interpreted as 'not defined' (otherwise a max lod of 0 would would mean never display anything)
    this._maxDepthFromLod = (scales.maxLod ? scales.maxLod : this.defaultMaximumZoomLevel);

    this._defaultSymbol = ArcGisFeatureProvider.getDefaultSymbology(this._layerMetadata?.geometryType);
    if (!this._defaultSymbol) {
      Logger.logError(loggerCategory, "Could not determine default symbology: geometry type not supported");
      throw new Error("Could not determine default symbology: geometry type not supported");
    }
    if (this._defaultSymbol.type === "esriPMS") {
      await (this._defaultSymbol as EsriPMS).loadImage();
    }

    try {
      this._renderer = EsriRenderer.fromJSON(this._layerMetadata?.drawingInfo?.renderer);
      await this._renderer.initialize();
    } catch (e) {
      Logger.logError(loggerCategory, `Could not initialize symbology renderer for '${this._settings.name}': ${e}`);
    }

  }

  public static getDefaultSymbology(geomType: ArcGisFeatureGeometryType) {
    if (geomType) {
      if (geomType === "esriGeometryPoint" || geomType === "esriGeometryMultipoint") {
        return EsriPMS.fromJSON(ArcGisFeatureProvider.defaultPMS);
      } else if (geomType === "esriGeometryLine" || geomType === "esriGeometryPolyline") {
        return EsriSLS.fromJSON(ArcGisFeatureProvider.defaultSLS);
      } else if (geomType === "esriGeometryPolygon") {
        return EsriSFS.fromJSON(ArcGisFeatureProvider.defaultSFS);
      }
    }
    return undefined;
  }

  private async fetchLayerExtent() {
    let extentJson: any;
    const tmpUrl = new URL(this._settings.url);
    tmpUrl.pathname = `${tmpUrl.pathname}/${this._layerId}/query`;
    tmpUrl.searchParams.append("where", "1=1");
    tmpUrl.searchParams.append("outSR", "3857");
    tmpUrl.searchParams.append("returnExtentOnly", "true");
    tmpUrl.searchParams.append("f", "json");
    const cached = ArcGisFeatureProvider._extentCache.get(tmpUrl.toString());
    if (cached) {
      extentJson = cached;
    } else {
      // Some server are struggling computing the extent for a layer (outdated spatial index I presume), lets wait 10s max.
      // Worst case scenario we will end up with a map-layer with no 'Zoom-To-Layer' functionality.
      const opts: RequestInit = { method: "GET" };
      setRequestTimeout(opts, 10000);
      const response = await this.fetch(tmpUrl, opts);

      extentJson = await response.json();
      ArcGisFeatureProvider._extentCache.set(tmpUrl.toString(), extentJson);
    }
    return (extentJson ? extentJson.extent : undefined);
  }

  private setCartoRangeFromExtentJson(extent: any) {
    const range3857 = Range2d.createFrom({
      low: { x: extent.xmin, y: extent.ymin },
      high: { x: extent.xmax, y: extent.ymax },
    });

    const west = this.getEPSG4326Lon(range3857.xLow);
    const south = this.getEPSG4326Lat(range3857.yLow);
    const east = this.getEPSG4326Lon(range3857.xHigh);
    const north = this.getEPSG4326Lat(range3857.yHigh);
    this.cartoRange = MapCartoRectangle.fromDegrees(west, south, east, north);
  }

  protected async getLayerMetadata(layerId: number) {
    let metadata: ArcGISServiceMetadata | undefined;
    try {
      const url = new URL(this._settings.url);
      url.pathname = `${url.pathname}/${layerId}`;
      metadata = await ArcGisUtilities.getServiceJson({
        url: url.toString(), formatId: this._settings.formatId,
        userName: this._settings.userName, password: this._settings.password,
        queryParams: this._settings.collectQueryParams(), requireToken: this._accessTokenRequired});
    } catch {

    }
    return metadata?.content;
  }

  public override get tileSize(): number { return 512; }
  public get format(): ArcGisFeatureFormat | undefined { return this._format; }

  // We don't use this method inside this provider (see constructFeatureUrl), but since this is an abstract method, we need to define something
  public async constructUrl(_row: number, _column: number, _zoomLevel: number): Promise<string> {
    return "";
  }

  public constructFeatureUrl(row: number, column: number, zoomLevel: number, format: ArcGisFeatureFormat, resultType: ArcGisFeatureResultType, geomOverride?: ArcGisGeometry, outFields?: string, tolerance?: number, returnGeometry?: boolean, maxAllowableOffset?: number): ArcGisFeatureUrl | undefined {

    const tileExtent = this.getEPSG3857Extent(row, column, zoomLevel);
    const tileEnvelope = {
      xmin: tileExtent.left, ymin: tileExtent.bottom,
      xmax: tileExtent.right, ymax: tileExtent.top,
      spatialReference: { wkid: 102100, latestWkid: 3857 },
    };

    // Actual spatial filter.
    // By default, we request the tile extent.  If 'cartoPoint' is specified,
    // we restrict the spatial to specific point. (i.e. GetFeatureInfo requests)
    // If envelope is provided, it has the priority over 'cartoPoint'
    let geometry: ArcGisGeometry | undefined;
    if (geomOverride) {
      geometry = geomOverride;
    } else {
      geometry = { geom: tileEnvelope, type: "esriGeometryEnvelope" };
    }

    let quantizationParameters: FeatureQueryQuantizationParams | undefined;
    const toleranceWorld = (tileExtent.top - tileExtent.bottom) / this.tileSize;
    if (resultType === "tile" && this._supportsCoordinatesQuantization) {
      quantizationParameters = {
        mode: "view",
        originPosition: "upperLeft",
        tolerance: toleranceWorld, // pixel size in world units
        extent: tileEnvelope,
      };
    }
    const url = new ArcGisFeatureQuery(
      this._settings.url,
      this._layerId,
      format,
      this._outSR,
      {
        geometry,
        geometryType: "esriGeometryEnvelope",
        returnExceededLimitFeatures: false,
        maxRecordCountFactor: 3,    // This was grabbed from the ESRI web viewer request, not sure where this factor come from
        resultType,
        quantizationParameters,
        outFields,
        returnGeometry,
        distance: (tolerance ? tolerance * toleranceWorld : undefined),
        maxAllowableOffset,
      });

    let envelope: ArcGisExtent | undefined;
    if (geomOverride && geomOverride.type === "esriGeometryEnvelope") {
      envelope = geomOverride.geom as ArcGisExtent;
    } else {
      envelope = tileEnvelope;
    }

    return { url: url.toString(), envelope };

  }

  // Makes an identify request to ESRI MapService , and return it as a list MapLayerFeatureInfo object
  public override async getFeatureInfo(featureInfos: MapLayerFeatureInfo[], quadId: QuadId, carto: Cartographic, _tree: ImageryMapTileTree, hit: HitDetail, options?: MapFeatureInfoOptions): Promise<void> {
    if (!this._querySupported || this.format === undefined)
      return;

    const epsg3857X = this.getEPSG3857X(carto.longitudeDegrees);
    const epsg3857Y = this.getEPSG3857Y(carto.latitudeDegrees);

    const tileExtent = this.getEPSG3857Extent(quadId.row, quadId.column, quadId.level);
    const tilePixelSize = (tileExtent.top - tileExtent.bottom) / this.tileSize;
    const tolerancePixel = options?.tolerance ?? 7;
    const toleranceWorld = tilePixelSize * tolerancePixel;

    // Note: We used to pass a single point as the query 'geometry' and leverage the 'distance' parameter, turns
    // out that approach was a lot slower on some server compared to using a single envelope.
    const queryEnvelope: ArcGisGeometry = {
      type: "esriGeometryEnvelope",
      geom: {
        xmin: epsg3857X - toleranceWorld, ymin: epsg3857Y - toleranceWorld,
        xmax: epsg3857X + toleranceWorld, ymax: epsg3857Y + toleranceWorld,
        spatialReference: { wkid: 102100, latestWkid: 3857 },
      }};

    const doFeatureInfoQuery = async (format: ArcGisFeatureFormat, outFields?: string, returnGeometry?: boolean) => {
      const infoUrl = this.constructFeatureUrl(quadId.row, quadId.column, quadId.level, format, "standard", queryEnvelope,
        outFields, undefined, returnGeometry, tilePixelSize);

      if (!infoUrl || infoUrl.url.length === 0) {
        Logger.logError(loggerCategory, `Could not construct feature info query URL`);
        return undefined;
      }

      const response = this.fetch(new URL(infoUrl.url), { method: "GET" });

      const featureResponse = new ArcGisFeatureResponse(format, response);
      return featureResponse.getResponseData();
    };

    if (this._debugFeatureGeom) {
      try {
        let responseData = await doFeatureInfoQuery("PBF", "", true);
        if (responseData) {
          const json = JSON.stringify(responseData.data.toObject());
          Logger.logInfo(loggerCategory, json);
        }
        responseData = await doFeatureInfoQuery("JSON", "", true);
        if (responseData) {
          const json = JSON.stringify(responseData.data);
          Logger.logInfo(loggerCategory, json);
        }
      } catch (e) {
        Logger.logInfo(loggerCategory, `Error occurred with debug FeatureInfo: ${e}`);
      }
    }

    try {
      // Feature Info requests are always made in JSON for now.
      const responseData = await doFeatureInfoQuery("JSON", "*", true);
      if (!responseData) {
        Logger.logError(loggerCategory, `Could not get feature info data`);
        return;
      }
      if (responseData.exceedTransferLimit) {
        Logger.logError(loggerCategory, `Could not get feature info : transfer limit exceeded.`);
        return;
      }

      const featureReader = new ArcGisJsonFeatureReader(this._settings, this._layerMetadata);

      const renderer = new ArcGisGraphicsRenderer({viewport: hit.viewport});
      await featureReader.readFeatureInfo(responseData, featureInfos, renderer);

    } catch (e) {
      Logger.logError(loggerCategory, `Exception occurred while loading feature info data : ${e}`);
      return;
    }

    return;
  }

  private async fetchTile(row: number, column: number, zoomLevel: number, refineEnvelope?: ArcGisExtent): Promise<ArcGisFeatureResponse | undefined> {
    if (!this.format) {
      return undefined;
    }

    const geomOverride: ArcGisGeometry | undefined = (refineEnvelope ? { geom: refineEnvelope, type: "esriGeometryEnvelope" } : undefined);
    const fields = this._renderer?.fields;
    const outFields = fields ? fields.join(",") : undefined;
    const tileUrl = this.constructFeatureUrl(row, column, zoomLevel, this.format, "tile", geomOverride, outFields);
    if (!tileUrl || tileUrl.url.length === 0) {
      Logger.logError(loggerCategory, `Could not construct feature query URL for tile ${zoomLevel}/${row}/${column}`);
      return undefined;
    }

    const response = this.fetch(new URL(tileUrl.url), { method: "GET" });
    return new ArcGisFeatureResponse(this.format, response, tileUrl.envelope);
  }

  public drawTileDebugInfo(row: number, column: number, zoomLevel: number, context: CanvasRenderingContext2D) {
    context.fillStyle = "cyan";
    context.strokeRect(0, 0, this.tileSize, this.tileSize);
    context.font = "30px Arial";
    context.lineWidth = 5;
    context.fillText(`${zoomLevel}-${row}-${column}`, 10, 50);
  }

  // Compute transform that provides coordinates in the canvas coordinate system (pixels, origin = top-left)
  // from coordinate in world (i.e EPSG:3857)
  protected computeTileWorld2CanvasTransform(row: number, column: number, zoomLevel: number) {

    const tileExtentWorld3857 = this.getEPSG3857Extent(row, column, zoomLevel);
    const worldTileWidth = tileExtentWorld3857.right - tileExtentWorld3857.left;
    const canvasTileWidth = this.tileSize;
    const world2CanvasRatio = canvasTileWidth / worldTileWidth;
    const worldTileOrigin = Point3d.create(tileExtentWorld3857.left, tileExtentWorld3857.bottom);
    const worldTileExtent = Point3d.create(tileExtentWorld3857.right, tileExtentWorld3857.top);
    const canvasTileOriginOffset = worldTileOrigin.clone();
    const canvasTileExtentOffset = worldTileExtent.clone();
    canvasTileOriginOffset.scaleInPlace(world2CanvasRatio);
    canvasTileExtentOffset.scaleInPlace(world2CanvasRatio);
    const xTranslate = -1 * canvasTileOriginOffset.x;

    // Canvas origin is uppler left corner, so we need to flip the y axsis
    const yTranslate = canvasTileExtentOffset.y;     // y-axis flip
    const yWorld2CanvasRatio = -1 * world2CanvasRatio; // y-axis flip

    const matrix = Matrix4d.createTranslationAndScaleXYZ(xTranslate, yTranslate, 0, world2CanvasRatio, yWorld2CanvasRatio, 1);
    return matrix.asTransform;
  }

  public override async loadTile(row: number, column: number, zoomLevel: number): Promise<ImageSource | undefined> {

    if ((this.status === MapLayerImageryProviderStatus.RequireAuth)) {
      return undefined;
    }
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
      let transfo: Transform | undefined;
      if (!this._supportsCoordinatesQuantization) {
        transfo = this.computeTileWorld2CanvasTransform(row, column, zoomLevel);
        if (!transfo) {
          Logger.logError(loggerCategory, `Could not compute data transformation for tile (${zoomLevel}/${row}/${column})`);
        }
      }

      // Create the renderer
      const symbRenderer = ArcGisSymbologyRenderer.create(this._renderer, this._defaultSymbol!);
      const renderer = new ArcGisCanvasRenderer(ctx, symbRenderer, transfo);
      const featureReader: ArcGisFeatureReader = this.format === "PBF" ? new ArcGisPbfFeatureReader(this._settings, this._layerMetadata) : new ArcGisJsonFeatureReader(this._settings, this._layerMetadata);

      const getSubEnvelopes = (envelope: ArcGisExtent): ArcGisExtent[] => {
        const dx = (envelope.xmax - envelope.xmin) * 0.5;
        const dy = (envelope.xmax - envelope.xmin) * 0.5;
        const subEnvelopes: ArcGisExtent[] = [];
        for (let posX = 0; posX < ArcGisFeatureProvider._nbSubTiles; posX++) {
          for (let posY = 0; posY < ArcGisFeatureProvider._nbSubTiles; posY++) {
            subEnvelopes.push({
              xmin: envelope.xmin + (dx * posX), ymin: envelope.ymin + (dy * posY),
              xmax: envelope.xmin + (dx * (posX + 1)), ymax: envelope.ymin + (dy * (posY + 1)),
              spatialReference: { wkid: 102100, latestWkid: 3857 },
            });
          }
        }
        return subEnvelopes;
      };

      // The strategy here is simple: we make a request for an area that represents the current tile (i.e envelope),
      // the server will either return the requested data OR a 'exceedTransferLimit' message (too much data to transfers).
      // In the latter case, we subdivide the previous request envelope in for 4 sub-envelopes,
      // and repeat again until we get data.
      const renderData = async (envelope?: ArcGisExtent) => {
        let response: ArcGisFeatureResponse | undefined;
        let responseData: ArcGisResponseData | undefined;
        try {
          response = await this.fetchTile(row, column, zoomLevel, envelope);

          if (!response) {
            Logger.logError(loggerCategory, `Error occurred while fetching tile (${zoomLevel}/${row}/${column})`);
            return;
          }

          responseData = await response.getResponseData();
          if (!responseData) {
            Logger.logError(loggerCategory, `Could not get response data for tile (${zoomLevel}/${row}/${column})`);
            return;
          }
        } catch (e) {
          Logger.logError(loggerCategory, `Exception occurred while loading tile (${zoomLevel}/${row}/${column}) : ${e}`);
          return;
        }

        if (responseData.exceedTransferLimit) {
          if (response.envelope) {
            const subEnvelopes = getSubEnvelopes(response.envelope);
            const renderPromises = [];
            for (const subEnvelope of subEnvelopes) {
              renderPromises.push(renderData(subEnvelope));
            }
            await Promise.all(renderPromises);
          } else {
            Logger.logError(loggerCategory, `Request exceeded transfer limit, could not refine request`);
          }
        } else {
          await featureReader.readAndRender(responseData, renderer);
        }
      };
      await renderData();
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

