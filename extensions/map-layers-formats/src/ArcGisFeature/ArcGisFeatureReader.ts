/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { ImageMapLayerSettings } from "@itwin/core-common";
import { FeatureGeometryRenderer, FeatureGraphicsRenderer, MapLayerFeatureInfo } from "@itwin/core-frontend";
import { ArcGisResponseData } from "./ArcGisFeatureResponse";
import { FeatureInfoReader } from "../Feature/FeatureInfoReader";

/** Interface defining minimal implementation needed to create an ArcGIS geometry reader,
 * needed by the [[ArcGisFeatureProvider]].
 * @internal
 */
export interface ArcGisFeatureReader {
  readAndRender: (response: ArcGisResponseData, renderer: FeatureGeometryRenderer) => Promise<void>;
  readFeatureInfo: (response: ArcGisResponseData, featureInfos: MapLayerFeatureInfo[], renderer: FeatureGraphicsRenderer) => Promise<void>;
}

/** Internal implementation of [[ArcGisFeatureReader]]
 * @internal
 */
export abstract class ArcGisBaseFeatureReader extends FeatureInfoReader implements ArcGisFeatureReader {

  protected _settings: ImageMapLayerSettings;
  protected _layerMetadata: any;

  public constructor(settings: ImageMapLayerSettings, layerMetadata: any) {
    super();
    this._settings = settings;
    this._layerMetadata = layerMetadata;
  }

  public abstract readAndRender(response: ArcGisResponseData, renderer: FeatureGeometryRenderer): Promise<void>;
  public abstract readFeatureInfo(response: ArcGisResponseData, featureInfos: MapLayerFeatureInfo[], renderer: FeatureGraphicsRenderer): Promise<void>;

}
