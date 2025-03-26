/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Content
 */

import { InstanceId, InstanceKey } from "../EC.js";
import { LabelDefinition } from "../LabelDefinition.js";
import { ValuesDictionary } from "../Utils.js";

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
}

/**
 * A map of raw values
 * @public
 */
export interface ValuesMap extends ValuesDictionary<Value> {} // eslint-disable-line @typescript-eslint/no-empty-object-type

/**
 * An array of raw values
 * @public
 */
export interface ValuesArray extends Array<Value> {} // eslint-disable-line @typescript-eslint/no-empty-object-type

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
}

/**
 * A map of display values
 * @public
 */
export interface DisplayValuesMap extends ValuesDictionary<DisplayValue> {} // eslint-disable-line @typescript-eslint/no-empty-object-type

/**
 * An array of display values
 * @public
 */
export interface DisplayValuesArray extends Array<DisplayValue> {} // eslint-disable-line @typescript-eslint/no-empty-object-type

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
  /**
   * Label of the ECInstance that this `NestedContentValue` is based on.
   * @deprecated in 5.x. Use [[label]] instead.
   */
  labelDefinition?: LabelDefinition;
  label?: LabelDefinition;
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

function isNestedContentValue(v: Value): v is NestedContentValue[] {
  return (
    v !== undefined &&
    Array.isArray(v) &&
    (v.length === 0 ||
      (!!v[0] &&
        (v[0] as NestedContentValue).primaryKeys !== undefined &&
        (v[0] as NestedContentValue).values !== undefined &&
        (v[0] as NestedContentValue).displayValues !== undefined &&
        (v[0] as NestedContentValue).mergedFieldNames !== undefined))
  );
}

function isArrayValue(v: Value | DisplayValue): v is ValuesArray | DisplayValuesArray {
  // note: we don't guarantee by 100% that v is ValuesArray | DisplayValuesArray, but merely make compiler happy.
  // we have other means to determine the type of value.
  return v !== undefined && Array.isArray(v);
}
function isMapValue(v: Value | DisplayValue): v is ValuesMap | DisplayValuesMap {
  return v !== undefined && typeof v === "object" && !Array.isArray(v);
}
function isPrimitiveValue(v: Value | DisplayValue): v is string | number | boolean | undefined {
  return !isArrayValue(v) && !isMapValue(v);
}
