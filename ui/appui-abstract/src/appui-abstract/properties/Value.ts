/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Properties
 */

import { Primitives } from "./PrimitiveTypes";
import { PropertyRecord } from "./Record";

/**
 * Enumeration for Format of the property value.
 * @public
 */
export enum PropertyValueFormat {
  Primitive,
  Array,
  Struct,
}

/** Base interface for a property value
 * @public
 */
export interface BasePropertyValue {
  valueFormat: PropertyValueFormat;
}

/** Primitive property value
 * @public
 */
export interface PrimitiveValue extends BasePropertyValue {
  valueFormat: PropertyValueFormat.Primitive;
  value?: Primitives.Value;
  displayValue?: string;
  /**
   * Rounding error that should be taken into consideration when comparing numeric values. This is useful
   * when numeric display value is rounded and displayed with less precision than actual value.
   *
   * Example: entered value is 0.12 but it should match values like 0.12345. In that case `roundingError` can be set to `0.005` and comparison should be done in `0.115` to `0.125` range.
   */
  roundingError?: number;
}

/** Struct property value
 * @public
 */
export interface StructValue extends BasePropertyValue {
  valueFormat: PropertyValueFormat.Struct;
  members: { [name: string]: PropertyRecord };
}

/** Array property value
 * @public
 */
export interface ArrayValue extends BasePropertyValue {
  valueFormat: PropertyValueFormat.Array;
  items: PropertyRecord[];
  itemsTypeName: string;
}

/** Type for all property values
 * @public
 */
export type PropertyValue = PrimitiveValue | StructValue | ArrayValue;
