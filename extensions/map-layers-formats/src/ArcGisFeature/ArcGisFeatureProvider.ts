/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */
import { ImageMapLayerSettings, ImageSource, ImageSourceFormat, ServerError } from "@itwin/core-common";
import { assert, base64StringToUint8Array, IModelStatus, Logger } from "@itwin/core-bentley";
import { Matrix4d, Point3d, Transform } from "@itwin/core-geometry";
import { ArcGisErrorCode, ArcGisUtilities, MapLayerImageryProvider, MapLayerImageryProviderStatus, MapLayerSourceStatus, MapLayerSourceValidation } from "@itwin/core-frontend";
import { esriPBuffer } from "./esriPBuffer.gen";
import { ArcGisSymbologyRenderer } from "./ArcGisSymbologyRenderer";
import { ArcGisExtent, ArcGisFeatureFormat, ArcGisFeatureQuery, FeatureQueryQuantizationParams } from "./ArcGisFeatureQuery";
import { ArcGisFeatureRenderer } from "./ArcGisFeatureRenderer";
import { ArcGisFeaturePBF } from "./ArcGisFeaturePBF";
import { ArcGisFeatureJSON } from "./ArcGisFeatureJSON";

const levelToken = "{level}";
const rowToken = "{row}";
const columnToken = "{column}";

const samplePngIcon = "iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAyJpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuMC1jMDYwIDYxLjEzNDc3NywgMjAxMC8wMi8xMi0xNzozMjowMCAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RSZWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZVJlZiMiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIENTNSBNYWNpbnRvc2giIHhtcE1NOkluc3RhbmNlSUQ9InhtcC5paWQ6OURDRDBBMkZEMjdBMTFFMEFFOTVFRTBGMDE2NDc1MDUiIHhtcE1NOkRvY3VtZW50SUQ9InhtcC5kaWQ6OURDRDBBMzBEMjdBMTFFMEFFOTVFRTBGMDE2NDc1MDUiPiA8eG1wTU06RGVyaXZlZEZyb20gc3RSZWY6aW5zdGFuY2VJRD0ieG1wLmlpZDoxRjE2MjU0QUQyNzkxMUUwQUU5NUVFMEYwMTY0NzUwNSIgc3RSZWY6ZG9jdW1lbnRJRD0ieG1wLmRpZDo5RENEMEEyRUQyN0ExMUUwQUU5NUVFMEYwMTY0NzUwNSIvPiA8L3JkZjpEZXNjcmlwdGlvbj4gPC9yZGY6UkRGPiA8L3g6eG1wbWV0YT4gPD94cGFja2V0IGVuZD0iciI/PgQ9khMAAAlOSURBVHja7JtrbBTX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";
const sampleIconImg = new Image();
sampleIconImg.src = `data:image/png;base64,${samplePngIcon}`;

const loggerCategory = "ArcGISFeatureProvider";

/**
* @internal
*/
interface ArcGisFeatureUrl {
  url: string;
  envelope: ArcGisExtent;
}

/**
* @internal
*/
interface ArcGisResponseData {
  data: any;
  exceedTransferLimit: boolean;
}

/**
* @internal
*/
class ArcGisFeatureReponse {

  public readonly format: ArcGisFeatureFormat;
  public readonly envelope: ArcGisExtent;

  private _response: Promise<Response>;

  constructor(format: ArcGisFeatureFormat,  response: Promise<Response>, envelope: ArcGisExtent) {
    this.format = format;
    this._response = response;
    this.envelope = envelope;
  }

  public async getResponseData(): Promise<ArcGisResponseData|undefined> {

    let data: any|undefined;
    try {
      const tileResponse = await this._response;
      if (tileResponse === undefined || tileResponse.status !== 200  )
        return undefined;

      if (this.format === "PBF") {
        const byteArray: Uint8Array = new Uint8Array(await tileResponse.arrayBuffer());
        if (!byteArray || (byteArray.length === 0))
          return undefined;

        data = esriPBuffer.FeatureCollectionPBuffer.deserialize(byteArray);
        const collection = data as esriPBuffer.FeatureCollectionPBuffer;
        return {data, exceedTransferLimit: collection?.queryResult?.featureResult?.exceededTransferLimit};

      } else {
        if (tileResponse.text === undefined)
          return undefined;

        data = await tileResponse.json();
        return {data, exceedTransferLimit: data?.exceededTransferLimit};
      }

    } catch(_e) {
      return undefined;
    }
  }
}

