/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */
import { IModelStatus } from "@itwin/core-bentley";
import { Cartographic, ImageMapLayerSettings, MapSubLayerSettings, ServerError } from "@itwin/core-common";
import { Point2d } from "@itwin/core-geometry";
import {
  ImageryMapTileTree, MapCartoRectangle, MapLayerImageryProvider, MapLayerImageryProviderStatus, QuadId, WmsCapabilities,
  WmsCapability, WmsUtilities,
} from "../../internal";

// eslint-disable-next-line prefer-const
let doToolTips = true;

const scratchPoint2d = Point2d.createZero();

/** @internal */
export interface WmsCrsSupport {
  support3857: boolean;
  support4326: boolean;
}

/** @internal */
export class WmsMapLayerImageryProvider extends MapLayerImageryProvider {
  private _capabilities?: WmsCapabilities;
  private _allLayersRange?: MapCartoRectangle;
  private _subLayerRanges = new Map<string, MapCartoRectangle>();
  private _baseUrl: string;
  private _crsSupport: WmsCrsSupport|undefined;

  constructor(settings: ImageMapLayerSettings) {
    super(settings, false);
    this._baseUrl = WmsUtilities.getBaseUrl(this._settings.url);
  }

  public override async initialize(): Promise<void> {
    try {
      const credentials = (this._settings.userName && this._settings.password ? {user: this._settings.userName, password:  this._settings.password} : undefined);
      this._capabilities = await WmsCapabilities.create(this._baseUrl, credentials);
      if (undefined !== this._capabilities) {
        this._allLayersRange = this._capabilities.cartoRange;
        if (this._capabilities.layer && Array.isArray(this._capabilities.layer.subLayers)) {
          const mapCartoRanges = ((subLayer: WmsCapability.SubLayer) => {
            if (Array.isArray(subLayer.children))
              subLayer.children.forEach((child) => mapCartoRanges(child));
            else if (subLayer.cartoRange)
              this._subLayerRanges.set(subLayer.name, subLayer.cartoRange);
          });
          this._capabilities.layer.subLayers.forEach((subLayer) => mapCartoRanges(subLayer));
          this._settings.subLayers.forEach((subLayer) => {
            if (subLayer.isNamed && this._settings.isSubLayerVisible(subLayer)) {
              const subLayerRange = this._subLayerRanges.get(subLayer.name);
              if (subLayerRange)
                if (this.cartoRange)
                  this.cartoRange.extendRange(subLayerRange);
                else
                  this.cartoRange = subLayerRange.clone();
            }
          });
        }

        if (!this.cartoRange)
          this.cartoRange = this._allLayersRange;

        this._crsSupport = this.getCrsSupport();
      }
    } catch (error: any) {
      // Don't throw error if unauthorized status:
      // We want the tile tree to be created, so that end-user can get feedback on which layer is missing credentials.
      // When credentials will be provided, a new provider will be created, and initialization should be fine.
      if (error?.status === 401) {
        this.setStatus(MapLayerImageryProviderStatus.RequireAuth);
      } else {
        throw new ServerError(IModelStatus.ValidationFailed, "");
      }
    }
  }

  private getVisibleLayerString() {
    const layerNames = this.getVisibleLayers().map((layer)=>layer.name);
    return layerNames.join("%2C");
  }

  private getVisibleLayers(): MapSubLayerSettings[] {
    return this._settings.subLayers.filter((subLayer) =>  this._settings.isSubLayerVisible(subLayer) && subLayer.isNamed);
  }

  private getVisibleLayersSrs() {
    const visibleLayers = this.getVisibleLayers();
    const visibleLayerNames = visibleLayers.map((layer) => layer.name);
    return this._capabilities?.getSubLayersCrs(visibleLayerNames);
  }

  private getQueryableLayers(): string[] {
    const layerNames = new Array<string>();
    const getQueryableSubLayers = ((subLayer: WmsCapability.SubLayer) => {
      if (!subLayer)
        return;

      if (subLayer.queryable)
        layerNames.push(subLayer.name);

      subLayer.children?.forEach((childSubLayer) => getQueryableSubLayers(childSubLayer));
    });

    this._capabilities?.layer?.subLayers?.forEach((subLayer) => getQueryableSubLayers(subLayer));
    return layerNames;
  }

  private getVisibleQueryableLayersString(): string {
    const layers = new Array<string>();
    const queryable = this.getQueryableLayers();
    const visibleLayerNames = this.getVisibleLayers().map((layer) => layer.name);
    queryable.forEach((layer: string) => {
      if (visibleLayerNames.includes(layer))
        layers.push(layer);
    });

    return layers.join("%2C");
  }

