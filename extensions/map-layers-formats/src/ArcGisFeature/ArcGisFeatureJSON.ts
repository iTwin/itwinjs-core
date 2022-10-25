/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module MapLayersFormats
 */

import { PrimitiveValue, PropertyValueFormat, StandardTypeNames } from "@itwin/appui-abstract";
import { ImageMapLayerSettings } from "@itwin/core-common";
import { MapFeatureInfoRecord, MapLayerFeatureInfo, MapSubLayerFeatureInfo } from "@itwin/core-frontend";
import {  Transform } from "@itwin/core-geometry";
import { ArcGisFeatureReader } from "./ArcGisFeatureReader";
import { ArcGisFeatureRenderer } from "./ArcGisFeatureRenderer";
import { ArcGisFieldType, ArcGisResponseData } from "./ArcGisFeatureResponse";

/** @internal */
export class ArcGisFeatureJSON  extends ArcGisFeatureReader {
  public transform: Transform|undefined;

  public constructor(settings: ImageMapLayerSettings, layerMetadata: any) {
    super(settings, layerMetadata);
  }

  public readAndRender(response: ArcGisResponseData, renderer: ArcGisFeatureRenderer) {
    const responseObj = response.data;

    if (responseObj?.geometryType === "esriGeometryPolyline" || responseObj?.geometryType === "esriGeometryPolygon") {
      const fill = (responseObj.geometryType === "esriGeometryPolygon");
      for (const feature of responseObj.features) {
        let offset = 0;
        const lengths: number[] = [];
        const coords: number[] = [];

        if (feature?.geometry?.rings) {
          for (const ring of feature?.geometry?.rings) {
            offset = ArcGisFeatureJSON.deflateCoordinates(ring, coords, 2, offset);
            lengths.push(ring.length);
          }
        } else if (feature?.geometry?.paths) {
          for (const path of feature?.geometry?.paths) {
            offset = ArcGisFeatureJSON.deflateCoordinates(path, coords, 2, offset);
            lengths.push(path.length);
          }
        }
        renderer.renderPath(lengths, coords, fill, 2, renderer.transform === undefined);

      }
    } else if (responseObj?.geometryType === "esriGeometryPoint" || responseObj?.geometryType === "esriGeometryMultiPoint") {
      for (const feature of responseObj.features) {
        // TODO: Add support for multipoint
        if (feature.geometry) {
          const lengths: number[] = [];
          const coords: number[] = [feature.geometry.x, feature.geometry.y];
          renderer.renderPoint(lengths, coords, 2, renderer.transform === undefined);
        }
      }
    }
  }

  // Converts an [[x1,y1], [x2,y2], ...] to [x1,y1,x2,y2, ...]
  // stride is the number of dimensions
  // https://github.com/openlayers/openlayers/blob/7a2f87caca9ddc1912d910f56eb5637445fc11f6/src/ol/geom/flat/deflate.js#L26
  protected static deflateCoordinates( coordinates: number[][], flatCoordinates: number[], stride: number, offset: number) {
    for (let i = 0, ii = coordinates.length; i < ii; ++i) {
      const coordinate = coordinates[i];
      for (let j = 0; j < stride; ++j)
        flatCoordinates[offset++] = coordinate[j];
    }

    return offset;
  }

  public readFeatureInfo(response: ArcGisResponseData, featureInfos: MapLayerFeatureInfo[]) {
    const responseObj = response.data;
    if (responseObj === undefined || !Array.isArray(responseObj.features))
      return;

    const layerInfo: MapLayerFeatureInfo = {layerName: this._settings.name};

    // Create a signature index for every field name / type.
    const fieldsType: {[key: string]: ArcGisFieldType} = {};
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

      return new MapFeatureInfoRecord (propertyValue, {name: fieldName, displayLabel: fieldName,  typename});
    };

    for (const feature of responseObj.features) {
      const subLayerInfo: MapSubLayerFeatureInfo = {
        subLayerName: this._layerMetadata.name,
        displayFieldName: this._layerMetadata.name,
        records : [],
      };

      for (const [key, value] of Object.entries(feature.attributes))
        subLayerInfo.records?.push(getRecordInfo(key,value));

      if (layerInfo.info === undefined)
        layerInfo.info = [];

      if (!(layerInfo.info instanceof HTMLElement))
        layerInfo.info.push(subLayerInfo);
    }

    featureInfos.push(layerInfo);
  }
}