/**  Provide tiles from a url template in the a generic format ... i.e. https://b.tile.openstreetmap.org/{level}/{column}/{row}.png
* @internal
*/
export class ArcGisFeatureProvider extends MapLayerImageryProvider {

  private _supportsCoordinatesQuantization = false;
  private _layerId = 0;
  private _layerInfo: any;
  private _format: ArcGisFeatureFormat|undefined;
  public serviceJson: any;
  private _symbologyRenderer: ArcGisSymbologyRenderer|undefined;
  private static readonly _nbSubTiles = 2;

  constructor(settings: ImageMapLayerSettings) {
    super(settings, true);
  }

  public override async initialize(): Promise<void> {

    let json;
    try {
      json = await ArcGisUtilities.getServiceJson(this._settings.url, this.getRequestAuthorization());
    } catch {
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
      }
    }
    this.serviceJson = json;

    if (this._settings.subLayers.length >= 0) {
      for (const layer of this._settings.subLayers) {

        if (layer.visible && typeof layer.id === "number") {
          this._layerId = layer.id;
          break;
        }
      }
    } else if (json !== undefined) {
      // No sublayers were specified on the layerSettings object, lets find a default one in the capabilities

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
              this._layerInfo = layerJson;
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
    if (!this._layerInfo) {
      this._layerInfo = await this.getLayerMetadata(this._layerId);

      // Check supported query formats: JSON and PBF are currently implemented by this provider
      // Note: needs to be checked on the layer metadata, service metadata advertises a different set of formats
      if (this._layerInfo.supportedQueryFormats) {
        const formats: string[] = this._layerInfo.supportedQueryFormats.split(", ");
        if (formats.includes("PBF")) {
          this._format = "PBF";
        } else if (formats.includes ("JSON"))  {
          this._format = "JSON";
        } else {
          Logger.logError(loggerCategory, "Could not get service JSON");
          throw new ServerError(IModelStatus.ValidationFailed, "");
        }
      }

      // Coordinates Quantization:  If supported, server will transform for us the coordinates in the Tile coordinate space (pixels, origin = upper left corner
      // If not supported, transformation will be applied client side.
      if (this._layerInfo.supportsCoordinatesQuantization) {
        this._supportsCoordinatesQuantization = true;
      }
    }

    this._symbologyRenderer = new ArcGisSymbologyRenderer(this._layerInfo?.drawingInfo?.renderer);
  }

  protected  async getLayerMetadata(layerId: number) {
    let json;
    try {
      const url = new URL(this._settings.url);
      url.pathname = `${url.pathname}/${layerId}`;
      json = await ArcGisUtilities.getServiceJson(url.toString(), this.getRequestAuthorization());
    } catch {

    }
    return json;
  }

  public override get tileSize(): number { return 512; }
  public get format(): ArcGisFeatureFormat|undefined { return this._format; }
  public static validateUrlTemplate(template: string): MapLayerSourceValidation {
    return { status: (template.indexOf(levelToken) > 0 && template.indexOf(columnToken) > 0 && template.indexOf(rowToken) > 0) ? MapLayerSourceStatus.Valid : MapLayerSourceStatus.InvalidUrl };
  }

  // We dont use this method inside this provider (see constructFeatureUrl), but since this is an anstract method, we need to define something
  public async constructUrl(_row: number, _column: number, _zoomLevel: number): Promise<string> {
    return "";
  }

  public constructFeatureUrl(row: number, column: number, zoomLevel: number, refineEnvelope?: ArcGisExtent): ArcGisFeatureUrl | undefined {

    if (!this.format) {
      return undefined;
    }
    const tileExtent = this.getEPSG3857Extent(row, column, zoomLevel);

    const tileEnvelope = {
      xmin: tileExtent.left, ymin: tileExtent.bottom,
      xmax: tileExtent.right, ymax: tileExtent.top,
      spatialReference: {wkid:102100, latestWkid:3857},
    };

    let quantizationParameters: FeatureQueryQuantizationParams|undefined;
    if (this._supportsCoordinatesQuantization) {
      quantizationParameters = {
        mode: "view",
        originPosition: "upperLeft",
        tolerance: (tileExtent.top - tileExtent.bottom) / this.tileSize, // pixel size in world units
        extent: tileEnvelope,
      };
    }
    const url = new ArcGisFeatureQuery(
      this._settings.url,
      this._layerId,
      this.format,
      {
        geometry: refineEnvelope ?? tileEnvelope,
        geometryType: "esriGeometryEnvelope",
        returnExceededLimitFeatures: false,
        maxRecordCountFactor: 3,    // This was grabbed from the ESRI web viewer request, not sure where this factor come from
        resultType: "tile",
        quantizationParameters,
      });
    return  {url: url.toString(), envelope: refineEnvelope ?? tileEnvelope} ;

  }

