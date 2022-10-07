/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { ArcGisFeatureRenderer } from "./ArcGisFeatureRenderer";
import { esriPBuffer } from "../ArcGisFeature/esriPBuffer.gen";
import { MapFeatureInfoRecord, MapLayerFeatureInfo, MapSubLayerFeatureInfo } from "@itwin/core-frontend";
import { PrimitiveValue, PropertyValueFormat, StandardTypeNames } from "@itwin/appui-abstract";
import { ImageMapLayerSettings } from "@itwin/core-common";
import { ArcGisFeatureReader } from "./ArcGisFeatureReader";
import { ArcGisResponseData } from "./ArcGisFeatureResponse";
import { assert, Logger } from "@itwin/core-bentley";
import { ArcGisFeatureGeometryType } from "./ArcGisFeatureQuery";

const esriGeometryType = esriPBuffer.FeatureCollectionPBuffer.GeometryType;
const loggerCategory =  "MapLayersFormats.ArcGISFeature";

export class ArcGisFeaturePBF extends ArcGisFeatureReader {

  public constructor(settings: ImageMapLayerSettings, layerMetadata: any) {
    super(settings, layerMetadata);
  }

  public static getArcGisFeatureGeometryType(geomType: esriPBuffer.FeatureCollectionPBuffer.GeometryType): ArcGisFeatureGeometryType  {
    switch (geomType) {
      case esriPBuffer.FeatureCollectionPBuffer.GeometryType.esriGeometryTypeMultipatch:
        return "esriGeometryMultiPatch";
      case esriPBuffer.FeatureCollectionPBuffer.GeometryType.esriGeometryTypeMultipoint:
        return "esriGeometryMultipoint";
      case esriPBuffer.FeatureCollectionPBuffer.GeometryType.esriGeometryTypePoint:
        return "esriGeometryPoint";
      case esriPBuffer.FeatureCollectionPBuffer.GeometryType.esriGeometryTypePolygon:
        return "esriGeometryPolygon";
      case esriPBuffer.FeatureCollectionPBuffer.GeometryType.esriGeometryTypePolyline:
        return "esriGeometryPolyline";
      default:
        return "esriGeometryNull";
    }
  }
  public readAndRender(response: ArcGisResponseData, renderer: ArcGisFeatureRenderer) {
    if (!(response.data instanceof esriPBuffer.FeatureCollectionPBuffer)) {
      const msg = "Response was not in PBF format";
      assert(!msg);
      Logger.logError(loggerCategory, msg);
    }
    const collection = response.data as esriPBuffer.FeatureCollectionPBuffer;
    if (!collection.has_queryResult || !collection.queryResult.has_featureResult || collection?.queryResult?.featureResult?.features === undefined)
      return;

    const geomType = collection.queryResult.featureResult.geometryType;
    const stride = (collection.queryResult.featureResult.hasM || collection.queryResult.featureResult.hasZ) ? 3 : 2;

    // console.log(`Nb Feature: ${collection.queryResult.featureResult.features.length}`);
    if (geomType === esriGeometryType.esriGeometryTypePoint ||
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

  public readFeatureInfo(response: ArcGisResponseData, featureInfos: MapLayerFeatureInfo[]) {
    if (!(response.data instanceof esriPBuffer.FeatureCollectionPBuffer)) {
      const msg = "Response was not in PBF format";
      assert(!msg);
      Logger.logError(loggerCategory, msg);
    }
    const collection = response.data as esriPBuffer.FeatureCollectionPBuffer;
    if (!collection.has_queryResult || !collection.queryResult.has_featureResult || collection?.queryResult?.featureResult?.features === undefined)
      return;

    const layerInfo: MapLayerFeatureInfo = { layerName: this._settings.name, info: [] };

    // Fields metadata is stored outside feature results, create dedicated array first
    const fields: string[] = [];
    for (const field of collection.queryResult.featureResult.fields) {
      fields.push(field.name);
    }

    const getRecordInfo = (fieldName: string, attrValue: esriPBuffer.FeatureCollectionPBuffer.Value) => {
      const propertyValue: PrimitiveValue = { valueFormat: PropertyValueFormat.Primitive };

      let strValue;
      let typename = StandardTypeNames.String;
      if (attrValue.has_bool_value) {
        strValue = `${attrValue.bool_value}`;
        propertyValue.value = attrValue.bool_value;
        typename = StandardTypeNames.Bool;
      } else if (attrValue.has_double_value) {
        const value = this.toFixedWithoutPadding(attrValue.double_value);
        strValue = `${value}`;
        propertyValue.value = value;
        typename = StandardTypeNames.Double;
      } else if (attrValue.has_float_value) {
        const value = this.toFixedWithoutPadding(attrValue.float_value);
        strValue = `${value}`;
        propertyValue.value = value;
        typename = StandardTypeNames.Float;
      } else if (attrValue.has_int64_value) {
        strValue = `${attrValue.int64_value}`;
        propertyValue.value = attrValue.int64_value;
        typename = StandardTypeNames.Integer;
      } else if (attrValue.has_sint64_value) {
        strValue = `${attrValue.sint64_value}`;
        propertyValue.value = attrValue.sint64_value;
        typename = StandardTypeNames.Integer;
      } else if (attrValue.has_sint_value) {
        strValue = `${attrValue.sint_value}`;
        propertyValue.value = attrValue.sint_value;
        typename = StandardTypeNames.Integer;
      } else if (attrValue.has_string_value) {
        strValue = `${attrValue.string_value}`;
        propertyValue.value = attrValue.string_value;
        typename = StandardTypeNames.String;
      } else if (attrValue.has_uint64_value) {
        strValue = `${attrValue.uint64_value}`;
        propertyValue.value = attrValue.uint64_value;
        typename = StandardTypeNames.Integer;
      } else if (attrValue.has_uint_value) {
        strValue = `${attrValue.uint_value}`;
        propertyValue.value = attrValue.uint_value;
        typename = StandardTypeNames.Integer;
      } else {
        Logger.logError(loggerCategory, `Could not read value for field ${fieldName}`);
        return undefined;
      }

      propertyValue.displayValue = strValue;

      return new MapFeatureInfoRecord(propertyValue, { name: fieldName, displayLabel: fieldName, typename });
    };

    // Read feature values
    for (const feature of collection.queryResult.featureResult.features) {
      const subLayerInfo: MapSubLayerFeatureInfo = {
        subLayerName: this._layerMetadata.name,
        displayFieldName: this._layerMetadata.name,
        records: [],
      };
      let i = 0;

      for (const attrValue of feature.attributes) {
        if (i > fields.length) {
          Logger.logError(loggerCategory, "Error while read feature info data: fields metadata missing");
          break;
        }
        // Convert everything to string for now
        const info = getRecordInfo(fields[i], attrValue);
        if (info) {
          subLayerInfo.records?.push(info);
        }

        i++;
      }
      if (layerInfo.info === undefined) {
        layerInfo.info = [];
      }
      if (!(layerInfo.info instanceof HTMLElement)) {
        layerInfo.info.push(subLayerInfo);
      }
    }

    featureInfos.push(layerInfo);

  }
}
