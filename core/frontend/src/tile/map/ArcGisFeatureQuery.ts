/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

export type ArcGisFeatureResultType = "none" | "standard" | "tile";
export type ArcGisFeatureGeometryType = "esriGeometryPoint" | "esriGeometryMultipoint" | "esriGeometryPolyline" | "esriGeometryPolygon" | "esriGeometryEnvelope";
export type ArcGisFeatureSpatialRel =  "esriSpatialRelIntersects" | "esriSpatialRelContains" | "esriSpatialRelCrosses" | "esriSpatialRelEnvelopeIntersects" | "esriSpatialRelIndexIntersects" | "esriSpatialRelOverlaps" | "esriSpatialRelTouches" | "esriSpatialRelWithin";

export interface ArcGisSpatialReference {
  wkid: number;
  latestWkid: number;
}

export interface ArcGisExtent {
  xmin: number;
  xmax: number;
  ymin: number;
  ymax: number;
  spatialReference: ArcGisSpatialReference;
}

export interface FeatureQueryQuantizationParams {
  extent: ArcGisExtent;
  mode: "view" | "edit";
  originPosition: "upperLeft" | "lowerLeft";
  tolerance: number;
}

export type ArcGisFeatureFormat = "JSON" | "PBF";

// Based on official documentation:
// https://developers.arcgis.com/rest/services-reference/query-feature-service-layer-.htm
export interface ArcGisFeatureQueryParams {

  /** This option can be used for fetching query results up to the resultRecordCount specified.
   * When resultOffset is specified but this parameter is not, the map service defaults it to maxRecordCount.
   * The maximum value for this parameter is the value of the layer's maxRecordCount property.
   * The minimum value entered for this parameter cannot be below 1.
   * This parameter only applies if supportsPagination is true.
   * */
  resultRecordCount?: number;

  /** This option can be used for fetching query results up to the resultRecordCount specified.
   * When resultOffset is specified but this parameter is not, the map service defaults it to maxRecordCount.
   * The maximum value for this parameter is the value of the layer's maxRecordCount property.
   * The minimum value entered for this parameter cannot be below 1.
   * This parameter only applies if supportsPagination is true.
   * */
  resultOffset?: number;

  /** If true, the result includes the geometry associated with each feature returned. */
  returnGeometry?: boolean;
  geometry?: ArcGisExtent;
  geometryType?: ArcGisFeatureGeometryType;
  spatialRel?: ArcGisFeatureSpatialRel;
  resultType?: ArcGisFeatureResultType;
  maxRecordCountFactor?: number;
  returnExceededLimitFeatures?: boolean;
  outSR?: number;
  quantizationParameters?: FeatureQueryQuantizationParams;
}
export class ArcGisFeatureQuery {
  public baseUrl: string;
  public layerIdx: number;
  public format: ArcGisFeatureFormat;
  public resultRecordCount?: number;
  public resultOffset?: number;
  public returnGeometry?: boolean;
  public geometry?: ArcGisExtent;
  public geometryType?: ArcGisFeatureGeometryType;
  public spatialRel?: ArcGisFeatureSpatialRel;
  public resultType?: ArcGisFeatureResultType;
  public maxRecordCountFactor?: number;
  public returnExceededLimitFeatures?: boolean;
  public outSR?: number;

  // public envelopeFilter?: CartographicRange;
  public quantizationParams?: FeatureQueryQuantizationParams;

  // base url is expected ito be in the format of:
  // https://<hostname>/arcgis/rest/services/<ServiceName>/FeatureServer
  public constructor(baseUrl: string, layerIdx: number, format: ArcGisFeatureFormat, params?: ArcGisFeatureQueryParams) {
    this.baseUrl = baseUrl;
    this.layerIdx = layerIdx;
    this.format = format;

    if (params !== undefined) {
      this.resultRecordCount = params.resultRecordCount;
      this.resultOffset = params.resultOffset;
      this.returnGeometry = params.returnGeometry;
      this.geometry = params.geometry;
      this.geometryType = params.geometryType;
      this.spatialRel = params.spatialRel;
      this.resultType = params.resultType;
      this.maxRecordCountFactor = params.maxRecordCountFactor;
      this.returnExceededLimitFeatures = params.returnExceededLimitFeatures;
      this.outSR = params.outSR;
      this.quantizationParams = params.quantizationParameters;
    }

  }

