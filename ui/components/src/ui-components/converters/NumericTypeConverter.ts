/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module TypeConverters */

import { TypeConverter, LessGreaterOperatorProcessor } from "./TypeConverter";
import { TypeConverterManager } from "./TypeConverterManager";
import { Primitives } from "@bentley/imodeljs-frontend";

/**
 * Base Numeric Type Converter.
 * @public
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
 * @public
 */
export class FloatTypeConverter extends NumericTypeConverterBase {
  public convertToString(value?: Primitives.Float) {
    if (value === undefined)
      return "";

    let numericValue = 0;
    if (typeof value === "string") {
      if (value === "-" || value === "" || value === "-0.0" || value === "-0") {
        // handle these semi-valid values as 0
        numericValue = 0;
      } else {
        numericValue = parseFloat(value);
      }
    } else {
      numericValue = value;
    }
    // this is close to calling `toFixed(2)`, but cuts of any trailing zeros
    let stringValue = (Math.round(100 * numericValue) / 100).toString();
    // because this is a _float_ converter, we want to emphasize the number is a float - make
    // sure there's a decimal part
    if (stringValue.indexOf(".") === -1)
      stringValue += ".0";
    return stringValue;
  }

  public convertFromString(value: string): number {
    return parseFloat(value);
  }
}
TypeConverterManager.registerConverter("float", FloatTypeConverter);
TypeConverterManager.registerConverter("double", FloatTypeConverter);

/**
 * Int Type Converter.
 * @public
 */
export class IntTypeConverter extends NumericTypeConverterBase {
  public convertToString(value?: Primitives.Int) {
    if (value === undefined)
      return "";

    let numericValue = 0;
    if (typeof value === "string") {
      if (value === "-" || value === "" || value === "-0") {
        // handle these semi-valid values as 0
        numericValue = 0;
      } else {
        numericValue = parseInt(value, 10);
      }
    } else {
      numericValue = value;
    }
    return Math.round(numericValue).toString();
  }

  public convertFromString(value: string): number {
    return parseInt(value, 10);
  }
}
TypeConverterManager.registerConverter("int", IntTypeConverter);
TypeConverterManager.registerConverter("integer", IntTypeConverter);
