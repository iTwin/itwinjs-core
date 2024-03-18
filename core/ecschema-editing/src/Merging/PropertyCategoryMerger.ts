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
      ...change.json,
    });
  },
  async modify(context, change, itemKey, item: MutablePropertyCategory) {
    if(change.json.label) {
      item.setDisplayLabel(change.json.label);
    }
    if(change.json.priority !== undefined) {
      // TODO: inconsistency: setPriority does not return a result whether the priority was set successfully.
      await context.editor.propertyCategories.setPriority(itemKey, change.json.priority);
    }
    return {};
  },
};
