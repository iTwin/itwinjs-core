/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Constant, DelayedPromiseWithProps, LazyLoadedPhenomenon, Phenomenon, SchemaItem, SchemaItemKey } from "@itwin/ecschema-metadata";
import { SchemaItemChanges } from "../ecschema-editing";
import { mergeSchemaItemProperties } from "./SchemaItemMerger";
import { MutableConstant } from "../Editing/Mutable/MutableConstant";

export default async function mergeConstant(target: Constant, source: Constant, changes: SchemaItemChanges) {
    const mutableConstant = target as MutableConstant;

    // Get referenced phenomenon to create lazy loaded phenomenon for target
    const [schemaName, itemName] = SchemaItem.parseFullName(source.phenomenon!.fullName);
    const reference = await source.schema.getReference(schemaName);

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
                if (item.numerator !== propertyValue)
                    throw Error(`Failed to merged, constant numerator conflict: ${propertyValue} -> ${item.numerator}`);
            }
            case "denominator": {
                if (!item.hasDenominator)
                    return item.setDenominator(propertyValue);
                if (item.denominator !== propertyValue)
                    throw Error(`Failed to merged, constant denominator conflict: ${propertyValue} -> ${item.denominator}`);
            }
            case "phenomenon": {
                // At this point, higher level phenomenon item should not be undefined 
                if (item.phenomenon === undefined) {  
                    // In this case, propertyValue references the phenomenon in source schema, this is incompatible with target schema
                    // A lazy loaded phenomenon with the correct reference schema is needed, it would either be the target schema or a referenced schema 
                    const schemaItemKey = reference !== undefined
                        ? new SchemaItemKey(itemName, reference.schemaKey)
                        : new SchemaItemKey(itemName, target.schema.schemaKey);

                    const lazyTargetPhenomenon: LazyLoadedPhenomenon = new DelayedPromiseWithProps<SchemaItemKey, Phenomenon>(schemaItemKey, async () => (await target.schema.context.getSchemaItem<Phenomenon>(schemaItemKey))!);
                    return item.setPhenomenon(lazyTargetPhenomenon);
                }
            }
        }
    })
}