  private async fetchTile(row: number, column: number, zoomLevel: number, refineEnvelope?: ArcGisExtent): Promise<ArcGisFeatureReponse | undefined> {
    if (!this.format) {
      assert(!"No supported query format");
      return undefined;
    }

    // const tileRequestOptions: RequestOptions = { method: "GET", responseType: this.format === "JSON" ? "text" : "arraybuffer" };
    // tileRequestOptions.auth = this.getRequestAuthorization();
    const tileUrl =  this.constructFeatureUrl(row, column, zoomLevel, refineEnvelope);
    if (!tileUrl || tileUrl.url.length === 0) {
      Logger.logError(loggerCategory, `Could not construct feature query URL for tile ${zoomLevel}/${row}/${column}`);
      return undefined;
    }

    // return {response: request(tileUrl.url, tileRequestOptions), envelope: tileUrl.envelope};
    const response = fetch(tileUrl.url, { method: "GET" });
    return new ArcGisFeatureReponse(this.format, response, tileUrl.envelope);
  }

  public  drawTileDebugInfo(row: number, column: number, zoomLevel: number, context: CanvasRenderingContext2D ){
    context.fillStyle = "cyan";
    context.strokeRect(0, 0, this.tileSize, this.tileSize);
    context.font = "30px Arial";
    context.lineWidth = 5;
    context.fillText(`${zoomLevel}-${row}-${column}`, 10, 50);
  }

  public override async loadTile(row: number, column: number, zoomLevel: number): Promise<ImageSource | undefined> {

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
        transfo = matrix.asTransform;
        if (!transfo)  {
          Logger.logError(loggerCategory, `Could not compute data transformation for tile (${zoomLevel}/${row}/${column})`);
          assert(!"Could not compute world to canvas transform");
        }
      }

      const renderer = new ArcGisFeatureRenderer(ctx, this._symbologyRenderer, transfo);
      const featureReader = this.format === "PBF" ? new ArcGisFeaturePBF() : new ArcGisFeatureJSON();

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

      // The stategy here is simple: we make a request for an area that represents the current tile (i.e envelope),
      // the server will either return the requested data OR a 'exceedTransferLimit' message (too much data to transfert).
      // In the latter case, we subdivise the previous request enveloppe in for 4 sub-envelopes,
      // and repeat again until we get data.
      const renderData = async (envelope?: ArcGisExtent) => {
        let response: ArcGisFeatureReponse | undefined;
        let responseData: ArcGisResponseData | undefined;
        try {
          response = await this.fetchTile(row, column, zoomLevel, envelope);
          if (!response) {
            Logger.logError(loggerCategory, `Error occured while fetching tile (${zoomLevel}/${row}/${column})`);
            return ;
          }

          responseData = await response.getResponseData();
          if (!responseData) {
            Logger.logError(loggerCategory, `Could not get response data for tile (${zoomLevel}/${row}/${column})`);
            return ;
          }
        } catch (e) {
          Logger.logError(loggerCategory, `Exception occured while loading tile (${zoomLevel}/${row}/${column}) : ${e}`);
          return;
        }

        if (responseData.exceedTransferLimit) {
          const subEnvelopes = getSubEnvelopes(response.envelope);
          const renderPromises = [];
          for (const subEnvelope of subEnvelopes) {
            renderPromises.push(renderData(subEnvelope));
          }
          await Promise.all(renderPromises);
        } else {
          featureReader.readAndRender(responseData.data, renderer);
        }
      };
      await renderData();
      this.drawTileDebugInfo(row, column, zoomLevel, ctx);
    } catch (e) {
      Logger.logError(loggerCategory, `Exception occured while loading tile (${zoomLevel}/${row}/${column}) : ${e}`);
    }

    try {
      const dataUrl =  canvas.toDataURL("image/png");
      const header = "data:image/png;base64,";
      const dataUrl2 = dataUrl.substring(header.length);
      return new ImageSource(base64StringToUint8Array(dataUrl2), ImageSourceFormat.Png);
    } catch (e) {
      Logger.logError(loggerCategory, `Exception occured while rendering tile (${zoomLevel}/${row}/${column}) : ${e}.`);
    }

    return undefined;
  }
}
