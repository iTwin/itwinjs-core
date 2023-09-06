/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Constant, DelayedPromiseWithProps, LazyLoadedPhenomenon, Phenomenon, SchemaItemKey } from "@itwin/ecschema-metadata";
import { SchemaItemChanges } from "../ecschema-editing";
import { mergeSchemaItemProperties } from "./SchemaItemMerger";
import { MutableConstant } from "../Editing/Mutable/MutableConstant";

export default async function mergeConstant(target: Constant, source: Constant, changes: SchemaItemChanges) {
    const mutableConstant = target as MutableConstant;

    await mergeSchemaItemProperties(mutableConstant, changes.propertyValueChanges, (item, propertyName, propertyValue) => {
        switch (propertyName) {
            case "definition": {
                if (item.definition === "")
                    return item.setDefinition(propertyValue);
                if (item.definition !== propertyValue)
                    throw Error(`Failed to merged, constant definition conflict: ${propertyValue} -> ${item.definition}`);
            }
            case "numerator": {
                if (!item.hasNumerator)
                    return item.setNumerator(propertyValue);
                if (item.hasNumerator && item.numerator !== propertyValue)
                    throw Error(`Failed to merged, constant numerator conflict: ${propertyValue} -> ${item.numerator}`);
            }
            case "denominator": {
                if (!item.hasDenominator)
                    return item.setDenominator(propertyValue);
                if (item.hasDenominator && item.denominator !== propertyValue)
                    throw Error(`Failed to merged, constant denominator conflict: ${propertyValue} -> ${item.denominator}`);
            }
            case "phenomenon": {
                if (item.phenomenon === undefined) {
                    // It assumes that phenomenon item is not undefined in target schema
                    // In this case, propertyValue references the phenomenon in source schema, this is incompatible with target schema
                    // A lazy loaded phenomenon that references the phenomenon in target schema is needed 
                    const key = new SchemaItemKey(source.phenomenon!.name, target.schema.schemaKey);
                    const lazyTargetPhenomenon: LazyLoadedPhenomenon = new DelayedPromiseWithProps<SchemaItemKey, Phenomenon>(key, async () => (await target.schema.context.getSchemaItem<Phenomenon>(key))!);
                    return item.setPhenomenon(lazyTargetPhenomenon);
                }
            }
        }
    })
}