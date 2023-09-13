/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Unit } from "@itwin/ecschema-metadata";
import { SchemaItemChanges } from "../ecschema-editing";
import { MutableUnit } from "../Editing/Mutable/MutableUnit";
import { mergeSchemaItemProperties } from "./SchemaItemMerger";

export default async function mergeUnit(target: Unit, _source: Unit, changes: SchemaItemChanges) {
    const targetMutableUnit = target as MutableUnit;
    await mergeSchemaItemProperties(targetMutableUnit, changes.propertyValueChanges, (_item, _propertyName, _propertyValue) => {});
}