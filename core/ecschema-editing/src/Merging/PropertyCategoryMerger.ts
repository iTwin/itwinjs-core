/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { type PropertyCategoryDifference } from "../Differencing/SchemaDifference";
import { type SchemaMergerHandler } from "./SchemaItemMerger";
import { type MutablePropertyCategory } from "../Editing/Mutable/MutablePropertyCategory";

/**
 * @internal
 */
export const propertyCategoryMerger: SchemaMergerHandler<PropertyCategoryDifference> = {
  async add(context, change) {
    return context.editor.propertyCategories.createFromProps(context.targetSchemaKey, {
      name: change.itemName,
      ...change.difference,
    });
  },
  async modify(context, change, itemKey, item: MutablePropertyCategory) {
    if(change.difference.label) {
      item.setDisplayLabel(change.difference.label);
    }
    if(change.difference.priority !== undefined) {
      // TODO: inconsistency: setPriority does not return a result whether the priority was set successfully.
      await context.editor.propertyCategories.setPriority(itemKey, change.difference.priority);
    }
    return {};
  },
};
