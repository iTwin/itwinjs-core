/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { CustomAttributeClassDifference } from "../Differencing/SchemaDifference";
import type { MutableCAClass } from "../Editing/Mutable/MutableCAClass";
import type { SchemaMergeContext } from "./SchemaMerger";
import { containerTypeToString, parseCustomAttributeContainerType, SchemaItemKey } from "@itwin/ecschema-metadata";
import { modifyClass } from "./ClassMerger";

/**
 * Merges a new CustomAttribute into the target schema.
 * @internal
 */
export async function addCustomAttributeClass(context: SchemaMergeContext, change: CustomAttributeClassDifference) {
  if (change.difference.appliesTo === undefined) {
    throw new Error("appliesTo is a required property of a CustomAttributeClass but it is not set");
  }

  await context.editor.customAttributes.createFromProps(context.targetSchemaKey, {
    ...change.difference,
    name: change.itemName,
    schemaItemType: change.schemaType,
    appliesTo: change.difference.appliesTo,
  });
}

/**
 * Merges differences to an existing CustomAttribute in the target schema.
 * @internal
 */
export async function modifyCustomAttributeClass(context: SchemaMergeContext, change: CustomAttributeClassDifference, itemKey: SchemaItemKey) {
  const item = await context.targetSchema.lookupItem(itemKey) as MutableCAClass;
  if (change.difference.appliesTo !== undefined) {
    const currentValue = containerTypeToString(item.appliesTo);
    if (currentValue !== "" && change.difference.appliesTo !== currentValue) {
      const containerType = parseCustomAttributeContainerType(`${currentValue}, ${change.difference.appliesTo}`);
      if (containerType === undefined) {
        throw new Error("An invalid custom attribute class containerType has been provided.");
      }
      item.setAppliesTo(containerType);
    }
  }
  return modifyClass(context, change, itemKey, item);
}
