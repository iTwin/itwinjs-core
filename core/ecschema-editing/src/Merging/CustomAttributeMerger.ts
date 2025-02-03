/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { CustomAttribute, CustomAttributeClass, RelationshipClass } from "@itwin/ecschema-metadata";
import { type SchemaMergeContext } from "./SchemaMerger";
import { type CustomAttributeDifference } from "../Differencing/SchemaDifference";
import { getClassEditor, toItemKey, toPropertyKey, updateSchemaItemFullName, updateSchemaItemKey } from "./Utils";

type CustomAttributeSetter = (customAttribute: CustomAttribute) => Promise<void>;

/**
 * Merges a new CustomAttributes from Schema, items or properties into the target schema.
 * @internal
 */
export async function addCustomAttribute(context: SchemaMergeContext, change: CustomAttributeDifference): Promise<void> {
  if (change.difference.className === undefined) {
    throw new Error("CustomAttribute instance must specify className");
  }
  const schemaItemKey = await updateSchemaItemKey(context, change.difference.className);

  const targetCustomAttributeClass = await context.targetSchema.lookupTypedItem(schemaItemKey, CustomAttributeClass);
  if (targetCustomAttributeClass === undefined) {
    throw new Error(`Unable to locate the custom attribute class ${schemaItemKey.name} in the merged schema.`);
  }

  const caInstance: CustomAttribute = {
    ...change.difference,
    className: schemaItemKey.fullName,
  };

  if (change.appliedTo === "Schema") {
    await context.editor.addCustomAttribute(context.targetSchemaKey, caInstance);
  }
  if (change.appliedTo === "SchemaItem") {
    const itemKey = toItemKey(context, change.itemName);
    const editor = await getClassEditor(context, itemKey);
    await editor.addCustomAttribute(itemKey, caInstance);
  }
  if (change.appliedTo === "Property") {
    const itemKey = toItemKey(context, change.itemName);
    const [propertyName] = change.path.split(".");
    const propertyKey = toPropertyKey(context, change.itemName, propertyName);
    const editor = await getClassEditor(context, itemKey);
    await editor.properties.addCustomAttribute(itemKey, propertyKey.propertyName, caInstance);
  }
  if (change.appliedTo === "RelationshipConstraint") {
    const itemKey = toItemKey(context, change.itemName);
    const relationshipClass = await context.targetSchema.lookupTypedItem(itemKey, RelationshipClass);
    if (relationshipClass === undefined) {
      throw new Error(`Unable to locate the relationship class ${itemKey.name} in the merged schema.`);
    }
    const constraint = change.path === "$source"
      ? relationshipClass.source
      : relationshipClass.target;

    return context.editor.relationships.addCustomAttributeToConstraint(constraint, caInstance);
  }
}

/**
 * @internal
 */
export async function applyCustomAttributes(context: SchemaMergeContext, customAttributes: CustomAttribute[], handler: CustomAttributeSetter): Promise<void> {
  for (const customAttribute of customAttributes) {
    await applyCustomAttribute(context, customAttribute, handler);
  }
}

/**
 * @internal
 */
export async function applyCustomAttribute(context: SchemaMergeContext, customAttribute: CustomAttribute, handler: CustomAttributeSetter): Promise<void> {
  customAttribute.className = await updateSchemaItemFullName(context, customAttribute.className);
  return handler(customAttribute);
}
