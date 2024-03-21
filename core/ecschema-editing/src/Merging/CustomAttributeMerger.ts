/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { CustomAttribute, CustomAttributeClass, RelationshipClass, SchemaItemKey } from "@itwin/ecschema-metadata";
import { type SchemaMergeContext } from "./SchemaMerger";
import { type CustomAttributeDifference } from "../Differencing/SchemaDifference";
import { type SchemaEditResults } from "../Editing/Editor";
import { updateSchemaItemFullName, updateSchemaItemKey } from "./SchemaItemMerger";

type CustomAttributeSetter = (customAttribute: CustomAttribute) => Promise<SchemaEditResults>;

/**
 * Merges the custom attributes of the given changes iterable. The third parameter is a callback to pass
 * a scope (Class, Property, Schema) specific handler.
 * @param context   The current schema merging context.
 * @param change    The individual custom attribute change.
 * @returns         A EditResults object.
 * @internal
 */
export async function mergeCustomAttribute(context: SchemaMergeContext, change: CustomAttributeDifference): Promise<SchemaEditResults> {
  if (change.changeType === "add") {
    const schemaItemKey = await updateSchemaItemKey(context, change.difference.className);

    const targetCustomAttributeClass = await context.targetSchema.lookupItem<CustomAttributeClass>(schemaItemKey);
    if (targetCustomAttributeClass === undefined) {
      return { errorMessage: `Unable to locate the custom attribute class ${schemaItemKey.name} in the merged schema.`};
    }

    change.difference.className = schemaItemKey.fullName;

    if(change.appliesTo === "Schema") {
      return context.editor.addCustomAttribute(context.targetSchemaKey, change.difference);
    }
    if(change.appliesTo === "SchemaItem") {
      const itemKey = new SchemaItemKey(change.itemName, context.targetSchemaKey);
      return context.editor.entities.addCustomAttribute(itemKey, change.difference);
    }
    if(change.appliesTo === "Property") {
      const itemKey = new SchemaItemKey(change.itemName, context.targetSchemaKey);
      const [propertyName] = change.path.split(".");
      return context.editor.entities.addCustomAttributeToProperty(itemKey, propertyName, change.difference);
    }
    if(change.appliesTo === "RelationshipConstraint") {
      const itemKey = new SchemaItemKey(change.itemName, context.targetSchemaKey);
      const relationshipClass = await context.targetSchema.lookupItem<RelationshipClass>(itemKey);
      if(relationshipClass === undefined) {
        return { errorMessage: `Unable to locate the relationship class ${itemKey.name} in the merged schema.`};
      }
      const constraint = change.path === "$source"
        ? relationshipClass.source
        : relationshipClass.target;

      return context.editor.relationships.addCustomAttributeToConstraint(constraint, change.difference);
    }
    return {};
  } else {
    return { errorMessage: `Changes of Custom Attribute on merge is not implemented.`};
  }
}

/**
 * @internal
 */
export async function applyCustomAttributes(context: SchemaMergeContext, customAttributes: CustomAttribute[], handler: CustomAttributeSetter): Promise<SchemaEditResults> {
  for(const customAttribute of customAttributes) {
    const result = await applyCustomAttribute(context, customAttribute, handler);
    if(result.errorMessage) {
      return result;
    }
  }
  return {};
}

/**
 * @internal
 */
export async function applyCustomAttribute(context: SchemaMergeContext, customAttribute: CustomAttribute, handler: CustomAttributeSetter): Promise<SchemaEditResults> {
  customAttribute.className = await updateSchemaItemFullName(context, customAttribute.className);
  return handler(customAttribute);
}
