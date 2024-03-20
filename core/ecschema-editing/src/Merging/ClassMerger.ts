/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { SchemaMergeContext } from "./SchemaMerger";
import { AnySchemaItemDifference, ClassItemDifference, SchemaItemTypeName, StructClassDifference } from "../Differencing/SchemaDifference";
import { AnyMergerHandler, filterByType, locateSchemaItem, SchemaItemMergerHandler, updateSchemaItemKey } from "./SchemaItemMerger";
import { type MutableClass } from "../Editing/Mutable/MutableClass";
import { ECClass, ECClassModifier, parseClassModifier, SchemaItemKey, SchemaItemType } from "@itwin/ecschema-metadata";
import { SchemaEditResults } from "../Editing/Editor";
import { entityClassMerger } from "./EntityClassMerger";
import { customAttributeClassMerger } from "./CAClassMerger";
import { mixinClassMerger } from "./MixinMerger";
import { relationshipClassMerger } from "./RelationshipClassMerger";
import { mergeClassProperties, mergePropertyDifference } from "./PropertyMerger";

type ClassItemHandler = <T extends AnySchemaItemDifference>(change: T, merger: AnyMergerHandler<T>) => Promise<void>;

/**
 * @internal
 */
export async function * mergeClassItems(context: SchemaMergeContext, classChanges: AnySchemaItemDifference[]) {
  // In the first pass all class items will be created as stubs. That only applies to added entities.
  await iterateClassChanges(classChanges, async (change, merger) => {
    if(change.changeType === "add" && merger.add) {
      // Make a copy of the change instance, we don't want to alter the actual instance.
      const changeCopy = {
        ...change,
        difference: {
          ...change.difference,
          // Remove everything we want to validate before setting
          baseClass: undefined,
          mixins: undefined,
          properties: undefined,
        },
      };
      await merger.add(context, changeCopy);
    }
  });

  // In the second pass the base classes and mixins get merged. At that add-changes are
  // effectively modify changes now, as the items has been created in the first pass.
  await iterateClassChanges(classChanges, async (change, merger) => {
    if(merger.modify) {
      const schemaItem = await locateSchemaItem(context, change.itemName, change.schemaType);
      const result = await merger.modify(context, change, schemaItem.key, schemaItem);
      if(result.errorMessage) {
        throw new Error(result.errorMessage);
      }
    }
  });

  // At last step the properties that are added to existing classes or modified.
  for (const difference of filterByType(classChanges, "Property")) {
    const result = await mergePropertyDifference(context, difference);
    if(result.errorMessage) {
      throw new Error(result.errorMessage);
    }
  }
}

async function iterateClassChanges(classChanges: AnySchemaItemDifference[], handler: ClassItemHandler) {
  for (const difference of filterByType(classChanges, SchemaItemTypeName.CustomAttributeClass)) {
    await handler(difference, customAttributeClassMerger);
  }

  for (const difference of filterByType(classChanges, SchemaItemTypeName.Mixin)) {
    await handler(difference, mixinClassMerger);
  }

  for (const difference of filterByType(classChanges, SchemaItemTypeName.StructClass)) {
    await handler(difference, structClassMerger);
  }

  for (const difference of filterByType(classChanges, SchemaItemTypeName.EntityClass)) {
    await handler(difference, entityClassMerger);
  }

  for (const difference of filterByType(classChanges, SchemaItemTypeName.RelationshipClass)) {
    await handler(difference, relationshipClassMerger);
  }
}

/**
 * Shared modify merger of all ECClass based items.
 * @internal
 */
export async function modifyClass(context: SchemaMergeContext, change: ClassItemDifference, itemKey: SchemaItemKey, item: ECClass): Promise<SchemaEditResults> {
  const mutableClass = item as MutableClass;
  if(change.difference.label) {
    mutableClass.setDisplayLabel(change.difference.label);
  }
  if(change.difference.description) {
    mutableClass.setDescription(change.difference.description);
  }

  if(change.difference.baseClass) {
    const result = await setBaseClass(context, item, change.difference.baseClass, change.changeType === "add");
    if(result.errorMessage) {
      return result;
    }
  }

  if(change.difference.modifier) {
    const result = await setClassModifier(mutableClass, change.difference.modifier);
    if(result.errorMessage) {
      return result;
    }
  }

  return mergeClassProperties(context, change, itemKey);
}

async function setBaseClass(context: SchemaMergeContext, item: ECClass, baseClass: string, isInitial: boolean): Promise<SchemaEditResults> {
  const baseClassKey = await updateSchemaItemKey(context, baseClass);
  const baseClassSetter = getBaseClassSetter(context, item);
  if(isInitial && item.baseClass === undefined) {
    return baseClassSetter(item.key, baseClassKey);
  }
  if(item.baseClass !== undefined) {
    const currentBaseClass = await item.baseClass;
    const newBaseClass = await context.editor.schemaContext.getSchemaItem<ECClass>(baseClassKey);
    if (newBaseClass === undefined) {
      return { errorMessage: `'${baseClassKey.name}' class could not be located in the merged schema.`};
    }
    if(await currentBaseClass.is(newBaseClass)) {
      return baseClassSetter(item.key, baseClassKey);
    }
  }
  return { errorMessage: `Changing the class '${item.key.name}' baseClass is not supported.`};
}

async function setClassModifier(item: MutableClass, modifierValue: string): Promise<SchemaEditResults> {
  const modifier = parseClassModifier(modifierValue);
  if(modifier === undefined) {
    return { errorMessage: "An invalid class modifier has been provided." };
  }
  if(item.modifier === undefined || item.modifier === modifier || modifier === ECClassModifier.None) {
    item.setModifier(modifier);
    return {};
  }
  return { errorMessage: `Changing the class '${item.name}' modifier is not supported.` };
}

function getBaseClassSetter(context: SchemaMergeContext, item: ECClass) {
  return async (itemKey: SchemaItemKey, baseClassKey: SchemaItemKey) => {
    switch(item.schemaItemType) {
      case SchemaItemType.EntityClass: return context.editor.entities.setBaseClass(itemKey, baseClassKey);
      case SchemaItemType.Mixin: return context.editor.mixins.setMixinBaseClass(itemKey, baseClassKey);
      // TODO: verify; structs and relationship classes can't have base classes?
    }
    return { errorMessage: `Changing the base class '${item.name}' is not supported.` };
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
