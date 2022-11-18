/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Cartographic, ImageMapLayerSettings, ImageSource, ImageSourceFormat, ServerError } from "@itwin/core-common";
import { assert, base64StringToUint8Array, IModelStatus, Logger } from "@itwin/core-bentley";
import { Matrix4d, Point3d, Range2d, Transform } from "@itwin/core-geometry";
import { ArcGisErrorCode, ArcGISImageryProvider, ArcGisUtilities, ImageryMapTileTree, MapCartoRectangle, MapLayerFeatureInfo, MapLayerImageryProviderStatus, QuadId } from "@itwin/core-frontend";
import { ArcGisSymbologyRenderer } from "./ArcGisSymbologyRenderer";
import { ArcGisExtent, ArcGisFeatureFormat, ArcGisFeatureQuery, ArcGisGeometry, FeatureQueryQuantizationParams } from "./ArcGisFeatureQuery";
import { ArcGisFeatureRenderer } from "./ArcGisFeatureRenderer";
import { ArcGisFeaturePBF } from "./ArcGisFeaturePBF";
import { ArcGisFeatureJSON } from "./ArcGisFeatureJSON";
import { ArcGisFeatureResponse, ArcGisResponseData } from "./ArcGisFeatureResponse";
import { ArcGisFeatureReader } from "./ArcGisFeatureReader";
const loggerCategory =  "MapLayersFormats.ArcGISFeature";
/**
* @internal
*/
interface ArcGisFeatureUrl {
  url: string;
  envelope?: ArcGisExtent;    // envelope representing the current computed URL, requiered to refine request.
}

/**  Provide tiles from a ESRI ArcGIS Feature service
* @internal
*/
export class ArcGisFeatureProvider extends ArcGISImageryProvider {
  // Debug flags, should always be commited to FALSE !
  private _drawDebugInfo = false;
  private _debugFeatureGeom = false;

  private _supportsCoordinatesQuantization = false;
  private _querySupported = false;
  private _layerId = 0;
  private _layerMetadata: any;
  private _format: ArcGisFeatureFormat|undefined;
  public serviceJson: any;
  private _symbologyRenderer: ArcGisSymbologyRenderer|undefined;
  private static readonly _nbSubTiles = 2;
  private _outSR = 102100;

  private _maxDepthFromLod = 0;
  private _minDepthFromLod = 0;
  public override get minimumZoomLevel(): number { return this._minDepthFromLod; }
  public override get maximumZoomLevel(): number { return this._maxDepthFromLod; }

  constructor(settings: ImageMapLayerSettings) {
    super(settings, true);
  }

  public override async initialize(): Promise<void> {

    let json;
    try {
      json = await ArcGisUtilities.getServiceJson(this._settings.url, this._settings.formatId, this._settings.userName, this._settings.password);

    } catch (_e) {

    }

    if (json === undefined) {
      Logger.logError(loggerCategory, "Could not get service JSON");
      throw new ServerError(IModelStatus.ValidationFailed, "");
    }

    if (json?.error?.code === ArcGisErrorCode.TokenRequired || json?.error?.code === ArcGisErrorCode.InvalidToken) {
      // Check again layer status, it might have change during await.
      if (this.status === MapLayerImageryProviderStatus.Valid) {
        this.status = MapLayerImageryProviderStatus.RequireAuth;
        this.onStatusChanged.raiseEvent(this);
        return;
      }
    }

    if (json.capabilities) {
      this._querySupported = json.capabilities.indexOf("Query") >= 0;
      if (!this._querySupported)
        throw new ServerError(IModelStatus.ValidationFailed, "");
    }

    this.serviceJson = json;

    let  foundVisibleSubLayer = false;
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
    let majorVersion: number|undefined;
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
      if (formats.includes("PBF") && this._supportsCoordinatesQuantization ) {
        this._format = "PBF";
      } else if (formats.includes ("JSON"))  {
        this._format = "JSON";
      }
    }

    if (!this._format) {
      Logger.logError(loggerCategory, "Could not get service JSON");
      throw new ServerError(IModelStatus.ValidationFailed, "");
    }

    // Read range using full extent from service metadata
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

    // Check for minScale / max scale
    const minScale = this._layerMetadata?.minScale || undefined;  // undefined, 0 -> undefined
    const maxScale = this._layerMetadata?.maxScale || undefined;  // undefined, 0 -> undefined
    const scales = ArcGisUtilities.getZoomLevelsScales(this.defaultMaximumZoomLevel, this.tileSize, minScale, maxScale);
    if (scales.minLod)
      this._minDepthFromLod = scales.minLod;

    // Some servers advertises a max LOD of 0, it should be interpreted as 'not defined' (otherwise a max lod of 0 would would mean never display anything)
    this._maxDepthFromLod =  (scales.maxLod ? scales.maxLod : this.defaultMaximumZoomLevel);

