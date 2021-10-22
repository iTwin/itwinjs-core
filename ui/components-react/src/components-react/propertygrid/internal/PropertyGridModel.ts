/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module PropertyGrid
 */
import { immerable } from "immer";
import { PropertyCategory, PropertyData } from "../PropertyDataProvider";
import { FlatGridItem, GridCategoryItem } from "./flat-items/FlatGridItem";
import { IMutableFlatGridItem, IMutableGridCategoryItem } from "./flat-items/MutableFlatGridItem";
import { IMutableGridItemFactory } from "./flat-items/MutableGridItemFactory";

/**
 * PropertyGridModel interface for working with immutable FlatGridItems
 * @beta
 */
export interface IPropertyGridModel {
  getItem: (selectionKey: string) => FlatGridItem;
  getRootCategories: () => GridCategoryItem[];
  getFlatGrid: () => FlatGridItem[];
  getVisibleFlatGrid: () => FlatGridItem[];
}

/**
 * PropertyGridModel interface for working with mutable FlatGridItems
 * @beta
 */
export interface IMutablePropertyGridModel {
  getItem: (selectionKey: string) => IMutableFlatGridItem;
  getRootCategories: () => IMutableGridCategoryItem[];
  getFlatGrid: () => IMutableFlatGridItem[];
  getVisibleFlatGrid: () => IMutableFlatGridItem[];
}

/**
 * Implementation of PropertyGridModel for working with and converting PropertyData to mutable FlatGridItems
 * @beta
 */
export class MutablePropertyGridModel implements IPropertyGridModel, IMutablePropertyGridModel {
  public [immerable] = true;

  private _categories: IMutableGridCategoryItem[];
  public constructor(propertyData: PropertyData, private _gridItemFactory: IMutableGridItemFactory) {
    this._categories = propertyData.categories.map((category: PropertyCategory) => this._gridItemFactory.createGridCategory(category, propertyData.records));
  }

  /**
   * Retrieves grid item from model.
   * @param selectionKey unique key for identifying item to retrieve.
   */
  public getItem(selectionKey: string) {
    const item = this.findItem(this._categories, selectionKey);
    if (!item)
      throw new Error(`Grid item at provided key not found: ${selectionKey}`);

    return item;
  }

  /**
   * Walks the grid item hierarchy and finds item matching key
   * @param items items and their descendants to check
   * @param selectionKey unique key for identifying item
   * @returns FlatGridItem if items with key exists, undefined otherwise
   */
  private findItem(items: IMutableFlatGridItem[], selectionKey: string): IMutableFlatGridItem | undefined {
    for (const item of items) {
      // Each items key is prefixed with it's parent key, so we can ignore the ones that aren't prefixed to reduce checking unnecessary branches.
      if (!selectionKey.startsWith(item.selectionKey))
        continue;

      if (item.selectionKey === selectionKey)
        return item;

      const foundItem = this.findItem(item.getChildren(), selectionKey);
      if (foundItem)
        return foundItem;
    }

    return undefined;
  }

  /**
   * Gets all GridCategoryItems that do not have parent categories.
   * @returns array of GridCategoryItems
   */
  public getRootCategories(): IMutableGridCategoryItem[] {
    return this._categories;
  }

  /**
   * Gets an array of all FlatGridItems.
   * @returns 1-Dimensional array of GridCategories and CategorizedProperties
   */
  public getFlatGrid(): IMutableFlatGridItem[] {
    const flatGrid: IMutableFlatGridItem[] = [];
    this._categories.forEach((category) => flatGrid.push(...category.getDescendantsAndSelf()));

    return flatGrid;
  }

  /**
   * Gets an array of all currently visible FlatGridItems.
   * @returns 1-Dimensional array of GridCategories and CategorizedProperties
   */
  public getVisibleFlatGrid(): IMutableFlatGridItem[] {
    const visibleItems: IMutableFlatGridItem[] = [];
    this._categories.forEach((category) => visibleItems.push(...category.getVisibleDescendantsAndSelf()));

    return visibleItems;
  }
}
