/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Content
 */

import { InstanceId, InstanceKey } from "../EC";
import { LabelDefinition } from "../LabelDefinition";
import { ValuesDictionary } from "../Utils";

/**
 * Raw value type
 * @public
 */
export type Value = string | number | boolean | undefined | ValuesMap | ValuesArray | NavigationPropertyValue | NestedContentValue[];

/** @public */
// eslint-disable-next-line @typescript-eslint/no-redeclare
export namespace Value {
  /** Is the value a primitive */
  export function isPrimitive(value: Value): value is string | number | boolean | undefined {
    return isPrimitiveValue(value);
  }

  /** Is the value an array */
  export function isArray(value: Value): value is ValuesArray {
    return isArrayValue(value);
  }

  /** Is the value a map / struct */
  export function isMap(value: Value): value is ValuesMap {
    return isMapValue(value);
  }

  /** Is the value a nested content value */
  export function isNestedContent(value: Value): value is NestedContentValue[] {
    return isNestedContentValue(value);
  }

  /** Is the value a navigation value */
  export function isNavigationValue(value: Value): value is NavigationPropertyValue {
    return (
      value !== undefined &&
      (value as NavigationPropertyValue).id !== undefined &&
      (value as NavigationPropertyValue).className !== undefined &&
      (value as NavigationPropertyValue).label !== undefined
    );
  }

  /**
   * Serialize [[Value]] to JSON
   * @deprecated in 3.x. Use [[Value]]
   */
  // eslint-disable-next-line deprecation/deprecation
  export function fromJSON(json: ValueJSON): Value {
    if (json === null) {
      return undefined;
    }
    if (isNestedContentValue(json)) {
      // eslint-disable-next-line deprecation/deprecation
      return json.map(NestedContentValue.fromJSON);
    }
    if (isArrayValue(json)) {
      return valuesArrayFromJSON(json);
    }
    if (isMapValue(json)) {
      return valuesMapFromJSON(json);
    }
    return json;
  }

  /**
   * Deserialize [[Value]] from JSON
   * @deprecated in 3.x. Use [[Value]]
   */
  // eslint-disable-next-line deprecation/deprecation
  export function toJSON(value: Value): ValueJSON {
    if (undefined === value) {
      return null;
    }
    if (isNestedContentValue(value)) {
      // eslint-disable-next-line deprecation/deprecation
      return value.map(NestedContentValue.toJSON);
    }
    if (isArrayValue(value)) {
      return valuesArrayToJSON(value);
    }
    if (isMapValue(value)) {
      return valuesMapToJSON(value);
    }
    return value;
  }
}

/**
 * A map of raw values
 * @public
 */
export interface ValuesMap extends ValuesDictionary<Value> {} // eslint-disable-line @typescript-eslint/no-empty-interface

/**
 * An array of raw values
 * @public
 */
export interface ValuesArray extends Array<Value> {} // eslint-disable-line @typescript-eslint/no-empty-interface

/**
 * Display value type.
 * @public
 */
export type DisplayValue = string | undefined | DisplayValuesMap | DisplayValuesArray;

/** @public */
// eslint-disable-next-line @typescript-eslint/no-redeclare
export namespace DisplayValue {
  /** Is the value a primitive */
  export function isPrimitive(value: DisplayValue): value is string | undefined {
    return isPrimitiveValue(value);
  }

  /** Is the value an array */
  export function isArray(value: DisplayValue): value is DisplayValuesArray {
    return isArrayValue(value);
  }

  /** Is the value a map / struct */
  export function isMap(value: DisplayValue): value is DisplayValuesMap {
    return isMapValue(value);
  }

  /**
   * Serialize [[DisplayValue]] to JSON
   * @deprecated in 3.x. Use [[DisplayValue]]
   */
  // eslint-disable-next-line deprecation/deprecation
  export function fromJSON(json: DisplayValueJSON): DisplayValue {
    if (json === null) {
      return undefined;
    }
    if (isArrayValue(json)) {
      return displayValuesArrayFromJSON(json);
    }
    if (isMapValue(json)) {
      return displayValuesMapFromJSON(json);
    }
    return json;
  }

  /**
   * Deserialize [[DisplayValue]] from JSON
   * @deprecated in 3.x. Use [[DisplayValue]]
   */
  // eslint-disable-next-line deprecation/deprecation
  export function toJSON(value: DisplayValue): DisplayValueJSON {
    if (undefined === value) {
      return null;
    }
    if (isArrayValue(value)) {
      return displayValuesArrayToJSON(value);
    }
    if (isMapValue(value)) {
      return displayValuesMapToJSON(value);
    }
    return value;
  }
}

/**
 * A map of display values
 * @public
 */
export interface DisplayValuesMap extends ValuesDictionary<DisplayValue> {} // eslint-disable-line @typescript-eslint/no-empty-interface

/**
 * An array of display values
 * @public
 */
export interface DisplayValuesArray extends Array<DisplayValue> {} // eslint-disable-line @typescript-eslint/no-empty-interface

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

