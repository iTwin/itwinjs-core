/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Angle, Range2d } from "@bentley/geometry-core";
import { CartographicRange } from "@bentley/imodeljs-common";
import { ArcGisTokenClientType, ArcGisTokenManager } from "@bentley/imodeljs-frontend";

export interface EsriFeatureQueryUrlParams {
  /** This option can be used for fetching query results up to the resultRecordCount specified.
   * When resultOffset is specified but this parameter is not, the map service defaults it to maxRecordCount.
   * The maximum value for this parameter is the value of the layer's maxRecordCount property.
   * The minimum value entered for this parameter cannot be below 1.
   * This parameter only applies if supportsPagination is true.
   * */
  resultRecordCount?: number;

  /** This option can be used for fetching query results by skipping the specified number of records and starting from the next record (that is, resultOffset + 1).
   * The default is 0.
   * This parameter only applies if supportsPagination is true.
   * You can use this option to fetch records that are beyond maxRecordCount.
   * */
  resultOffset?: number;

  /** If true, the result includes the geometry associated with each feature returned.
     * The default is true.
     * */
  returnGeometry?: boolean;

  /** The geometry to apply as the spatial filter.
   * EPSG:3857 is assumed for now.
     * */
  // envelopeFilter?: Range2d;
  envelopeFilter?: CartographicRange;

  userName?: string;
  password?: string;
}

// Based on official documentation:
// https://developers.arcgis.com/rest/services-reference/query-feature-service-layer-.htm
export class EsriFeatureQueryUrl {
  public baseUrl: string;
  public layerIdx: number;
  public resultRecordCount?: number;
  public resultOffset?: number;
  public returnGeometry?: boolean;
  // public envelopeFilter?: Range2d;
  public envelopeFilter?: CartographicRange;
  public userName?: string;
  public password?: string;

  // base url is expected ito be in the format of:
  // https://<hostname>/arcgis/rest/services/<ServiceName>/FeatureServer
  public constructor(baseUrl: string, layerIdx: number, params?: EsriFeatureQueryUrlParams) {
    this.baseUrl = baseUrl;
    this.layerIdx = layerIdx;

    if (params !== undefined) {
      if (params.resultRecordCount !== undefined) {
        this.resultRecordCount = params.resultRecordCount;
      }

      if (params.resultOffset !== undefined) {
        this.resultOffset = params.resultOffset;
      }

      if (params.returnGeometry !== undefined) {
        this.returnGeometry = params.returnGeometry;
      }

      if (params.envelopeFilter !== undefined) {
        this.envelopeFilter = params.envelopeFilter;
      }

      if (params.userName !== undefined) {
        this.userName = params.userName;
      }

      if (params.password !== undefined) {
        this.password = params.password;
      }
    }

  }

  public async toString() {
    let customParams = "";
    if ( this.resultRecordCount !== undefined
      || this.resultOffset !== undefined
      || this.returnGeometry !== undefined
      || this.envelopeFilter !== undefined
    ) {
      if (this.envelopeFilter !== undefined) {
        // Basic geometry expression is used : geometryType=esriGeometryEnvelope&geometry=<xmin>,<ymin>,<xmax>,<ymax>
        // A more advanced JSON structure exists in the service API if we ever need it.
        // We assume the extent to be in EPSG:3857 (Esri SR ID: 102100)
        customParams = EsriFeatureQueryUrl.appendParam(customParams, "geometryType", "esriGeometryEnvelope");
        const radianRange = this.envelopeFilter.getLongitudeLatitudeBoundingBox();
        const bbox: Range2d = new Range2d(
          Angle.radiansToDegrees(radianRange.xLow), Angle.radiansToDegrees(radianRange.yLow),
          Angle.radiansToDegrees(radianRange.xHigh), Angle.radiansToDegrees(radianRange.yHigh));

        // customParams = EsriFeatureQueryUrl.appendParam(customParams, "geometry", `${this.envelopeFilter.xLow},${this.envelopeFilter.yLow},${this.envelopeFilter.xHigh},${this.envelopeFilter.yHigh}`);
        customParams = EsriFeatureQueryUrl.appendParam(customParams, "geometry", `${bbox.xLow},${bbox.yLow},${bbox.xHigh},${bbox.yHigh}`);
        // customParams = EsriFeatureQueryUrl.appendParam(customParams, "inSR", "102100");
        customParams = EsriFeatureQueryUrl.appendParam(customParams, "inSR", "4326");
      }
    } else {
      // No custom params, fetch all geometries
      customParams = "where=1=1";
    }

    if (this.resultOffset !== undefined) {
      customParams = EsriFeatureQueryUrl.appendParam(customParams, "resultOffset", `${this.resultOffset}`);
    }

    if (this.resultRecordCount !== undefined) {
      customParams = EsriFeatureQueryUrl.appendParam(customParams, "resultRecordCount", `${this.resultRecordCount}`);
    }

    if (this.returnGeometry !== undefined) {
      customParams = EsriFeatureQueryUrl.appendParam(customParams, "returnGeometry", this.returnGeometry?"true":"false");
    }

    // TODO: Removed hardcoded 102100 SR (EPSG:3857)
    // return `${this.baseUrl}/${this.layerIdx}/query/?f=json&${customParams}&outSR=102100`;
    return this.appendSecurityToken(`${this.baseUrl}/${this.layerIdx}/query/?f=json&${customParams}&outSR=102100`);
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

  private async appendSecurityToken(url: string): Promise<string> {
    // Append security token if required
    let tokenParam = "";
    if (this.userName && this.password) {
      try {
        const token = await ArcGisTokenManager.getToken(this.baseUrl, this.userName, this.password,
          {
            client: ArcGisTokenClientType.referer,
          });
        if (token?.token)
          tokenParam = `&token=${token.token}`;
      } catch {
      }
    }
    return `${url}${tokenParam}`;
  }
}
