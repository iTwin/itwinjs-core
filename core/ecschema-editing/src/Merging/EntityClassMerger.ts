/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { EntityClassDifference, EntityClassMixinDifference } from "../Differencing/SchemaDifference";
import type { MutableEntityClass } from "../Editing/Mutable/MutableEntityClass";
import type { SchemaMergeContext } from "./SchemaMerger";
import { SchemaItemKey } from "@itwin/ecschema-metadata";
import { modifyClass } from "./ClassMerger";
import { updateSchemaItemKey } from "./Utils";

/**
 * Merges a new EntityClass into the target schema.
 * @internal
 */
export async function addEntityClass(context: SchemaMergeContext, change: EntityClassDifference) {
  await context.editor.entities.createFromProps(context.targetSchemaKey, {
    name: change.itemName,
    schemaItemType: change.schemaType,

    ...change.difference,
  });
}

/**
 * Merges differences to an existing EntityClass in the target schema.
 * @internal
 */
export async function modifyEntityClass(context: SchemaMergeContext, change: EntityClassDifference, itemKey: SchemaItemKey) {
  const item = await context.targetSchema.lookupItem(itemKey) as MutableEntityClass;
  if(change.difference.mixins !== undefined) {
    for(const mixin of change.difference.mixins) {
      const mixinKey = await updateSchemaItemKey(context, mixin);
      await context.editor.entities.addMixin(itemKey, mixinKey);
    }
  }

  return modifyClass(context, change, itemKey, item);
}

/**
 * Merges Mixins to Entity Class schema items.
 * @internal
 */
export async function addClassMixins(context: SchemaMergeContext, change: EntityClassMixinDifference): Promise<void> {
  for(const mixinFullName of change.difference) {
    const mixinKey = await updateSchemaItemKey(context, mixinFullName);
    const entityKey = new SchemaItemKey(change.itemName, context.targetSchemaKey);
    await context.editor.entities.addMixin(entityKey, mixinKey);
  }
}
