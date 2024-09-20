/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { SchemaMergeContext } from "./SchemaMerger";
import { ECObjectsError, ECObjectsStatus, SchemaContext, SchemaItem, SchemaItemKey } from "@itwin/ecschema-metadata";

/**
 * Convenience-method around updateSchemaItemKey that returns the full name instead of a SchemaItemKey.
 * @internal
 */
export async function updateSchemaItemFullName(context: SchemaMergeContext, reference: string) {
  const schemaItemKey = await updateSchemaItemKey(context, reference);
  return schemaItemKey.fullName;
}

/**
 * Updates the given reference if it refers to a SchemaItem in the source Schema and
 * returns a SchemaItemKey. If any other schema is referred the reference is not change.
 * @internal
 */
export async function updateSchemaItemKey(context: SchemaMergeContext, reference: string) {
  const [schemaName, itemName] = SchemaItem.parseFullName(reference);
  if (context.sourceSchemaKey.compareByName(schemaName)) {
    return resolveSchemaItemKey(context.editor.schemaContext, new SchemaItemKey(itemName, context.targetSchemaKey));
  }

  const referencedSchema = await context.targetSchema.getReference(schemaName);
  if (referencedSchema !== undefined) {
    return resolveSchemaItemKey(context.editor.schemaContext, new SchemaItemKey(itemName, referencedSchema.schemaKey));
  }

  throw new Error(`Cannot locate referenced schema item ${reference}`);
}

/**
 * To support case insensitivity for schema items, the given key is checked if there
 * exists an item for it.
 * @internal
 */
async function resolveSchemaItemKey(schemaContext: SchemaContext, itemKey: SchemaItemKey): Promise<SchemaItemKey> {
  const item = await schemaContext.getSchemaItem(itemKey);
  if (item === undefined) {
    // If the schema item hasn't been created yet, we have to trust the given key is correctly spelled.
    return itemKey;
  }
  return item.key;
}

/**
 * @internal
 */
export async function locateSchemaItem(context: SchemaMergeContext, itemName: string, schemaType: string) {
  const schemaItemKey = new SchemaItemKey(itemName, context.targetSchemaKey);
  const schemaItem = await context.editor.schemaContext.getSchemaItem(schemaItemKey);
  if (schemaItem === undefined) {
    throw new ECObjectsError(ECObjectsStatus.ClassNotFound, `${schemaType} ${schemaItemKey.fullName} not found in schema context.`);
  }

  return schemaItem;
}
