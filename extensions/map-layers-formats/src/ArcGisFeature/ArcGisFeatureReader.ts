/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { ImageMapLayerSettings } from "@itwin/core-common";
import { MapLayerFeatureInfo } from "@itwin/core-frontend";
import { ArcGisFeatureRenderer } from "./ArcGisFeatureRenderer";
import { ArcGisResponseData } from "./ArcGisFeatureResponse";

export abstract  class ArcGisFeatureReader  {

  // Optionally you can set the floating precision
  public floatPrecision: number|undefined;

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
}

