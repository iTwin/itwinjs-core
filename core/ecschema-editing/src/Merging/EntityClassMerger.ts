/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { type EntityClassDifference, EntityClassMixinDifference } from "../Differencing/SchemaDifference";
import { type SchemaItemMergerHandler, updateSchemaItemKey } from "./SchemaItemMerger";
import { type MutableEntityClass } from "../Editing/Mutable/MutableEntityClass";
import { modifyClass } from "./ClassMerger";
import { SchemaItemKey } from "@itwin/ecschema-metadata";
import { SchemaMergeContext } from "./SchemaMerger";

/**
 * Defines a merge handler to merge Entity Class schema items.
 * @internal
 */
export const entityClassMerger: SchemaItemMergerHandler<EntityClassDifference> = {
  async add(context, change) {
    return context.editor.entities.createFromProps(context.targetSchemaKey, {
      name: change.itemName,
      schemaItemType: change.schemaType,

      ...change.difference,
    });
  },
  async modify(context, change, itemKey, item: MutableEntityClass) {
    if(change.difference.mixins !== undefined) {
      for(const mixin of change.difference.mixins) {
        const mixinKey = await updateSchemaItemKey(context, mixin);
        await context.editor.entities.addMixin(itemKey, mixinKey);
      }
    }

    return modifyClass(context, change, itemKey, item);
  },
};

/**
 * Merges Mixins to Entity Class schema items.
 * @internal
 */
export async function mergeClassMixins(context: SchemaMergeContext, change: EntityClassMixinDifference): Promise<void> {
  if(change.changeType === "add") {
    for(const mixinFullName of change.difference) {
      const mixinKey = await updateSchemaItemKey(context, mixinFullName);
      const entityKey = new SchemaItemKey(change.itemName, context.targetSchemaKey);
      await context.editor.entities.addMixin(entityKey, mixinKey);
    }
  } else {
    throw new Error(`Changing the entity class '${change.itemName}' mixins is not supported.`);
  }
}
