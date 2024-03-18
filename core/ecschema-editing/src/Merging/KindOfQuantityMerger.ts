// /*---------------------------------------------------------------------------------------------
// * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
// * See LICENSE.md in the project root for license terms and full copyright notice.
// *--------------------------------------------------------------------------------------------*/
import { type KindOfQuantityDifference } from "../Differencing/SchemaDifference";
import { type SchemaMergerHandler, updateSchemaItemFullName } from "./SchemaItemMerger";
import { type MutableKindOfQuantity } from "../Editing/Mutable/MutableKindOfQuantity";

/**
 * @internal
 */
export const kindOfQuantityMerger: SchemaMergerHandler<KindOfQuantityDifference> = {
  async add(context, change) {
    change.json.persistenceUnit = await updateSchemaItemFullName(context, change.json.persistenceUnit);
    if(change.json.presentationUnits) {
      if(Array.isArray(change.json.presentationUnits)) {
        for(let index = 0; index < change.json.presentationUnits.length; index++) {
          const updatedReference = await updateSchemaItemFullName(context, change.json.presentationUnits[index]);
          change.json.presentationUnits[index] = updatedReference;
        }
      } else {
        const updatedReference = await updateSchemaItemFullName(context, change.json.presentationUnits);
        change.json.presentationUnits = updatedReference;
      }
    }

    return context.editor.kindOfQuantities.createFromProps(context.targetSchemaKey, {
      name: change.itemName,
      ...change.json,
    });
  },
  async modify(_context, change, itemKey, item: MutableKindOfQuantity) {
    if(change.json.label) {
      item.setDisplayLabel(change.json.label);
    }
    if(change.json.relativeError) {
      // TODO: Not settable through the interface
    }
    if(change.json.persistenceUnit) {
      // TODO: It should be checked if the unit is the same, but referring to the source schema.
      throw new Error(`Changing the kind of quantity '${itemKey.name}' persistenceUnit is not supported.`);
    }
    return {};
  },
};
