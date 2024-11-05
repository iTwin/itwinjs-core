/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { MixinClassDifference } from "../Differencing/SchemaDifference";
import type { MutableMixin } from "../Editing/Mutable/MutableMixin";
import type { SchemaMergeContext } from "./SchemaMerger";
import type { SchemaItemKey } from "@itwin/ecschema-metadata";
import { updateSchemaItemFullName, updateSchemaItemKey } from "./Utils";
import { modifyClass } from "./ClassMerger";

/**
 * Merges a new Mixin into the target schema.
 * @internal
 */
export async function addMixinClass(context: SchemaMergeContext, change: MixinClassDifference) {
  if (change.difference.appliesTo === undefined) {
    throw new Error("Mixin must define appliesTo");
  }
  await context.editor.mixins.createFromProps(context.targetSchemaKey, {
    ...change.difference,
    name: change.itemName,
    schemaItemType: change.schemaType,
    appliesTo: await updateSchemaItemFullName(context, change.difference.appliesTo),
  });
}

/**
 * Merges differences to an existing Mixin in the target schema.
 * @internal
 */
export async function modifyMixinClass(context: SchemaMergeContext, change: MixinClassDifference, itemKey: SchemaItemKey) {
  const mixin = await context.targetSchema.lookupItem(itemKey) as MutableMixin;
  if(change.difference.appliesTo !== undefined) {
    const appliesTo = await updateSchemaItemKey(context, change.difference.appliesTo);
    const currentValue = await mixin.appliesTo;
    if (currentValue !== undefined && !appliesTo.matches(currentValue.key)) {
      throw new Error(`Changing the mixin '${itemKey.name}' appliesTo is not supported.`);
    }
  }

  return modifyClass(context, change, itemKey, mixin);
}
