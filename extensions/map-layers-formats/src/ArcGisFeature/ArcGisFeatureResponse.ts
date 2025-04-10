/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { ArcGisExtent, ArcGisFeatureFormat, arcgisFeatureFormats } from "./ArcGisFeatureQuery.js";
import { esriPBuffer } from "./esriPBuffer.gen.js";

/** @internal */
export interface ArcGisResponseData {
  data: any;
  exceedTransferLimit: boolean;
}

/** @internal */
export type ArcGisFieldType =
  "esriFieldTypeInteger"
  | "esriFieldTypeSmallInteger"
  | "esriFieldTypeDouble"
  | "esriFieldTypeSingle"
  | "esriFieldTypeString"
  | "esriFieldTypeDate"
  | "esriFieldTypeGeometry"
  | "esriFieldTypeOID"
  | "esriFieldTypeBlob"
  | "esriFieldTypeGlobalID"
  | "esriFieldTypeRaster"
  | "esriFieldTypeGUID"
  | "esriFieldTypeXML";

/** @internal */
export class ArcGisFeatureResponse {
  public readonly format: ArcGisFeatureFormat;
  public readonly envelope: ArcGisExtent | undefined;

  private _response: Promise<Response>;

  constructor(format: ArcGisFeatureFormat,  response: Promise<Response>, envelope?: ArcGisExtent) {
    this.format = format;
    this._response = response;
    this.envelope = envelope;
  }

  public async getResponseData(): Promise<ArcGisResponseData|undefined> {
    let data: any;
    try {
      const tileResponse = await this._response;
      if (tileResponse === undefined || tileResponse.status !== 200  )
        return undefined;

      if (this.format === arcgisFeatureFormats.pbf) {
        const byteArray: Uint8Array = new Uint8Array(await tileResponse.arrayBuffer());
        if (!byteArray || (byteArray.length === 0))
          return undefined;

        data = esriPBuffer.FeatureCollectionPBuffer.deserialize(byteArray);
        const collection = data as esriPBuffer.FeatureCollectionPBuffer;
        return {data, exceedTransferLimit: collection?.queryResult?.featureResult?.exceededTransferLimit};

      } else {
        data = await tileResponse.json();
        if (data === undefined || data == null)
          return undefined;

        return {data, exceedTransferLimit: data.exceededTransferLimit};
      }

    } catch {
      return undefined;
    }
  }
}
