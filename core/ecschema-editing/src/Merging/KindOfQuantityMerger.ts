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
    change.difference.persistenceUnit = await updateSchemaItemFullName(context, change.difference.persistenceUnit);
    if(change.difference.presentationUnits) {
      if(Array.isArray(change.difference.presentationUnits)) {
        for(let index = 0; index < change.difference.presentationUnits.length; index++) {
          const updatedReference = await updateSchemaItemFullName(context, change.difference.presentationUnits[index]);
          change.difference.presentationUnits[index] = updatedReference;
        }
      } else {
        const updatedReference = await updateSchemaItemFullName(context, change.difference.presentationUnits);
        change.difference.presentationUnits = updatedReference;
      }
    }

    return context.editor.kindOfQuantities.createFromProps(context.targetSchemaKey, {
      name: change.itemName,
      ...change.difference,
    });
  },
  async modify(_context, change, itemKey, item: MutableKindOfQuantity) {
    if(change.difference.label) {
      item.setDisplayLabel(change.difference.label);
    }
    if(change.difference.relativeError) {
      // TODO: Not settable through the interface
    }
    if(change.difference.persistenceUnit) {
      // TODO: It should be checked if the unit is the same, but referring to the source schema.
      throw new Error(`Changing the kind of quantity '${itemKey.name}' persistenceUnit is not supported.`);
    }
    return {};
  },
};