    this._symbologyRenderer = new ArcGisSymbologyRenderer(this._layerMetadata?.geometryType, this._layerMetadata?.drawingInfo?.renderer);
  }

  protected async getLayerMetadata(layerId: number) {
    let json;
    try {
      const url = new URL(this._settings.url);
      url.pathname = `${url.pathname}/${layerId}`;
      json = await ArcGisUtilities.getServiceJson(url.toString(), this._settings.formatId, this._settings.userName, this._settings.password);
    } catch {

    }
    return json;
  }

  public override get tileSize(): number { return 512; }
  public get format(): ArcGisFeatureFormat|undefined { return this._format; }

  // We don't use this method inside this provider (see constructFeatureUrl), but since this is an abstract method, we need to define something
  public async constructUrl(_row: number, _column: number, _zoomLevel: number): Promise<string> {
    return "";
  }

  public constructFeatureUrl(row: number, column: number, zoomLevel: number, format: ArcGisFeatureFormat, geomOverride?: ArcGisGeometry, outFields?: string, tolerance?: number, returnGeometry?: boolean): ArcGisFeatureUrl | undefined {

    const tileExtent = this.getEPSG3857Extent(row, column, zoomLevel);
    const tileEnvelope = {
      xmin: tileExtent.left, ymin: tileExtent.bottom,
      xmax: tileExtent.right, ymax: tileExtent.top,
      spatialReference: {wkid:102100, latestWkid:3857},
    };

    // Actual spatial filter.
    // By default, we request the tile extent.  If 'cartoPoint' is specified,
    // we restrict the spatial to specific point. (i.e. GetFeatureInfo requests)
    // If envelope is provided, it has the priority over 'cartoPoint'
    let geometry: ArcGisGeometry|undefined;
    if (geomOverride) {
      geometry = geomOverride;
    } else {
      geometry = {geom: tileEnvelope, type: "esriGeometryEnvelope"};
    }

    let quantizationParameters: FeatureQueryQuantizationParams|undefined;
    const toleranceWorld = (tileExtent.top - tileExtent.bottom) / this.tileSize;
    if (this._supportsCoordinatesQuantization) {
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
      { geometry,
        geometryType: "esriGeometryEnvelope",
        returnExceededLimitFeatures: false,
        maxRecordCountFactor: 3,    // This was grabbed from the ESRI web viewer request, not sure where this factor come from
        resultType: "tile",
        quantizationParameters,
        outFields,
        returnGeometry,
        distance: (tolerance ? tolerance*toleranceWorld :undefined) });

    let envelope: ArcGisExtent | undefined;
    if (geomOverride && geomOverride.type === "esriGeometryEnvelope"){
      envelope = geomOverride.geom as ArcGisExtent;
    } else {
      envelope = tileEnvelope;
    }

    return  {url: url.toString(), envelope} ;

  }

  // Makes an identify request to ESRI MapService , and return it as a list MapLayerFeatureInfo object
  public  override async getFeatureInfo(featureInfos: MapLayerFeatureInfo[], quadId: QuadId, carto: Cartographic, _tree: ImageryMapTileTree): Promise<void> {
    if (!this._querySupported || this.format === undefined)
      return;

    const cartoPoint = {
      x: this.getEPSG3857X(carto.longitudeDegrees),
      y: this.getEPSG3857Y(carto.latitudeDegrees),
      spatialReference: {wkid:102100, latestWkid:3857},
    };

    const doFeatureInfoQuery = async (format: ArcGisFeatureFormat, outFields?: string, returnGeometry?: boolean,) => {
      const infoUrl = this.constructFeatureUrl(quadId.row, quadId.column, quadId.level, format, {geom: cartoPoint, type: "esriGeometryPoint"}, outFields, 3 /* tolerance in pixel*/, returnGeometry);

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
          Logger.logInfo(loggerCategory, JSON.stringify(responseData.data.toObject()));
        }
        responseData = await doFeatureInfoQuery("JSON", "", true);
        if (responseData) {
          Logger.logInfo(loggerCategory, JSON.stringify(responseData.data));
        }
      } catch (e) {
        Logger.logInfo(loggerCategory, `Error occured with debug FeatureInfo: ${e}`);
      }
    }

    try {
      const responseData = await doFeatureInfoQuery(this.format, "*", false);
      if (!responseData) {
        Logger.logError(loggerCategory, `Could not get feature info data`);
        return;
      }
      if (responseData.exceedTransferLimit) {
        Logger.logError(loggerCategory, `Could not get feature info : transfert limit exeeded.`);
        return;
      }
      const featureReader: ArcGisFeatureReader = this.format === "PBF" ? new ArcGisFeaturePBF(this._settings, this._layerMetadata) : new ArcGisFeatureJSON(this._settings, this._layerMetadata);
      featureReader.readFeatureInfo(responseData, featureInfos);

    } catch (e) {
      Logger.logError(loggerCategory, `Exception occured while loading feature info data : ${e}`);
      return;
    }

    return;
  }

  private async fetchTile(row: number, column: number, zoomLevel: number, refineEnvelope?: ArcGisExtent): Promise<ArcGisFeatureResponse | undefined> {
    if (!this.format) {
      assert(!"No supported query format");
      return undefined;
    }

    const geomOverride: ArcGisGeometry|undefined = (refineEnvelope ? {geom: refineEnvelope, type: "esriGeometryEnvelope"} : undefined);
    const tileUrl =  this.constructFeatureUrl(row, column, zoomLevel, this.format, geomOverride);
    if (!tileUrl || tileUrl.url.length === 0) {
      Logger.logError(loggerCategory, `Could not construct feature query URL for tile ${zoomLevel}/${row}/${column}`);
      return undefined;
    }

    const response = this.fetch(new URL(tileUrl.url), { method: "GET" });
    // if ((await response).status !== 200){
    //   return undefined;
    // }
    return new ArcGisFeatureResponse(this.format, response, tileUrl.envelope);
  }

  public  drawTileDebugInfo(row: number, column: number, zoomLevel: number, context: CanvasRenderingContext2D ){
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
    const xTranslate = -1*canvasTileOriginOffset.x;

    // Canvas origin is uppler left corner, so we need to flip the y axsis
    const yTranslate = canvasTileExtentOffset.y;     // y-axis flip
    const yWorld2CanvasRatio = -1*world2CanvasRatio; // y-axis flip

    const matrix = Matrix4d.createTranslationAndScaleXYZ(xTranslate, yTranslate, 0, world2CanvasRatio, yWorld2CanvasRatio, 1);
    return  matrix.asTransform;
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
      assert(!"no canvas context");
      return undefined;
    }

    if (!this._symbologyRenderer) {
      Logger.logError(loggerCategory, "No symbology renderer available for loading tile.");
      assert(!"No symbology renderer");
      return undefined;
    }
    try {

      // Compute transform if CoordinatesQuantization is not supported by service
      let transfo: Transform | undefined;
      if (!this._supportsCoordinatesQuantization) {
        transfo = this.computeTileWorld2CanvasTransform(row, column, zoomLevel);
        if (!transfo)  {
          Logger.logError(loggerCategory, `Could not compute data transformation for tile (${zoomLevel}/${row}/${column})`);
          assert(!"Could not compute world to canvas transform");
        }
      }

      const renderer = new ArcGisFeatureRenderer(ctx, this._symbologyRenderer, transfo);
      const featureReader: ArcGisFeatureReader = this.format === "PBF" ? new ArcGisFeaturePBF(this._settings, this._layerMetadata) : new ArcGisFeatureJSON(this._settings, this._layerMetadata);

      const getSubEnvelopes = (envelope: ArcGisExtent): ArcGisExtent[] => {
        const dx = (envelope.xmax - envelope.xmin) * 0.5;
        const dy = (envelope.xmax - envelope.xmin) * 0.5;
        const subEnvelopes: ArcGisExtent[] = [];
        for (let posX=0; posX<ArcGisFeatureProvider._nbSubTiles; posX++) {
          for (let posY=0; posY<ArcGisFeatureProvider._nbSubTiles; posY++) {
            subEnvelopes.push({
              xmin: envelope.xmin + (dx*posX), ymin: envelope.ymin + (dy*posY),
              xmax: envelope.xmin + (dx*(posX+1)), ymax: envelope.ymin + (dy*(posY+1)),
              spatialReference: {wkid:102100, latestWkid:3857},
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
            return ;
          }

          responseData = await response.getResponseData();
          if (!responseData) {
            Logger.logError(loggerCategory, `Could not get response data for tile (${zoomLevel}/${row}/${column})`);
            return ;
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
          featureReader.readAndRender(responseData, renderer);
        }
      };
      await renderData();
      if (this._drawDebugInfo)
        this.drawTileDebugInfo(row, column, zoomLevel, ctx);
    } catch (e) {
      Logger.logError(loggerCategory, `Exception occurred while loading tile (${zoomLevel}/${row}/${column}) : ${e}`);
    }

    try {
      const dataUrl =  canvas.toDataURL("image/png");
      const header = "data:image/png;base64,";
      const dataUrl2 = dataUrl.substring(header.length);
      return new ImageSource(base64StringToUint8Array(dataUrl2), ImageSourceFormat.Png);
    } catch (e) {
      Logger.logError(loggerCategory, `Exception occurred while rendering tile (${zoomLevel}/${row}/${column}) : ${e}.`);
    }

    return undefined;
  }
}
