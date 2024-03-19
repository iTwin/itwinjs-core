/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { primitiveTypeToString, SchemaItemKey } from "@itwin/ecschema-metadata";
import type { EnumerationDifference, EnumeratorDifference } from "../Differencing/SchemaDifference";
import type { SchemaMergerHandler } from "./SchemaItemMerger";
import { type MutableEnumeration } from "../Editing/Mutable/MutableEnumeration";

type ChangeTypes = EnumerationDifference | EnumeratorDifference;

/**
 * @internal
 */
export const enumerationMerger: SchemaMergerHandler<ChangeTypes> = {
  async add(context, change) {
    if(isEnumeratorDifference(change)) {
      const itemKey = new SchemaItemKey(change.itemName, context.targetSchemaKey);
      await context.editor.enumerations.addEnumerator(itemKey, change.difference);
      return {};
    }

    return context.editor.enumerations.createFromProps(context.targetSchemaKey, {
      name: change.itemName,
      ...change.difference,
    });
  },
  async modify(context, change, itemKey, item: MutableEnumeration) {
    if(isEnumeratorDifference(change)) {
      const [_path, enumeratorName] = change.path.split(".");
      if(change.difference.value) {
        return { errorMessage: `Failed to merge enumerator attribute, Enumerator "${enumeratorName}" has different values.` };
      }

      if(change.difference.description) {
        await context.editor.enumerations.setEnumeratorDescription(itemKey, enumeratorName, change.difference.description);
      }
      if(change.difference.label) {
        await context.editor.enumerations.setEnumeratorLabel(itemKey, enumeratorName, change.difference.label);
      }
      return {};
    }

    if(change.difference.type) {
      return { errorMessage: `The Enumeration ${itemKey.name} has an incompatible type. It must be "${primitiveTypeToString(item.type!)}", not "${change.difference.type}".` };
    }
    if(change.difference.label) {
      item.setDisplayLabel(change.difference.label);
    }
    if(change.difference.isStrict) {
      item.setIsStrict(change.difference.isStrict);
    }

    return {};
  },
};

function isEnumeratorDifference(change: ChangeTypes): change is EnumeratorDifference {
  return "path" in change && change.path.startsWith("$enumerators");
}
