/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Enumeration, primitiveTypeToString } from "@itwin/ecschema-metadata";
import { ChangeType, EnumerationChanges } from "../Validation/SchemaChanges";
import { MutableEnumeration } from "../Editing/Mutable/MutableEnumeration";
import { mergeSchemaItemProperties } from "./SchemaItemMerger";

export default async function mergeEnumeration(target: Enumeration, source: Enumeration, changes: EnumerationChanges) {
  const mutableTargetEnumeration = target as MutableEnumeration;
  await mergeSchemaItemProperties(mutableTargetEnumeration, changes.propertyValueChanges, (item, propertyName, propertyValue) => {
    switch (propertyName) {
      case "isStrict": return item.setIsStrict(propertyValue);
    }
  });

  if (target.type !== source.type) {
    throw Error(`Enumeration types not equal: Source Enumeration type is ${primitiveTypeToString(source.type!)}, target Enumeration type is ${primitiveTypeToString(target.type!)}`);
  }

  for (const enumeratorChange of changes.enumeratorChanges.values()) {
    // Handle each case:
    // If missing, add source enumerator to target
    if (enumeratorChange.enumeratorMissing?.changeType === ChangeType.Missing) {
      const sourceEnumerator = source.getEnumeratorByName(enumeratorChange.ecTypeName)!;
      mutableTargetEnumeration.addEnumerator(sourceEnumerator);
    }
  }
}