  public toString() {
    let customParams = "";

    if ( this.resultRecordCount !== undefined) {
      customParams = ArcGisFeatureQuery.appendParam(customParams, "resultRecordCount", `${this.resultRecordCount}`);
    }

    if ( this.resultOffset !== undefined) {
      customParams = ArcGisFeatureQuery.appendParam(customParams, "resultOffset", `${this.resultOffset}`);
    }

    if ( this.returnGeometry !== undefined) {
      customParams = ArcGisFeatureQuery.appendParam(customParams, "returnGeometry", this.returnGeometry?"true":"false");
    }

    if ( this.resultType !== undefined) {
      customParams = ArcGisFeatureQuery.appendParam(customParams, "resultType", this.resultType);
    }

    if ( this.maxRecordCountFactor !== undefined) {
      customParams = ArcGisFeatureQuery.appendParam(customParams, "maxRecordCountFactor", `${this.maxRecordCountFactor}`);
    }

    if ( this.returnExceededLimitFeatures !== undefined) {
      customParams = ArcGisFeatureQuery.appendParam(customParams, "returnExceededLimitFeatures", this.returnExceededLimitFeatures?"true":"false");
    }

    if ( this.outSR !== undefined) {
      customParams = ArcGisFeatureQuery.appendParam(customParams, "outSR", `${this.outSR}`);
    }

    if (this.geometry || this.geometryType || this.spatialRel) {

      if (this.spatialRel) {
        customParams = ArcGisFeatureQuery.appendParam(customParams, "spatialRel", this.spatialRel);
      }

      if (this.geometryType) {
        customParams = ArcGisFeatureQuery.appendParam(customParams, "geometryType", this.geometryType);
      }

      if (this.geometry) {
        // Basic geometry expression is used : geometryType=esriGeometryEnvelope&geometry=<xmin>,<ymin>,<xmax>,<ymax>
        // A more advanced JSON structure exists in the service API if we ever need it.
        // We assume the extent to be in EPSG:3857 (Esri SR ID: 102100)
        // customParams = ArcGisFeatureQuery.appendParam(customParams, "geometryType", "esriGeometryEnvelope");
        /*
        const radianRange = this.envelopeFilter.getLongitudeLatitudeBoundingBox();
        const bbox: Range2d = new Range2d(
          Angle.radiansToDegrees(radianRange.xLow), Angle.radiansToDegrees(radianRange.yLow),
          Angle.radiansToDegrees(radianRange.xHigh), Angle.radiansToDegrees(radianRange.yHigh));
*/
        // customParams = ArcGisFeatureQuery.appendParam(customParams, "geometry", `${this.envelopeFilter.xLow},${this.envelopeFilter.yLow},${this.envelopeFilter.xHigh},${this.envelopeFilter.yHigh}`);
        // customParams = ArcGisFeatureQueryUrl.appendParam(customParams, "geometry", `${bbox.xLow},${bbox.yLow},${bbox.xHigh},${bbox.yHigh}`);

        const geomStr = JSON.stringify(this.geometry);
        customParams = ArcGisFeatureQuery.appendParam(customParams, "geometry", geomStr);

        customParams = ArcGisFeatureQuery.appendParam(customParams, "inSR", `${this.geometry.spatialReference.wkid}`);
        // customParams = ArcGisFeatureQueryUrl.appendParam(customParams, "inSR", "4326");
      }
    } else {
      // No custom params, fetch all geometries
      customParams = "where=1=1";
    }

    if (this.quantizationParams) {
      const quantizationParamsStr = JSON.stringify(this.quantizationParams);
      customParams = ArcGisFeatureQuery.appendParam(customParams, "quantizationParameters", quantizationParamsStr);
    }

    // TODO: Removed hardcoded 102100 SR (EPSG:3857)
    // return `${this.baseUrl}/${this.layerIdx}/query/?f=json&${customParams}&outSR=102100`;

    return `${this.baseUrl}/${this.layerIdx}/query/?f=${this.format}&${customParams}&outSR=102100`;
  }

  private static  appendParam(urlToAppend: string, paramName: string, paramValue: string) {
    if (paramName.length === 0) {
      return urlToAppend;
    }

    let url = urlToAppend;
    if (urlToAppend.length > 0 && !urlToAppend.endsWith("&")) {
      url = `${urlToAppend  }&`;
    }

    return `${url}${paramName}=${paramValue}`;
  }

}
