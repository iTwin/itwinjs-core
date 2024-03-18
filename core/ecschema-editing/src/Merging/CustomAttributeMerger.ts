/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Merging
 */

import { CustomAttributeClass, SchemaItem, SchemaItemKey, SchemaKey } from "@itwin/ecschema-metadata";
import { type SchemaMergeContext } from "./SchemaMerger";
import { type SchemaCustomAttributeDifference } from "../Differencing/SchemaDifference";
import { type SchemaEditResults } from "../Editing/Editor";

/**
 * Merges the custom attributes of the given changes iterable. The third parameter is a callback to pass
 * a scope (Class, Property, Schema) specific handler.
 * @param context   The current schema merging context.
 * @param change    The individual custom attribute change.
 * @returns         A EditResults object.
 * @internal
 */
export async function mergeCustomAttribute(context: SchemaMergeContext, change: SchemaCustomAttributeDifference): Promise<SchemaEditResults> {
  if (change.changeType === "add") {
    const [schemaName, itemName]  = SchemaItem.parseFullName(change.json.className);
    const schemaItemKey = new SchemaItemKey(itemName, context.sourceSchemaKey.compareByName(schemaName)
      ? context.targetSchemaKey
      : new SchemaKey(schemaName),
    );

    const targetCustomAttributeClass = await context.targetSchema.lookupItem<CustomAttributeClass>(schemaItemKey);
    if (targetCustomAttributeClass === undefined) {
      return { errorMessage: `Unable to locate the custom attribute class ${schemaItemKey.name} in the merged schema.`};
    }

    if(change.schemaType === "Schema") {
      return context.editor.addCustomAttribute(context.targetSchemaKey, change.json);
    }
    if(change.schemaType === "EntityClass") {
      const itemKey = new SchemaItemKey(change.itemName!, context.targetSchemaKey);
      return context.editor.entities.addCustomAttribute(itemKey, change.json);
    }
    if(change.schemaType === "Properties") {
      const itemKey = new SchemaItemKey(change.itemName!, context.targetSchemaKey);
      const [propertyName] = change.path!.split(".");
      return context.editor.entities.addCustomAttributeToProperty(itemKey, propertyName, change.json);
    }
    if(change.schemaType === "RelationshipConstraint") {
      // return context.editor.relationships.addCustomAttributeToConstraint();
      // TODO parse constraint name (source/target)
      throw new Error("RelationshipConstraint CAs not implemented yet");
    }
    return {};
  } else {
    return { errorMessage: `Changes of Custom Attribute ${change.itemName} on merge is not implemented.`};
  }
}
