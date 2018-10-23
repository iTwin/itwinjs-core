/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Content */

import { InstanceKey, InstanceKeyJSON, instanceKeyFromJSON } from "../EC";
import { ValuesDictionary } from "../Utils";

export type Value = string | number | boolean | undefined | ValuesMap | ValuesArray | NestedContentValue[];
export interface ValuesMap extends ValuesDictionary<Value> { }
export interface ValuesArray extends Array<Value> { }

export type DisplayValue = string | undefined | DisplayValuesMap | DisplayValuesArray;
export interface DisplayValuesMap extends ValuesDictionary<DisplayValue> { }
export interface DisplayValuesArray extends Array<DisplayValue> { }

/** Data structure that describes nested content value */
export interface NestedContentValue {
  primaryKeys: InstanceKey[];
  values: ValuesDictionary<Value>;
  displayValues: ValuesDictionary<DisplayValue>;
  mergedFieldNames: string[];
}

/** @hidden */
export type ValueJSON = string | number | boolean | null | ValuesMapJSON | ValuesArrayJSON | NestedContentValueJSON[];
/** @hidden */
export interface ValuesMapJSON extends ValuesDictionary<ValueJSON> { }
/** @hidden */
export interface ValuesArrayJSON extends Array<ValueJSON> { }

/** @hidden */
export type DisplayValueJSON = string | null | DisplayValuesMapJSON | DisplayValuesArrayJSON;
/** @hidden */
export interface DisplayValuesMapJSON extends ValuesDictionary<DisplayValueJSON> { }
/** @hidden */
export interface DisplayValuesArrayJSON extends Array<DisplayValueJSON> { }

/**
 * Serialized [[NestedContentValue]] JSON representation.
 *
 * @hidden
 */
export interface NestedContentValueJSON {
  primaryKeys: InstanceKeyJSON[];
  values: ValuesDictionary<ValueJSON>;
  displayValues: ValuesDictionary<DisplayValueJSON>;
  mergedFieldNames: string[];
}

/** @hidden */
export function isNestedContentValue(v: Value | ValueJSON): v is NestedContentValue[] | NestedContentValueJSON[] {
  return (v !== undefined) && Array.isArray(v)
    && ((v.length === 0)
      || (v[0] as NestedContentValue).primaryKeys !== undefined
      && (v[0] as NestedContentValue).values !== undefined
      && (v[0] as NestedContentValue).displayValues !== undefined
      && (v[0] as NestedContentValue).mergedFieldNames !== undefined);
}
/** @hidden */
export function isArray(v: Value | ValueJSON | DisplayValue | DisplayValueJSON): v is ValuesArray | ValuesArrayJSON | DisplayValuesArray | DisplayValuesArrayJSON {
  // note: we don't guarantee by 100% that v is ValuesArray | DisplayValuesArray, but merely make compiler happy.
  // we have other means to determine the type of value.
  return (v !== undefined) && Array.isArray(v);
}
/** @hidden */
export function isMap(v: Value | ValueJSON | DisplayValue | DisplayValueJSON): v is ValuesMap | ValuesMapJSON | DisplayValuesMap | DisplayValuesMapJSON {
  return (v !== undefined) && (typeof v === "object") && !Array.isArray(v);
}
/** @hidden */
export function isPrimitive(v: Value | DisplayValue): v is string | number | boolean | undefined {
  return !isArray(v) && !isMap(v);
}

/** @hidden */
export function valueFromJSON(json: ValueJSON): Value {
  if (json === null)
    return undefined;
  if (isNestedContentValue(json))
    return json.map(nestedContentValueFromJSON);
  if (isArray(json))
    return valuesArrayFromJSON(json);
  if (isMap(json))
    return valuesMapFromJSON(json);
  return json;
}
/** @hidden */
export function valuesArrayFromJSON(json: ValuesArrayJSON): ValuesArray {
  return json.map(valueFromJSON);
}
/** @hidden */
export function valuesMapFromJSON(json: ValuesMapJSON): ValuesMap {
  const map: ValuesMap = {};
  for (const key in json) {
    /* istanbul ignore else */
    if (json.hasOwnProperty(key)) {
      map[key] = valueFromJSON(json[key]);
    }
  }
  return map;
}

/** @hidden */
export function displayValueFromJSON(json: DisplayValueJSON): DisplayValue {
  if (json === null)
    return undefined;
  if (isArray(json))
    return displayValuesArrayFromJSON(json);
  if (isMap(json))
    return displayValuesMapFromJSON(json);
  return json;
}
/** @hidden */
export function displayValuesArrayFromJSON(json: DisplayValuesArrayJSON): DisplayValuesArray {
  return json.map(displayValueFromJSON);
}
/** @hidden */
export function displayValuesMapFromJSON(json: DisplayValuesMapJSON): DisplayValuesMap {
  const map: DisplayValuesMap = {};
  for (const key in json) {
    /* istanbul ignore else */
    if (json.hasOwnProperty(key)) {
      map[key] = displayValueFromJSON(json[key]);
    }
  }
  return map;
}

/** @hidden */
export function nestedContentValueFromJSON(json: NestedContentValueJSON): NestedContentValue {
  return {
    primaryKeys: json.primaryKeys.map(instanceKeyFromJSON),
    values: valuesMapFromJSON(json.values),
    displayValues: displayValuesMapFromJSON(json.displayValues),
    mergedFieldNames: json.mergedFieldNames,
  };
}
