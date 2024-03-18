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
    const phenomenonKey = await updateSchemaItemKey(context, change.json.phenomenon);
    change.json.phenomenon = phenomenonKey.fullName;

    return context.editor.constants.createFromProps(context.targetSchemaKey, {
      name: change.itemName,
      ...change.json,
    });
  },
  async modify(context, change, itemKey, item: MutableConstant) {
    if(change.json.label) {
      item.setDisplayLabel(change.json.label);
    }

    // Note: There are no editor methods to modify a constant.
    if(change.json.definition) {
      if (change.json.definition !== "" && item.definition.toLowerCase() !== change.json.definition.toLowerCase()) {
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Constant ${itemKey.name} has an invalid 'definition' attribute.`);
      }
      item.setDefinition(change.json.definition);
    }
    if(change.json.denominator) {
      if(item.hasDenominator && item.denominator !== change.json.denominator) {
        throw new Error(`Failed to merged, constant denominator conflict: ${change.json.denominator} -> ${item.denominator}`);
      }
      item.setDenominator(change.json.denominator);
    }
    if(change.json.numerator) {
      if(item.hasNumerator && item.numerator !== change.json.numerator) {
        throw new Error(`Failed to merged, constant numerator conflict: ${change.json.numerator} -> ${item.numerator}`);
      }
      item.setNumerator(change.json.numerator);
    }
    if(change.json.phenomenon) {
      const lookupKey  = await updateSchemaItemKey(context, change.json.phenomenon);
      const phenomenon = await context.editor.schemaContext.getSchemaItem<Phenomenon>(lookupKey);
      if(phenomenon === undefined) {
        throw new Error(`Could not find phenomenon ${lookupKey.fullName} in the current context`);
      }

      item.setPhenomenon(new DelayedPromiseWithProps(phenomenon.key, async () => phenomenon));
    }
    return {};
  },
};
