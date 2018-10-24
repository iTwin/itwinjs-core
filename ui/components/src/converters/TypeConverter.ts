/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module TypeConverters */

import { PropertyDescription } from "../properties/Description";
import { PropertyRecord } from "../properties/Record";
import { PropertyValue, PropertyValueFormat, PrimitiveValue } from "../properties/Value";
import { OutputMessagePriority, OutputMessageType, OutputMessageAlert } from "@bentley/imodeljs-frontend";
import { Primitives, ConvertedPrimitives } from "./valuetypes";

/**
 * StandardTypeConverterTypeNames.
 */
export const enum StandardTypeConverterTypeNames {
  Text = "text",
  String = "string",
  ShortDate = "shortdate",
  Boolean = "boolean",
  Float = "float",
  Int = "int",
  Hexadecimal = "hexadecimal",
  Enum = "enum",
  Point2d = "point2d",
  Point3d = "point3d",
}

/** Sort compare method for types that support sorting */
export interface SortComparer {
  sortCompare(valueA: Primitives.Value, valueB: Primitives.Value, ignoreCase?: boolean): number;
}

/** Operators for all filterable types */
export interface OperatorProcessor {
  isEqualTo(a: Primitives.Value, b: Primitives.Value): boolean;
  isNotEqualTo(a: Primitives.Value, b: Primitives.Value): boolean;
}

/** Operators for Numeric types, DateTime, TimeSpan, or  any type that supports these comparisons */
export interface LessGreaterOperatorProcessor {
  isLessThan(a: Primitives.Value, b: Primitives.Value): boolean;
  isLessThanOrEqualTo(a: Primitives.Value, b: Primitives.Value): boolean;
  isGreaterThan(a: Primitives.Value, b: Primitives.Value): boolean;
  isGreaterThanOrEqualTo(a: Primitives.Value, b: Primitives.Value): boolean;
}

/** Operators for all filterable null-able types */
export interface NullableOperatorProcessor {
  isNull(value: Primitives.Value): boolean;
  isNotNull(value: Primitives.Value): boolean;
}

/** Asynchronous Error Message returned as part of [[AsyncValueProcessingResult]] */
export interface AsyncErrorMessage {
  briefMsg: string;
  detailedMsg?: string;
  priority?: OutputMessagePriority;
  msgType?: OutputMessageType;
  localizationNamespace?: string;   // If this is defined, the detailed and brief properties are keys used along with the namespace to look up localized strings.
  alertType?: OutputMessageAlert;
  displayTime?: number;
}

/** Asynchronous Value Process Result */
export interface AsyncValueProcessingResult {
  returnValue?: PropertyValue;
  encounteredError: boolean;
  errorMsg?: AsyncErrorMessage;
}

/**
 * Type Converter base class.
 */
export abstract class TypeConverter implements SortComparer, OperatorProcessor {
  public async convertToString(value?: Primitives.Value): Promise<string> {
    if (value === undefined)
      return "";
    return value.toString();
  }

  public async convertFromString(_value: string): Promise<ConvertedPrimitives.Value | undefined> {
    return undefined;
  }

  public async convertPropertyToString(_propertyDescription: PropertyDescription, value?: Primitives.Value): Promise<string> {
    return this.convertToString(value);
  }

  public async convertFromStringToPropertyValue(value: string, _propertyRecord?: PropertyRecord): Promise<PropertyValue> {
    const stringValue = await this.convertFromString(value);
    const propertyValue: PrimitiveValue = {
      valueFormat: PropertyValueFormat.Primitive,
      value: stringValue ? stringValue : "",
      displayValue: "",
    };
    return propertyValue;
  }

  public abstract sortCompare(valueA: Primitives.Value, valueB: Primitives.Value, _ignoreCase?: boolean): number;

  public isEqualTo(valueA: Primitives.Value, valueB: Primitives.Value): boolean {
    return valueA === valueB;
  }

  public isNotEqualTo(valueA: Primitives.Value, valueB: Primitives.Value): boolean {
    return valueA !== valueB;
  }

  public get isStringType(): boolean { return false; }
  public get isLessGreaterType(): boolean { return false; }
  public get isNullableType(): boolean { return false; }
  public get isBooleanType(): boolean { return false; }
}
