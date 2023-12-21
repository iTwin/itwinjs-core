/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Merging
 */

import { CustomAttribute, CustomAttributeClass, SchemaItem, SchemaItemKey, SchemaKey } from "@itwin/ecschema-metadata";
import { ChangeType, CustomAttributeContainerChanges } from "../Validation/SchemaChanges";
import { SchemaMergeContext } from "./SchemaMerger";

interface EditResults {
  errorMessage?: string;
}

/**
 * Merges the custom attributes of the given changes iterable. The third parameter is a callback to pass
 * a scope (Class, Property, Schema) specific handler.
 * @param mergeContext  The current schema merging context.
 * @param changes       An iterable with custom attribute changes.
 * @param callback      The callback to add the custom attribute with a scope specific editor.
 * @returns             A EditResults object.
 * @internal
 */
export async function mergeCustomAttributes(mergeContext: SchemaMergeContext, changes: Iterable<CustomAttributeContainerChanges>, callback: (customAttribute: CustomAttribute) => Promise<EditResults>): Promise<EditResults> {
  for (const customAttributeContainerChange of changes) {
    for (const change of customAttributeContainerChange.customAttributeChanges) {
      if (change.changeType === ChangeType.Missing) {
        const [sourceCustomAttribute] = change.diagnostic.messageArgs as [CustomAttribute];
        const [schemaName, itemName]  = SchemaItem.parseFullName(sourceCustomAttribute.className);
        const schemaItemKey = new SchemaItemKey(itemName, mergeContext.sourceSchema.schemaKey.compareByName(schemaName)
          ? mergeContext.targetSchema.schemaKey
          : new SchemaKey(schemaName),
        );
        const targetCustomAttribute = await mergeContext.targetSchema.lookupItem<CustomAttributeClass>(schemaItemKey);
        if (targetCustomAttribute === undefined) {
          return { errorMessage: `Unable to locate the custom attribute class ${schemaItemKey.name} in the merged schema.`};
        }

        const results = await callback({
          ...sourceCustomAttribute,
          className: targetCustomAttribute.fullName,
        });

        if (results.errorMessage !== undefined) {
          return {  errorMessage: results.errorMessage };
        }
      } else {
        return { errorMessage: `Changes of Custom Attribute ${customAttributeContainerChange.ecTypeName} on ${mergeContext.targetSchema.name} merge is not implemented.`};
      }
    }
  }
  return {};
}
