/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module PropertyGrid
 */
import { IMutableCategorizedPropertyItem, IMutableGridCategoryItem } from "./MutableFlatGridItem";
import { PropertyRecord, PropertyValueFormat } from "@bentley/ui-abstract";
import { MutableCategorizedPrimitiveProperty } from "./MutableCategorizedPrimitiveProperty";
import { MutableCategorizedArrayProperty } from "./MutableCategorizedArrayProperty";
import { MutableCategorizedStructProperty } from "./MutableCategorizedStructProperty";
import { CategoryRecordsDict, MutableGridCategory } from "./MutableGridCategory";
import { PropertyCategory } from "../../PropertyDataProvider";

/**
 * IMutableGridItemFactory interface for creating MutableGridItem objects
 * @alpha
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
 * @alpha
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
   * @param parent parent FlatGridItem of provided `record`.
   * @param depth current depth counting from parent category.
   * @param record record to convert to a FlatGridItem.
   * @param prevModelMap map of previous property grid full model. Used to transfer state data by selection key.
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
   * @param prevModelMap map of previous property grid full model. Used to transfer state data by selection key.
   * @param depth current depth counting from root category.
   * @param parentCategory parent of this category.
   * @returns converted GridCategory.
   */
  public createGridCategory(
    category: PropertyCategory,
    recordsDict: CategoryRecordsDict,
    parentSelectionKey?: string,
    depth?: number,
  ): IMutableGridCategoryItem {
    if (parentSelectionKey !== undefined && depth !== undefined)
      return new MutableGridCategory(category, recordsDict, this, parentSelectionKey, depth);

    return new MutableGridCategory(category, recordsDict, this);
  }
}
