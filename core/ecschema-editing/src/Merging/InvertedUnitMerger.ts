/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { SchemaItemKey } from "@itwin/ecschema-metadata";
import { InvertedUnitDifference } from "../Differencing/SchemaDifference";
import { SchemaMergeContext } from "./SchemaMerger";
import { updateSchemaItemFullName } from "./Utils";

/**
 * Merges a new InvertedUnit into the target schema.
 * @internal
 */
export async function addInvertedUnit(context: SchemaMergeContext, change: InvertedUnitDifference) {
  if (change.difference.unitSystem === undefined) {
    throw new Error("InvertedUnit must define unitSystem");
  }
  if (change.difference.invertsUnit === undefined) {
    throw new Error("InvertedUnit must define invertsUnit");
  }

  change.difference.unitSystem = await updateSchemaItemFullName(context, change.difference.unitSystem);
  change.difference.invertsUnit = await updateSchemaItemFullName(context, change.difference.invertsUnit);

  await context.editor.invertedUnits.createFromProps(context.targetSchemaKey, {
    ...change.difference,
    name: change.itemName,
    schemaItemType: change.schemaType,
    unitSystem: change.difference.unitSystem,
    invertsUnit: change.difference.invertsUnit,
  });
}

/**
 * Merges differences to an existing InvertedUnit in the target schema.
 * @internal
 */
export async function modifyInvertedUnit(context: SchemaMergeContext, change: InvertedUnitDifference, itemKey: SchemaItemKey) {
  if (change.difference.unitSystem !== undefined) {
    throw new Error(`Changing the invertedUnit '${change.itemName}' unitSystem is not supported.`);
  }
  if (change.difference.invertsUnit !== undefined) {
    throw new Error(`Changing the invertedUnit '${change.itemName}' invertsUnit is not supported.`);
  }

  if (change.difference.label !== undefined) {
    await context.editor.invertedUnits.setDisplayLabel(itemKey, change.difference.label);
  }
  if (change.difference.description !== undefined) {
    await context.editor.invertedUnits.setDescription(itemKey, change.difference.description);
  }
}
