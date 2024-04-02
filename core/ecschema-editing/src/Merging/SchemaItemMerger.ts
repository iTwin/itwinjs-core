/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { SchemaMergeContext } from "./SchemaMerger";
import type { SchemaEditResults, SchemaItemEditResults } from "../Editing/Editor";
import { AnySchemaDifference, AnySchemaItemDifference, SchemaDifference } from "../Differencing/SchemaDifference";
import { ECObjectsError, ECObjectsStatus, SchemaContext, SchemaItem, SchemaItemKey } from "@itwin/ecschema-metadata";
import { enumerationMerger, enumeratorMerger } from "./EnumerationMerger";
import { phenomenonMerger } from "./PhenomenonMerger";
import { propertyCategoryMerger } from "./PropertyCategoryMerger";
import { unitSystemMerger } from "./UnitSystemMerger";
import { kindOfQuantityMerger } from "./KindOfQuantityMerger";
import { constantMerger } from "./ConstantMerger";
import { mergeClassItems } from "./ClassMerger";

/**
 * @internal
 */
export interface SchemaItemMergerHandler<T extends AnySchemaItemDifference> {
  add:    (context: SchemaMergeContext, change: T) => Promise<SchemaItemEditResults>;
  modify: (context: SchemaMergeContext, change: T, itemKey: SchemaItemKey, item: any) => Promise<SchemaItemEditResults>;
}

/**
 * Handles the merging logic for everything that is same for all schema items such as labels or descriptions
 * @internal
 */
async function mergeSchemaItem<T extends AnySchemaItemDifference>(context: SchemaMergeContext, change: T, merger: SchemaItemMergerHandler<T>): Promise<SchemaEditResults> {
  if(change.changeType === "add") {
    return merger.add(context, change);
  }

  if(change.changeType === "modify") {
    const schemaItem = await locateSchemaItem(context, change.itemName, change.schemaType);
    return merger.modify(context, change, schemaItem.key, schemaItem);
  }

  return { errorMessage: `The merger does not support ${change.changeType} of ${change.schemaType}.` };
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

/**
 * Merges the given set of schema items. As schema items may depend or relate with other
 * schema items, the list gets filtered to ensure the items get merged in a certain order.
 * @param context       The current merging context.
 * @param itemChanges   Set of schema item that differed.
 * @returns             An async iterable with the merge result for each schema item.
 * @internal
 */
export async function* mergeSchemaItems(context: SchemaMergeContext, itemChanges: AnySchemaDifference[]) {
  for (const difference of itemChanges.filter(SchemaDifference.isUnitSystemDifference)) {
    yield await mergeSchemaItem(context, difference, unitSystemMerger);
  }

  for (const difference of itemChanges.filter(SchemaDifference.isPropertyCategoryDifference)) {
    yield await mergeSchemaItem(context, difference, propertyCategoryMerger);
  }

  for (const difference of itemChanges.filter(SchemaDifference.isEnumerationDifference)) {
    yield await mergeSchemaItem(context, difference, enumerationMerger);
  }

  for (const difference of itemChanges.filter(SchemaDifference.isEnumeratorDifference)) {
    yield await mergeSchemaItem(context, difference, enumeratorMerger);
  }

  for (const difference of itemChanges.filter(SchemaDifference.isPhenomenonDifference)) {
    yield await mergeSchemaItem(context, difference, phenomenonMerger);
  }

  // TODO:
  // The following schema items are not supported yet. Mentioned in the processing order:
  // - Unit
  // - Inverted Unit
  // - Format

  for (const difference of itemChanges.filter(SchemaDifference.isKindOfQuantityDifference)) {
    yield await mergeSchemaItem(context, difference, kindOfQuantityMerger);
  }

  for (const difference of itemChanges.filter(SchemaDifference.isConstantDifference)) {
    yield await mergeSchemaItem(context, difference, constantMerger);
  }

  // Classes are slightly differently merged, since they can refer each other the process
  // uses several stages to merge.
  for await (const classMergeResult of mergeClassItems(context, itemChanges)) {
    yield classMergeResult;
  }
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
