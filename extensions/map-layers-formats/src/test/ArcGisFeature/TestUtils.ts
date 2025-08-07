/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { DefaultArcGiSymbology } from "../../ArcGisFeature/ArcGisFeatureProvider.js";
import { ArcGisFeatureGeometryType } from "../../ArcGisFeature/ArcGisFeatureQuery.js";
import { ArcGisSymbologyCanvasRenderer } from "../../ArcGisFeature/ArcGisSymbologyRenderer.js";
import { EsriRenderer } from "../../ArcGisFeature/EsriSymbology.js";

/**
* @internal
*/
export class TestUtils {

  public static async createSymbologyRenderer(geometryType: ArcGisFeatureGeometryType, rendererDef: any) {
    const defaultSymb = new DefaultArcGiSymbology();
    await defaultSymb.initialize();
    return ArcGisSymbologyCanvasRenderer.create(EsriRenderer.fromJSON(rendererDef), defaultSymb, geometryType);
  }
}
