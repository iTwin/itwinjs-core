/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Primitives, StandardTypeNames } from "@itwin/appui-abstract";
import { ImageMapLayerSettings } from "@itwin/core-common";
import { ArcGisGeometryRenderer, ArcGisGraphicsRenderer, MapLayerFeatureInfo } from "@itwin/core-frontend";
import { ArcGisResponseData } from "./ArcGisFeatureResponse";

/** Interface defining minimal implementation needed to create an ArcGIS geometry reader,
 * needed by the [[ArcGisFeatureProvider]].
 * @internal
 */
export interface ArcGisFeatureReader {
  readAndRender: (response: ArcGisResponseData, renderer: ArcGisGeometryRenderer) => Promise<void>;
  readFeatureInfo: (response: ArcGisResponseData, featureInfos: MapLayerFeatureInfo[], renderer: ArcGisGraphicsRenderer) => Promise<void>;
}

/** Internal implementation of [[ArcGisFeatureReader]]
 * @internal
 */
export abstract class ArcGisBaseFeatureReader implements ArcGisFeatureReader {
  // Optionally you can set the floating precision
  public floatPrecision: number|undefined;

  // Force display value of date to ISO 8601 format.
  // Turning this ON, will disable display value in end-user's locale
  public forceDateDisplayValueToIso = false;

  protected _settings: ImageMapLayerSettings;
  protected _layerMetadata: any;

  public constructor(settings: ImageMapLayerSettings, layerMetadata: any) {
    this._settings = settings;
    this._layerMetadata = layerMetadata;
  }

  public abstract readAndRender(response: ArcGisResponseData, renderer: ArcGisGeometryRenderer): Promise<void>;
  public abstract readFeatureInfo(response: ArcGisResponseData, featureInfos: MapLayerFeatureInfo[], renderer: ArcGisGraphicsRenderer): Promise<void>;

  protected  toFixedWithoutPadding = (value: number) => {
    return (this.floatPrecision === undefined ? value : parseFloat(value.toFixed(this.floatPrecision)));
  };

  protected getDisplayValue = (typename: StandardTypeNames, value: Primitives.Value|undefined) => {
    if (value === undefined) {
      return  "";
    } else if ( typename === StandardTypeNames.DateTime && this.forceDateDisplayValueToIso) {
      return (value as Date).toISOString();
    } else {
      return `${value}`;
    }
  };
}
