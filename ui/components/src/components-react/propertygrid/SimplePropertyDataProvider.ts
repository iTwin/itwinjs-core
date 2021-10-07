/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module PropertyGrid
 */

import { PropertyRecord } from "@itwin/appui-abstract";
import { IPropertyDataProvider, PropertyCategory, PropertyData, PropertyDataChangeEvent } from "./PropertyDataProvider";

/**
 * Implementation of [IPropertyDataProvider] that uses an associative array.
 * @public
 */
export class SimplePropertyDataProvider implements IPropertyDataProvider, PropertyData {
  public label: PropertyRecord = PropertyRecord.fromString("");
  public description?: string;
  public categories: PropertyCategory[] = [];
  public records: { [categoryName: string]: PropertyRecord[] } = {};
  public onDataChanged = new PropertyDataChangeEvent();

  public addCategory(category: PropertyCategory): number {
    const categoryIdx = this.categories.push(category) - 1;
    this.records[this.categories[categoryIdx].name] = [];
    this.onDataChanged.raiseEvent();
    return categoryIdx;
  }

  public findCategoryIndex(category: PropertyCategory): number {
    const index = this.categories.findIndex((testCategory: PropertyCategory) => {
      return testCategory.name === category.name;
    });
    return index;
  }

  public addProperty(propertyRecord: PropertyRecord, categoryIdx: number): void {
    this.records[this.categories[categoryIdx].name].push(propertyRecord);
    this.onDataChanged.raiseEvent();
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
