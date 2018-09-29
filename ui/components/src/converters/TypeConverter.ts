/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module TypeConverters */

import { PropertyDescription } from "../properties/Description";
import { PropertyRecord } from "../properties/Record";
import { PropertyValue, PropertyValueFormat, PrimitiveValue } from "../properties/Value";
import { OutputMessagePriority, OutputMessageType, OutputMessageAlert } from "@bentley/imodeljs-frontend";

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
  Hexdecimal = "hexadecimal",
  Enum = "enum",
  Point2d = "point2d",
  Point3d = "point3d",
}

/** Sort compare method for types that support sorting */
export interface SortComparer {
  sortCompare(valueA: any, valueB: any, ignoreCase?: boolean): number;
}

/** Operators for all filterable types */
export interface OperatorProcessor {
  isEqualTo(a: any, b: any): boolean;
  isNotEqualTo(a: any, b: any): boolean;
}

/** Operators for Numeric types, DateTime, TimeSpan, or  any type that supports these comparisons */
export interface LessGreaterOperatorProcessor {
  isLessThan(a: any, b: any): boolean;
  isLessThanOrEqualTo(a: any, b: any): boolean;
  isGreaterThan(a: any, b: any): boolean;
  isGreaterThanOrEqualTo(a: any, b: any): boolean;
}

/** Operators for all filterable null-able types */
export interface NullableOperatorProcessor {
  isNull(value: any): boolean;
  isNotNull(value: any): boolean;
}

export interface AsyncErrorMsg {
  briefMsg: string;
  detailedMsg?: string;
  priority?: OutputMessagePriority;
  msgType?: OutputMessageType;
  localizationNamespace?: string;   // If this is defined, the detailed and brief properties are keys used along with the namespace to look up localized strings.
  alertType?: OutputMessageAlert;
  displayTime?: number;
}

export interface AsyncValueProcessingResult {
  returnValue?: PropertyValue;
  encounteredError: boolean;
  errorMsg?: AsyncErrorMsg;
}

/**
 * Type Converter base class.
 */
export class TypeConverter implements SortComparer, OperatorProcessor {
  public async convertToString(value: any): Promise<string> {
    if (null === value || undefined === value)
      return "";
    return value.toString();
  }

  public async convertFromString(_value: string): Promise<any> {
    return undefined;
  }

  public async convertPropertyToString(_propertyDescription: PropertyDescription, value: any): Promise<string> {
    if (null === value || undefined === value)
      return "";
    return this.convertToString(value);
  }

  public async convertFromStringToPropertyValue(value: string, _propertyRecord?: PropertyRecord): Promise<PropertyValue> {
    const propertyValue: PrimitiveValue = {
      valueFormat: PropertyValueFormat.Primitive,
      value: await this.convertFromString(value),
      displayValue: "",
    };
    return propertyValue;
  }

  public sortCompare(valueA: any, valueB: any, _ignoreCase?: boolean): number {
    return valueA - valueB;
  }

  public isEqualTo(valueA: any, valueB: any): boolean {
    return valueA === valueB;
  }

  public isNotEqualTo(valueA: any, valueB: any): boolean {
    return valueA !== valueB;
  }

  public get isStringType(): boolean { return false; }
  public get isLessGreaterType(): boolean { return false; }
  public get isNullableType(): boolean { return false; }
  public get isBooleanType(): boolean { return false; }
}
