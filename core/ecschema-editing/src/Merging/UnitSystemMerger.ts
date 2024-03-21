/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { type MutableUnitSystem } from "../Editing/Mutable/MutableUnitSystem";
import { type SchemaItemMergerHandler } from "./SchemaItemMerger";
import { type UnitSystemDifference } from "../Differencing/SchemaDifference";

/**
 * Defines a merge handler to merge UnitSystem schema items.
 * @internal
 */
export const unitSystemMerger: SchemaItemMergerHandler<UnitSystemDifference> = {
  async add(context, change) {
    return context.editor.unitSystems.createFromProps(context.targetSchemaKey, {
      name: change.itemName,
      schemaItemType: change.schemaType,

      ...change.difference,
    });
  },
  async modify(_context, change, _itemKey, item: MutableUnitSystem) {
    if(change.difference.label !== undefined) {
      item.setDisplayLabel(change.difference.label);
    }
    if(change.difference.description !== undefined) {
      item.setDescription(change.difference.description);
    }
    return {};
  },
};
