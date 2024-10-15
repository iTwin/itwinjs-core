/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { KindOfQuantityDifference } from "../Differencing/SchemaDifference";
import type { MutableKindOfQuantity } from "../Editing/Mutable/MutableKindOfQuantity";
import type { SchemaMergeContext } from "./SchemaMerger";
import type { SchemaItemKey } from "@itwin/ecschema-metadata";
import { updateSchemaItemFullName } from "./Utils";

/**
 * Merges a new KindOfQuantity into the target schema.
 * @internal
 */
export async function addKindOfQuantity(context: SchemaMergeContext, change: KindOfQuantityDifference) {
  if (change.difference.persistenceUnit === undefined) {
    throw new Error("KindOfQuantity must define persistenceUnit");
  }
  if (change.difference.relativeError === undefined) {
    throw new Error("KindOfQuantity must define relativeError");
  }
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

  await context.editor.kindOfQuantities.createFromProps(context.targetSchemaKey, {
    ...change.difference,
    name: change.itemName,
    schemaItemType: change.schemaType,
    persistenceUnit: change.difference.persistenceUnit,
    presentationUnits: change.difference.presentationUnits,
    relativeError: change.difference.relativeError,
  });
}

/**
 * Merges differences to an existing KindOfQuantity in the target schema.
 * @internal
 */
export async function modifyKindOfQuantity(context: SchemaMergeContext, change: KindOfQuantityDifference, itemKey: SchemaItemKey) {
  const kindOfQuantity = await context.targetSchema.lookupItem(itemKey) as MutableKindOfQuantity;
  if(change.difference.label !== undefined) {
    await context.editor.kindOfQuantities.setDisplayLabel(itemKey, change.difference.label);
  }
  if(change.difference.description !== undefined) {
    await context.editor.kindOfQuantities.setDescription(itemKey, change.difference.description);
  }
  if(change.difference.relativeError !== undefined) {
    kindOfQuantity.setRelativeError(change.difference.relativeError);
  }
  if(change.difference.persistenceUnit !== undefined) {
    // TODO: It should be checked if the unit is the same, but referring to the source schema.
    throw new Error(`Changing the kind of quantity '${itemKey.name}' persistenceUnit is not supported.`);
  }
}

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
