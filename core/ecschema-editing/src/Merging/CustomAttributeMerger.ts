/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Merging
 */

import { CustomAttributeClass, RelationshipClass, SchemaItemKey } from "@itwin/ecschema-metadata";
import { type SchemaMergeContext } from "./SchemaMerger";
import { type CustomAttributeDifference, CustomAttributePropertyDifference, CustomAttributeRelationshipDifference, CustomAttributeSchemaDifference, CustomAttributeSchemaItemDifference } from "../Differencing/SchemaDifference";
import { type SchemaEditResults } from "../Editing/Editor";
import { updateSchemaItemKey } from "./SchemaItemMerger";

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
    const schemaItemKey = await updateSchemaItemKey(context, change.json.className);

    const targetCustomAttributeClass = await context.targetSchema.lookupItem<CustomAttributeClass>(schemaItemKey);
    if (targetCustomAttributeClass === undefined) {
      return { errorMessage: `Unable to locate the custom attribute class ${schemaItemKey.name} in the merged schema.`};
    }

    change.json.className = schemaItemKey.fullName;

    if(isSchemaDifference(change)) {
      return context.editor.addCustomAttribute(context.targetSchemaKey, change.json);
    }
    if(isRelationshipConstraintDifference(change)) {
      const itemKey = new SchemaItemKey(change.itemName, context.targetSchemaKey);
      const relationshipClass = await context.targetSchema.lookupItem<RelationshipClass>(itemKey);
      if(relationshipClass === undefined) {
        return { errorMessage: `Unable to locate the relationship class ${itemKey.name} in the merged schema.`};
      }
      const constraint = change.path === "$source"
        ? relationshipClass.source
        : relationshipClass.target;

      return context.editor.relationships.addCustomAttributeToConstraint(constraint, change.json);
    }
    if(isPropertyDifference(change)) {
      const itemKey = new SchemaItemKey(change.itemName, context.targetSchemaKey);
      const [propertyName] = change.path.split(".");
      return context.editor.entities.addCustomAttributeToProperty(itemKey, propertyName, change.json);
    }
    if(isSchemaItemDifference(change)) {
      const itemKey = new SchemaItemKey(change.itemName, context.targetSchemaKey);
      return context.editor.entities.addCustomAttribute(itemKey, change.json);
    }
    return {};
  } else {
    return { errorMessage: `Changes of Custom Attribute on merge is not implemented.`};
  }
}

function isSchemaDifference(change: CustomAttributeDifference): change is CustomAttributeSchemaDifference {
  return "path" in change && change.path === "$schema";
}

function isPropertyDifference(change: CustomAttributeDifference): change is CustomAttributePropertyDifference {
  return "itemName" in change && "path" in change;
}

function isRelationshipConstraintDifference(change: CustomAttributeDifference): change is CustomAttributeRelationshipDifference {
  return "path" in change && (change.path === "$source" || change.path === "$target");
}

function isSchemaItemDifference(change: CustomAttributeDifference): change is CustomAttributeSchemaItemDifference {
  return "itemName" in change && !("path" in change);
}
