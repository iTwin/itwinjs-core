/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Properties */

import { PropertyRecord } from "./Record";
import { Primitives } from "./PrimitiveTypes";

/**
 * Enumeration for Format of the property value.
 * @beta
 */
export enum PropertyValueFormat {
  Primitive,
  Array,
  Struct,
}

/** Base interface for a property value
 * @beta
 */
export interface BasePropertyValue {
  valueFormat: PropertyValueFormat;
}

/** Primitive property value
 * @beta
 */
export interface PrimitiveValue extends BasePropertyValue {
  valueFormat: PropertyValueFormat.Primitive;
  value?: Primitives.Value;
  displayValue?: string;
}

/** Struct property value
 * @beta
 */
export interface StructValue extends BasePropertyValue {
  valueFormat: PropertyValueFormat.Struct;
  members: { [name: string]: PropertyRecord };
}

/** Array property value
 * @beta
 */
export interface ArrayValue extends BasePropertyValue {
  valueFormat: PropertyValueFormat.Array;
  items: PropertyRecord[];
  itemsTypeName: string;
}

/** Type for all property values
 * @beta
 */
export type PropertyValue = PrimitiveValue | StructValue | ArrayValue;
