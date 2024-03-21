/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { DefaultArcGiSymbology } from "../../ArcGisFeature/ArcGisFeatureProvider";
import { ArcGisFeatureGeometryType } from "../../ArcGisFeature/ArcGisFeatureQuery";
import { ArcGisSymbologyCanvasRenderer } from "../../ArcGisFeature/ArcGisSymbologyRenderer";
import { EsriRenderer } from "../../ArcGisFeature/EsriSymbology";

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
