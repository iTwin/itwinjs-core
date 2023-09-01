/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { AnyEnumerator, Enumeration, parsePrimitiveType, primitiveTypeToString } from "@itwin/ecschema-metadata";
import { ChangeType, EnumerationChanges, EnumeratorChanges, EnumeratorDelta } from "../Validation/SchemaChanges";
import { mergeSchemaItemProperties } from "./SchemaItemMerger";
import { MutableEnumeration } from "../Editing/Mutable/MutableEnumeration";

type EnumeratorAttributeChanged<TEnumerator extends AnyEnumerator> = (item: TEnumerator, attributeName: string, deltaChange: string, attributeValue: any) => void | boolean;

export default async function mergeEnumeration(target: Enumeration, source: Enumeration, changes: EnumerationChanges) {
  const mutableEnumeration = target as MutableEnumeration;
  await mergeSchemaItemProperties(mutableEnumeration, changes.propertyValueChanges, (item, propertyName, propertyValue) => {
    switch (propertyName) {
      case "isStrict": return item.setIsStrict(propertyValue);
      case "type": {
        const primitiveType = parsePrimitiveType(propertyValue);
        if (primitiveType && item.type !== primitiveType) {
          throw Error(`Merged enumeration ${item.name} types not equal: ${primitiveTypeToString(item.type!)} -> ${propertyValue}`);
        }
      }
    }
  });

  // I need something similar to mergeSchemaItemProperties() but for enumeratorChanges 
  // mergeEnumeratorAttributes(mutableEnumerator, changes.enumeratorChanges.values(), (enumerator, attributeName, attributeValue) => {}) 

  for (const enumeratorChange of changes.enumeratorChanges.values()) {

    // Handle each case:
    // If missing, add source enumerator to target
    if (enumeratorChange.enumeratorMissing?.changeType === ChangeType.Missing) {

      const enumerator = source.getEnumeratorByName(enumeratorChange.ecTypeName);
      if (enumerator === undefined) {
        throw Error(`Enumerator '${enumeratorChange.ecTypeName}' not found in class ${source.fullName}`);
      }

      const result = mutableEnumeration.createEnumerator(enumerator.name, enumerator.value, enumerator.label, enumerator.description);
      mutableEnumeration.addEnumerator(result);
    }

    //await mergeEnumeratorAttributes()
    const targetEnumerator = mutableEnumeration.getEnumeratorByName(enumeratorChange.ecTypeName);
    await mergeEnumeratorAttributes(targetEnumerator!, enumeratorChange.enumeratorDeltas, (enumerator, attributeName, deltaChange, attributeValue) => {
      switch (attributeName) {
        case "name": {
          console.log(enumerator.name);
          console.log(attributeValue);
          console.log(deltaChange);
        };
        case "label": {
          console.log(enumerator.label);
          console.log(attributeValue);
          console.log(deltaChange);
        };
        case "value": {
          console.log(enumerator.value);
          console.log(attributeValue);
          console.log(deltaChange);
        };
      }
    })

  }
}

export async function mergeEnumeratorAttributes<T extends AnyEnumerator>(targetEnumerator: T, changes: EnumeratorDelta[], handler: EnumeratorAttributeChanged<T>) {
  for (let index = 0, stepUp = true; index < changes.length; stepUp && index++, stepUp = true) {
    const deltaChange = changes[index].toString(); // this will be useful for error message.
    const [attributeName, attributeValue] = changes[index].diagnostic.messageArgs!.slice(1); // messageArgs[0] seems to be an object, need to get to the next one, slice to start at index 1 
    if (handler(targetEnumerator, attributeName, deltaChange, attributeValue) === true) {
      changes.splice(index, 1);
      stepUp = false;
    }
  }
}

