/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { PropertyCategoryDifference } from "../Differencing/SchemaDifference";
import type { SchemaMergeContext } from "./SchemaMerger";
import type { SchemaItemKey } from "@itwin/ecschema-metadata";

/**
 * Merges a new PropertyCategory into the target schema.
 * @internal
 */
export async function addPropertyCategory(context: SchemaMergeContext, change: PropertyCategoryDifference) {
  if (change.difference.priority === undefined) {
    throw new Error("PropertyCategory must define priority");
  }

  await context.editor.propertyCategories.createFromProps(context.targetSchemaKey, {
    ...change.difference,
    name: change.itemName,
    schemaItemType: change.schemaType,
    priority: change.difference.priority,
  });
}

/**
 * Merges differences to an existing PropertyCategory in the target schema.
 * @internal
 */
export async function modifyPropertyCategory(context: SchemaMergeContext, change: PropertyCategoryDifference, itemKey: SchemaItemKey) {
  if(change.difference.label !== undefined) {
    await context.editor.propertyCategories.setDisplayLabel(itemKey, change.difference.label);
  }
  if(change.difference.description !== undefined) {
    await context.editor.propertyCategories.setDescription(itemKey, change.difference.description);
  }
  if(change.difference.priority !== undefined) {
    await context.editor.propertyCategories.setPriority(itemKey, change.difference.priority);
  }
}
