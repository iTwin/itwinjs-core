// /*---------------------------------------------------------------------------------------------
// * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
// * See LICENSE.md in the project root for license terms and full copyright notice.
// *--------------------------------------------------------------------------------------------*/
import { SchemaItemKey } from "@itwin/ecschema-metadata";
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
      await context.editor.enumerations.addEnumerator(itemKey, change.json);
      return {};
    }

    return context.editor.enumerations.createFromProps(context.targetSchemaKey, {
      name: change.itemName,
      ...change.json,
    });
  },
  async modify(context, change, itemKey, item: MutableEnumeration) {
    if(isEnumeratorDifference(change)) {
      const [_path, enumeratorName] = change.path.split(".");
      if(change.json.description) {
        await context.editor.enumerations.setEnumeratorDescription(itemKey, enumeratorName, change.json.description);
      }
      if(change.json.label) {
        await context.editor.enumerations.setEnumeratorLabel(itemKey, enumeratorName, change.json.label);
      }
      return {};
    }

    if(change.json.label) {
      item.setDisplayLabel(change.json.label);
    }

    if(change.json.isStrict) {
      item.setIsStrict(change.json.isStrict);
    }

    return {};
  },
};

function isEnumeratorDifference(change: ChangeTypes): change is EnumeratorDifference {
  return "path" in change && change.path.startsWith("$enumerators");
}
