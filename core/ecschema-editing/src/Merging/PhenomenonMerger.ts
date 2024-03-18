/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { type PhenomenonDifference } from "../Differencing/SchemaDifference";
import { type SchemaMergerHandler } from "./SchemaItemMerger";
import { ECObjectsError, ECObjectsStatus } from "@itwin/ecschema-metadata";
import { MutablePhenomenon } from "../Editing/Mutable/MutablePhenomenon";

/**
 * @internal
 */
export const phenomenonMerger: SchemaMergerHandler<PhenomenonDifference> = {
  add: async (context, change) => {
    return context.editor.phenomenons.createFromProps(context.targetSchemaKey, {
      name: change.itemName,
      ...change.difference,
    });
  },
  modify: async (_context, change, itemKey, phenomenon: MutablePhenomenon) => {
    if(change.difference.label) {
      phenomenon.setDisplayLabel(change.difference.label);
    }
    if(change.difference.definition) {
      // It would be better if the validation would be part of phenomenon.setDefinition.
      if (phenomenon.definition !== "" && change.difference.definition.toLowerCase() !== phenomenon.definition.toLowerCase())
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Phenomenon ${itemKey.name} has an invalid 'definition' attribute.`);

      await phenomenon.setDefinition(change.difference.definition);
    }
    return {};
  },
};
