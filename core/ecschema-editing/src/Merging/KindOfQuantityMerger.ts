
import { KindOfQuantity } from "@itwin/ecschema-metadata";
import { KindOfQuantityChanges } from "../ecschema-editing";
import { MutableKindOfQuantity } from "../Editing/Mutable/MutableKindOfQuantity";
import { mergeSchemaItemProperties } from "./SchemaItemMerger";

export default async function mergeKindOfQuantity(target: KindOfQuantity, _source: KindOfQuantity, changes: KindOfQuantityChanges) {
  const targetMutableKindOfQuantity = target as MutableKindOfQuantity;

  await mergeSchemaItemProperties(targetMutableKindOfQuantity, changes.propertyValueChanges, (_item, propertyName, _propertyValue) => {
    switch (propertyName) {
    }
  });
}