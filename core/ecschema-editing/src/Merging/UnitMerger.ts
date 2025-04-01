/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { SchemaItemKey } from "@itwin/ecschema-metadata";
import { UnitDifference } from "../Differencing/SchemaDifference.js";
import { SchemaMergeContext } from "./SchemaMerger.js";
import { updateSchemaItemFullName } from "./Utils.js";

/**
 * Merges a new Unit into the target schema.
 * @internal
 */
export async function addUnit(context: SchemaMergeContext, change: UnitDifference) {
  if (change.difference.phenomenon === undefined) {
    throw new Error("Unit must define phenomenon");
  }
  if (change.difference.unitSystem === undefined) {
    throw new Error("Unit must define unitSystem");
  }
  if (change.difference.definition === undefined) {
    throw new Error("Unit must define definition");
  }

  change.difference.phenomenon = await updateSchemaItemFullName(context, change.difference.phenomenon);
  change.difference.unitSystem = await updateSchemaItemFullName(context, change.difference.unitSystem);

  await context.editor.units.createFromProps(context.targetSchemaKey, {
    ...change.difference,
    name: change.itemName,
    schemaItemType: change.schemaType,
    phenomenon: change.difference.phenomenon,
    unitSystem: change.difference.unitSystem,
    definition: change.difference.definition,
  });
}

/**
 * Merges differences to an existing Unit in the target schema.
 * @internal
 */
export async function modifyUnit(context: SchemaMergeContext, change: UnitDifference, itemKey: SchemaItemKey) {
  if (change.difference.unitSystem !== undefined) {
    throw new Error(`Changing the unit '${change.itemName}' unitSystem is not supported.`);
  }
  if (change.difference.phenomenon !== undefined) {
    throw new Error(`Changing the unit '${change.itemName}' phenomenon is not supported.`);
  }
  if (change.difference.definition !== undefined) {
    throw new Error(`Changing the unit '${change.itemName}' definition is not supported.`);
  }
  // we have consider later should we allow to change these values on merging
  if (change.difference.denominator !== undefined) {
    throw new Error(`Changing the unit '${change.itemName}' denominator is not supported.`);
  }
  if (change.difference.numerator !== undefined) {
    throw new Error(`Changing the unit '${change.itemName}' numerator is not supported.`);
  }
  if (change.difference.offset !== undefined) {
    throw new Error(`Changing the unit '${change.itemName}' offset is not supported.`);
  }

  if (change.difference.label !== undefined) {
    await context.editor.units.setDisplayLabel(itemKey, change.difference.label);
  }
  if (change.difference.description !== undefined) {
    await context.editor.units.setDescription(itemKey, change.difference.description);
  }
}
