/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { ArcGisFeatureGeometryType } from "../../ArcGisFeature/ArcGisFeatureQuery";
import { ArcGisSymbologyRenderer } from "../../ArcGisFeature/ArcGisSymbologyRenderer";
import { EsriRenderer } from "../../ArcGisFeature/EsriSymbology";
import { ArcGisFeatureProvider } from "../../map-layers-formats";

/**
* @internal
*/
export class TestUtils {

  public static createSymbologyRenderer(geometryType: ArcGisFeatureGeometryType, rendererDef: any) {
    const defaultSymbol = ArcGisFeatureProvider.getDefaultSymbology(geometryType);
    if (!defaultSymbol) {
      throw new Error ("Could not create default symbology");
    }
    const renderer = EsriRenderer.fromJSON(rendererDef);
    return ArcGisSymbologyRenderer.create(renderer, defaultSymbol);
  }
}
