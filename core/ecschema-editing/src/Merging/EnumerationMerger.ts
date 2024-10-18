/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { primitiveTypeToString, type SchemaItemKey } from "@itwin/ecschema-metadata";
import type { EnumerationDifference } from "../Differencing/SchemaDifference";
import type { SchemaMergeContext } from "./SchemaMerger";
import type { MutableEnumeration } from "../Editing/Mutable/MutableEnumeration";

/**
 * Merges a new Enumeration into the target schema.
 * @internal
 */
export async function addEnumeration(context: SchemaMergeContext, change: EnumerationDifference) {
  if (change.difference.type === undefined) {
    throw new Error("Enumerations must define a type property");
  }
  if (change.difference.isStrict === undefined) {
    throw new Error("Enumerations must define whether enumeration is strict.");
  }
  if (change.difference.enumerators === undefined) {
    throw new Error("Enumerations must define at least ine enumerator.");
  }

  await context.editor.enumerations.createFromProps(context.targetSchemaKey, {
    ...change.difference,
    name: change.itemName,
    schemaItemType: change.schemaType,
    type: change.difference.type,
    isStrict: change.difference.isStrict,
    enumerators: change.difference.enumerators,
  });
}

/**
 * Merges differences to an existing Enumeration in the target schema.
 * @internal
 */
export async function modifyEnumeration(context: SchemaMergeContext, change: EnumerationDifference, itemKey: SchemaItemKey) {
  const enumeration = await context.targetSchema.lookupItem(itemKey) as MutableEnumeration;
  if(change.difference.type !== undefined) {
    throw new Error(`The Enumeration ${itemKey.name} has an incompatible type. It must be "${primitiveTypeToString(enumeration.type!)}", not "${change.difference.type}".`);
  }
  if(change.difference.label !== undefined) {
    await context.editor.enumerations.setDisplayLabel(itemKey, change.difference.label);
  }
  if(change.difference.description !== undefined) {
    await context.editor.enumerations.setDescription(itemKey, change.difference.description);
  }
  if(change.difference.isStrict !== undefined) {
    enumeration.setIsStrict(change.difference.isStrict);
  }
}
