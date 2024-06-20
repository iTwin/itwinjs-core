/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { MergeFn, SchemaMergeContext } from "./SchemaMerger";
import { AnySchemaDifference, AnySchemaItemDifference, AnySchemaItemPathDifference } from "../Differencing/SchemaDifference";
import { ECObjectsError, ECObjectsStatus, SchemaContext, SchemaItem, SchemaItemKey } from "@itwin/ecschema-metadata";
import { filterClassItems } from "./ClassMerger";
import { enumerationMerger, enumeratorMerger } from "./EnumerationMerger";
import { phenomenonMerger } from "./PhenomenonMerger";
import { propertyCategoryMerger } from "./PropertyCategoryMerger";
import { unitSystemMerger } from "./UnitSystemMerger";
import { kindOfQuantityMerger } from "./KindOfQuantityMerger";
import { constantMerger } from "./ConstantMerger";
import * as Utils from "../Differencing/Utils";

/**
 * @internal
 */
export interface SchemaItemMergerHandler<T extends AnySchemaItemDifference | AnySchemaItemPathDifference> {
  add: (context: SchemaMergeContext, difference: T) => Promise<SchemaItemKey>;
  modify: (context: SchemaMergeContext, difference: T, itemKey: SchemaItemKey, item: any) => Promise<void>;
}

/**
 * Handles the merging logic for everything that is same for all schema items such as labels or descriptions
 * @internal
 */
async function mergeSchemaItem<T extends AnySchemaItemDifference | AnySchemaItemPathDifference>(context: SchemaMergeContext, difference: T, merger: SchemaItemMergerHandler<T>): Promise<void> {
  if (difference.changeType === "add") {
    await merger.add(context, difference);
    return;
  }

  if (difference.changeType === "modify") {
    const schemaItem = await locateSchemaItem(context, difference.itemName, difference.schemaType);
    return merger.modify(context, difference, schemaItem.key, schemaItem);
  }

  throw new Error(`The merger does not support ${difference.changeType} of ${difference.schemaType}.`);
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
 * @param differences   Set of schema item that differed.
 * @returns             An async iterable with the merge result for each schema item.
 * @internal
 */
export function* filterSchemaItems(differences: AnySchemaDifference[]): Iterable<MergeFn> {
  for (const difference of differences.filter(Utils.isUnitSystemDifference)) {
    yield async (context) => await mergeSchemaItem(context, difference, unitSystemMerger);
  }

  for (const difference of differences.filter(Utils.isPropertyCategoryDifference)) {
    yield async (context) => await mergeSchemaItem(context, difference, propertyCategoryMerger);
  }

  for (const difference of differences.filter(Utils.isEnumerationDifference)) {
    yield async (context) => await mergeSchemaItem(context, difference, enumerationMerger);
  }

  for (const difference of differences.filter(Utils.isEnumeratorDifference)) {
    yield async (context) => await mergeSchemaItem(context, difference, enumeratorMerger);
  }

  for (const difference of differences.filter(Utils.isPhenomenonDifference)) {
    yield async (context) => await mergeSchemaItem(context, difference, phenomenonMerger);
  }

  // TODO:
  // The following schema items are not supported yet. Mentioned in the processing order:
  // - Unit
  // - Inverted Unit
  // - Format

  for (const difference of differences.filter(Utils.isKindOfQuantityDifference)) {
    yield async (context) => await mergeSchemaItem(context, difference, kindOfQuantityMerger);
  }

  for (const difference of differences.filter(Utils.isConstantDifference)) {
    yield async (context) => await mergeSchemaItem(context, difference, constantMerger);
  }

  // Classes are slightly differently merged, since they can refer each other the process
  // uses several stages to merge.
  for (const classMerger of filterClassItems(differences)) {
    yield classMerger;
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
