/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { type SchemaMergeContext } from "./SchemaMerger";
import { AnyClassItemDifference } from "../Differencing/SchemaDifference";
import { updateSchemaItemKey } from "./Utils";
import { type MutableClass } from "../Editing/Mutable/MutableClass";
import { CustomAttribute, ECClass, ECClassModifier, parseClassModifier, SchemaItemKey, SchemaItemType } from "@itwin/ecschema-metadata";
import { mergeClassProperties } from "./PropertyMerger";
import { applyCustomAttributes } from "./CustomAttributeMerger";

/**
 * Shared modify merger of all ECClass based items.
 * @internal
 */
export async function modifyClass(context: SchemaMergeContext, change: AnyClassItemDifference, itemKey: SchemaItemKey, item: ECClass): Promise<void> {
  const mutableClass = item as MutableClass;
  if (change.difference.label !== undefined) {
    mutableClass.setDisplayLabel(change.difference.label);
  }

  if (change.difference.description !== undefined) {
    mutableClass.setDescription(change.difference.description);
  }

  if (change.difference.hasOwnProperty("baseClass")) {
    // If the entry difference have a property baseClass and it is explicitly set to undefined,
    // it is expected to remove the base class, which is not allowed in this case.
    // TODO: We should consider using null for this case.
    if(change.difference.baseClass === undefined) {
      throw new Error(`Changing the class '${item.key.name}' baseClass is not supported.`);
    }
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
  if (!isInitial && (item.baseClass === undefined))
    throw new Error(`Changing the class '${item.key.name}' baseClass is not supported.`);

  const baseClassKey = await updateSchemaItemKey(context, baseClass);
  const baseClassSetter = getBaseClassSetter(context, item);

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
