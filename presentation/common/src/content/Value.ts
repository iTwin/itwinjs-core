/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Content */

import { InstanceKey, InstanceKeyJSON } from "../EC";
import { ValuesDictionary } from "../Utils";

/**
 * Raw value type
 * @public
 */
export type Value = string | number | boolean | undefined | ValuesMap | ValuesArray | NestedContentValue[];
/** @public */
export namespace Value {
  /** Is the value a primitive */
  export function isPrimitive(value: Value): value is string | number | boolean | undefined { return isPrimitiveValue(value); }
  /** Is the value an array */
  export function isArray(value: Value): value is ValuesArray { return isArrayValue(value); }
  /** Is the value a map / struct */
  export function isMap(value: Value): value is ValuesMap { return isMapValue(value); }
  /** Is the value a nested content value */
  export function isNestedContent(value: Value): value is NestedContentValue[] { return isNestedContentValue(value); }
  /** @internal */
  export function fromJSON(json: ValueJSON): Value {
    if (json === null)
      return undefined;
    if (isNestedContentValue(json))
      return json.map(NestedContentValue.fromJSON);
    if (isArrayValue(json))
      return valuesArrayFromJSON(json);
    if (isMapValue(json))
      return valuesMapFromJSON(json);
    return json;
  }
  /** @internal */
  export function toJSON(value: Value): ValueJSON {
    if (undefined === value)
      return null;
    if (isNestedContentValue(value))
      return value.map(NestedContentValue.toJSON);
    if (isArrayValue(value))
      return valuesArrayToJSON(value);
    if (isMapValue(value))
      return valuesMapToJSON(value);
    return value;
  }
}
/**
 * A map of raw values
 * @public
 */
export interface ValuesMap extends ValuesDictionary<Value> { }
/**
 * An array of raw values
 * @public
 */
export interface ValuesArray extends Array<Value> { }

/**
 * Display value type.
 * @public
 */
export type DisplayValue = string | undefined | DisplayValuesMap | DisplayValuesArray;
export namespace DisplayValue {
  /** Is the value a primitive */
  export function isPrimitive(value: DisplayValue): value is string | undefined { return isPrimitiveValue(value); }
  /** Is the value an array */
  export function isArray(value: DisplayValue): value is DisplayValuesArray { return isArrayValue(value); }
  /** Is the value a map / struct */
  export function isMap(value: DisplayValue): value is DisplayValuesMap { return isMapValue(value); }
  /** @internal */
  export function fromJSON(json: DisplayValueJSON): DisplayValue {
    if (json === null)
      return undefined;
    if (isArrayValue(json))
      return displayValuesArrayFromJSON(json);
    if (isMapValue(json))
      return displayValuesMapFromJSON(json);
    return json;
  }
  /** @internal */
  export function toJSON(value: DisplayValue): DisplayValueJSON {
    if (undefined === value)
      return null;
    if (isArrayValue(value))
      return displayValuesArrayToJSON(value);
    if (isMapValue(value))
      return displayValuesMapToJSON(value);
    return value;
  }
}
/**
 * A map of display values
 * @public
 */
export interface DisplayValuesMap extends ValuesDictionary<DisplayValue> { }
/**
 * An array of display values
 * @public
 */
export interface DisplayValuesArray extends Array<DisplayValue> { }

/**
 * Data structure that describes nested content value.
 * @public
 */
export interface NestedContentValue {
  /** Keys of instances whose content is contained in this value */
  primaryKeys: InstanceKey[];
  /** Content values map */
  values: ValuesDictionary<Value>;
  /** Content display values map */
  displayValues: ValuesDictionary<DisplayValue>;
  /** Names of fields whose values are merged */
  mergedFieldNames: string[];
}
/** @public */
export namespace NestedContentValue {
  /** @internal */
  export function toJSON(json: NestedContentValue): NestedContentValueJSON {
    return {
      primaryKeys: json.primaryKeys.map(InstanceKey.toJSON),
      values: valuesMapToJSON(json.values),
      displayValues: displayValuesMapToJSON(json.displayValues),
      mergedFieldNames: json.mergedFieldNames,
    };
  }
  /** @internal */
  export function fromJSON(json: NestedContentValueJSON): NestedContentValue {
    return {
      primaryKeys: json.primaryKeys.map(InstanceKey.fromJSON),
      values: valuesMapFromJSON(json.values),
      displayValues: displayValuesMapFromJSON(json.displayValues),
      mergedFieldNames: json.mergedFieldNames,
    };
  }
}

