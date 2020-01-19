/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module TypeConverters
 */

import { TimeFormat } from "@bentley/ui-core";
import { TypeConverter, LessGreaterOperatorProcessor, StandardTypeConverterTypeNames } from "./TypeConverter";
import { TypeConverterManager } from "./TypeConverterManager";
import { Primitives } from "@bentley/imodeljs-frontend";

/**
 * DateTime Type Converter.
 * @public
 */
export abstract class DateTimeTypeConverterBase extends TypeConverter implements LessGreaterOperatorProcessor {
  public convertToString(value?: Primitives.ShortDate) {
    if (value === undefined)
      return "";

    if (typeof value === "string")
      value = new Date(value);

    switch (this.getTimeFormat()) {
      case TimeFormat.Short: return value.toLocaleDateString();
      case TimeFormat.Long: return value.toLocaleString();
    }
    return value.toISOString();
  }

  private isDateValid(date: Date) {
    return date instanceof Date && !isNaN(+date);
  }

  public convertFromString(value: string) {
    if (!value)
      return undefined;

    const dateValue = new Date(value);

    if (!this.isDateValid(dateValue))
      return undefined;

    return dateValue;
  }

  protected abstract getTimeFormat(): TimeFormat;

  public get isLessGreaterType(): boolean { return true; }

  public sortCompare(valueA: Date, valueB: Date, _ignoreCase?: boolean): number {
    return valueA.valueOf() - valueB.valueOf();
  }

  public isEqualTo(valueA: Date, valueB: Date): boolean {
    return valueA.valueOf() === valueB.valueOf();
  }

  public isNotEqualTo(valueA: Date, valueB: Date): boolean {
    return valueA.valueOf() !== valueB.valueOf();
  }

  public isLessThan(a: Date, b: Date): boolean {
    return a.valueOf() < b.valueOf();
  }

  public isLessThanOrEqualTo(a: Date, b: Date): boolean {
    return a.valueOf() <= b.valueOf();
  }

  public isGreaterThan(a: Date, b: Date): boolean {
    return a.valueOf() > b.valueOf();
  }

  public isGreaterThanOrEqualTo(a: Date, b: Date): boolean {
    return a.valueOf() >= b.valueOf();
  }
}

/**
 * Short Date Type Converter.
 * @public
 */
export class ShortDateTypeConverter extends DateTimeTypeConverterBase {
  protected getTimeFormat(): TimeFormat { return TimeFormat.Short; }
}
TypeConverterManager.registerConverter(StandardTypeConverterTypeNames.ShortDate, ShortDateTypeConverter);

/**
 * Date Time Type Converter.
 * @public
 */
export class DateTimeTypeConverter extends DateTimeTypeConverterBase {
  protected getTimeFormat(): TimeFormat { return TimeFormat.Long; }
}
TypeConverterManager.registerConverter(StandardTypeConverterTypeNames.DateTime, DateTimeTypeConverter);
