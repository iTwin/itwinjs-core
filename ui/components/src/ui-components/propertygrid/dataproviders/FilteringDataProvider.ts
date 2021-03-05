/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module PropertyGrid
 */
import { IDisposable } from "@bentley/bentleyjs-core";
import { PropertyRecord, PropertyValue, PropertyValueFormat } from "@bentley/ui-abstract";
import { HighlightInfo } from "../../common/HighlightingComponentProps";
import { CategoryRecordsDict } from "../internal/flat-items/MutableGridCategory";
import { IPropertyDataProvider, PropertyCategory, PropertyData, PropertyDataChangeEvent } from "../PropertyDataProvider";
import { FilteredType, IPropertyDataFilterer, PropertyDataFilterResult } from "./filterers/PropertyDataFiltererBase";

interface FilteredRecords {
  filteredRecords: PropertyRecord[];
  shouldExpandNodeParents: boolean;
  matchesCount: number;
  activeMatch?: HighlightInfo;
  filteredResultMatches: { id: string, matchesCount: number }[];
  filteredTypes: FilteredType[];
}

/**
 *  Data returned by [[FilteringPropertyDataProvider]]
 * @beta
 */
export interface FilteredPropertyData extends PropertyData {
  /*
  * Shows how many matches were found when filtering data.
  * Undefined when filterer is not active
  */
  matchesCount?: number;
  /*
  * Function used for getting PropertyRecordMatchInfo by index from all the filtered matches.
  * Undefined when filterer is not active
  */
  getMatchByIndex?: (index: number) => HighlightInfo | undefined;

  filteredTypes?: FilteredType[];
}

/**
 * IPropertyDataProvider implementation which will filter wrapped provider PropertyData using passed IPropertyDataFilterer.
 * @alpha
 */
export class FilteringPropertyDataProvider implements IPropertyDataProvider, IDisposable {
  public onDataChanged = new PropertyDataChangeEvent();
  private _filteredPropertyData: Promise<FilteredPropertyData> | undefined = undefined;
  private _disposeFilterChangedListener: Function;
  private _disposeDataChangedListener: Function;

  public constructor(private _dataProvider: IPropertyDataProvider, private _filterer: IPropertyDataFilterer) {
    this._disposeFilterChangedListener = this._filterer.onFilterChanged.addListener(() => { this._filteredPropertyData = undefined; this.onDataChanged.raiseEvent(); });
    this._disposeDataChangedListener = this._dataProvider.onDataChanged.addListener(() => { this._filteredPropertyData = undefined; this.onDataChanged.raiseEvent(); });
  }

  public dispose(): void {
    this._disposeDataChangedListener();
    this._disposeFilterChangedListener();
  }

  public async getData(): Promise<FilteredPropertyData> {
    if (this._filteredPropertyData) {
      return this._filteredPropertyData;
    }

    this._filteredPropertyData = this._dataProvider.getData().then(async (propertyData) => {
      return ((this._filterer.isActive) ?
        this.filterPropertyData(propertyData) : propertyData);
    });

    return this._filteredPropertyData;
  }

  private async filterPropertyData(propertyData: PropertyData) {
    const { categories, records, label, description } = { ...propertyData };
    const { filteredCategories, filteredRecords, matchesCount, filteredResultMatches, filteredTypes } = await matchHierarchy(this._filterer, categories, records, undefined);

    const uniqueTypes = [...new Set(filteredTypes)];
    const getMatchByIndex = (index: number) => {
      let activeMatch: HighlightInfo | undefined;
      if (index <= 0)
        return undefined;

      let i = 1;
      for (const record of filteredResultMatches) {
        const fullMatchesCount = record.matchesCount;
        if (index < i + fullMatchesCount) {
          activeMatch = {
            highlightedItemIdentifier: record.id,
            highlightIndex: index - i,
          };
          break;
        }

        i += fullMatchesCount;
      }
      return activeMatch;
    };

    return {
      label,
      description,
      categories: filteredCategories,
      records: filteredRecords,
      reusePropertyDataState: false,
      matchesCount,
      getMatchByIndex,
      filteredTypes: uniqueTypes,
    };
  }
}

