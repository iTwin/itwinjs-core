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
  field: Readonly<Field>;
  property: Readonly<Property>;
  keys: Array<Readonly<ec.InstanceKey>>;
}

export interface FieldPropertyValueKeys {
  [fieldName: string]: Array<Readonly<PropertyValueKeys>>;
}

/** A struct that represents a single content record. */
export default interface Item {
  primaryKeys: Array<Readonly<ec.InstanceKey>>;
  label: string;
  imageId: string;
  classInfo?: Readonly<ec.ClassInfo>;
  values: Readonly<ValuesDictionary<any>>;
  displayValues: Readonly<ValuesDictionary<string | undefined>>;
  mergedFieldNames: string[];
  fieldPropertyValueKeys: Readonly<FieldPropertyValueKeys>;
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
    if (undefined !== accessor[i].arrayIndex)
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
