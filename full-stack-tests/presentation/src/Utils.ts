/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Field } from "@bentley/presentation-common";

/**
 * Simplified type for `sinon.SinonSpy`.
 * @internal
 */
export type SinonSpy<T extends (...args: any) => any> = sinon.SinonSpy<Parameters<T>, ReturnType<T>>;

/**
 * Returns field by given label.
 * @internal
 */
export function findFieldByLabel(fields: Field[], label: string, allFields?: Field[]): Field | undefined {
  const isTopLevel = (undefined === allFields);
  if (!allFields)
    allFields = new Array<Field>();
  for (const field of fields) {
    if (field.label === label)
      return field;

    if (field.isNestedContentField()) {
      const nestedMatchingField = findFieldByLabel(field.nestedFields, label, allFields);
      if (nestedMatchingField)
        return nestedMatchingField;
    }

    allFields.push(field);
  }
  if (isTopLevel) {
    // eslint-disable-next-line no-console
    console.error(`Field '${label}' not found. Available fields: [${allFields.map((f) => `"${f.label}"`).join(", ")}]`);
  }
  return undefined;
}
