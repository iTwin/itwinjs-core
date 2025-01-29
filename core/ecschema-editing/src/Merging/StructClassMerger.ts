/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { StructClassDifference } from "../Differencing/SchemaDifference";
import type { MutableClass } from "../Editing/Mutable/MutableClass";
import type { SchemaMergeContext } from "./SchemaMerger";
import type { SchemaItemKey } from "@itwin/ecschema-metadata";
import { modifyClass } from "./ClassMerger";

/**
 * Merges a new StructClass into the target schema.
 * @internal
 */
export async function addStructClass(context: SchemaMergeContext, change: StructClassDifference) {
  await context.editor.structs.createFromProps(context.targetSchemaKey, {
    name: change.itemName,
    ...change.difference,
  });
}

/**
 * Merges differences to an existing StructClass in the target schema.
 * @internal
 */
export async function modifyStructClass(context: SchemaMergeContext, change: StructClassDifference, itemKey: SchemaItemKey) {
  const item = await context.targetSchema.lookupItem(itemKey) as MutableClass;
  return modifyClass(context, change, itemKey, item);
}
