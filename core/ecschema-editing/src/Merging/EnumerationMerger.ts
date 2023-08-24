/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Enumeration } from "@itwin/ecschema-metadata";
import { ChangeType, EnumerationChanges, EnumeratorChanges } from "../Validation/SchemaChanges";
import { MutableEnumeration } from "../Editing/Mutable/MutableEnumeration";

export default async function mergeEnumeration(target: Enumeration, source: Enumeration, changes: EnumerationChanges) {
  const mutableTargetEnumeration = target as MutableEnumeration;
  console.log(changes.propertyValueChanges[0].diagnostic.messageArgs);

  // Before jumping into this, look for a flag that gives if primitiveType is different
  for (const enumeratorChange of changes.enumeratorChanges.values()) {
    
    // Handle each case:
    // If missing, add source enumerator 
    if(isEnumeratorMissing(enumeratorChange)){
      addEnumeratorToTarget(source, mutableTargetEnumeration, enumeratorChange)
    }
    
    // If encounter deltas, throw an error for the time being, it will need to get handle at a later iteration
    // What triggers delta? : Something funky about enumerators we are not so sure about :/ 
  }

  function isEnumeratorMissing(enumeratorChange: EnumeratorChanges){
    return enumeratorChange.enumeratorMissing?.changeType === ChangeType.Missing; 
  }

  function doesEnumeratorDeltasExist(enumeratorChange: EnumeratorChanges){
    return enumeratorChange.enumeratorDeltas.length > 0;
  }

  function isEnumerationTypeMissMatch(_enumerationChanges: EnumerationChanges){
    // Compare the property value diagnostic 
  }

  function addEnumeratorToTarget(source: Enumeration, mutableEnumeration: MutableEnumeration, enumeratorChange: EnumeratorChanges){
    let sourceEnumerator = source.getEnumeratorByName(enumeratorChange.ecTypeName)!;
    mutableEnumeration.addEnumerator(sourceEnumerator)
  }
}
