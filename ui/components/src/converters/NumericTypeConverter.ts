/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module TypeConverters */

import { TypeConverter, LessGreaterOperatorProcessor } from "./TypeConverter";
import { TypeConverterManager } from "./TypeConverterManager";
import * as Primitives from "./valuetypes/PrimitiveTypes";

/**
 * Base Numeric Type Converter.
 */
export abstract class NumericTypeConverterBase extends TypeConverter implements LessGreaterOperatorProcessor {
  public get isLessGreaterType(): boolean { return true; }

  public isLessThan(a: Primitives.Numeric, b: Primitives.Numeric): boolean {
    return a < b;
  }

  public isLessThanOrEqualTo(a: Primitives.Numeric, b: Primitives.Numeric): boolean {
    return a <= b;
  }

  public isGreaterThan(a: Primitives.Numeric, b: Primitives.Numeric): boolean {
    return a > b;
  }

  public isGreaterThanOrEqualTo(a: Primitives.Numeric, b: Primitives.Numeric): boolean {
    return a >= b;
  }

  public sortCompare(a: Primitives.Numeric, b: Primitives.Numeric, _ignoreCase?: boolean): number {
    return (+a) - (+b);
  }
}

/**
 * Float Type Converter.
 */
export class FloatTypeConverter extends NumericTypeConverterBase {
  public convertToString(value?: Primitives.Float) {
    if (value === undefined)
      return "";

    let stringValue = value.toString();

    if (stringValue === "-" || stringValue === "" || stringValue === "-0.0" || stringValue === "-0")
      stringValue = "0.0";
    if (stringValue.indexOf(".") === -1)
      stringValue = stringValue + ".0";
    return stringValue;
  }

  public convertFromString(value: string) {
    return parseFloat(value);
  }
}
TypeConverterManager.registerConverter("float", FloatTypeConverter);
TypeConverterManager.registerConverter("double", FloatTypeConverter);

/**
 * Int Type Converter.
 */
export class IntTypeConverter extends NumericTypeConverterBase {
  public convertToString(value?: Primitives.Int) {
    if (value === undefined)
      return "";

    let stringValue = value.toString();

    if (stringValue === "-" || stringValue === "" || stringValue === "-0")
      stringValue = "0";
    return stringValue;
  }

  public convertFromString(value: string) {
    return parseInt(value, 10);
  }
}
TypeConverterManager.registerConverter("int", IntTypeConverter);
TypeConverterManager.registerConverter("integer", IntTypeConverter);
