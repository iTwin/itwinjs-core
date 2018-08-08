/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Properties */

import { PropertyRecord } from "./Record";

/**
 * Enumeration for Format of the property value.
 */
export enum PropertyValueFormat {
  Primitive,
  Array,
  Struct,
}

/** Base interface for a property value */
export interface BasePropertyValue {
  valueFormat: PropertyValueFormat;
}

/** Primitive property value */
export interface PrimitiveValue extends BasePropertyValue {
  valueFormat: PropertyValueFormat.Primitive;
  value: any;
  displayValue: string;
}

/** Struct property value */
export interface StructValue extends BasePropertyValue {
  valueFormat: PropertyValueFormat.Struct;
  members: { [name: string]: PropertyRecord };
}

/** Array property value */
export interface ArrayValue extends BasePropertyValue {
  valueFormat: PropertyValueFormat.Array;
  items: PropertyRecord[];
}

/** Type for all property values */
export type PropertyValue = PrimitiveValue | StructValue | ArrayValue;
