/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { type CustomAttributeClassDifference } from "../Differencing/SchemaDifference";
import { type SchemaItemMergerHandler } from "./SchemaItemMerger";
import { type MutableCAClass } from "../Editing/Mutable/MutableCAClass";
import { containerTypeToString, parseCustomAttributeContainerType } from "@itwin/ecschema-metadata";
import { modifyClass } from "./ClassMerger";

/**
 * Defines a merge handler to merge Custom Attribute Class schema items.
 * @internal
 */
export const customAttributeClassMerger: SchemaItemMergerHandler<CustomAttributeClassDifference> = {
  async add(context, change) {
    if (change.difference.appliesTo === undefined) {
      return { errorMessage: "appliesTo is a required property of a CustomAttributeClass but it is not set" };
    }

    return context.editor.customAttributes.createFromProps(context.targetSchemaKey, {
      ...change.difference,
      name: change.itemName,
      schemaItemType: change.schemaType,
      appliesTo: change.difference.appliesTo,
    });
  },
  async modify(context, change, itemKey, item: MutableCAClass) {
    if (change.difference.appliesTo !== undefined) {
      const currentValue = containerTypeToString(item.containerType);
      if (currentValue !== "" && change.difference.appliesTo !== currentValue) {
        const containerType = parseCustomAttributeContainerType(`${currentValue}, ${change.difference.appliesTo}`);
        if (containerType === undefined) {
          return { errorMessage: "An invalid custom attribute class containerType has been provided." };
        }
        item.setContainerType(containerType);
      }
    }
    return modifyClass(context, change, itemKey, item);
  },
};
