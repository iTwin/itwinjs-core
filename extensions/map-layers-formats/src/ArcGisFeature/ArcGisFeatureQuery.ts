/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @internal */
export type ArcGisFeatureResultType = "none" | "standard" | "tile";

/** @internal */
export type ArcGisFeatureGeometryType =
 "esriGeometryNull"
 | "esriGeometryPoint"
 | "esriGeometryMultipoint"
 | "esriGeometryLine"
 | "esriGeometryCircularArc"
 | "esriGeometryEllipticArc"
 | "esriGeometryBezier3Curve"
 | "esriGeometryPath"
 | "esriGeometryPolyline"
 | "esriGeometryRing"
 | "esriGeometryPolygon"
 | "esriGeometryEnvelope"
 | "esriGeometryAny"
 | "esriGeometryBag"
 | "esriGeometryMultiPatch"
 | "esriGeometryTriangleStrip"
 | "esriGeometryTriangeFan"
 | "esriGeometryRay"
 | "esriGeometrySphere"
 | "esriGeometryTriangles";

/** @internal */
export type ArcGisFeatureSpatialRel =  "esriSpatialRelIntersects" | "esriSpatialRelContains" | "esriSpatialRelCrosses" | "esriSpatialRelEnvelopeIntersects" | "esriSpatialRelIndexIntersects" | "esriSpatialRelOverlaps" | "esriSpatialRelTouches" | "esriSpatialRelWithin";

/** @internal */
export interface ArcGisGeometry {
  type: ArcGisFeatureGeometryType;
  geom: ArcGisExtent | ArcGisPointGeometry;
}

/** @internal */
export interface ArcGisSpatialReference {
  wkid: number;
  latestWkid: number;
}

/** @internal */
export interface ArcGisExtent {
  xmin: number;
  xmax: number;
  ymin: number;
  ymax: number;
  spatialReference: ArcGisSpatialReference;
}

/** @internal */
export interface ArcGisPointGeometry {
  x: number;
  y: number;
  spatialReference: ArcGisSpatialReference;
}

/** @internal */
export interface FeatureQueryQuantizationParams {
  extent: ArcGisExtent;
  mode: "view" | "edit";
  originPosition: "upperLeft" | "lowerLeft";
  tolerance: number;
}

/** @internal */
export type ArcGisFeatureFormat = "JSON" | "PBF";

// Based on official documentation:
// https://developers.arcgis.com/rest/services-reference/query-feature-service-layer-.htm
/** @internal */
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
  geometry?: ArcGisGeometry;
  geometryType?: ArcGisFeatureGeometryType;
  spatialRel?: ArcGisFeatureSpatialRel;
  resultType?: ArcGisFeatureResultType;
  maxRecordCountFactor?: number;
  returnExceededLimitFeatures?: boolean;
  quantizationParameters?: FeatureQueryQuantizationParams;

  /** The list of fields to be included in the returned result set. This list is a comma-delimited list of field names.
   * You can also specify the wildcard "*" as the value of this parameter.
   *  */
  outFields?: string;

  /** The buffer distance for the input geometries.
   *  */
  distance?: number;
}

/** @internal */
export class ArcGisFeatureQuery {
  public baseUrl: string;
  public layerIdx: number;
  public format: ArcGisFeatureFormat;
  public resultRecordCount?: number;
  public resultOffset?: number;
  public returnGeometry?: boolean;
  public geometry?: ArcGisGeometry;
  public spatialRel?: ArcGisFeatureSpatialRel;
  public resultType?: ArcGisFeatureResultType;
  public maxRecordCountFactor?: number;
  public returnExceededLimitFeatures?: boolean;
  public outSR: number;
  public outFields?: string;
  public distance?: number;

  // public envelopeFilter?: CartographicRange;
  public quantizationParams?: FeatureQueryQuantizationParams;

  // base url is expected ito be in the format of:
  // https://<hostname>/arcgis/rest/services/<ServiceName>/FeatureServer
  public constructor(baseUrl: string, layerIdx: number, format: ArcGisFeatureFormat, outSR: number, params?: ArcGisFeatureQueryParams) {
    this.baseUrl = baseUrl;
    this.layerIdx = layerIdx;
    this.format = format;
    this.outSR = outSR;

    if (params !== undefined) {
      this.resultRecordCount = params.resultRecordCount;
      this.resultOffset = params.resultOffset;
      this.returnGeometry = params.returnGeometry;
      this.geometry = params.geometry;
      this.spatialRel = params.spatialRel;
      this.resultType = params.resultType;
      this.maxRecordCountFactor = params.maxRecordCountFactor;
      this.returnExceededLimitFeatures = params.returnExceededLimitFeatures;
      this.quantizationParams = params.quantizationParameters;
      this.outFields = params.outFields;
      this.distance = params.distance;
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

    customParams = ArcGisFeatureQuery.appendParam(customParams, "outSR", `${this.outSR}`);

    if (this.geometry || this.spatialRel) {

      if (this.spatialRel) {
        customParams = ArcGisFeatureQuery.appendParam(customParams, "spatialRel", this.spatialRel);
      }

      if (this.geometry) {
        customParams = ArcGisFeatureQuery.appendParam(customParams, "geometryType", this.geometry.type);

        const geomStr = JSON.stringify(this.geometry.geom);
        customParams = ArcGisFeatureQuery.appendParam(customParams, "geometry", geomStr);

        customParams = ArcGisFeatureQuery.appendParam(customParams, "inSR", `${this.geometry.geom.spatialReference.wkid}`);
      }
    } else {
      // No custom params, fetch all geometries
      customParams = "where=1=1";
    }

    if (this.quantizationParams) {
      const quantizationParamsStr = JSON.stringify(this.quantizationParams);
      customParams = ArcGisFeatureQuery.appendParam(customParams, "quantizationParameters", quantizationParamsStr);
    }

    if (this.outFields) {
      customParams = ArcGisFeatureQuery.appendParam(customParams, "outFields", this.outFields);
    }

    if (this.distance) {
      customParams = ArcGisFeatureQuery.appendParam(customParams, "distance", `${this.distance}`);
    }

    return `${this.baseUrl}/${this.layerIdx}/query/?f=${this.format}&${customParams}`;
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
