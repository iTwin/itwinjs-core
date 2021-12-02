/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module PropertyGrid
 */

import { PrimitiveValue, PropertyDescription, PropertyRecord, PropertyValueFormat, StandardTypeNames } from "@itwin/appui-abstract";
import { IPropertyDataProvider, PropertyCategory, PropertyData, PropertyDataChangeEvent } from "@itwin/components-react";
import { MapLayerFeatureInfo } from "@itwin/core-common";
import { HitDetail } from "@itwin/core-frontend";
import { IdentifyHitEvent, MapLayersUI } from "../../mapLayers";
// import { IPropertyDataProvider, PropertyCategory, PropertyData, PropertyDataChangeEvent } from ""

class FeatureInfoRecord extends PropertyRecord {
  constructor(name: string, value: any, typename: string = StandardTypeNames.String) {
    const v = {
      valueFormat: PropertyValueFormat.Primitive,
      value,
      displayValue: value.toString(),
    } as PrimitiveValue;
    const p = {
      name,
      displayLabel: name,
      typename,
    } as PropertyDescription;
    super(v, p);

    this.description = `${name} - description`;
    this.isReadonly = false;
  }
}

/**
 * Implementation of [IPropertyDataProvider] that uses an associative array.
 * @public
 */
export class FeatureInfoDataProvider implements IPropertyDataProvider, PropertyData {
  public label: PropertyRecord = PropertyRecord.fromString("");
  public description?: string;
  public categories: PropertyCategory[] = [];
  public records: { [categoryName: string]: PropertyRecord[] } = {};
  public onDataChanged = new PropertyDataChangeEvent();
  constructor() {

    // eslint-disable-next-line @typescript-eslint/unbound-method
    MapLayersUI.onIdentifyHit?.addListener(this.handleIdentifyHit, this);
  }

  private async handleIdentifyHit(identifyHit: HitDetail)  {
    if (identifyHit?.isMapHit) {
      this.records = {};
      this.categories = [];
      const info = await identifyHit.viewport.getFeatureInfo(identifyHit);
      if (info !== undefined ) {
        for (const curInfo of info) {
          const layerCategory: PropertyCategory = {name:curInfo.layerName, label:curInfo.layerName, expand:true, childCategories:[]};
          if (curInfo.subLayerInfo) {

            for (const infoResult of curInfo.subLayerInfo) {
              const catIdx = this.findCategoryIndexByName(infoResult.subLayerName);
              if (catIdx === -1) {
                const subLayerCategory = {name:infoResult.subLayerName, label:infoResult.subLayerName, expand:true};
                this.addSubCategory(subLayerCategory.name);
                layerCategory.childCategories?.push(subLayerCategory);

                if (infoResult.attributes) {
                  for (const [key, value] of Object.entries(infoResult.attributes)) {
                    this.addProperty(new FeatureInfoRecord(key, value), subLayerCategory.name);
                  }
                }
              }
            }
          }
          this.addCategory(layerCategory);
        }
      }
      this.onDataChanged.raiseEvent();
    }
  }

  public addSubCategory(categoryName: string) {
    this.records[categoryName] = [];
    // this.onDataChanged.raiseEvent();
  }
  public addCategory(category: PropertyCategory): number {
    const categoryIdx = this.categories.push(category) - 1;
    this.records[this.categories[categoryIdx].name] = [];
    // this.onDataChanged.raiseEvent();
    return categoryIdx;
  }

  public findCategoryIndex(category: PropertyCategory): number {
    const index = this.categories.findIndex((testCategory: PropertyCategory) => {
      return testCategory.name === category.name;
    });
    return index;
  }
  public findCategoryIndexByName(name: string): number {
    const index = this.categories.findIndex((testCategory: PropertyCategory) => {
      return testCategory.name === name;
    });
    return index;
  }

  public addProperty(propertyRecord: PropertyRecord, categoryName: string): void {
    this.records[categoryName].push(propertyRecord);
    // this.onDataChanged.raiseEvent();
  }

  public removeProperty(propertyRecord: PropertyRecord, categoryIdx: number): boolean {
    const index = this.records[this.categories[categoryIdx].name].findIndex((record: PropertyRecord) => {
      return record === propertyRecord;
    });

    let result = false;

    // istanbul ignore else
    if (index >= 0) {
      this.records[this.categories[categoryIdx].name].splice(index, 1);
      this.onDataChanged.raiseEvent();
      result = true;
    }
    return result;
  }

  public replaceProperty(propertyRecord: PropertyRecord, categoryIdx: number, newRecord: PropertyRecord): boolean {
    const index = this.records[this.categories[categoryIdx].name].findIndex((record: PropertyRecord) => {
      return record === propertyRecord;
    });

    let result = false;

    // istanbul ignore else
    if (index >= 0) {
      this.records[this.categories[categoryIdx].name].splice(index, 1, newRecord);
      result = true;
    }
    return result;
  }

  public async getData(): Promise<PropertyData> {
    return this;
  }
}
