/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module PropertyGrid
 */
import { PropertyRecord } from "@bentley/ui-abstract";
import { FlatGridItemType, IMutableCategorizedPropertyItem, MutableCategorizedProperty } from "./MutableFlatGridItem";
import { IMutableGridItemFactory } from "./MutableGridItemFactory";

/**
 * Mutable wrapper object for PropertyRecord with struct valueFormat which provides methods for working with and managing record children hierarchies.
 * @beta
 */
export class MutableCategorizedStructProperty extends MutableCategorizedProperty implements IMutableCategorizedPropertyItem {
  private _children: IMutableCategorizedPropertyItem[];

  public constructor(
    record: PropertyRecord,
    parentSelectionKey: string,
    parentCategorySelectionKey: string,
    depth: number,
    gridItemFactory: IMutableGridItemFactory,
    overrideName?: string,
    overrideDisplayLabel?: string,
  ) {
    super(FlatGridItemType.Struct, record, parentSelectionKey, parentCategorySelectionKey, depth, overrideName, overrideDisplayLabel);

    this._children = record.getChildrenRecords().map((value) => {
      return gridItemFactory.createCategorizedProperty(value, this.selectionKey, this.parentCategorySelectionKey, depth + 1);
    });
  }

  public get type(): FlatGridItemType.Struct {
    return FlatGridItemType.Struct;
  }

  public getChildren(): IMutableCategorizedPropertyItem[] {
    return this._children;
  }
}
