/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module PropertyGrid
 */
import { PropertyRecord } from "@itwin/appui-abstract";
import { FlatGridItemType, IMutableCategorizedPropertyItem, MutableCategorizedProperty } from "./MutableFlatGridItem";

/**
 * Mutable wrapper object for PropertyRecord with primitive valueFormat.
 * @beta
 */
export class MutableCategorizedPrimitiveProperty extends MutableCategorizedProperty implements IMutableCategorizedPropertyItem {
  public constructor(
    record: PropertyRecord,
    parentSelectionKey: string,
    parentCategorySelectionKey: string,
    depth: number,
    overrideName?: string,
    overrideDisplayLabel?: string,
  ) {
    super(FlatGridItemType.Primitive, record, parentSelectionKey, parentCategorySelectionKey, depth, overrideName, overrideDisplayLabel);
  }

  public get type(): FlatGridItemType.Primitive {
    return FlatGridItemType.Primitive;
  }

  public getChildren(): IMutableCategorizedPropertyItem[] {
    return [];
  }
}
