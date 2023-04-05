/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Primitives, StandardTypeNames } from "@itwin/appui-abstract";
import { ImageMapLayerSettings } from "@itwin/core-common";
import { MapLayerFeatureInfo } from "@itwin/core-frontend";
import { ArcGisFeatureRenderer } from "./ArcGisFeatureRenderer";
import { ArcGisResponseData } from "./ArcGisFeatureResponse";

/** @internal */
export abstract class ArcGisFeatureReader  {
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

  public abstract readAndRender(response: ArcGisResponseData, _renderer: ArcGisFeatureRenderer): void;

  public abstract readFeatureInfo(response: ArcGisResponseData, featureInfos: MapLayerFeatureInfo[]): void;

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
