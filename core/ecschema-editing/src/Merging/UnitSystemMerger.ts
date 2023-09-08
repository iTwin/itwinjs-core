import { UnitSystem } from "@itwin/ecschema-metadata";
import { SchemaItemChanges } from "../ecschema-editing";
import { mergeSchemaItemProperties } from "./SchemaItemMerger";
import { MutableUnitSystem } from "../Editing/Mutable/MutableUnitSystem";

export default async function mergeUnitSystem(target: UnitSystem, _source: UnitSystem, changes: SchemaItemChanges) {
    const targetMutableUnitSystem = target as MutableUnitSystem;
    await mergeSchemaItemProperties(targetMutableUnitSystem, changes.propertyValueChanges, (_item, _propertyName, _propertyValue) => {});
}