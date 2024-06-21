/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { type SchemaMergeContext } from "./SchemaMerger";
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

type ClassItemHandler = <T extends AnySchemaItemDifference | AnySchemaItemPathDifference>(change: T, merger: SchemaItemMergerHandler<T>) => Promise<void>;

/**
 * @internal
 */
export async function* mergeClassItems(context: SchemaMergeContext, classChanges: AnySchemaDifference[]) {
  // In the first pass all class items will be created as stubs. That only applies to added entities.
  await iterateClassChanges(classChanges, async (change, merger) => {
    if (change.changeType === "add" && merger.add) {
      // Make a copy of the change instance, we don't want to alter the actual instance.
      const changeCopy = {
        ...change,
        difference: {
          ...change.difference,
          // Remove everything we want to validate before setting
          baseClass: undefined,
          mixins: undefined,
          properties: undefined,
          customAttributes: undefined,
        },
      };
      await merger.add(context, changeCopy);
    }
  });

  // In the second pass the base classes and mixins get merged. At that add-changes are
  // effectively modify changes now, as the items has been created in the first pass.
  await iterateClassChanges(classChanges, async (change, merger) => {
    if (merger.modify) {
      const schemaItem = await locateSchemaItem(context, change.itemName, change.schemaType);
      await merger.modify(context, change, schemaItem.key, schemaItem);
    }
  });

  for (const difference of classChanges.filter(Utils.isEntityClassMixinDifference)) {
    await mergeClassMixins(context, difference);
  }

  for (const difference of classChanges.filter(Utils.isRelationshipConstraintDifference)) {
    await mergeRelationshipConstraint(context, difference);
  }

  for (const difference of classChanges.filter(Utils.isRelationshipConstraintClassDifference)) {
    await mergeRelationshipClassConstraint(context, difference);
  }

  // At last step the properties that are added to existing classes or modified.
  for (const difference of classChanges.filter(Utils.isClassPropertyDifference)) {
    await mergePropertyDifference(context, difference);
  }
}

async function iterateClassChanges(classChanges: AnySchemaDifference[], handler: ClassItemHandler) {
  for (const difference of classChanges.filter(Utils.isCustomAttributeClassDifference)) {
    await handler(difference, customAttributeClassMerger);
  }

  for (const difference of classChanges.filter(Utils.isMixinClassDifference)) {
    await handler(difference, mixinClassMerger);
  }

  for (const difference of classChanges.filter(Utils.isStructClassDifference)) {
    await handler(difference, structClassMerger);
  }

  for (const difference of classChanges.filter(Utils.isEntityClassDifference)) {
    await handler(difference, entityClassMerger);
  }

  for (const difference of classChanges.filter(Utils.isRelationshipClassDifference)) {
    await handler(difference, relationshipClassMerger);
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
