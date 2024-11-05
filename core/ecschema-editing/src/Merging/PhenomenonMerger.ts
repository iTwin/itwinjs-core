/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { PhenomenonDifference } from "../Differencing/SchemaDifference";
import type { MutablePhenomenon } from "../Editing/Mutable/MutablePhenomenon";
import type { SchemaMergeContext } from "./SchemaMerger";
import { ECObjectsError, ECObjectsStatus, type SchemaItemKey } from "@itwin/ecschema-metadata";

/**
 * Merges a new Phenomenon into the target schema.
 * @internal
 */
export async function addPhenomenon(context: SchemaMergeContext, change: PhenomenonDifference) {
  if (change.difference.definition === undefined) {
    throw new Error("Phenomenon must define definition");
  }

  await context.editor.phenomenons.createFromProps(context.targetSchemaKey, {
    ...change.difference,
    name: change.itemName,
    schemaItemType: change.schemaType,
    definition: change.difference.definition,
  });
}

/**
 * Merges differences to an existing Phenomenon in the target schema.
 * @internal
 */
export async function modifyPhenomenon(context: SchemaMergeContext, change: PhenomenonDifference, itemKey: SchemaItemKey) {
  const phenomenon = await context.targetSchema.lookupItem(itemKey) as MutablePhenomenon;
  if(change.difference.label !== undefined) {
    await context.editor.phenomenons.setDisplayLabel(itemKey, change.difference.label);
  }
  if(change.difference.description !== undefined) {
    await context.editor.phenomenons.setDescription(itemKey, change.difference.description);
  }

  if(change.difference.definition !== undefined) {
    // It would be better if the validation would be part of phenomenon.setDefinition.
    if (phenomenon.definition !== "" && change.difference.definition.toLowerCase() !== phenomenon.definition.toLowerCase())
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Phenomenon ${itemKey.name} has an invalid 'definition' attribute.`);

    await phenomenon.setDefinition(change.difference.definition);
  }
}
