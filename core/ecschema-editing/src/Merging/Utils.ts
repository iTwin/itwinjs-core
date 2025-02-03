/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ECClasses } from "../Editing/ECClasses";
import { PropertyKey } from "./Edits/NameMapping";
import type { SchemaMergeContext } from "./SchemaMerger";
import { ECClass, ECObjectsError, ECObjectsStatus, SchemaContext, SchemaItem, SchemaItemKey, SchemaItemType } from "@itwin/ecschema-metadata";

/**
 * Resolves a SchemaItemKey for the given item name.
 * @internal
 */
export function toItemKey(context: SchemaMergeContext, itemName: string): SchemaItemKey {
  const classKey = context.nameMapping.resolveItemKey(new SchemaItemKey(itemName, context.sourceSchemaKey));
  return new SchemaItemKey(classKey.name, context.targetSchemaKey);
}

/**
 * Resolves a SchemaItemKey for the given class property name.
 * @internal
 */
export function toPropertyKey(context: SchemaMergeContext, itemName: string, propertyName: string): PropertyKey {
  const classKey = new SchemaItemKey(itemName, context.sourceSchemaKey);
  return context.nameMapping.resolvePropertyKey(new PropertyKey(propertyName, classKey));
}

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
    const schemaItemKey = toItemKey(context, itemName);
    return resolveSchemaItemKey(context.editor.schemaContext, schemaItemKey);
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
  const schemaItemKey = toItemKey(context, itemName);
  const schemaItem = await context.editor.schemaContext.getSchemaItem(schemaItemKey);
  if (schemaItem === undefined) {
    throw new ECObjectsError(ECObjectsStatus.ClassNotFound, `${schemaType} ${schemaItemKey.fullName} not found in schema context.`);
  }

  return schemaItem;
}

/**
 * @internal
 */
export async function getClassEditor(context: SchemaMergeContext, ecClass: ECClass | SchemaItemKey): Promise<ECClasses> {
  const schemaItemType = ECClass.isECClass(ecClass)
    ? ecClass.schemaItemType
    : (await context.editor.schemaContext.getTypedSchemaItem(ecClass, ECClass))?.schemaItemType;

  switch(schemaItemType) {
    case SchemaItemType.EntityClass:
      return context.editor.entities;
    case SchemaItemType.Mixin:
      return context.editor.mixins;
    case SchemaItemType.StructClass:
      return context.editor.structs;
    case SchemaItemType.CustomAttributeClass:
      return context.editor.customAttributes;
    case SchemaItemType.RelationshipClass:
      return context.editor.relationships;
    default:
      throw new Error("SchemaItemType not supported");
  }
}