/**
 * Data structure that describes value of the navigation property.
 * @public
 */
export interface NavigationPropertyValue {
  /** Label of target instance. */
  label: LabelDefinition;
  /** Full class name of target instance in format `SchemaName:ClassName` */
  className: string;
  /** Id of target instance. */
  id: InstanceId;
}

/** @public */
export namespace NestedContentValue {
  /**
   * Serialize [[NestedContentValue]] to JSON
   * @deprecated in 3.x. Use [[NestedContentValue]]
   */
  // eslint-disable-next-line deprecation/deprecation
  export function toJSON(value: NestedContentValue): NestedContentValueJSON {
    return {
      ...value,
      values: valuesMapToJSON(value.values),
      displayValues: displayValuesMapToJSON(value.displayValues),
    };
  }

  /**
   * Deserialize [[NestedContentValue]] from JSON
   * @deprecated in 3.x. Use [[NestedContentValue]]
   */
  // eslint-disable-next-line deprecation/deprecation
  export function fromJSON(json: NestedContentValueJSON): NestedContentValue {
    return {
      ...json,
      values: valuesMapFromJSON(json.values),
      displayValues: displayValuesMapFromJSON(json.displayValues),
    };
  }
}

/**
 * JSON representation of [[Value]]
 * @public
 * @deprecated in 3.x. Use [[Value]]
 */
// eslint-disable-next-line deprecation/deprecation
export type ValueJSON = string | number | boolean | null | ValuesMapJSON | ValuesArrayJSON | NavigationPropertyValue | NestedContentValueJSON[];
/**
 * JSON representation of [[ValuesMap]]
 * @public
 * @deprecated in 3.x. Use [[ValuesMap]]
 */
// eslint-disable-next-line deprecation/deprecation
export interface ValuesMapJSON extends ValuesDictionary<ValueJSON> {} // eslint-disable-line @typescript-eslint/no-empty-interface

/**
 * JSON representation of [[ValuesArray]]
 * @public
 * @deprecated in 3.x. Use [[ValuesArray]]
 */
// eslint-disable-next-line deprecation/deprecation
export interface ValuesArrayJSON extends Array<ValueJSON> {} // eslint-disable-line @typescript-eslint/no-empty-interface

/**
 * JSON representation of [[DisplayValue]]
 * @public
 * @deprecated in 3.x. Use [[DisplayValue]]
 */
// eslint-disable-next-line deprecation/deprecation
export type DisplayValueJSON = string | null | DisplayValuesMapJSON | DisplayValuesArrayJSON;

/**
 * JSON representation of [[DisplayValuesMap]]
 * @public
 * @deprecated in 3.x. Use [[DisplayValuesMap]]
 */
// eslint-disable-next-line deprecation/deprecation
export interface DisplayValuesMapJSON extends ValuesDictionary<DisplayValueJSON> {} // eslint-disable-line @typescript-eslint/no-empty-interface

/**
 * JSON representation of [[DisplayValuesArray]]
 * @public
 * @deprecated in 3.x. Use [[DisplayValuesArray]]
 */
// eslint-disable-next-line deprecation/deprecation
export interface DisplayValuesArrayJSON extends Array<DisplayValueJSON> {} // eslint-disable-line @typescript-eslint/no-empty-interface

/**
 * JSON representation of [[NestedContentValue]]
 * @public
 * @deprecated in 3.x. Use [[NestedContentValue]]
 */
export interface NestedContentValueJSON {
  primaryKeys: InstanceKey[];
  // eslint-disable-next-line deprecation/deprecation
  values: ValuesDictionary<ValueJSON>;
  // eslint-disable-next-line deprecation/deprecation
  displayValues: ValuesDictionary<DisplayValueJSON>;
  mergedFieldNames: string[];
}

/**
 * A group of raw values and their common display value.
 * @public
 */
export interface DisplayValueGroup {
  /** Common display value for all grouped raw values */
  displayValue: DisplayValue;
  /** A list of grouped raw values */
  groupedRawValues: Value[];
}

/**
 * JSON representation of [[DisplayValueGroup]].
 * @public
 * @deprecated in 3.x. Use [[DisplayValueGroup]]
 */
export interface DisplayValueGroupJSON {
  // eslint-disable-next-line deprecation/deprecation
  displayValue: DisplayValueJSON;
  // eslint-disable-next-line deprecation/deprecation
  groupedRawValues: ValueJSON[];
}

/** @public */
export namespace DisplayValueGroup {
  /**
   * Serialize [[DisplayValueGroup]] to JSON
   * @deprecated in 3.x. Use [[DisplayValueGroup]]
   */
  // eslint-disable-next-line deprecation/deprecation
  export function toJSON(group: DisplayValueGroup): DisplayValueGroupJSON {
    return {
      // eslint-disable-next-line deprecation/deprecation
      displayValue: DisplayValue.toJSON(group.displayValue),
      // eslint-disable-next-line deprecation/deprecation
      groupedRawValues: group.groupedRawValues.map(Value.toJSON),
    };
  }

