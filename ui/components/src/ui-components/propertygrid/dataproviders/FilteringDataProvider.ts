/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module PropertyGrid
 */

import { PropertyRecord, PropertyValue, PropertyValueFormat } from "@bentley/ui-abstract";
import { CategoryRecordsDict } from "../internal/flat-items/MutableGridCategory";
import { IPropertyDataProvider, PropertyCategory, PropertyData, PropertyDataChangeEvent } from "../PropertyDataProvider";
import { IPropertyDataFilterer } from "./filterers/PropertyDataFiltererBase";

/** @internal */
interface FilteredRecords {
  filteredRecords: PropertyRecord[];
  shouldExpandNodeParents: boolean;
}

/**
 * IPropertyDataProvider implementation which will filter wrapped provider PropertyData using passed IPropertyDataFilterer.
 * @alpha
 */
export class FilteringPropertyDataProvider implements IPropertyDataProvider {
  public onDataChanged = new PropertyDataChangeEvent();

  public constructor(private _dataProvider: IPropertyDataProvider, private _filterer: IPropertyDataFilterer) {
    this._filterer.onFilterChanged.addListener(() => this.onDataChanged.raiseEvent());
    this._dataProvider.onDataChanged.addListener(() => this.onDataChanged.raiseEvent());
  }

  public async getData(): Promise<PropertyData> {
    const propertyData = await this._dataProvider.getData();
    return (this._filterer.isActive) ? this.filterPropertyData(propertyData) : propertyData;
  }

  private async filterPropertyData(propertyData: PropertyData) {
    const { categories, records, label, description } = { ...propertyData };
    const { filteredCategories, filteredRecords } = await this.matchHierarchy(categories, records);
    return {
      label,
      description,
      categories: filteredCategories,
      records: filteredRecords,
      reusePropertyDataState: false,
    };
  }

  private async matchHierarchy(categories: PropertyCategory[], records: CategoryRecordsDict, newRecords?: CategoryRecordsDict) {
    const newCategories: PropertyCategory[] = [];
    newRecords = newRecords ?? {};

    for (const category of categories) {
      const childRecords = records[category.name] ?? [];
      const { filteredRecords } = await this.matchRecordHierarchy(childRecords, []);

      const childCategories = category.childCategories ?? [];
      const { filteredCategories } = await this.matchHierarchy(childCategories, records, newRecords);

      if (filteredRecords.length !== 0 || filteredCategories.length !== 0) {
        const newCategory = this.copyPropertyCategory(category, filteredCategories);
        newRecords[newCategory.name] = filteredRecords;
        newCategories.push(newCategory);
      }
    };

    return { filteredCategories: newCategories, filteredRecords: newRecords };
  }

  private async matchRecordHierarchy(records: PropertyRecord[], parents: PropertyRecord[], forceIncludeItem: boolean = false): Promise<FilteredRecords> {
    const newMatchedRecords: PropertyRecord[] = [];
    let expandParent = false; // property passed back to parent to indicate whether it should be expanded

    for (const record of records) {
      const matchInfo = await this._filterer.matchesFilter(record, parents);
      const shouldForceIncludeDescendants = forceIncludeItem || matchInfo.shouldForceIncludeDescendants;
      const { filteredRecords: filteredChildren, shouldExpandNodeParents } = await this.matchRecordHierarchy(record.getChildrenRecords(), [...parents, record], shouldForceIncludeDescendants);

      // if child hierarchy indicates parents should be expanded, then it should be passed back up to the top parent
      expandParent = expandParent || shouldExpandNodeParents;

      let newRecord: PropertyRecord | undefined;
      if (matchInfo.matchesFilter) {
        // Item is included if it matches filter
        // If at least one matched record from records list needs its parent expanded,
        // then `expandParent` should be set to true
        expandParent = expandParent || !!matchInfo.shouldExpandNodeParents;
        newRecord = this.copyPropertyRecord(record, filteredChildren, shouldExpandNodeParents);
      } else if (filteredChildren.length !== 0 || forceIncludeItem) {
        // Item is also included if it has at least one matched child or is forcefully included by its parent
        newRecord = this.copyPropertyRecord(record, filteredChildren, shouldExpandNodeParents);
      }

      if (newRecord)
        newMatchedRecords.push(newRecord);
    }

    return { filteredRecords: newMatchedRecords, shouldExpandNodeParents: expandParent };
  }

  private copyPropertyCategory(propertyCategory: PropertyCategory, newChildren: PropertyCategory[]) {
    const newCategory = {
      ...propertyCategory,
      childCategories: newChildren,
      expand: true,
    };
    newChildren.forEach((child) => child.parentCategory = newCategory);
    return newCategory;
  }

  private copyPropertyRecord(record: PropertyRecord, newChildren: PropertyRecord[], autoExpand: boolean) {
    const r = record.copyWithNewValue(this.createNewPropertyValue(record.value, newChildren));
    r.autoExpand = autoExpand;
    return r;
  }

  private createNewPropertyValue(value: PropertyValue, newChildren: PropertyRecord[]): PropertyValue {
    switch (value.valueFormat) {
      case PropertyValueFormat.Primitive:
        return { ...value };
      case PropertyValueFormat.Array:
        return {
          valueFormat: PropertyValueFormat.Array,
          itemsTypeName: value.itemsTypeName,
          items: newChildren,
        };
      case PropertyValueFormat.Struct:
        const members: { [name: string]: PropertyRecord } = {};
        newChildren.forEach((child) => members[child.property.name] = child);
        return {
          valueFormat: PropertyValueFormat.Struct,
          members,
        };
    }
  }
}
