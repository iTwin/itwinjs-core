/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Enumeration } from "@itwin/ecschema-metadata";
import { ChangeType, EnumerationChanges, EnumeratorChanges } from "../Validation/SchemaChanges";
import { MutableEnumeration } from "../Editing/Mutable/MutableEnumeration";

export default async function mergeEnumeration(target: Enumeration, source: Enumeration, changes: EnumerationChanges) {
  const mutableTargetEnumeration = target as MutableEnumeration;
  console.log(changes.propertyValueChanges[0]);

  // Before jumping into this, look for a flag that gives if primitiveType is different
  for (const _enumeratorChange of changes.enumeratorChanges.values()) {
    
    // Handle each case:
    // If missing, add source enumerator 
    addEnumeratorToTarget(source, mutableTargetEnumeration, _enumeratorChange)

    // If encounter delta, throw an error
    // What triggers delta? : Something funky about enumerators we are not so sure about :/ 
  }

  function addEnumeratorToTarget(_source: Enumeration, _mutableEnumeration: MutableEnumeration, _enumeratorChange: EnumeratorChanges){
    let sourceEnumerator = _source.getEnumeratorByName(_enumeratorChange.ecTypeName)!;
    mutableTargetEnumeration.addEnumerator(sourceEnumerator)
  }

}
