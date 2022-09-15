/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { ArcGisFeatureRenderer } from "./ArcGisFeatureRenderer";
import { esriPBuffer } from "../ArcGisFeature/esriPBuffer.gen";

const esriGeometryType = esriPBuffer.FeatureCollectionPBuffer.GeometryType;

export class ArcGisFeaturePBF  {

  public readAndRender(collection: esriPBuffer.FeatureCollectionPBuffer, renderer: ArcGisFeatureRenderer) {
    if (!collection.has_queryResult || !collection.queryResult.has_featureResult || collection?.queryResult?.featureResult?.features === undefined)
      return;

    const geomType = collection.queryResult.featureResult.geometryType;
    const stride = (collection.queryResult.featureResult.hasM  ||  collection.queryResult.featureResult.hasZ) ? 3 : 2;

    // console.log(`Nb Feature: ${collection.queryResult.featureResult.features.length}`);
    if ( geomType === esriGeometryType.esriGeometryTypePoint ||
         geomType === esriGeometryType.esriGeometryTypeMultipoint) {
      for (const feature of collection.queryResult.featureResult.features) {

        renderer.renderPointFeature(feature.geometry.lengths, feature.geometry.coords, stride);
      }
    } else if (
      geomType === esriGeometryType.esriGeometryTypePolyline ||
      geomType === esriGeometryType.esriGeometryTypePolygon) {
      const fill = (geomType === esriGeometryType.esriGeometryTypePolygon);

      for (const feature of collection.queryResult.featureResult.features) {
        if (feature?.has_geometry) {
          renderer.renderPathFeature(feature.geometry.lengths, feature.geometry.coords, fill, stride);
        }
      }
    }
  }
}
