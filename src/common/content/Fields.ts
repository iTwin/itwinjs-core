/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as ec from "../EC";
import CategoryDescription from "./Category";
import EditorDescription from "./Editor";
import Property from "./Property";
import { TypeDescription } from "./TypeDescription";

/** Describes a single content field. A field is usually represented as a grid column
 * or a property pane row.
 */
export interface Field {
  category: Readonly<CategoryDescription>;
  name: string;
  label: string;
  description: Readonly<TypeDescription>;
  editor?: Readonly<EditorDescription>;
  isReadOnly: boolean;
  priority: number;
  parent?: Readonly<NestedContentField>;
}

/** Describes a single content field that's based on one or more EC properties. */
export interface PropertiesField extends Field {
  properties: Array<Readonly<Property>>;
}

/** Describes a single content field that contains nested content. */
export interface NestedContentField extends Field {
  contentClassInfo: Readonly<ec.ClassInfo>;
  pathToPrimaryClass: Readonly<ec.RelationshipPathInfo>;
  nestedFields: Array<Readonly<Field>>;
}

/** Checks if the field is a properties field */
export const isPropertiesField = (field: Field): field is PropertiesField => {
  return (field as any).properties;
};

/** Checks if the field is nested content field */
export const isNestedContentField = (field: Field): field is NestedContentField => {
  return (field as any).contentClassInfo;
};

/** @hidden */
export const resetParentship = (field: Field): void => {
  field.parent = undefined;
  if (isNestedContentField(field)) {
    for (const nestedField of field.nestedFields)
      resetParentship(nestedField);
  }
};

/** @hidden */
export const rebuildParentship = (field: Field, parentField?: NestedContentField): void => {
  field.parent = parentField;
  if (isNestedContentField(field)) {
    for (const nestedField of field.nestedFields)
      rebuildParentship(nestedField, field);
  }
};