  public getCrsSupport(): WmsCrsSupport {
    const layersCrs = this.getVisibleLayersSrs();

    let support3857: boolean|undefined;
    let support4326: boolean|undefined;
    if (layersCrs) {
      for (const [_layerName, crs] of layersCrs) {
        if (crs.find((layerCrs) => layerCrs.includes("3857")) === undefined ) {
          support3857 = false;
        } else if (support3857 === undefined) {
          support3857 = true;
        }

        if (crs.find((layerCrs) => layerCrs.includes("4326")) === undefined ) {
          support4326 = false;
        } else if (support4326 === undefined) {
          support4326 = true;
        }
      }
    }

    return {support3857: support3857 ?? false, support4326: support4326 ?? false};
  }

  // WMS standard requires 'TRUE' or 'FALSE' (case sensitive) values.
  public override get transparentBackgroundString(): string { return this._settings.transparentBackground ? "TRUE" : "FALSE"; }

  // construct the Url from the desired Tile
  public async constructUrl(row: number, column: number, zoomLevel: number): Promise<string> {

    let bboxString ="";
    let crsString ="";

    // We support 2 SRS: EPSG:3857 and EPSG:4326, we prefer EPSG:3857.
    if (this._crsSupport?.support3857) {
      bboxString = this.getEPSG3857ExtentString(row, column, zoomLevel);
      crsString= "EPSG%3A3857";
    } else if (this._crsSupport?.support4326) {
      // The WMS 1.3.0 specification mandates using the axis ordering as defined in the EPSG database.
      // For instance, for EPSG:4326 the axis ordering is latitude/longitude, or north/east.
      // WMS 1.1.0 always requires the axis ordering to be longitude/latitude. *sigh*
      if (this._capabilities !== undefined) {
        bboxString = this.getEPSG4326TileExtentString(row, column, zoomLevel, this._capabilities?.isVersion13); // lat/long ordering
        crsString= "EPSG%3A4326";
      }

    }

    const layerString = this.getVisibleLayerString();

    if (bboxString.length === 0 || crsString.length === 0 ||layerString.length === 0)
      return "";

    const crsParamName = this._capabilities?.isVersion13 ? "CRS" : "SRS";

    const tmpUrl = `${this._baseUrl}?SERVICE=WMS&VERSION=${this._capabilities?.version}&REQUEST=GetMap&FORMAT=image%2Fpng&TRANSPARENT=${this.transparentBackgroundString}&LAYERS=${layerString}&WIDTH=${this.tileSize}&HEIGHT=${this.tileSize}&${crsParamName}=${crsString}&STYLES=&BBOX=${bboxString}`;
    return this.appendCustomParams(tmpUrl);
  }

  public override async getToolTip(strings: string[], quadId: QuadId, carto: Cartographic, tree: ImageryMapTileTree): Promise<void> {
    await super.getToolTip(strings, quadId, carto, tree);
    const infoFormats = this._capabilities?.featureInfoFormats;
    if (!doToolTips || undefined === infoFormats)
      return;
    let formatString: string | undefined = infoFormats.find((format) => format === "text/html");
    if (!formatString)
      formatString = infoFormats[0];

    const bboxString = this.getEPSG3857ExtentString(quadId.row, quadId.column, quadId.level);
    const layerString = this.getVisibleQueryableLayersString();
    if (layerString.length === 0)
      return;
    const rectangle = tree.getTileRectangle(quadId);
    const fraction = rectangle.worldToLocal(Point2d.create(carto.longitude, carto.latitude, scratchPoint2d))!;
    const x = Math.floor(.5 + fraction.x * this.tileSize);
    const y = Math.floor(.5 + (1.0 - fraction.y) * this.tileSize);
    const coordinateString =  this._capabilities?.isVersion13 ? `&i=${x}&j=${y}` : `&x=${x}&y=${y}`;
    const crsParamName = this._capabilities?.isVersion13 ? "CRS" : "SRS";
    let getFeatureUrl = `${this._baseUrl}?SERVICE=WMS&VERSION=${this._capabilities?.version}&REQUEST=GetFeatureInfo&LAYERS=${layerString}&WIDTH=${this.tileSize}&HEIGHT=${this.tileSize}&${crsParamName}=EPSG%3A3857&BBOX=${bboxString}&QUERY_LAYERS=${layerString}${coordinateString}&info_format=${formatString}`;
    getFeatureUrl = this.appendCustomParams(getFeatureUrl);
    return this.toolTipFromUrl(strings, getFeatureUrl);
  }
}
