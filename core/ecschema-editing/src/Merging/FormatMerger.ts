/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { FormatTraits, parseFormatTrait, parseScientificType, parseShowSignOption } from "@itwin/core-quantity";
import { InvertedUnit, SchemaItemKey, Unit } from "@itwin/ecschema-metadata";
import { FormatDifference, FormatUnitDifference, FormatUnitLabelDifference } from "../Differencing/SchemaDifference.js";
import { MutableFormat } from "../Editing/Mutable/MutableFormat.js";
import { SchemaMergeContext } from "./SchemaMerger.js";
import { updateSchemaItemFullName, updateSchemaItemKey } from "./Utils.js";

/**
 * Merges a new Format into the target schema.
 * @internal
 */
export async function addFormat(context: SchemaMergeContext, change: FormatDifference) {
  if (change.difference.type === undefined) {
    throw new Error("Format must define type");
  }

  if (change.difference.composite && change.difference.composite.units) {
    for (let index = 0; index < change.difference.composite.units.length; index++) {
      const compositeUnitName = await updateSchemaItemFullName(context, change.difference.composite.units[index].name);
      change.difference.composite.units[index] = {
        name: compositeUnitName,
        label: change.difference.composite.units[index].label,
      }
    }
  }

  await context.editor.formats.createFromProps(context.targetSchemaKey, {
    ...change.difference,
    name: change.itemName,
    schemaItemType: change.schemaType,
    type: change.difference.type,
    composite: change.difference.composite,
  });
}

/**
 * Merges differences to an existing Format in the target schema.
 * @internal
 */
export async function modifyFormat(context: SchemaMergeContext, change: FormatDifference, itemKey: SchemaItemKey) {
  const format = await context.targetSchema.lookupItem(itemKey) as MutableFormat;
  if (change.difference.type !== undefined) {
    throw new Error(`Changing the format '${change.itemName}' type is not supported.`);
  }

  if (change.difference.label !== undefined) {
    await context.editor.formats.setDisplayLabel(itemKey, change.difference.label);
  }
  if (change.difference.description !== undefined) {
    await context.editor.formats.setDescription(itemKey, change.difference.description);
  }
  if (change.difference.precision !== undefined) {
    format.setPrecision(change.difference.precision);
  }
  if (change.difference.roundFactor !== undefined) {
    format.setRoundFactor(change.difference.roundFactor);
  }
  if (change.difference.minWidth !== undefined) {
    format.setMinWidth(change.difference.minWidth);
  }
  if (change.difference.showSignOption !== undefined) {
    const showSignOption = parseShowSignOption(change.difference.showSignOption, change.itemName);
    format.setShowSignOption(showSignOption);
  }
  if (change.difference.formatTraits !== undefined) {
    const formatTraits = parseFormatTraits(change.difference.formatTraits, change.itemName);
    format.setFormatTraits(formatTraits);
  }
  if (change.difference.decimalSeparator !== undefined) {
    format.setDecimalSeparator(change.difference.decimalSeparator);
  }
  if (change.difference.thousandSeparator !== undefined) {
    format.setThousandSeparator(change.difference.thousandSeparator);
  }
  if (change.difference.uomSeparator !== undefined) {
    format.setUomSeparator(change.difference.uomSeparator);
  }
  if (change.difference.scientificType !== undefined) {
    const scientificType = parseScientificType(change.difference.scientificType, change.itemName);
    format.setScientificType(scientificType);
  }
  if (change.difference.stationOffsetSize !== undefined) {
    format.setStationOffsetSize(change.difference.stationOffsetSize);
  }
  if (change.difference.stationSeparator !== undefined) {
    format.setStationSeparator(change.difference.stationSeparator);
  }
  if (change.difference.composite !== undefined) {
    if (change.difference.composite.includeZero !== undefined) {
      format.setIncludeZero(change.difference.composite.includeZero);
    }
    if (change.difference.composite.spacer !== undefined) {
      format.setSpacer(change.difference.composite.spacer);
    }
  }
}

/**
 * Merges source format units into the target format
 * @internal
*/
export async function modifyFormatUnit(context: SchemaMergeContext, change: FormatUnitDifference, itemKey: SchemaItemKey) {
  const format = await context.targetSchema.lookupItem(itemKey) as MutableFormat;

  const units: [Unit | InvertedUnit, string | undefined][] = [];
  for (const { name, label } of change.difference) {
    const lookupKey = await updateSchemaItemKey(context, name);
    const formatUnit = await context.editor.schemaContext.getSchemaItem(lookupKey);
    if (formatUnit === undefined || (!Unit.isUnit(formatUnit) && !InvertedUnit.isInvertedUnit(formatUnit))) {
      throw new Error(`Could not find format unit ${lookupKey.fullName} in the current context`);
    }
    units.push([formatUnit, label]);
  }
  format.setUnits(units);
}

/**
 * Overrides format unit label
 * @internal
*/
export async function modifyFormatUnitLabel(context: SchemaMergeContext, change: FormatUnitLabelDifference, itemKey: SchemaItemKey) {
  const format = await context.targetSchema.lookupItem(itemKey) as MutableFormat;

  if (format.units !== undefined) {
    const unitKey = await updateSchemaItemKey(context, change.path);
    /* eslint-disable @typescript-eslint/prefer-for-of */
    for (let index = 0; index < format.units.length; index++) {
      if (format.units[index][0].key.matches(unitKey)) {
        format.units[index][1] = change.difference.label;
      }
    }
  }
}

function parseFormatTraits(formatTraitsFromJson: string | string[], formatName: string): FormatTraits {
  let formatTraits: FormatTraits = FormatTraits.Uninitialized;
  const formatTraitIterable = Array.isArray(formatTraitsFromJson)
    ? formatTraitsFromJson
    : formatTraitsFromJson.split(/,|;|\|/);
  for (const formatTraitsString of formatTraitIterable) {
    const formatTrait = parseFormatTrait(formatTraitsString, formatName);
    formatTraits = formatTraits | formatTrait;
  }
  return formatTraits;
}
