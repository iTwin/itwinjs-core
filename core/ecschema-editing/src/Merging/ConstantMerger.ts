// // /*---------------------------------------------------------------------------------------------
// // * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
// // * See LICENSE.md in the project root for license terms and full copyright notice.
// // *--------------------------------------------------------------------------------------------*/
import { type ConstantsDifference } from "../Differencing/SchemaDifference";
import { type SchemaMergerHandler, updateSchemaItemKey } from "./SchemaItemMerger";
import { type MutableConstant } from "../Editing/Mutable/MutableConstant";
import { DelayedPromiseWithProps, ECObjectsError, ECObjectsStatus, Phenomenon } from "@itwin/ecschema-metadata";

/**
 * @internal
 */
export const constantMerger: SchemaMergerHandler<ConstantsDifference> = {
  async add(context, change) {
    // Needs to update the reference from source to target schema.
    const phenomenonKey = await updateSchemaItemKey(context, change.difference.phenomenon);
    change.difference.phenomenon = phenomenonKey.fullName;

    return context.editor.constants.createFromProps(context.targetSchemaKey, {
      name: change.itemName,
      ...change.difference,
    });
  },
  async modify(context, change, itemKey, item: MutableConstant) {
    if(change.difference.label) {
      item.setDisplayLabel(change.difference.label);
    }

    // Note: There are no editor methods to modify a constant.
    if(change.difference.definition) {
      if (change.difference.definition !== "" && item.definition.toLowerCase() !== change.difference.definition.toLowerCase()) {
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Constant ${itemKey.name} has an invalid 'definition' attribute.`);
      }
      item.setDefinition(change.difference.definition);
    }
    if(change.difference.denominator) {
      if(item.hasDenominator && item.denominator !== change.difference.denominator) {
        throw new Error(`Failed to merged, constant denominator conflict: ${change.difference.denominator} -> ${item.denominator}`);
      }
      item.setDenominator(change.difference.denominator);
    }
    if(change.difference.numerator) {
      if(item.hasNumerator && item.numerator !== change.difference.numerator) {
        throw new Error(`Failed to merged, constant numerator conflict: ${change.difference.numerator} -> ${item.numerator}`);
      }
      item.setNumerator(change.difference.numerator);
    }
    if(change.difference.phenomenon) {
      const lookupKey  = await updateSchemaItemKey(context, change.difference.phenomenon);
      const phenomenon = await context.editor.schemaContext.getSchemaItem<Phenomenon>(lookupKey);
      if(phenomenon === undefined) {
        throw new Error(`Could not find phenomenon ${lookupKey.fullName} in the current context`);
      }

      item.setPhenomenon(new DelayedPromiseWithProps(phenomenon.key, async () => phenomenon));
    }
    return {};
  },
};
