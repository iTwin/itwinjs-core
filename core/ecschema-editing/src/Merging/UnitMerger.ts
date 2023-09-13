/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { DelayedPromiseWithProps, LazyLoadedPhenomenon, LazyLoadedUnitSystem, Phenomenon, Schema, SchemaItem, SchemaItemKey, Unit, UnitSystem } from "@itwin/ecschema-metadata";
import { SchemaItemChanges } from "../ecschema-editing";
import { MutableUnit } from "../Editing/Mutable/MutableUnit";
import { mergeSchemaItemProperties } from "./SchemaItemMerger";

export default async function mergeUnit(target: Unit, source: Unit, changes: SchemaItemChanges) {
    const targetMutableUnit = target as MutableUnit;

    let phenomenonReference: Schema | undefined;
    let unitSystemReference: Schema | undefined;

    const [phenomenonSchemaRefName, phenomenonName] = SchemaItem.parseFullName(source.phenomenon!.fullName);
    const [unitSystemSchemaRefName, unitSystemName] = SchemaItem.parseFullName(source.unitSystem!.fullName);

    if (phenomenonSchemaRefName === unitSystemSchemaRefName)
        phenomenonReference = unitSystemReference = await source.schema.getReference(phenomenonSchemaRefName);

    if (phenomenonSchemaRefName !== unitSystemSchemaRefName) {
        phenomenonReference = await source.schema.getReference(phenomenonSchemaRefName);
        unitSystemReference = await source.schema.getReference(unitSystemSchemaRefName);
    }

    await mergeSchemaItemProperties(targetMutableUnit, changes.propertyValueChanges, (item, propertyName, propertyValue) => {
        switch (propertyName) {
            case "definition": {
                if (item.definition === "") {
                    item.setDefinition(propertyValue);
                    return;
                }
            }
            case "phenomenon": {
                if (item.phenomenon === undefined) {
                    const schemaItemKey = phenomenonReference !== undefined
                        ? new SchemaItemKey(phenomenonName, phenomenonReference.schemaKey)
                        : new SchemaItemKey(phenomenonName, target.schema.schemaKey);

                    const lazyPhenomenon: LazyLoadedPhenomenon = new DelayedPromiseWithProps<SchemaItemKey, Phenomenon>(schemaItemKey, async () => {
                        const phenomenon = (await target.schema.context.getSchemaItem<Phenomenon>(schemaItemKey));
                        if (phenomenon === undefined)
                            throw Error(`Unable to locate phenomenon item in schema ${schemaItemKey.schemaName}`)
                        return phenomenon;
                    });
                    item.setPhenomenon(lazyPhenomenon);
                    return;
                }
            }
            case "unitSystem": {
                if (item.unitSystem === undefined) {
                    const schemaItemKey = unitSystemReference !== undefined
                        ? new SchemaItemKey(unitSystemName, unitSystemReference.schemaKey)
                        : new SchemaItemKey(unitSystemName, target.schema.schemaKey);

                    const lazyUnitSystem: LazyLoadedUnitSystem = new DelayedPromiseWithProps<SchemaItemKey, UnitSystem>(schemaItemKey, async () => {
                        const unitSystem = (await target.schema.context.getSchemaItem<UnitSystem>(schemaItemKey));
                        if (unitSystem === undefined) {
                            throw Error(`Unable to locate unit system item in schema ${schemaItemKey.schemaName}`)
                        }
                        return unitSystem;

                    });
                    item.setUnitSystem(lazyUnitSystem);
                    return;
                }

            }
        }
    });
}