/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { DelayedPromiseWithProps, ECClass, LazyLoadedECClass, SchemaItemKey } from "@itwin/ecschema-metadata";
import { MutableClass } from "../Editing/Mutable/MutableClass";
import { BaseClassDelta, ChangeType, ClassChanges, PropertyChanges } from "../Validation/SchemaChanges";

/**
 * @internal
 */
export default async function mergeClasses(target: ECClass, source: ECClass, change: ClassChanges) {
  // This applies to all type of classes regardless if they are Entities, Structs, Mixins,...
  // all can have properties that required to get merged.
  await mergeBaseClass(target, source, change.baseClassDelta);

  for(const propertyChange of change.propertyChanges.values()) {
    await mergeClassProperties(target, source, propertyChange);
  }
}

async function mergeBaseClass(target: ECClass, source: ECClass, baseClassChange?: BaseClassDelta) {
  if (baseClassChange !== undefined) {
    const sourceBaseClass = baseClassChange.diagnostic.messageArgs![0] as ECClass;
    const targetBaseClass = baseClassChange.diagnostic.messageArgs![1] as ECClass;

    if (targetBaseClass === undefined) {
      const itemKey = sourceBaseClass.schema.schemaKey.matches(source.schema.schemaKey)
        ? new SchemaItemKey(sourceBaseClass.name, target.schema.schemaKey)
        : sourceBaseClass.key;

      const baseClassEntity = await target.schema.context.getSchemaItem<ECClass>(itemKey);
      if (baseClassEntity === undefined)
        throw new Error(`Unable to locate base class ${sourceBaseClass.name} in schema ${target.schema.name}`);

      const mutableTargetClass = target as MutableClass;
      mutableTargetClass.baseClass = new DelayedPromiseWithProps(baseClassEntity.key, async () => baseClassEntity) as LazyLoadedECClass;
    } else {
      throw new Error(`Failed to merge base class '${sourceBaseClass.name}': not supported case`);
    }
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
