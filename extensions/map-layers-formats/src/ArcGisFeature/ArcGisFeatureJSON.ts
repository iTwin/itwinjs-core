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

  public constructor(settings: ImageMapLayerSettings, layerMetadata: any) {
    super(settings, layerMetadata);

  }

  public async readAndRender(response: ArcGisResponseData, renderer: ArcGisGeometryRenderer) {
    const responseObj = response.data;
    if (responseObj.geometryType) {
      const geomReader = new ArcGisGeometryReaderJSON(responseObj.geometryType, renderer, renderer.transform === undefined);

      for (const feature of responseObj.features) {
        await geomReader.readGeometry(feature.geometry);
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


    let geomReader: ArcGisGeometryReaderJSON|undefined;
    if (renderer && responseObj?.geometryType) {
      geomReader = new ArcGisGeometryReaderJSON(responseObj.geometryType, renderer)
    }

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

      if (geomReader) {
        await geomReader.readGeometry(feature.geometry);
        subLayerInfo.graphics = renderer!.moveGraphics();
      }

      if (!(layerInfo.subLayerInfos instanceof HTMLElement))
        layerInfo.subLayerInfos.push(subLayerInfo);
    }

    featureInfos.push(layerInfo);
  }
}
