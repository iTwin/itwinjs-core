/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { type KindOfQuantityDifference } from "../Differencing/SchemaDifference";
import { type SchemaMergerHandler, updateSchemaItemFullName } from "./SchemaItemMerger";
import { type MutableKindOfQuantity } from "../Editing/Mutable/MutableKindOfQuantity";
import { SchemaMergeContext } from "./SchemaMerger";

/**
 * @internal
 */
export const kindOfQuantityMerger: SchemaMergerHandler<KindOfQuantityDifference> = {
  async add(context, change) {
    change.difference.persistenceUnit = await updateSchemaItemFullName(context, change.difference.persistenceUnit);
    if(change.difference.presentationUnits) {
      if(Array.isArray(change.difference.presentationUnits)) {
        for(let index = 0; index < change.difference.presentationUnits.length; index++) {
          change.difference.presentationUnits[index] = await updateOverrideFormat(context, change.difference.presentationUnits[index]);
        }
      } else {
        change.difference.presentationUnits = await updateOverrideFormat(context, change.difference.presentationUnits);
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

async function updateOverrideFormat(context: SchemaMergeContext, formatString: string) {
  // https://www.itwinjs.org/v1/bis/ec/kindofquantity/#format-string
  const match = formatString.match(/^([^(]+)\((\d+)\)\[(.*)\]$/);
  if(match === null) {
    return formatString;
  }

  const originalFormat = match[1];
  const updatedFormat = await updateSchemaItemFullName(context, originalFormat);

  const unitOverrides  = match[3].split("][");
  for(let index=0; index< unitOverrides.length; index++) {
    const [unit, label] = unitOverrides[index].split("|");
    const updatedUnit = await updateSchemaItemFullName(context, unit);
    unitOverrides[index] = `${updatedUnit}${label ? `|${label}` : ""}`;
  }

  return `${updatedFormat}(${match[2]})[${unitOverrides.join("][")}]`;
}
