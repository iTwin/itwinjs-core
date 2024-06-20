/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { MergeFn, SchemaMergeContext } from "./SchemaMerger";
import { AnySchemaDifference, AnySchemaItemDifference, AnySchemaItemPathDifference, ClassItemDifference, StructClassDifference } from "../Differencing/SchemaDifference";
import { locateSchemaItem, SchemaItemMergerHandler, updateSchemaItemKey } from "./SchemaItemMerger";
import { type MutableClass } from "../Editing/Mutable/MutableClass";
import { CustomAttribute, ECClass, ECClassModifier, parseClassModifier, SchemaItemKey, SchemaItemType } from "@itwin/ecschema-metadata";
import { entityClassMerger, mergeClassMixins } from "./EntityClassMerger";
import { customAttributeClassMerger } from "./CAClassMerger";
import { mixinClassMerger } from "./MixinMerger";
import { mergeRelationshipClassConstraint, mergeRelationshipConstraint, relationshipClassMerger } from "./RelationshipClassMerger";
import { mergeClassProperties, mergePropertyDifference } from "./PropertyMerger";
import { applyCustomAttributes } from "./CustomAttributeMerger";
import * as Utils from "../Differencing/Utils";

type ClassItemHandler = <T extends AnySchemaItemDifference | AnySchemaItemPathDifference>(context: SchemaMergeContext, change: T, merger: SchemaItemMergerHandler<T>) => Promise<void>;

/**
 * @internal
 */
export function* filterClassItems(differences: AnySchemaDifference[]): Iterable<MergeFn> {

  for (const merger of iterateClassMerger(differences, mergeAddDifference)) {
    yield merger;
  }

  for (const merger of iterateClassMerger(differences, mergeModifyDifference)) {
    yield merger;
  }

  for (const difference of differences.filter(Utils.isEntityClassMixinDifference)) {
    yield async (context) => await mergeClassMixins(context, difference);
  }

  for (const difference of differences.filter(Utils.isRelationshipConstraintDifference)) {
    yield async (context) => await mergeRelationshipConstraint(context, difference);
  }

  for (const difference of differences.filter(Utils.isRelationshipConstraintClassDifference)) {
    yield async (context) => await mergeRelationshipClassConstraint(context, difference);
  }

  // At last step the properties that are added to existing classes or modified.
  for (const difference of differences.filter(Utils.isClassPropertyDifference)) {
    yield async (context) => await mergePropertyDifference(context, difference);
  }
}

function* iterateClassMerger(differences: AnySchemaDifference[], handler: ClassItemHandler): Iterable<MergeFn> {
  for (const difference of differences.filter(Utils.isCustomAttributeClassDifference)) {
    yield async (context) => await handler(context, difference, customAttributeClassMerger);
  }

  for (const difference of differences.filter(Utils.isMixinClassDifference)) {
    yield async (context) => await handler(context, difference, mixinClassMerger);
  }

  for (const difference of differences.filter(Utils.isStructClassDifference)) {
    yield async (context) => await handler(context, difference, structClassMerger);
  }

  for (const difference of differences.filter(Utils.isEntityClassDifference)) {
    yield async (context) => await handler(context, difference, entityClassMerger);
  }

  for (const difference of differences.filter(Utils.isRelationshipClassDifference)) {
    yield async (context) => await handler(context, difference, relationshipClassMerger);
  }
}

// In the first pass all class items will be created as stubs. That only applies to added entities.
const mergeAddDifference: ClassItemHandler = async (context, difference, merger) => {
  if (difference.changeType === "add" && merger.add) {
    // Make a copy of the change instance, we don't want to alter the actual instance.
    const changeCopy = {
      ...difference,
      difference: {
        ...difference.difference,
        // Remove everything we want to validate before setting
        baseClass: undefined,
        mixins: undefined,
        properties: undefined,
        customAttributes: undefined,
      },
    };
    await merger.add(context, changeCopy);
  }
}

// In the second pass the base classes and mixins get merged. At that add-changes are
// effectively modify changes now, as the items has been created in the first pass.
const mergeModifyDifference: ClassItemHandler = async (context, difference, merger) => {
  if (merger.modify) {
    const schemaItem = await locateSchemaItem(context, difference.itemName, difference.schemaType);
    await merger.modify(context, difference, schemaItem.key, schemaItem);
  }
}

/**
 * Shared modify merger of all ECClass based items.
 * @internal
 */
export async function modifyClass(context: SchemaMergeContext, change: ClassItemDifference, itemKey: SchemaItemKey, item: ECClass): Promise<void> {
  const mutableClass = item as MutableClass;
  if (change.difference.label !== undefined) {
    mutableClass.setDisplayLabel(change.difference.label);
  }

  if (change.difference.description !== undefined) {
    mutableClass.setDescription(change.difference.description);
  }

  if (change.difference.baseClass !== undefined) {
    await setBaseClass(context, item, change.difference.baseClass, change.changeType === "add");
  }

  if (change.difference.modifier !== undefined) {
    await setClassModifier(mutableClass, change.difference.modifier);
  }

  if (change.difference.customAttributes !== undefined) {
    await applyCustomAttributes(context, change.difference.customAttributes as CustomAttribute[], async (ca) => {
      await context.editor.entities.addCustomAttribute(itemKey, ca);
    });
  }

  return mergeClassProperties(context, change, itemKey);
}

async function setBaseClass(context: SchemaMergeContext, item: ECClass, baseClass: string, isInitial: boolean): Promise<void> {
  const baseClassKey = await updateSchemaItemKey(context, baseClass);
  const baseClassSetter = getBaseClassSetter(context, item);
  if (!isInitial && item.baseClass === undefined)
    throw new Error(`Changing the class '${item.key.name}' baseClass is not supported.`);

  await baseClassSetter(item.key, baseClassKey);
}

async function setClassModifier(item: MutableClass, modifierValue: string): Promise<void> {
  const modifier = parseClassModifier(modifierValue);
  if (modifier === undefined) {
    throw new Error("An invalid class modifier has been provided.");
  }
  if (item.modifier === undefined || item.modifier === modifier || modifier === ECClassModifier.None) {
    item.setModifier(modifier);
    return;
  }
  throw new Error(`Changing the class '${item.name}' modifier is not supported.`);
}

function getBaseClassSetter(context: SchemaMergeContext, item: ECClass) {
  return async (itemKey: SchemaItemKey, baseClassKey: SchemaItemKey) => {
    switch (item.schemaItemType) {
      case SchemaItemType.CustomAttributeClass: return context.editor.customAttributes.setBaseClass(itemKey, baseClassKey);
      case SchemaItemType.EntityClass: return context.editor.entities.setBaseClass(itemKey, baseClassKey);
      case SchemaItemType.Mixin: return context.editor.mixins.setBaseClass(itemKey, baseClassKey);
      case SchemaItemType.RelationshipClass: return context.editor.relationships.setBaseClass(itemKey, baseClassKey);
      case SchemaItemType.StructClass: return context.editor.structs.setBaseClass(itemKey, baseClassKey);
    }
    throw new Error(`Changing the base class '${item.name}' is not supported.`);
  };
}

const structClassMerger: SchemaItemMergerHandler<StructClassDifference> = {
  async add(context, change) {
    return context.editor.structs.createFromProps(context.targetSchemaKey, {
      name: change.itemName,
      ...change.difference,
    });
  },
  modify: modifyClass,
};
