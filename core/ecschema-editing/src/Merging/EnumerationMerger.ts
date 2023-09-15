/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { AnyEnumerator, Enumeration, parsePrimitiveType, primitiveTypeToString } from "@itwin/ecschema-metadata";
import { ChangeType, EnumerationChanges, EnumeratorDelta } from "../Validation/SchemaChanges";
import { mergeSchemaItemProperties } from "./SchemaItemMerger";
import { MutableEnumeration } from "../Editing/Mutable/MutableEnumeration";

/**
 * @param item Type Enumerator, the Enumerator the differences get merged into.
 * @param attributeName Name of the Enumerator attribute that changed.
 * @param deltaChange Provides information about the changes in Enumerator attributes. 
 * @param attributeValue The value that gets merged into the Enumerator attribute. 
 */
type EnumeratorAttributeChanged<TEnumerator extends AnyEnumerator> = (item: TEnumerator, attributeName: string, deltaChange: string, attributeValue: any) => void | boolean;

/**
 * Simple interface to extend access Enumerator type. 
 * It will allow editing to Enumerator attributes.
 */
interface MutableEnumerator extends AnyEnumerator {
  label?: string;
  description?: string;
}

/**
 * @param target The Enumeration the differences get merged into
 * @param source The Enumeration to compare 
 * @param changes Gets the @see EnumerationChanges between the two Enumerations. 
 * For example, if source Enumeration has an attribute that is undefined in  
 * target one, it would be listed in propertyValueChanges.
 */
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

  for (const enumeratorChange of changes.enumeratorChanges.values()) {
    if (enumeratorChange.enumeratorMissing?.changeType === ChangeType.Missing) {
      const enumerator = source.getEnumeratorByName(enumeratorChange.ecTypeName);
      if (enumerator === undefined) {
        throw Error(`Enumerator '${enumeratorChange.ecTypeName}' not found in Enumeration ${source.fullName}`);
      }
      const result = mutableEnumeration.createEnumerator(enumerator.name, enumerator.value, enumerator.label, enumerator.description);
      mutableEnumeration.addEnumerator(result);
    } else {
      const targetEnumerator = target.getEnumeratorByName(enumeratorChange.ecTypeName);
      if (targetEnumerator === undefined) {
        throw Error(`Enumerator '${enumeratorChange.ecTypeName}' not found in Enumeration ${target.fullName}`);
      }
      const mutableEnumerator = targetEnumerator as MutableEnumerator;
      await mergeEnumeratorAttributes(mutableEnumerator, enumeratorChange.enumeratorDeltas, (enumerator, attributeName, deltaChange, attributeValue) => {
        switch (attributeName) {
          case "label": {
            enumerator.label = attributeValue;
            return;
          };
          case "description": {
            enumerator.description = attributeValue;
            return;
          };
          case "value": {  
            throw Error(`Failed to merge enumerator attribute, ${deltaChange} in ${enumerator.name}`);
          };
        }
      })
    }
  }
}

/**
 * @param targetEnumerator The enumerator the differences get merged into
 * @param changes Gets the @see EnumeratorDelta, the Enumerator delta array holds information about changes between two Enumerators
 * @param handler Defines the information needed to merge the attributes
 */
async function mergeEnumeratorAttributes<T extends AnyEnumerator>(targetEnumerator: T, changes: EnumeratorDelta[], handler: EnumeratorAttributeChanged<T>) {
  for (let index = 0, stepUp = true; index < changes.length; stepUp && index++, stepUp = true) {
    const deltaChange = changes[index].toString(); // this will be useful for error message.
    const [attributeName, attributeValue] = changes[index].diagnostic.messageArgs!.slice(1); // messageArgs[0] seems to be an object, need to get to the next one, slice to start at index 1 
    if (handler(targetEnumerator, attributeName, deltaChange, attributeValue) === true) {
      changes.splice(index, 1);
      stepUp = false;
    }
  }
}