async function matchHierarchy(filterer: IPropertyDataFilterer, categories: PropertyCategory[], records: CategoryRecordsDict, newRecords?: CategoryRecordsDict, parentMatchInfo?: PropertyDataFilterResult) {
  const newCategories: PropertyCategory[] = [];
  newRecords = newRecords ?? {};
  let matchesCount = 0;
  let allFilteredResultMatches: { id: string, matchesCount: number }[] = [];
  let allFilteredTypes: FilteredType[] = [];

  for (const category of categories) {
    const matchInfo = await filterer.categoryMatchesFilter(category, []);

    if (matchInfo.matchesFilter) {
      allFilteredResultMatches.push({ id: category.name, matchesCount: matchInfo.matchesCount ?? 0 });
      allFilteredTypes = allFilteredTypes.concat(matchInfo.filteredTypes ?? []);
      matchesCount += matchInfo.matchesCount ?? 0;
    }

    const childRecords = records[category.name] ?? [];
    const { filteredRecords, matchesCount: count, filteredResultMatches, filteredTypes } = await matchRecordHierarchy(filterer, childRecords, []);
    allFilteredResultMatches = allFilteredResultMatches.concat(filteredResultMatches);
    allFilteredTypes = allFilteredTypes.concat(filteredTypes);
    matchesCount += count;

    const parentInfo = parentMatchInfo?.matchesFilter ? parentMatchInfo : matchInfo;

    const childCategories = category.childCategories ?? [];
    const { filteredCategories, matchesCount: childCount, filteredResultMatches: childFilteredResultMatches, filteredTypes: childFilteredTypes } = await matchHierarchy(filterer, childCategories, records, newRecords, parentInfo);
    allFilteredResultMatches = allFilteredResultMatches.concat(childFilteredResultMatches);
    allFilteredTypes = allFilteredTypes.concat(childFilteredTypes);
    matchesCount += childCount;

    let expand = !(count === 0 && childCount === 0);
    if (matchInfo.matchesFilter || (parentMatchInfo?.matchesFilter && parentMatchInfo.shouldForceIncludeDescendants)) {
      newRecords[category.name] = records[category.name];
      if (matchInfo.matchesFilter) {
        expand = true;
      }
      const newCategory = copyPropertyCategory(category, filteredCategories, expand);
      newCategories.push(newCategory);
    }

    if ((filteredRecords.length !== 0 || filteredCategories.length !== 0) && !matchInfo.matchesFilter && !(parentMatchInfo?.shouldExpandNodeParents && parentMatchInfo.matchesFilter)) {
      const newCategory = copyPropertyCategory(category, filteredCategories, expand);
      newRecords[newCategory.name] = filteredRecords;
      newCategories.push(newCategory);
    }
  }

  return { filteredCategories: newCategories, filteredRecords: newRecords, matchesCount, filteredResultMatches: allFilteredResultMatches, filteredTypes: allFilteredTypes };
}

async function matchRecordHierarchy(filterer: IPropertyDataFilterer, records: PropertyRecord[], parents: PropertyRecord[], forceIncludeItem: boolean = false): Promise<FilteredRecords> {
  const newMatchedRecords: PropertyRecord[] = [];
  let expandParent = false; // property passed back to parent to indicate whether it should be expanded
  let matchesCount = 0;
  let filteredResultMatches: { id: string, matchesCount: number }[] = [];
  let filteredTypes: FilteredType[] = [];

  for (const record of records) {
    const matchInfo = await filterer.recordMatchesFilter(record, parents);
    const shouldForceIncludeDescendants = forceIncludeItem || matchInfo.shouldForceIncludeDescendants;
    const { filteredRecords: filteredChildren, shouldExpandNodeParents, matchesCount: childrenMatchesCount, filteredResultMatches: childrenResultMatches, filteredTypes: childrenFilteredTypes } = await matchRecordHierarchy(filterer, record.getChildrenRecords(), [...parents, record], shouldForceIncludeDescendants);
    filteredResultMatches = filteredResultMatches.concat(childrenResultMatches);
    filteredTypes = [...filteredTypes, ...childrenFilteredTypes];
    matchesCount += childrenMatchesCount;
    // if child hierarchy indicates parents should be expanded, then it should be passed back up to the top parent
    expandParent = expandParent || shouldExpandNodeParents;

    let newRecord: PropertyRecord | undefined;
    if (matchInfo.matchesFilter) {
      filteredTypes = [...filteredTypes, ...(matchInfo.filteredTypes ?? [])];
      const recordMatchesCount = matchInfo.matchesCount ?? 0;
      matchesCount += recordMatchesCount;
      // Item is included if it matches filter
      // If at least one matched record from records list needs its parent expanded,
      // then `expandParent` should be set to true
      expandParent = expandParent || !!matchInfo.shouldExpandNodeParents;
      newRecord = copyPropertyRecord(record, filteredChildren, shouldExpandNodeParents);
      filteredResultMatches.push({ id: newRecord.property.name, matchesCount: recordMatchesCount });
    } else if (filteredChildren.length !== 0 || forceIncludeItem) {
      // Item is also included if it has at least one matched child or is forcefully included by its parent
      newRecord = copyPropertyRecord(record, filteredChildren, shouldExpandNodeParents);
    }

    if (newRecord)
      newMatchedRecords.push(newRecord);
  }

  return { filteredRecords: newMatchedRecords, shouldExpandNodeParents: expandParent, matchesCount, filteredResultMatches, filteredTypes };
}

function copyPropertyCategory(
  propertyCategory: PropertyCategory,
  newChildren: PropertyCategory[],
  expand: boolean,
): PropertyCategory {
  return {
    ...propertyCategory,
    childCategories: newChildren,
    expand,
  };
}

function copyPropertyRecord(record: PropertyRecord, newChildren: PropertyRecord[], autoExpand: boolean) {
  const r = record.copyWithNewValue(createNewPropertyValue(record.value, newChildren));
  r.autoExpand = autoExpand;
  return r;
}

function createNewPropertyValue(value: PropertyValue, newChildren: PropertyRecord[]): PropertyValue {
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
