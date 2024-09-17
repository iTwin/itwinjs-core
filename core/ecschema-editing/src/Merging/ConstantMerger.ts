/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import type { ConstantDifference } from "../Differencing/SchemaDifference";
import type{ MutableConstant } from "../Editing/Mutable/MutableConstant";
import type { SchemaMergeContext } from "./SchemaMerger";
import { DelayedPromiseWithProps, ECObjectsError, ECObjectsStatus, Phenomenon, SchemaItemKey } from "@itwin/ecschema-metadata";
import { updateSchemaItemFullName, updateSchemaItemKey } from "./Utils";

/**
 * Merges a new Constant into the target schema.
 * @internal
 */
export async function addConstant(context: SchemaMergeContext, change: ConstantDifference) {
  if (change.difference.phenomenon === undefined) {
    throw new Error("Constant must define phenomenon");
  }
  if (change.difference.definition === undefined) {
    throw new Error("Constant must define definition");
  }

  // Needs to update the reference from source to target schema.
  change.difference.phenomenon = await updateSchemaItemFullName(context, change.difference.phenomenon);

  await context.editor.constants.createFromProps(context.targetSchemaKey, {
    ...change.difference,
    name: change.itemName,
    schemaItemType: change.schemaType,
    phenomenon: change.difference.phenomenon,
    definition: change.difference.definition,
  });
}

/**
 * Merges differences to an existing Constant in the target schema.
 * @internal
 */
export async function modifyConstant(context: SchemaMergeContext, change: ConstantDifference, itemKey: SchemaItemKey) {
  const constant = await context.targetSchema.lookupItem(itemKey) as MutableConstant;
  if (change.difference.label !== undefined) {
    await context.editor.constants.setDisplayLabel(itemKey, change.difference.label);
  }
  if (change.difference.description !== undefined) {
    await context.editor.constants.setDescription(itemKey, change.difference.description);
  }

  // Note: There are no editor methods to modify a constant.
  if (change.difference.definition !== undefined) {
    if (change.difference.definition !== "" && constant.definition.toLowerCase() !== change.difference.definition.toLowerCase()) {
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Constant ${itemKey.name} has an invalid 'definition' attribute.`);
    }
    constant.setDefinition(change.difference.definition);
  }
  if (change.difference.denominator !== undefined) {
    if (constant.hasDenominator && constant.denominator !== change.difference.denominator) {
      throw new Error(`Failed to merged, constant denominator conflict: ${change.difference.denominator} -> ${constant.denominator}`);
    }
    constant.setDenominator(change.difference.denominator);
  }
  if (change.difference.numerator !== undefined) {
    if (constant.hasNumerator && constant.numerator !== change.difference.numerator) {
      throw new Error(`Failed to merged, constant numerator conflict: ${change.difference.numerator} -> ${constant.numerator}`);
    }
    constant.setNumerator(change.difference.numerator);
  }
  if (change.difference.phenomenon !== undefined) {
    const lookupKey = await updateSchemaItemKey(context, change.difference.phenomenon);
    const phenomenon = await context.editor.schemaContext.getSchemaItem<Phenomenon>(lookupKey);
    if (phenomenon === undefined) {
      throw new Error(`Could not find phenomenon ${lookupKey.fullName} in the current context`);
    }

    constant.setPhenomenon(new DelayedPromiseWithProps(phenomenon.key, async () => phenomenon));
  }
}
