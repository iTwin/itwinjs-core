
import { KindOfQuantity } from "@itwin/ecschema-metadata";
import { ChangeType, KindOfQuantityChanges } from "../ecschema-editing";
import { MutableKindOfQuantity } from "../Editing/Mutable/MutableKindOfQuantity";
import { mergeSchemaItemProperties } from "./SchemaItemMerger";

export default async function mergeKindOfQuantity(target: KindOfQuantity, _source: KindOfQuantity, changes: KindOfQuantityChanges) {
  const targetMutableKindOfQuantity = target as MutableKindOfQuantity;
  console.log(changes);

  // If item missing, copy over to target schema
  if(changes.schemaItemMissing?.changeType === ChangeType.Missing){
    
  }

  await mergeSchemaItemProperties(targetMutableKindOfQuantity, changes.propertyValueChanges, (item, propertyName, propertyValue) => {
    switch (propertyName) {
      case "displayLabel": return item.setDisplayLabel(propertyValue);
    }
  });
}