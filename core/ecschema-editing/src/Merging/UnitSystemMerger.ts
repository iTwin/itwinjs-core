/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { UnitSystemDifference } from "../Differencing/SchemaDifference";
import type { SchemaMergeContext } from "./SchemaMerger";
import type { SchemaItemKey } from "@itwin/ecschema-metadata";

/**
 * Merges a new UnitSystem into the target schema.
 * @internal
 */
export async function addUnitSystem(context: SchemaMergeContext, change: UnitSystemDifference) {
  await context.editor.unitSystems.createFromProps(context.targetSchemaKey, {
    ...change.difference,
    name: change.itemName,
    schemaItemType: change.schemaType,
  });
}

/**
 * Merges differences to an existing UnitSystem in the target schema.
 * @internal
 */
export async function modifyUnitSystem(context: SchemaMergeContext, change: UnitSystemDifference, itemKey: SchemaItemKey) {
  if(change.difference.label !== undefined) {
    await context.editor.unitSystems.setDisplayLabel(itemKey, change.difference.label);
  }
  if(change.difference.description !== undefined) {
    await context.editor.unitSystems.setDescription(itemKey, change.difference.description);
  }
}
