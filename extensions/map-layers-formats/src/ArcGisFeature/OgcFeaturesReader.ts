/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { ImageMapLayerSettings } from "@itwin/core-common";
import { FeatureGeometryRenderer, FeatureGraphicsRenderer, MapLayerFeatureInfo} from "@itwin/core-frontend";
import { Transform } from "@itwin/core-geometry";
import { ArcGisBaseFeatureReader } from "./ArcGisFeatureReader";
import { ArcGisResponseData } from "./ArcGisFeatureResponse";
import { GeoJSONGeometryReader } from "../GeoJSON/GeoJSONGeometryReader";

/** @internal */
export class OgcFeaturesReader extends ArcGisBaseFeatureReader {
  public transform: Transform | undefined;

  public constructor(settings: ImageMapLayerSettings) {
    super(settings, undefined);

  }

  // private applySymbologyAttributes(attrSymbology: FeatureAttributeDrivenSymbology, feature: any) {
  //   if (attrSymbology && feature) {
  //     const symbolFields = attrSymbology.rendererFields;
  //     if (symbolFields && symbolFields.length > 0 && feature.attributes) {
  //       const featureAttr: {[key: string]: any} = {};
  //       for (const [attrKey, attrValue] of Object.entries(feature.attributes))
  //         if (symbolFields.includes(attrKey)) {
  //           featureAttr[attrKey] = attrValue;
  //         }
  //       attrSymbology.setActiveFeatureAttributes(featureAttr);
  //     }
  //   }
  // }

  public async readAndRender(data: any, renderer: FeatureGeometryRenderer) {
    const responseObj = data;
    if (responseObj.type === "FeatureCollection") {
      // const attrSymbology = renderer.attributeSymbology;

      const geomReader = new GeoJSONGeometryReader(renderer);

      for (const feature of responseObj.features) {
        // if (attrSymbology) {
        //   // Read attributes if needed (attribute driven symbology)
        //   this.applySymbologyAttributes(attrSymbology, feature);
        // }

        // Each feature has potentially a different geometry type, so we need to inform the geometry renderer
        if (renderer.hasSymbologyRenderer())
          renderer.symbolRenderer.activeGeometryType = feature.geometry.type;
        await geomReader.readGeometry(feature.geometry);
      }
    }
  }

  public async readFeatureInfo(_response: ArcGisResponseData, _featureInfos: MapLayerFeatureInfo[], _renderer?: FeatureGraphicsRenderer) {

    // TODO
    return;
  }

  // public async readFeatureInfo(response: ArcGisResponseData, featureInfos: MapLayerFeatureInfo[], renderer?: FeatureGraphicsRenderer) {
  //   const responseObj = response.data;
  //   if (responseObj === undefined || !Array.isArray(responseObj.features))
  //     return;

  //   const layerInfo: MapLayerFeatureInfo = { layerName: this._settings.name };

  //   // Create a signature index for every field name / type.
  //   const fieldsType: { [key: string]: ArcGisFieldType } = {};
  //   for (const fieldInfo of responseObj.fields) {
  //     fieldsType[fieldInfo.name] = fieldInfo.type;
  //   }

  //   const getStandardTypeName = (fieldType: ArcGisFieldType) => {
  //     switch (fieldType) {
  //       case "esriFieldTypeInteger":
  //       case "esriFieldTypeSmallInteger":
  //       case "esriFieldTypeOID":
  //         return StandardTypeNames.Integer;
  //       case "esriFieldTypeDouble":
  //         return StandardTypeNames.Double;
  //       case "esriFieldTypeSingle":
  //         return StandardTypeNames.Float;
  //       case "esriFieldTypeDate":
  //         return StandardTypeNames.DateTime;
  //       default:
  //         return StandardTypeNames.String;
  //     }
  //   };

  //   const getRecordInfo = (fieldName: string, value: any): MapLayerFeatureAttribute => {
  //     const propertyValue: PrimitiveValue = {valueFormat: PropertyValueFormat.Primitive};

  //     if (value === null) {
  //       value = undefined;
  //     }

  //     const strValue = `${value}`;
  //     const fieldType = fieldsType[fieldName];
  //     switch (fieldType) {
  //       case "esriFieldTypeInteger":
  //       case "esriFieldTypeSmallInteger":
  //       case "esriFieldTypeOID":
  //         propertyValue.value = value as number;
  //         break;
  //       case "esriFieldTypeDouble":
  //       case "esriFieldTypeSingle":
  //         propertyValue.value = this.toFixedWithoutPadding(value);
  //         break;
  //       case "esriFieldTypeDate":
  //         propertyValue.value = new Date(value);
  //         break;
  //       default:
  //         if (value !== undefined)
  //           propertyValue.value = strValue;

  //         break;
  //     }

  //     const typename = getStandardTypeName(fieldType);
  //     propertyValue.displayValue = this.getDisplayValue(typename, propertyValue.value);

  //     return {value: propertyValue, property: { name: fieldName, displayLabel: fieldName, typename }};
  //   };

  //   let geomReader: ArcGisGeometryReaderJSON|undefined;
  //   if (renderer && responseObj?.geometryType) {
  //     geomReader = new ArcGisGeometryReaderJSON(responseObj.geometryType, renderer);
  //   }

  //   // Each feature response represent a single sub-layer, no need to check for existing entry.
  //   const subLayerInfo: MapSubLayerFeatureInfo = {
  //     subLayerName: this._layerMetadata.name,
  //     displayFieldName: this._layerMetadata.name,
  //     features: [],
  //   };

  //   // Read all features attributes / geometries
  //   for (const responseFeature of responseObj.features) {
  //     const feature: MapLayerFeature = {attributes: []};

  //     for (const [key, value] of Object.entries(responseFeature.attributes))
  //       feature.attributes?.push(getRecordInfo(key, value));

  //     if (geomReader) {
  //       await geomReader.readGeometry(responseFeature.geometry);
  //       const graphics = renderer!.moveGraphics();
  //       feature.geometries = graphics.map((graphic) => {
  //         return {graphic};
  //       });
  //     }
  //     subLayerInfo.features.push(feature);
  //   }

  //   if (layerInfo.subLayerInfos === undefined)
  //     layerInfo.subLayerInfos = [];
  //   layerInfo.subLayerInfos.push(subLayerInfo);

  //   featureInfos.push(layerInfo);
  // }
}