/** @internal */
export type ValueJSON = string | number | boolean | null | ValuesMapJSON | ValuesArrayJSON | NestedContentValueJSON[];
/** @internal */
export interface ValuesMapJSON extends ValuesDictionary<ValueJSON> { }
/** @internal */
export interface ValuesArrayJSON extends Array<ValueJSON> { }

/** @internal */
export type DisplayValueJSON = string | null | DisplayValuesMapJSON | DisplayValuesArrayJSON;
/** @internal */
export interface DisplayValuesMapJSON extends ValuesDictionary<DisplayValueJSON> { }
/** @internal */
export interface DisplayValuesArrayJSON extends Array<DisplayValueJSON> { }

/**
 * Serialized [[NestedContentValue]] JSON representation.
 * @internal
 */
export interface NestedContentValueJSON {
  primaryKeys: InstanceKeyJSON[];
  values: ValuesDictionary<ValueJSON>;
  displayValues: ValuesDictionary<DisplayValueJSON>;
  mergedFieldNames: string[];
}

function isNestedContentValue(v: Value | ValueJSON): v is NestedContentValue[] | NestedContentValueJSON[] {
  return (v !== undefined) && Array.isArray(v)
    && ((v.length === 0)
      || (v[0] as NestedContentValue).primaryKeys !== undefined
      && (v[0] as NestedContentValue).values !== undefined
      && (v[0] as NestedContentValue).displayValues !== undefined
      && (v[0] as NestedContentValue).mergedFieldNames !== undefined);
}
function isArrayValue(v: Value | ValueJSON | DisplayValue | DisplayValueJSON): v is ValuesArray | ValuesArrayJSON | DisplayValuesArray | DisplayValuesArrayJSON {
  // note: we don't guarantee by 100% that v is ValuesArray | DisplayValuesArray, but merely make compiler happy.
  // we have other means to determine the type of value.
  return (v !== undefined) && Array.isArray(v);
}
function isMapValue(v: Value | ValueJSON | DisplayValue | DisplayValueJSON): v is ValuesMap | ValuesMapJSON | DisplayValuesMap | DisplayValuesMapJSON {
  return (v !== undefined) && (typeof v === "object") && !Array.isArray(v);
}
function isPrimitiveValue(v: Value | DisplayValue): v is string | number | boolean | undefined {
  return !isArrayValue(v) && !isMapValue(v);
}

function valuesArrayFromJSON(json: ValuesArrayJSON): ValuesArray {
  return json.map(Value.fromJSON);
}
function valuesArrayToJSON(values: ValuesArray): ValuesArrayJSON {
  return values.map(Value.toJSON);
}
function valuesMapFromJSON(json: ValuesMapJSON): ValuesMap {
  const map: ValuesMap = {};
  for (const key in json) {
    /* istanbul ignore else */
    if (json.hasOwnProperty(key)) {
      map[key] = Value.fromJSON(json[key]);
    }
  }
  return map;
}
function valuesMapToJSON(values: ValuesMap): ValuesMapJSON {
  const map: ValuesMapJSON = {};
  for (const key in values) {
    /* istanbul ignore else */
    if (values.hasOwnProperty(key)) {
      map[key] = Value.toJSON(values[key]);
    }
  }
  return map;
}

function displayValuesArrayFromJSON(json: DisplayValuesArrayJSON): DisplayValuesArray {
  return json.map(DisplayValue.fromJSON);
}
function displayValuesArrayToJSON(values: DisplayValuesArray): DisplayValuesArrayJSON {
  return values.map(DisplayValue.toJSON);
}
function displayValuesMapFromJSON(json: DisplayValuesMapJSON): DisplayValuesMap {
  const map: DisplayValuesMap = {};
  for (const key in json) {
    /* istanbul ignore else */
    if (json.hasOwnProperty(key)) {
      map[key] = DisplayValue.fromJSON(json[key]);
    }
  }
  return map;
}
function displayValuesMapToJSON(values: DisplayValuesMap): DisplayValuesMapJSON {
  const map: DisplayValuesMapJSON = {};
  for (const key in values) {
    /* istanbul ignore else */
    if (values.hasOwnProperty(key)) {
      map[key] = DisplayValue.toJSON(values[key]);
    }
  }
  return map;
}
