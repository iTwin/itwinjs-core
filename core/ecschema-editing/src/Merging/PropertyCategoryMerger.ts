/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { PropertyCategory } from "@itwin/ecschema-metadata";
import { MutablePropertyCategory } from "../Editing/Mutable/MutablePropertyCategory";
import { SchemaItemChanges } from "../Validation/SchemaChanges";
import { mergeSchemaItemProperties } from "./SchemaItemMerger";

export default async function mergePropertyCategory(target: PropertyCategory, _source: PropertyCategory, changes: SchemaItemChanges) {
  const mutablePropertyCategory = target as MutablePropertyCategory;
  await mergeSchemaItemProperties(mutablePropertyCategory, changes.propertyValueChanges, (item, propertyName, propertyValue) => {
    switch(propertyName) {
      case "priority": return item.setPriority(propertyValue);
    }
  });
}
