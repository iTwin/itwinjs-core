/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module TypeConverters */

import { TypeConverter, LessGreaterOperatorProcessor } from "./TypeConverter";
import { TypeConverterManager } from "./TypeConverterManager";

/**
 * Base Numeric Type Converter.
 */
export abstract class NumericTypeConverterBase extends TypeConverter implements LessGreaterOperatorProcessor {
  public get isLessGreaterType(): boolean { return true; }

  public isLessThan(a: any, b: any): boolean {
    return a < b;
  }

  public isLessThanOrEqualTo(a: any, b: any): boolean {
    return a <= b;
  }

  public isGreaterThan(a: any, b: any): boolean {
    return a > b;
  }

  public isGreaterThanOrEqualTo(a: any, b: any): boolean {
    return a >= b;
  }
}

/**
 * Float Type Converter.
 */
export class FloatTypeConverter extends NumericTypeConverterBase {
  public async convertToString(value: any): Promise<string> {
    if (null === value || undefined === value)
      return "";

    value = value.toString();
    if (value === "-" || value === "" || value === "-0.0" || value === "-0")
      value = "0.0";
    if (value.indexOf(".") === -1)
      value = value + ".0";
    return value;
  }

  public async convertFromString(value: string): Promise<any> {
    if (null === value || undefined === value)
      return undefined;

    return parseFloat(value);
  }
}
TypeConverterManager.registerConverter("float", FloatTypeConverter);
TypeConverterManager.registerConverter("double", FloatTypeConverter);

/**
 * Int Type Converter.
 */
export class IntTypeConverter extends NumericTypeConverterBase {
  public async convertToString(value: any): Promise<string> {
    if (null === value || undefined === value)
      return "";

    value = value.toString();
    if (value === "-" || value === "" || value === "-0")
      value = "0";
    return value;
  }

  public async convertFromString(value: string): Promise<any> {
    if (null === value || undefined === value)
      return undefined;

    // tslint:disable-next-line:radix
    return parseInt(value);
  }
}
TypeConverterManager.registerConverter("int", IntTypeConverter);
TypeConverterManager.registerConverter("integer", IntTypeConverter);
