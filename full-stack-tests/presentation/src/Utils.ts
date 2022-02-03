/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import type { Field } from "@itwin/presentation-common";

/**
 * Simplified type for `sinon.SinonSpy`.
 * @internal
 */
export type SinonSpy<T extends (...args: any) => any> = sinon.SinonSpy<Parameters<T>, ReturnType<T>>;

/** Returns field by given label. */
function tryGetFieldByLabelInternal(fields: Field[], label: string, allFields: Field[]): Field | undefined {
  for (const field of fields) {
    if (field.label === label)
      return field;

    if (field.isNestedContentField()) {
      const nestedMatchingField = tryGetFieldByLabelInternal(field.nestedFields, label, allFields);
      if (nestedMatchingField)
        return nestedMatchingField;
    }

    allFields.push(field);
  }
  return undefined;
}

/** Looks up a field by given label. Returns `undefined` if not found. */
export function tryGetFieldByLabel(fields: Field[], label: string): Field | undefined {
  return tryGetFieldByLabelInternal(fields, label, []);
}

/**
 * Returns field by given label.
 * @throws An error if the field is not found
 */
export function getFieldByLabel(fields: Field[], label: string): Field {
  const allFields = new Array<Field>();
  const result = tryGetFieldByLabelInternal(fields, label, allFields);
  if (!result)
    throw new Error(`Field '${label}' not found. Available fields: [${allFields.map((f) => `"${f.label}"`).join(", ")}]`);
  return result;
}

/**
 * Returns fields by given label.
 */
export function getFieldsByLabel(rootFields: Field[], label: string): Field[] {
  const foundFields = new Array<Field>();
  const handleFields = (fields: Field[]) => {
    for (const field of fields) {
      if (field.label === label)
        foundFields.push(field);
      if (field.isNestedContentField())
        handleFields(field.nestedFields);
    }
  };
  handleFields(rootFields);
  return foundFields;
}
