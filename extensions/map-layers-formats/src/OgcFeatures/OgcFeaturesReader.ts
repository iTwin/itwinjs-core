/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Transform } from "@itwin/core-geometry";
import { GeoJSONGeometryReader } from "../GeoJSON/GeoJSONGeometryReader";
import * as Geojson from "geojson";
import { PrimitiveValue, PropertyValueFormat, StandardTypeNames } from "@itwin/appui-abstract";
import { ImageMapLayerSettings } from "@itwin/core-common";
import { FeatureInfoReader } from "../Feature/FeatureInfoReader";
import { FeatureAttributeDrivenSymbology, FeatureGeometryRenderer, GraphicPrimitive, GraphicsGeometryRenderer, MapLayerFeature, MapLayerFeatureAttribute, MapLayerFeatureInfo, MapSubLayerFeatureInfo } from "@itwin/core-frontend";

export type OgcFeaturePropertyType = "string" | "number" | "integer" | "datetime" | "geometry" | "boolean";

export interface ReadOgcFeaturesInfoOptions {
  collection: Geojson.FeatureCollection;
  layerSettings: ImageMapLayerSettings;
  queryables?: any;
  geomRenderer?: GraphicsGeometryRenderer;
}

/** @internal */
export class OgcFeaturesReader extends FeatureInfoReader  {
  public transform: Transform | undefined;

  public constructor() {
    super();
  }

  private applySymbologyAttributes(attrSymbology: FeatureAttributeDrivenSymbology, feature: any) {
    if (attrSymbology && feature) {
      const symbolFields = attrSymbology.rendererFields;
      if (symbolFields && symbolFields.length > 0 && feature.properties) {
        const featureAttr: {[key: string]: any} = {};
        for (const [attrKey, attrValue] of Object.entries(feature.properties))
          if (symbolFields.includes(attrKey)) {
            featureAttr[attrKey] = attrValue;
          }
        attrSymbology.setActiveFeatureAttributes(featureAttr);
      }
    }
  }

  public async readAndRender(data: Geojson.FeatureCollection, renderer: FeatureGeometryRenderer) {
    const responseObj = data;
    if (responseObj.type === "FeatureCollection") {

      const geomReader = new GeoJSONGeometryReader(renderer);

      for (const feature of responseObj.features) {
        // Each feature has potentially a different geometry type, so we need to inform the geometry renderer
        if (renderer.hasSymbologyRenderer()) {
          renderer.symbolRenderer.activeGeometryType = feature.geometry.type;
          // Read attributes if needed (attribute driven symbology)
          if (renderer.symbolRenderer.isAttributeDriven()) {
            this.applySymbologyAttributes(renderer.symbolRenderer, feature);
          }
        }

        await geomReader.readGeometry(feature.geometry);
      }
    }
  }

  public async readFeatureInfo(opts: ReadOgcFeaturesInfoOptions, featureInfos: MapLayerFeatureInfo[]) {
    if (!Array.isArray(opts.collection.features))
      return;

    const layerInfo: MapLayerFeatureInfo = { layerName: opts.layerSettings.name };

    // Create a signature index for every field name / type.
    let fieldsType: { [key: string]: OgcFeaturePropertyType } | undefined;
    if (Array.isArray(opts.queryables?.properties)) {
      fieldsType = {};
      for (const fieldInfo of opts.queryables) {
        fieldsType[fieldInfo.name] = fieldInfo.type;
      }
    }

    const getStandardTypeName = (fieldType: OgcFeaturePropertyType) => {
      switch (fieldType) {
        case "number":
          return StandardTypeNames.Double;
        case "integer":
          return StandardTypeNames.Integer;
        case "boolean":
          return StandardTypeNames.Boolean;
        case "datetime":
          return StandardTypeNames.DateTime;
        default:
          return StandardTypeNames.String;
      }
    };

    const getRecordInfo = (fieldName: string, value: any): MapLayerFeatureAttribute => {
      let typename = StandardTypeNames.String;
      const propertyValue: PrimitiveValue = {valueFormat: PropertyValueFormat.Primitive};

      if (value === null) {
        value = undefined;
      }

      const strValue = `${value}`;
      if (fieldsType) {
        const fieldType = fieldsType[fieldName];
        switch (fieldType) {
          case "integer":
            propertyValue.value = value as number;
            break;
          case "number":
            propertyValue.value = this.toFixedWithoutPadding(value);
            break;
          case "datetime":
            propertyValue.value = new Date(value);
            break;
          default:
            if (value !== undefined)
              propertyValue.value = strValue;
            break;
        }
        typename = getStandardTypeName(fieldType);
        propertyValue.displayValue = this.getDisplayValue(typename, propertyValue.value);
      } else {
        // Queryables are optional with OGC Features, in this case everything is string.
        propertyValue.value = strValue;
        propertyValue.displayValue = strValue;
      }

      return {value: propertyValue, property: { name: fieldName, displayLabel: fieldName, typename }};
    };

    let geomReader: GeoJSONGeometryReader|undefined;
    if (opts.geomRenderer) {
      geomReader = new GeoJSONGeometryReader(opts.geomRenderer);
    }

    // Each feature response represent a single sub-layer, no need to check for existing entry.
    const subLayerInfo: MapSubLayerFeatureInfo = {
      subLayerName: opts.layerSettings.name,
      displayFieldName: opts.layerSettings.name,
      features: [],
    };

    // Read all features attributes / geometries
    for (const responseFeature of opts.collection.features) {
      const feature: MapLayerFeature = {attributes: []};

      if (responseFeature.properties) {
        for (const [key, value] of Object.entries(responseFeature.properties))
          feature.attributes?.push(getRecordInfo(key, value));
      }

      if (geomReader) {
        await geomReader.readGeometry(responseFeature.geometry as any);
        const graphics = opts.geomRenderer.moveGraphics();
        feature.geometries = graphics.map((graphic: GraphicPrimitive) => {
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
