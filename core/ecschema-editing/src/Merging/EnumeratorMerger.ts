/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { EnumeratorDifference } from "../Differencing/SchemaDifference";
import type { SchemaMergeContext } from "./SchemaMerger";
import { SchemaItemKey } from "@itwin/ecschema-metadata";

/**
 * Merges a new Enumerator into the target schema.
 * @internal
 */
export async function addEnumerator(context: SchemaMergeContext, change: EnumeratorDifference) {
  if (change.difference.name === undefined) {
    throw new Error("Enumerators must define a name");
  }
  if (change.difference.value === undefined) {
    throw new Error("Enumerators must define a value");
  }

  const itemKey = new SchemaItemKey(change.itemName, context.targetSchemaKey);
  await context.editor.enumerations.addEnumerator(itemKey, {
    name: change.difference.name,
    value: change.difference.value,
    label: change.difference.label,
    description: change.difference.description,
  });
}

/**
 * Merges differences to an existing Enumerator in the target schema.
 * @internal
 */
export async function modifyEnumerator(context: SchemaMergeContext, change: EnumeratorDifference, itemKey: SchemaItemKey) {
  if(change.difference.value !== undefined) {
    throw new Error(`Failed to merge enumerator attribute, Enumerator "${change.path}" has different values.`);
  }
  if(change.difference.description !== undefined) {
    await context.editor.enumerations.setEnumeratorDescription(itemKey, change.path, change.difference.description);
  }
  if(change.difference.label !== undefined) {
    await context.editor.enumerations.setEnumeratorLabel(itemKey, change.path, change.difference.label);
  }
}
