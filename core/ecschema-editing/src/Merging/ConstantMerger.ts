/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Constant, DelayedPromiseWithProps, LazyLoadedPhenomenon, Phenomenon, SchemaItemKey, SchemaItemType } from "@itwin/ecschema-metadata";
import { SchemaItemChanges } from "../ecschema-editing";
import { mergeSchemaItemProperties } from "./SchemaItemMerger";
import { MutableConstant } from "../Editing/Mutable/MutableConstant";

export default async function mergeConstant(target: Constant, source: Constant, changes: SchemaItemChanges) {
    const mutableConstant = target as MutableConstant;
    const targetPhenomenon = await target.schema.getItem<Phenomenon>(source.phenomenon!.name);

    await mergeSchemaItemProperties(mutableConstant, changes.propertyValueChanges, (item, propertyName, propertyValue) => {
        switch (propertyName) {
            case "definition": {
                if (item.definition === "")
                    return item.setDefinition(propertyValue);
            }
            case "numerator": {
                // if it's missing
                if (!item.hasNumerator)
                    return item.setNumerator(propertyValue);
            }
            case "denominator": {
                if (!item.hasDenominator)
                    return item.setDenominator(propertyValue);
            }
            case "phenomenon": {
                if (item.phenomenon === undefined) {
                    // It requires a lazy loaded type
                    // If phenomenon does not exist in target, create one
                    if (targetPhenomenon === undefined || targetPhenomenon.schemaItemType !== SchemaItemType.Phenomenon) {
                        throw Error(`Unable to locate phenomenon ${source.phenomenon!.name} in target schema`);
                    }
                    const lazyTargetPhenomenon: LazyLoadedPhenomenon = new DelayedPromiseWithProps<SchemaItemKey, Phenomenon>(targetPhenomenon.key, async () => targetPhenomenon!);
                    return item.setPhenomenon(lazyTargetPhenomenon);
                }
            }
        }
    })
}