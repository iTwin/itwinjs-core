/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { PrimitiveValue, PropertyValueFormat, StandardTypeNames } from "@itwin/appui-abstract";
import { ImageMapLayerSettings } from "@itwin/core-common";
import { ArcGisAttributeDrivenSymbology, ArcGisGeometryReaderJSON, ArcGisGeometryRenderer, ArcGisGraphicsRenderer, MapLayerFeature, MapLayerFeatureAttribute, MapLayerFeatureInfo, MapSubLayerFeatureInfo} from "@itwin/core-frontend";
import { Transform } from "@itwin/core-geometry";
import { ArcGisBaseFeatureReader } from "./ArcGisFeatureReader";
import { ArcGisFieldType, ArcGisResponseData } from "./ArcGisFeatureResponse";

/** @internal */
export class ArcGisJsonFeatureReader extends ArcGisBaseFeatureReader {
  public transform: Transform | undefined;

  public constructor(settings: ImageMapLayerSettings, layerMetadata: any) {
    super(settings, layerMetadata);

  }

  private applySymbologyAttributes(attrSymbology: ArcGisAttributeDrivenSymbology, feature: any) {
    if (attrSymbology && feature) {
      const symbolFields = attrSymbology.rendererFields;
      if (symbolFields && symbolFields.length > 0 && feature.attributes) {
        const featureAttr: {[key: string]: any} = {};
        for (const [attrKey, attrValue] of Object.entries(feature.attributes))
          if (symbolFields.includes(attrKey)) {
            featureAttr[attrKey] = attrValue;
          }
        attrSymbology.setActiveFeatureAttributes(featureAttr);
      }
    }
  }

  public async readAndRender(response: ArcGisResponseData, renderer: ArcGisGeometryRenderer) {
    const responseObj = response.data;
    if (responseObj.geometryType) {
      const attrSymbology = renderer.attributeSymbology;

      const geomReader = new ArcGisGeometryReaderJSON(responseObj.geometryType, renderer, renderer.transform === undefined);

      for (const feature of responseObj.features) {
        if (attrSymbology) {
          // Read attributes if needed (attribute driven symbology)
          this.applySymbologyAttributes(attrSymbology, feature);
        }

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

    const getRecordInfo = (fieldName: string, value: any): MapLayerFeatureAttribute => {
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

      return {value: propertyValue, property: { name: fieldName, displayLabel: fieldName, typename }};
    };

    let geomReader: ArcGisGeometryReaderJSON|undefined;
    if (renderer && responseObj?.geometryType) {
      geomReader = new ArcGisGeometryReaderJSON(responseObj.geometryType, renderer);
    }

    // Each feature response represent a single sub-layer, no need to check for existing entry.
    const subLayerInfo: MapSubLayerFeatureInfo = {
      subLayerName: this._layerMetadata.name,
      displayFieldName: this._layerMetadata.name,
      features: [],
    };

    // Read all features attributes / geometries
    for (const responseFeature of responseObj.features) {
      const feature: MapLayerFeature = {attributes: []};

      for (const [key, value] of Object.entries(responseFeature.attributes))
        feature.attributes?.push(getRecordInfo(key, value));

      if (geomReader) {
        await geomReader.readGeometry(responseFeature.geometry);
        const graphics = renderer!.moveGraphics();
        feature.geometries = graphics.map((graphic) => {
          return {graphic};
        });
      }
      subLayerInfo.features.push(feature);
    }

    if (layerInfo.subLayerInfos === undefined)
      layerInfo.subLayerInfos = [];
    layerInfo.subLayerInfos.push(subLayerInfo);

    featureInfos.push(layerInfo);
  }
}
