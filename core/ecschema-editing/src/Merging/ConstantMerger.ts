/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Constant, DelayedPromiseWithProps, LazyLoadedPhenomenon, Phenomenon, SchemaItem, SchemaItemKey } from "@itwin/ecschema-metadata";
import { SchemaItemChanges } from "../ecschema-editing";
import { mergeSchemaItemProperties } from "./SchemaItemMerger";
import { MutableConstant } from "../Editing/Mutable/MutableConstant";

/**
 * 
 * @param target The constant the differences get merged into
 * @param source The constant to compare 
 * @param changes Gets the @see SchemaItemChanges between the two constants. 
 * For example, if source constant has an attribute/property that it missing in  
 * target one, it would be listed in propertyValueChanges.
 */
export default async function mergeConstant(target: Constant, source: Constant, changes: SchemaItemChanges) {
    const mutableConstant = target as MutableConstant;

    // Get referenced higher level phenomenon
    const [schemaName, itemName] = SchemaItem.parseFullName(source.phenomenon!.fullName);
    const reference = await source.schema.getReference(schemaName);

    await mergeSchemaItemProperties(mutableConstant, changes.propertyValueChanges, (item, propertyName, propertyValue) => {
        switch (propertyName) {
            case "definition": {
                if (item.definition === "")
                    return item.setDefinition(propertyValue);
                throw Error(`Failed to merged, constant definition conflict: ${propertyValue} -> ${item.definition}`);
            }
            case "numerator": {
                if (!item.hasNumerator)
                    return item.setNumerator(propertyValue);
                throw Error(`Failed to merged, constant numerator conflict: ${propertyValue} -> ${item.numerator}`);
            }
            case "denominator": {
                if (!item.hasDenominator)
                    return item.setDenominator(propertyValue);
                throw Error(`Failed to merged, constant denominator conflict: ${propertyValue} -> ${item.denominator}`);
            }
            case "phenomenon": {
                if (item.phenomenon === undefined) {
                    // In this case, propertyValue references the phenomenon in source schema, this is incompatible with target schema
                    // A lazy loaded phenomenon with the correct reference schema is needed, it would either be the target schema or reference schema 
                    const schemaItemKey = reference !== undefined
                        ? new SchemaItemKey(itemName, reference.schemaKey)
                        : new SchemaItemKey(itemName, target.schema.schemaKey);

                    const lazyTargetPhenomenon: LazyLoadedPhenomenon = new DelayedPromiseWithProps<SchemaItemKey, Phenomenon>(schemaItemKey, async () => {
                        const phenomenon = (await target.schema.context.getSchemaItem<Phenomenon>(schemaItemKey));
                        // At this point, higher level phenomenon item should not be undefined
                        if (phenomenon === undefined) throw Error(`Unable to locate phenomenon item in schema ${schemaItemKey.schemaName}`);
                        return phenomenon;
                    });

                    return item.setPhenomenon(lazyTargetPhenomenon);
                }
            }
        }
    })
}