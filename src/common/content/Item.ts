/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as assert from "assert";
import * as ec from "../EC";
import { ValuesDictionary } from "../Utils";
import { Field } from "./Fields";
import Property, { PropertyAccessor } from "./Property";
import { NestedContent } from "./Content";

export interface PropertyValueKeys {
  field: Field;
  property: Property;
  keys: ec.InstanceKey[];
}

export interface FieldPropertyValueKeys {
  [fieldName: string]: PropertyValueKeys[];
}

/** A struct that represents a single content record. */
export default interface Item {
  primaryKeys: ec.InstanceKey[];
  label: string;
  imageId: string;
  classInfo?: ec.ClassInfo;
  values: ValuesDictionary<any>;
  displayValues: ValuesDictionary<string | undefined>;
  mergedFieldNames: string[];
  fieldPropertyValueKeys: FieldPropertyValueKeys;
}

/** Is value of field with the specified name merged in this record. */
export const isFieldMerged = (item: Item, fieldName: string): boolean => {
  return -1 !== item.mergedFieldNames.indexOf(fieldName);
};

/** Get the ECInstanceKeys of instances whose values are contained in the field
 * with the specified name.
 */
export const getFieldPropertyValueKeys = (item: Item, fieldName: string): PropertyValueKeys[] => {
  if (item.fieldPropertyValueKeys.hasOwnProperty(fieldName))
    return item.fieldPropertyValueKeys[fieldName];
  return [];
};

/** Get keys of nested instances accessible using supplied accessor. */
export const getNestedInstanceKeys = (item: Item, accessor: PropertyAccessor[]): ec.InstanceKey[] => {
  assert(accessor.length >= 2, "For nested fields the accessor length is expected to be at least 2");
  let values: any = item.values;
  for (let i = 0; i < accessor.length && values; ++i) {
    values = values[accessor[i].propertyName];
    if (null !== accessor[i].arrayIndex && undefined !== accessor[i].arrayIndex)
      values = values[accessor[i].arrayIndex!];
    else if (Array.isArray(values))
      values = values[0];
    const nestedValues: NestedContent = values;
    values = nestedValues.Values;
    if (i === accessor.length - 2)
      return nestedValues.PrimaryKeys;
  }
  return [];
};
