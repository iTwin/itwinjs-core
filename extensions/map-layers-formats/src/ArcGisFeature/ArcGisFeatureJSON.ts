/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { PrimitiveValue, PropertyValueFormat, StandardTypeNames } from "@itwin/appui-abstract";
import { ImageMapLayerSettings } from "@itwin/core-common";
import { MapFeatureInfoRecord, MapLayerFeatureInfo, MapSubLayerFeatureInfo } from "@itwin/core-frontend";
import { Transform } from "@itwin/core-geometry";
import { ArcGisFeatureReader } from "./ArcGisFeatureReader";
import { ArcGisFieldType, ArcGisResponseData } from "./ArcGisFeatureResponse";
import { ArcGisGraphicsRenderer } from "./ArcGisGraphicsRenderer";
import { ArcGisGeometryReaderJSON } from "./ArcGisGeometryReaderJSON";
import { ArcGisGeometryRenderer } from "./ArcGisGeometryRenderer";

/** @internal */
export class ArcGisFeatureJSON extends ArcGisFeatureReader {
  public transform: Transform | undefined;
  private _geomReader = new ArcGisGeometryReaderJSON();

  public constructor(settings: ImageMapLayerSettings, layerMetadata: any) {
    super(settings, layerMetadata);

  }


  public async readAndRender(response: ArcGisResponseData, renderer: ArcGisGeometryRenderer) {
    const responseObj = response.data;

    if (responseObj?.geometryType === "esriGeometryPolyline" || responseObj?.geometryType === "esriGeometryPolygon") {
      const fill = (responseObj.geometryType === "esriGeometryPolygon");
      for (const feature of responseObj.features) {
        await this._geomReader.readRingsAndPaths(feature.geometry, renderer, fill, renderer.transform === undefined);
      }
    } else if (responseObj?.geometryType === "esriGeometryPoint" || responseObj?.geometryType === "esriGeometryMultiPoint") {
      for (const feature of responseObj.features) {
        // TODO: Add support for multipoint
        await this._geomReader.readPoints(feature.geometry, renderer, renderer.transform === undefined);
      }
    }
  }

  public async readFeatureInfo(response: ArcGisResponseData, featureInfos: MapLayerFeatureInfo[], renderer?: ArcGisGraphicsRenderer) {
    const responseObj = response.data;
    if (responseObj === undefined || !Array.isArray(responseObj.features))
      return;

    const layerInfo: MapLayerFeatureInfo = { layerName: this._settings.name };

    // Create a signature index for every field name / type.
    const fieldsType: { [key: string]: ArcGisFieldType } = {};
    for (const fieldInfo of responseObj.fields) {
      fieldsType[fieldInfo.name] = fieldInfo.type;
    }

    const getStandardTypeName = (fieldType: ArcGisFieldType) => {
      switch (fieldType) {
        case "esriFieldTypeInteger":
        case "esriFieldTypeSmallInteger":
        case "esriFieldTypeOID":
          return StandardTypeNames.Integer;
        case "esriFieldTypeDouble":
          return StandardTypeNames.Double;
        case "esriFieldTypeSingle":
          return StandardTypeNames.Float;
        case "esriFieldTypeDate":
          return StandardTypeNames.DateTime;
        default:
          return StandardTypeNames.String;
      }
    };

    const getRecordInfo = (fieldName: string, value: any) => {
      const propertyValue: PrimitiveValue = {valueFormat: PropertyValueFormat.Primitive};

      if (value === null) {
        value = undefined;
      }

      const strValue = `${value}`;
      const fieldType = fieldsType[fieldName];
      switch (fieldType) {
        case "esriFieldTypeInteger":
        case "esriFieldTypeSmallInteger":
        case "esriFieldTypeOID":
          propertyValue.value = value as number;
          break;
        case "esriFieldTypeDouble":
        case "esriFieldTypeSingle":
          propertyValue.value = this.toFixedWithoutPadding(value);
          break;
        case "esriFieldTypeDate":
          propertyValue.value = new Date(value);
          break;
        default:
          if (value !== undefined)
            propertyValue.value = strValue;

          break;
      }

      const typename = getStandardTypeName(fieldType);
      propertyValue.displayValue = this.getDisplayValue(typename, propertyValue.value);

      return new MapFeatureInfoRecord(propertyValue, { name: fieldName, displayLabel: fieldName, typename });
    };

    const readRingsOrPaths = responseObj?.geometryType === "esriGeometryPolyline" || responseObj?.geometryType === "esriGeometryPolygon";
    const readPoints = responseObj?.geometryType === "esriGeometryPoint" || responseObj?.geometryType === "esriGeometryMultiPoint";
    const fill = (responseObj.geometryType === "esriGeometryPolygon");

    // Read feature values
    for (const feature of responseObj.features) {
      const subLayerInfo: MapSubLayerFeatureInfo = {
        subLayerName: this._layerMetadata.name,
        displayFieldName: this._layerMetadata.name,
        records: [],
      };

      for (const [key, value] of Object.entries(feature.attributes))
        subLayerInfo.records?.push(getRecordInfo(key, value));

      if (layerInfo.subLayerInfos === undefined)
        layerInfo.subLayerInfos = [];

      if (renderer) {
        if (readRingsOrPaths) {
          await this._geomReader.readRingsAndPaths(feature.geometry, renderer, fill, false);
          subLayerInfo.graphics = renderer.moveGraphics();
        } else if (readPoints) {
          await this._geomReader.readPoints(feature.geometry, renderer, false);
          subLayerInfo.graphics = renderer.moveGraphics();
        }
      }

      if (!(layerInfo.subLayerInfos instanceof HTMLElement))
        layerInfo.subLayerInfos.push(subLayerInfo);
    }

    featureInfos.push(layerInfo);
  }
}
