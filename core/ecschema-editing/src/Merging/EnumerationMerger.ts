/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Enumeration, parsePrimitiveType, primitiveTypeToString } from "@itwin/ecschema-metadata";
import { ChangeType, EnumerationChanges } from "../Validation/SchemaChanges";
import { mergeSchemaItemProperties } from "./SchemaItemMerger";
import { MutableEnumeration } from "../Editing/Mutable/MutableEnumeration";

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
  }
}

