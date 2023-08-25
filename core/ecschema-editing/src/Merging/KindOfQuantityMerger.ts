import { KindOfQuantity } from "@itwin/ecschema-metadata";
import { KindOfQuantityChanges } from "../ecschema-editing";
import { MutableKindOfQuantity } from "../Editing/Mutable/MutableKindOfQuantity";
import { mergeSchemaItemProperties } from "./SchemaItemMerger";

/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
export default async function mergeKindOfQuantity(target: KindOfQuantity, _source: KindOfQuantity, changes: KindOfQuantityChanges){
    const targetMutableKindOfQuantity = target as MutableKindOfQuantity;
    await mergeSchemaItemProperties(targetMutableKindOfQuantity, changes.propertyValueChanges, (item, propertyName, propertyValue) => {
        switch (propertyName) {
          case "displayLabel": return item.setDisplayLabel(propertyValue);
        }
      });
}