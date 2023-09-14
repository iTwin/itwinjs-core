/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { CustomAttributeClass, parseCustomAttributeContainerType } from "@itwin/ecschema-metadata";
import { MutableCAClass } from "../Editing/Mutable/MutableCAClass";
import { ClassChanges } from "../Validation/SchemaChanges";
import { mergeSchemaItemProperties } from "./SchemaItemMerger";
import mergeClasses from "./ClassMerger";

/**
 * @internal
 */
export default async function mergeCAClasses(target: CustomAttributeClass, source: CustomAttributeClass, changes: ClassChanges) {
  const mutableCAClass = target as MutableCAClass;
  await mergeSchemaItemProperties(mutableCAClass, changes.propertyValueChanges, (item, propertyName, propertyValue) => {
    switch(propertyName) {
      case "appliesTo": {
        const containerType = parseCustomAttributeContainerType(propertyValue);
        if (containerType !== undefined) {
          return item.setContainerType(containerType);
        }
      }
    }
  });

  return mergeClasses(target, source, changes);
}
