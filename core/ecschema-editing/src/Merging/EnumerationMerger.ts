/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { primitiveTypeToString, SchemaItemKey } from "@itwin/ecschema-metadata";
import type { EnumerationDifference, EnumeratorDifference } from "../Differencing/SchemaDifference";
import type { SchemaItemMergerHandler } from "./SchemaItemMerger";
import type { MutableEnumeration } from "../Editing/Mutable/MutableEnumeration";

/**
 * Defines a merge handler to merge Enumeration schema items.
 * @internal
 */
export const enumerationMerger: SchemaItemMergerHandler<EnumerationDifference> = {
  async add(context, change: EnumerationDifference) {
    if (change.difference.type === undefined) {
      return { errorMessage: "Enumerations must define a type property" };
    }
    if (change.difference.isStrict === undefined) {
      return { errorMessage: "Enumerations must define whether enumeration is strict." };
    }
    if (change.difference.enumerators === undefined) {
      return { errorMessage: "Enumerations must define at least ine enumerator." };
    }

    return context.editor.enumerations.createFromProps(context.targetSchemaKey, {
      ...change.difference,
      name: change.itemName,
      schemaItemType: change.schemaType,
      type: change.difference.type,
      isStrict: change.difference.isStrict,
      enumerators: change.difference.enumerators,
    });
  },
  async modify(_context, change, itemKey, item: MutableEnumeration) {
    if(change.difference.type !== undefined) {
      return { errorMessage: `The Enumeration ${itemKey.name} has an incompatible type. It must be "${primitiveTypeToString(item.type!)}", not "${change.difference.type}".` };
    }
    if(change.difference.label !== undefined) {
      item.setDisplayLabel(change.difference.label);
    }
    if(change.difference.description !== undefined) {
      item.setDescription(change.difference.description);
    }
    if(change.difference.isStrict !== undefined) {
      item.setIsStrict(change.difference.isStrict);
    }
    return { itemKey};
  },
};

/**
 * Defines a merge handler to merge Enumeration schema items.
 * @internal
 */
export const enumeratorMerger: SchemaItemMergerHandler<EnumeratorDifference> = {
  async add(context, change) {
    if (change.difference.name === undefined) {
      return { errorMessage: "Enumerators must define a name" };
    }
    if (change.difference.value === undefined) {
      return { errorMessage: "Enumerators must define a value" };
    }

    const itemKey = new SchemaItemKey(change.itemName, context.targetSchemaKey);
    await context.editor.enumerations.addEnumerator(itemKey, {
      name: change.difference.name,
      value: change.difference.value,
      label: change.difference.label,
      description: change.difference.description,
    });

    return { itemKey };
  },
  async modify(context, change, itemKey) {
    if(change.difference.value !== undefined) {
      return { errorMessage: `Failed to merge enumerator attribute, Enumerator "${change.path}" has different values.` };
    }

    if(change.difference.description !== undefined) {
      await context.editor.enumerations.setEnumeratorDescription(itemKey, change.path, change.difference.description);
    }
    if(change.difference.label !== undefined) {
      await context.editor.enumerations.setEnumeratorLabel(itemKey, change.path, change.difference.label);
    }
    return { itemKey };
  },
};
