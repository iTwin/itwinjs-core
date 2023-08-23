/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ECClass } from "@itwin/ecschema-metadata";
import { MutableClass } from "../Editing/Mutable/MutableClass";
import { ChangeType, ClassChanges, PropertyChanges } from "../Validation/SchemaChanges";

export default async function mergeClasses(target: ECClass, source: ECClass, change: ClassChanges) {
  // This applies to all type of classes regardless if they are Entities, Structs, Mixins,...
  // all can have properties that required to get merged.
  for(const propertyChange of change.propertyChanges.values()) {
    await mergeClassProperties(target, source, propertyChange);
  }
}

async function mergeClassProperties(target: ECClass, source: ECClass, propertyChange: PropertyChanges) {
  const mutableTargetClass = target as MutableClass;
  if (propertyChange.propertyMissing?.changeType === ChangeType.Missing) {

    const property = await source.getProperty(propertyChange.ecTypeName);
    if (property === undefined) {
      throw Error(`Property '${propertyChange.ecTypeName}' not found in class ${source.name}`);
    }

    if (property.isPrimitive()) {
      const primitiveProps =  property.toJSON();
      const result = property.isArray()
        ? await mutableTargetClass.createPrimitiveArrayProperty(propertyChange.ecTypeName, property.primitiveType)
        : await mutableTargetClass.createPrimitiveProperty(propertyChange.ecTypeName, property.primitiveType);

      await result.fromJSON(primitiveProps);

    } else {
      throw Error(`Failed to merge '${propertyChange.ecTypeName}' property: not supported type`);
    }
  }
}
