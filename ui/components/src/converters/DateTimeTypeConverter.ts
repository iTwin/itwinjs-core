/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module TypeConverters */

import { TimeFormat } from "@bentley/ui-core";
import { TypeConverter, LessGreaterOperatorProcessor } from "./TypeConverter";
import { TypeConverterManager } from "./TypeConverterManager";
import { Primitives } from "./valuetypes";

/**
 * Short Date Type Converter.
 */
export class ShortDateTypeConverter extends TypeConverter implements LessGreaterOperatorProcessor {
  public async convertToString(value?: Primitives.ShortDate): Promise<string> {
    if (value === undefined)
      return "";

    if (typeof value !== "string" && value.toDateString)     // Is this a Date?
      return value.toDateString();
    else
      return value.toString();
  }

  private isDateValid(date: Date) {
    return date instanceof Date && !isNaN(+date);
  }

  public async convertFromString(value: string): Promise<Date | undefined> {
    if (!value)
      return undefined;

    const dateValue = new Date(value);

    if (!this.isDateValid(dateValue))
      return undefined;

    return dateValue;
  }

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

  protected getTimeFormat(): TimeFormat { return TimeFormat.None; }
}
TypeConverterManager.registerConverter("shortdate", ShortDateTypeConverter);

/**
 * Date Time Type Converter.
 */
export class DateTimeTypeConverter extends ShortDateTypeConverter {
  protected getTimeFormat(): TimeFormat { return TimeFormat.Long; }
}
TypeConverterManager.registerConverter("dateTime", DateTimeTypeConverter);
