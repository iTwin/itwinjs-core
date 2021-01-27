/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Content
 */

import { InstanceKey, InstanceKeyJSON } from "../EC";
import { ValuesDictionary } from "../Utils";

/**
 * Raw value type
 * @public
 */
export type Value = string | number | boolean | undefined | ValuesMap | ValuesArray | NestedContentValue[];

/** @public */
export namespace Value { // eslint-disable-line @typescript-eslint/no-redeclare
  /** Is the value a primitive */
  export function isPrimitive(value: Value): value is string | number | boolean | undefined { return isPrimitiveValue(value); }

  /** Is the value an array */
  export function isArray(value: Value): value is ValuesArray { return isArrayValue(value); }

  /** Is the value a map / struct */
  export function isMap(value: Value): value is ValuesMap { return isMapValue(value); }

  /** Is the value a nested content value */
  export function isNestedContent(value: Value): value is NestedContentValue[] { return isNestedContentValue(value); }

  /** Serialize [[Value]] to JSON */
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

  /** Deserialize [[Value]] from JSON */
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
export interface ValuesMap extends ValuesDictionary<Value> { } // eslint-disable-line @typescript-eslint/no-empty-interface

/**
 * An array of raw values
 * @public
 */
export interface ValuesArray extends Array<Value> { } // eslint-disable-line @typescript-eslint/no-empty-interface

/**
 * Display value type.
 * @public
 */
export type DisplayValue = string | undefined | DisplayValuesMap | DisplayValuesArray;

/** @public */
export namespace DisplayValue { // eslint-disable-line @typescript-eslint/no-redeclare
  /** Is the value a primitive */
  export function isPrimitive(value: DisplayValue): value is string | undefined { return isPrimitiveValue(value); }

  /** Is the value an array */
  export function isArray(value: DisplayValue): value is DisplayValuesArray { return isArrayValue(value); }

  /** Is the value a map / struct */
  export function isMap(value: DisplayValue): value is DisplayValuesMap { return isMapValue(value); }

  /** Serialize [[DisplayValue]] to JSON */
  export function fromJSON(json: DisplayValueJSON): DisplayValue {
    if (json === null)
      return undefined;
    if (isArrayValue(json))
      return displayValuesArrayFromJSON(json);
    if (isMapValue(json))
      return displayValuesMapFromJSON(json);
    return json;
  }

  /** Deserialize [[DisplayValue]] from JSON */
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
export interface DisplayValuesMap extends ValuesDictionary<DisplayValue> { } // eslint-disable-line @typescript-eslint/no-empty-interface

/**
 * An array of display values
 * @public
 */
export interface DisplayValuesArray extends Array<DisplayValue> { } // eslint-disable-line @typescript-eslint/no-empty-interface

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
  /** Serialize [[NestedContentValue]] to JSON */
  export function toJSON(json: NestedContentValue): NestedContentValueJSON {
    return {
      primaryKeys: json.primaryKeys.map(InstanceKey.toJSON),
      values: valuesMapToJSON(json.values),
      displayValues: displayValuesMapToJSON(json.displayValues),
      mergedFieldNames: json.mergedFieldNames,
    };
  }

  /** Deserialize [[NestedContentValue]] from JSON */
  export function fromJSON(json: NestedContentValueJSON): NestedContentValue {
    return {
      primaryKeys: json.primaryKeys.map(InstanceKey.fromJSON),
      values: valuesMapFromJSON(json.values),
      displayValues: displayValuesMapFromJSON(json.displayValues),
      mergedFieldNames: json.mergedFieldNames,
    };
  }
}

/**
 * JSON representation of [[Value]]
 * @public
 */
export type ValueJSON = string | number | boolean | null | ValuesMapJSON | ValuesArrayJSON | NestedContentValueJSON[];

/**
 * JSON representation of [[ValuesMap]]
 * @public
 */
export interface ValuesMapJSON extends ValuesDictionary<ValueJSON> { } // eslint-disable-line @typescript-eslint/no-empty-interface

/**
 * JSON representation of [[ValuesArray]]
 * @public
 */
export interface ValuesArrayJSON extends Array<ValueJSON> { } // eslint-disable-line @typescript-eslint/no-empty-interface

/**
 * JSON representation of [[DisplayValue]]
 * @public
 */
export type DisplayValueJSON = string | null | DisplayValuesMapJSON | DisplayValuesArrayJSON;

/**
 * JSON representation of [[DisplayValuesMap]]
 * @public
 */
export interface DisplayValuesMapJSON extends ValuesDictionary<DisplayValueJSON> { } // eslint-disable-line @typescript-eslint/no-empty-interface

/**
 * JSON representation of [[DisplayValuesArray]]
 * @public
 */
export interface DisplayValuesArrayJSON extends Array<DisplayValueJSON> { } // eslint-disable-line @typescript-eslint/no-empty-interface

/**
 * JSON representation of [[NestedContentValue]]
 * @public
 */
export interface NestedContentValueJSON {
  primaryKeys: InstanceKeyJSON[];
  values: ValuesDictionary<ValueJSON>;
  displayValues: ValuesDictionary<DisplayValueJSON>;
  mergedFieldNames: string[];
}

/**
 * A group of raw values and their common display value.
 * @alpha
 */
export interface DisplayValueGroup {
  /** Common display value for all grouped raw values */
  displayValue: DisplayValue;
  /** A list of grouped raw values */
  groupedRawValues: Value[];
}

/**
 * JSON representation of [[DisplayValueGroup]].
 * @alpha
 */
export interface DisplayValueGroupJSON {
  displayValue: DisplayValueJSON;
  groupedRawValues: ValueJSON[];
}

/** @alpha */
export namespace DisplayValueGroup {
  /** Serialize [[DisplayValueGroup]] to JSON */
  export function toJSON(group: DisplayValueGroup): DisplayValueGroupJSON {
    return {
      displayValue: DisplayValue.toJSON(group.displayValue),
      groupedRawValues: group.groupedRawValues.map(Value.toJSON),
    };
  }

  /** Deserialize [[DisplayValueGroup]] from JSON */
  export function fromJSON(json: DisplayValueGroupJSON): DisplayValueGroup {
    return {
      displayValue: DisplayValue.fromJSON(json.displayValue),
      groupedRawValues: json.groupedRawValues.map(Value.fromJSON),
    };
  }
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
