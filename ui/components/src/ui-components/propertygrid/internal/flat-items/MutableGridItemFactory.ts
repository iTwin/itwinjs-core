/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module PropertyGrid
 */
import { PropertyRecord, PropertyValueFormat } from "@bentley/ui-abstract";
import { PropertyCategory } from "../../PropertyDataProvider";
import { MutableCategorizedArrayProperty } from "./MutableCategorizedArrayProperty";
import { MutableCategorizedPrimitiveProperty } from "./MutableCategorizedPrimitiveProperty";
import { MutableCategorizedStructProperty } from "./MutableCategorizedStructProperty";
import { MutableCustomGridCategory } from "./MutableCustomGridCategory";
import { IMutableCategorizedPropertyItem, IMutableGridCategoryItem } from "./MutableFlatGridItem";
import { CategoryRecordsDict, MutableGridCategory } from "./MutableGridCategory";

/**
 * IMutableGridItemFactory interface for creating MutableGridItem objects
 * @beta
 */
export interface IMutableGridItemFactory {
  createCategorizedProperty: (
    record: PropertyRecord,
    parentSelectionKey: string,
    parentCategorySelectionKey: string,
    depth: number,
    overrideName?: string,
    overrideDisplayLabel?: string,
  ) => IMutableCategorizedPropertyItem;

  createGridCategory: (
    category: PropertyCategory,
    recordsDict: CategoryRecordsDict,
    parentSelectionKey?: string,
    depth?: number,
  ) => IMutableGridCategoryItem;
}

/**
 * Implementation of IMutableGridItemFactory for creating MutableGridItem objects.
 * @beta
 */
export class MutableGridItemFactory implements IMutableGridItemFactory {
  protected createPrimitiveProperty(
    record: PropertyRecord,
    parentSelectionKey: string,
    parentCategorySelectionKey: string,
    depth: number,
    overrideName?: string,
    overrideDisplayLabel?: string,
  ) {
    return new MutableCategorizedPrimitiveProperty(record, parentSelectionKey, parentCategorySelectionKey, depth, overrideName, overrideDisplayLabel);
  }

  protected createArrayProperty(
    record: PropertyRecord,
    parentSelectionKey: string,
    parentCategorySelectionKey: string,
    depth: number,
    overrideName?: string,
    overrideDisplayLabel?: string,
  ) {
    return new MutableCategorizedArrayProperty(record, parentSelectionKey, parentCategorySelectionKey, depth, this, overrideName, overrideDisplayLabel);
  }

  protected createStructProperty(
    record: PropertyRecord,
    parentSelectionKey: string,
    parentCategorySelectionKey: string,
    depth: number,
    overrideName?: string,
    overrideDisplayLabel?: string,
  ) {
    return new MutableCategorizedStructProperty(record, parentSelectionKey, parentCategorySelectionKey, depth, this, overrideName, overrideDisplayLabel);
  }

  /**
   * Converts record into FlatGridItem.
   * @param record record to convert to a FlatGridItem.
   * @param parentSelectionKey parent selection key of provided `record`.
   * @param parentCategorySelectionKey parent category selection key of provided `record`.
   * @param depth current depth counting from parent category.
   * @param overrideName property name that overrides original record property name.
   * @param overrideDisplayLabel property display label that overrides original record property display label.
   * @returns converted CategorizedProperty.
   */
  public createCategorizedProperty(
    record: PropertyRecord,
    parentSelectionKey: string,
    parentCategorySelectionKey: string,
    depth: number,
    overrideName?: string,
    overrideDisplayLabel?: string,
  ): IMutableCategorizedPropertyItem {
    const valueFormat = record.value.valueFormat;
    switch (valueFormat) {
      case PropertyValueFormat.Primitive:
        return this.createPrimitiveProperty(record, parentSelectionKey, parentCategorySelectionKey, depth, overrideName, overrideDisplayLabel);
      case PropertyValueFormat.Array:
        return this.createArrayProperty(record, parentSelectionKey, parentCategorySelectionKey, depth, overrideName, overrideDisplayLabel);
      case PropertyValueFormat.Struct:
        return this.createStructProperty(record, parentSelectionKey, parentCategorySelectionKey, depth, overrideName, overrideDisplayLabel);
      /* istanbul ignore next */
      default:
        const unhandledRecordType: never = valueFormat;
        throw new Error(`Unhandled property record type. Was a new type added? ${unhandledRecordType}`);
    }
  }

  /**
   * Converts category into GridCategoryItem.
   * @param category PropertyCategory to convert.
   * @param recordsDict dictionary of category records.
   * @param parentSelectionKey parent selection key of this category.
   * @param depth current depth counting from root category.
   * @returns converted GridCategory.
   */
  public createGridCategory(
    category: PropertyCategory,
    recordsDict: CategoryRecordsDict,
    parentSelectionKey?: string,
    depth?: number,
  ): IMutableGridCategoryItem {
    if (category.renderer !== undefined)
      return new MutableCustomGridCategory(category, recordsDict, this, parentSelectionKey, depth ?? 0);

    if (parentSelectionKey !== undefined && depth !== undefined)
      return new MutableGridCategory(category, recordsDict, this, parentSelectionKey, depth);

    return new MutableGridCategory(category, recordsDict, this);
  }
}
