/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Format, InvertedUnit, OverrideFormat, SchemaItemKey, Unit } from "@itwin/ecschema-metadata";
import type { KindOfQuantityDifference, KindOfQuantityPresentationFormatDifference } from "../Differencing/SchemaDifference.js";
import type { MutableKindOfQuantity } from "../Editing/Mutable/MutableKindOfQuantity.js";
import type { SchemaMergeContext } from "./SchemaMerger.js";
import { updateSchemaItemFullName, updateSchemaItemKey } from "./Utils.js";

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
        const presentationFormat = await updateOverrideFormat(context, change.difference.presentationUnits[index]);
        change.difference.presentationUnits[index] = presentationFormat.fullName;
      }
    } else {
      const presentationFormat = await updateOverrideFormat(context, change.difference.presentationUnits);
      change.difference.presentationUnits = presentationFormat.name;
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
    throw new Error(`Changing the kind of quantity '${change.itemName}' persistenceUnit is not supported.`);
  }
}
/**
 * Merges a new presentation format into the target kind of quantity
 * @internal
*/
export async function addPresentationFormat(context: SchemaMergeContext, change: KindOfQuantityPresentationFormatDifference, itemKey: SchemaItemKey) {
  for (const formatString of change.difference) {
    const presentationFormat = await updateOverrideFormat(context, formatString);
    if (OverrideFormat.isOverrideFormat(presentationFormat)) {
      await context.editor.kindOfQuantities.addPresentationOverrideFormat(itemKey, presentationFormat);
    } else {
      await context.editor.kindOfQuantities.addPresentationFormat(itemKey, presentationFormat.key);
    }
  }
}

async function updateOverrideFormat(context: SchemaMergeContext, formatString: string): Promise<Format | OverrideFormat> {
  // https://www.itwinjs.org/v1/bis/ec/kindofquantity/#format-string
  const match = OverrideFormat.parseFormatString(formatString);
  const formatKey = await updateSchemaItemKey(context, match.name);
  const format = await context.targetSchema.lookupItem(formatKey) as Format;

  if (undefined === match.precision && undefined === match.unitAndLabels)
    return format;

  let unitAndLabels: Array<[Unit | InvertedUnit, string | undefined]> | undefined;
  if (undefined !== match.unitAndLabels) {
    unitAndLabels = [];
    for (const unitOverride of match.unitAndLabels) {
      const unitKey = await updateSchemaItemKey(context, unitOverride[0]);
      const unit = await context.targetSchema.lookupItem(unitKey) as Unit | InvertedUnit;
      unitAndLabels.push([unit, unitOverride[1]]);
    }
  }
  return context.editor.kindOfQuantities.createFormatOverride(formatKey, match.precision, unitAndLabels);
}
