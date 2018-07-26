/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module PropertyGrid */

import { PropertyRecord } from "../properties";
import { PropertyDataProvider, PropertyData, PropertyCategory, PropertyDataChangeEvent } from "./PropertyDataProvider";

/**
 * Implementation of [PropertyDataProvider] that uses an associative array.
 */
export class SimplePropertyDataProvider implements PropertyDataProvider, PropertyData {
  public label: string = "";
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

  public addProperty(propertyRecord: PropertyRecord, categoryIdx: number): void {
    this.records[this.categories[categoryIdx].name].push(propertyRecord);
    this.onDataChanged.raiseEvent();
  }

  public getData(): Promise<PropertyData> {
    return Promise.resolve(this);
  }
}
