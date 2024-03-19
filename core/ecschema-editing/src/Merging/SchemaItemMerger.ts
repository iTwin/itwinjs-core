/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { SchemaMergeContext } from "./SchemaMerger";
import type { SchemaEditResults } from "../Editing/Editor";
import { AnySchemaItemDifference, DifferenceType, SchemaItemTypeName, SchemaType } from "../Differencing/SchemaDifference";
import { ECObjectsError, ECObjectsStatus, SchemaItem, SchemaItemKey } from "@itwin/ecschema-metadata";
import { enumerationMerger } from "./EnumerationMerger";
import { phenomenonMerger } from "./PhenomenonMerger";
import { propertyCategoryMerger } from "./PropertyCategoryMerger";
import { unitSystemMerger } from "./UnitSystemMerger";
import { kindOfQuantityMerger } from "./KindOfQuantityMerger";
import { constantMerger } from "./ConstantMerger";
import { mergeClassItems } from "./ClassMerger";

type FilteredType<T extends SchemaType> = Extract<AnySchemaItemDifference, { schemaType: T }>;
interface ChangeHandlerMapping<T> {
  add:    (context: SchemaMergeContext, change: T) => Promise<SchemaEditResults>;
  modify: (context: SchemaMergeContext, change: T, itemKey: SchemaItemKey, item: any) => Promise<SchemaEditResults>;
}

/**
 * @internal
 */
export type SchemaMergerHandler<T extends AnySchemaItemDifference> = {
  [P in T["changeType"]]: ChangeHandlerMapping<T>[P];
};

/**
 * @internal
 */
export type AnyMergerHandler<T extends AnySchemaItemDifference = AnySchemaItemDifference> = {
  [P in DifferenceType]?: ChangeHandlerMapping<T>[P];
};

/**
 * Small typescript wrapper around the Array.filter to avoid extra casting.
 * @internal
 */
export function filterByType<T extends SchemaType, R=FilteredType<T>>(differences: AnySchemaItemDifference[], type: T): R[] {
  return differences.filter((entry) => entry.schemaType === type) as R[];
}

/** Handles the merging logic for everything that is same for all schema items such as labels or descriptions */
async function mergeSchemaItem<T extends AnySchemaItemDifference>(context: SchemaMergeContext, change: T, merger: AnyMergerHandler<T>): Promise<SchemaEditResults> {
  if(change.changeType === "add" && merger.add) {
    return merger.add(context, change);
  }

  if(change.changeType === "modify" && merger.modify) {
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
  if(schemaItem === undefined) {
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
export async function * mergeSchemaItems(context: SchemaMergeContext, itemChanges: AnySchemaItemDifference[]) {
  for (const difference of filterByType(itemChanges, SchemaItemTypeName.UnitSystem)) {
    yield await mergeSchemaItem(context, difference, unitSystemMerger);
  }

  for (const difference of filterByType(itemChanges, SchemaItemTypeName.PropertyCategory)) {
    yield await mergeSchemaItem(context, difference, propertyCategoryMerger);
  }

  for (const difference of filterByType(itemChanges, SchemaItemTypeName.Enumeration)) {
    yield await mergeSchemaItem(context, difference, enumerationMerger);
  }

  for (const difference of filterByType(itemChanges, SchemaItemTypeName.Phenomenon)) {
    yield await mergeSchemaItem(context, difference, phenomenonMerger);
  }

  // for (const _difference of itemChanges.filter((entry) => entry.schemaType === "Unit")) {

  // }

  // for (const _difference of itemChanges.filter((entry) => entry.schemaType === "InvertedUnit")) {

  // }

  // for (const _difference of itemChanges.filter((entry) => entry.schemaType === "Format")) {

  // }

  for (const difference of filterByType(itemChanges, SchemaItemTypeName.KindOfQuantity)) {
    yield await mergeSchemaItem(context, difference, kindOfQuantityMerger);
  }

  for (const difference of filterByType(itemChanges, SchemaItemTypeName.Constant)) {
    yield await mergeSchemaItem(context, difference, constantMerger);
  }

  // Classes are slightly differently merged, since they can refer each other the process
  // uses several stages to merge.
  for await(const classMergeResult of mergeClassItems(context, itemChanges)) {
    yield classMergeResult;
  }
}

/**
 * @internal
 */
export async function updateSchemaItemFullName(context: SchemaMergeContext, reference: string) {
  const schemaItemKey = await updateSchemaItemKey(context, reference);
  return schemaItemKey.fullName;
}

/**
 * @internal
 */
export async function updateSchemaItemKey(context: SchemaMergeContext, reference: string) {
  // There are two options, either the phenomenon was referenced from another
  // schema or it is defined in the same schema as the constant to be merged.
  // In the latter case, the changes would report a different property value that
  // refers to the source schema. So that needs to be changed here.
  const [schemaName, itemName] = SchemaItem.parseFullName(reference);
  if(schemaName === context.sourceSchemaKey.name) {
    return new SchemaItemKey(itemName, context.targetSchemaKey);
  }

  const referencedSchema = await context.targetSchema.getReference(schemaName);
  if(referencedSchema !== undefined) {
    return new SchemaItemKey(itemName, referencedSchema.schemaKey);
  }

  throw new Error(`Cannot locate referenced schema item ${reference}`);
}
