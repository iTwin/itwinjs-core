/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module PropertyGrid
 */
import { CategorizedPropertyTypes, FlatGridItemType } from "./MutableFlatGridItem.js";
import { PropertyRecord } from "@bentley/ui-abstract";
import { PropertyCategory } from "../../PropertyDataProvider.js";

/**
 * Base immutable data structure defining common methods and properties for both CategorizedProperties and GridCategories
 * @alpha
 */
export interface FlatGridItemBase {
  readonly isExpanded: boolean;
  readonly key: string;
  readonly selectionKey: string;
  readonly parentSelectionKey: string | undefined;
  readonly parentCategorySelectionKey: string | undefined;
  readonly depth: number;
  readonly label: string;
  readonly type: FlatGridItemType;
  readonly lastInNumberOfCategories: number;
  readonly isLastInRootCategory: boolean;
  getDescendantsAndSelf(): FlatGridItem[];
  getVisibleDescendantsAndSelf(): FlatGridItem[];
  getChildren(): FlatGridItem[];
  getLastVisibleDescendantOrSelf(): FlatGridItem;
}

/**
 * Data structure which describes methods and properties present on immutable GridCategoryItems
 * @alpha
 */
export interface GridCategoryItem extends FlatGridItemBase {
  readonly type: FlatGridItemType.Category;
  readonly name: string;
  readonly derivedCategory: PropertyCategory;

  getChildCategories(): GridCategoryItem[];
  getDescendantCategoriesAndSelf(): GridCategoryItem[];
}

/**
 * Data structure which describes methods and properties present on immutable CategorizedPropertyItems
 * @alpha
 */
export interface CategorizedPropertyItem extends FlatGridItemBase {
  readonly type: CategorizedPropertyTypes;
  readonly derivedRecord: PropertyRecord;
  readonly parentCategorySelectionKey: string;
  readonly parentSelectionKey: string;

  getChildren(): CategorizedPropertyItem[];
}

/**
 * Type which describes immutable GridCategoryItem or CategorizedPropertyItem
 * @alpha
 */
export type FlatGridItem = CategorizedPropertyItem | GridCategoryItem;