  /**
   * Deserialize [[DisplayValueGroup]] from JSON
   * @deprecated in 3.x. Use [[DisplayValueGroup]]
   */
  // eslint-disable-next-line deprecation/deprecation
  export function fromJSON(json: DisplayValueGroupJSON): DisplayValueGroup {
    return {
      // eslint-disable-next-line deprecation/deprecation
      displayValue: DisplayValue.fromJSON(json.displayValue),
      // eslint-disable-next-line deprecation/deprecation
      groupedRawValues: json.groupedRawValues.map(Value.fromJSON),
    };
  }
}

// eslint-disable-next-line deprecation/deprecation
function isNestedContentValue(v: Value | ValueJSON): v is NestedContentValue[] | NestedContentValueJSON[] {
  return (
    v !== undefined &&
    Array.isArray(v) &&
    (v.length === 0 ||
      ((v[0] as NestedContentValue).primaryKeys !== undefined &&
        (v[0] as NestedContentValue).values !== undefined &&
        (v[0] as NestedContentValue).displayValues !== undefined &&
        (v[0] as NestedContentValue).mergedFieldNames !== undefined))
  );
}

function isArrayValue(
  v: Value | ValueJSON | DisplayValue | DisplayValueJSON, // eslint-disable-line deprecation/deprecation
  // eslint-disable-next-line deprecation/deprecation
): v is ValuesArray | ValuesArrayJSON | DisplayValuesArray | DisplayValuesArrayJSON {
  // note: we don't guarantee by 100% that v is ValuesArray | DisplayValuesArray, but merely make compiler happy.
  // we have other means to determine the type of value.
  return v !== undefined && Array.isArray(v);
}
// eslint-disable-next-line deprecation/deprecation
function isMapValue(v: Value | ValueJSON | DisplayValue | DisplayValueJSON): v is ValuesMap | ValuesMapJSON | DisplayValuesMap | DisplayValuesMapJSON {
  return v !== undefined && typeof v === "object" && !Array.isArray(v);
}
function isPrimitiveValue(v: Value | DisplayValue): v is string | number | boolean | undefined {
  return !isArrayValue(v) && !isMapValue(v);
}

// eslint-disable-next-line deprecation/deprecation
function valuesArrayFromJSON(json: ValuesArrayJSON): ValuesArray {
  // eslint-disable-next-line deprecation/deprecation
  return json.map(Value.fromJSON);
}
// eslint-disable-next-line deprecation/deprecation
function valuesArrayToJSON(values: ValuesArray): ValuesArrayJSON {
  // eslint-disable-next-line deprecation/deprecation
  return values.map(Value.toJSON);
}
// eslint-disable-next-line deprecation/deprecation
function valuesMapFromJSON(json: ValuesMapJSON): ValuesMap {
  const map: ValuesMap = {};
  for (const key in json) {
    /* istanbul ignore else */
    if (json.hasOwnProperty(key)) {
      // eslint-disable-next-line deprecation/deprecation
      map[key] = Value.fromJSON(json[key]);
    }
  }
  return map;
}
// eslint-disable-next-line deprecation/deprecation
function valuesMapToJSON(values: ValuesMap): ValuesMapJSON {
  // eslint-disable-next-line deprecation/deprecation
  const map: ValuesMapJSON = {};
  for (const key in values) {
    /* istanbul ignore else */
    if (values.hasOwnProperty(key)) {
      // eslint-disable-next-line deprecation/deprecation
      map[key] = Value.toJSON(values[key]);
    }
  }
  return map;
}

// eslint-disable-next-line deprecation/deprecation
function displayValuesArrayFromJSON(json: DisplayValuesArrayJSON): DisplayValuesArray {
  // eslint-disable-next-line deprecation/deprecation
  return json.map(DisplayValue.fromJSON);
}
// eslint-disable-next-line deprecation/deprecation
function displayValuesArrayToJSON(values: DisplayValuesArray): DisplayValuesArrayJSON {
  // eslint-disable-next-line deprecation/deprecation
  return values.map(DisplayValue.toJSON);
}
// eslint-disable-next-line deprecation/deprecation
function displayValuesMapFromJSON(json: DisplayValuesMapJSON): DisplayValuesMap {
  const map: DisplayValuesMap = {};
  for (const key in json) {
    /* istanbul ignore else */
    if (json.hasOwnProperty(key)) {
      // eslint-disable-next-line deprecation/deprecation
      map[key] = DisplayValue.fromJSON(json[key]);
    }
  }
  return map;
}
// eslint-disable-next-line deprecation/deprecation
function displayValuesMapToJSON(values: DisplayValuesMap): DisplayValuesMapJSON {
  // eslint-disable-next-line deprecation/deprecation
  const map: DisplayValuesMapJSON = {};
  for (const key in values) {
    /* istanbul ignore else */
    if (values.hasOwnProperty(key)) {
      // eslint-disable-next-line deprecation/deprecation
      map[key] = DisplayValue.toJSON(values[key]);
    }
  }
  return map;
}
