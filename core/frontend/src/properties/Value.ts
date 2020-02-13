/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Properties
 */

import { PropertyRecord } from "./Record";
import { Primitives } from "./PrimitiveTypes";

/**
 * Enumeration for Format of the property value.
 * @beta
 * @deprecated Move PropertyValueFormat to bentley/ui-abstract beginning in iModel.js 2.0.
 */
export enum PropertyValueFormat {
  Primitive,
  Array,
  Struct,
}

/** Base interface for a property value
 * @beta
 * @deprecated Move BasePropertyValue to bentley/ui-abstract beginning in iModel.js 2.0.
 */
export interface BasePropertyValue {
  valueFormat: PropertyValueFormat;
}

/** Primitive property value
 * @beta
 * @deprecated Move PrimitiveValue to bentley/ui-abstract beginning in iModel.js 2.0.
 */
export interface PrimitiveValue extends BasePropertyValue {
  valueFormat: PropertyValueFormat.Primitive;
  value?: Primitives.Value;
  displayValue?: string;
}

/** Struct property value
 * @beta
 * @deprecated Move StructValue to bentley/ui-abstract beginning in iModel.js 2.0.
 */
export interface StructValue extends BasePropertyValue {
  valueFormat: PropertyValueFormat.Struct;
  members: { [name: string]: PropertyRecord };
}

/** Array property value
 * @beta
 * @deprecated Move ArrayValue to bentley/ui-abstract beginning in iModel.js 2.0.
 */
export interface ArrayValue extends BasePropertyValue {
  valueFormat: PropertyValueFormat.Array;
  items: PropertyRecord[];
  itemsTypeName: string;
}

/** Type for all property values
 * @beta
 * @deprecated Move PropertyValue to bentley/ui-abstract beginning in iModel.js 2.0.
 */
export type PropertyValue = PrimitiveValue | StructValue | ArrayValue;
