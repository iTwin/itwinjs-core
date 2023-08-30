/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Phenomenon } from "@itwin/ecschema-metadata";
import { SchemaItemChanges } from "../ecschema-editing";
import { MutablePhenomenon } from "../Editing/Mutable/MutablePhenomenon";
import { mergeSchemaItemProperties } from "./SchemaItemMerger";

export default async function mergePhenomenon(target: Phenomenon, _source: Phenomenon, changes: SchemaItemChanges) {
    const mutablePhenomenon = target as MutablePhenomenon;

    await mergeSchemaItemProperties(mutablePhenomenon, changes.propertyValueChanges, (item, propertyName, propertyValue) => {
        switch (propertyName) {
            case 'definition': {
                // If "", then a new Phenomenon item was created.
                // Therefore, just set to new value. 
                if (item.definition === "") {
                    item.setDefinition(propertyValue);

                    // throw error if conflict for now 
                } else if (item.definition !== propertyValue) {
                    throw Error(`definition attribute conflict: ${propertyValue} -> ${item.definition}`);
                }
                return;
            }
        }
    });
}