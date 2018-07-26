/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module TypeConverters */

import { TimeFormat } from "@bentley/ui-core";
import { TypeConverter, LessGreaterOperatorProcessor } from "./TypeConverter";
import { TypeConverterManager } from "./TypeConverterManager";

/**
 * Short Date Type Converter.
 */
export class ShortDateTypeConverter extends TypeConverter implements LessGreaterOperatorProcessor {
  public async convertToString(value: any): Promise<string> {
    if (null === value || undefined === value)
      return "";

    // let isoString = value;

    // if (typeof value !== "string" && value.toISOString)     // Is this a Date?
    //   isoString = value.toISOString();

    // let stringValue = UiContext.GetContext().FormatLocalizedDate(isoString, DateFormat.Short, this.GetTimeFormat());
    // if (stringValue === "" && value.toDateString)    // If empty & this is truly a Date
    //   stringValue = value.toDateString();

    let stringValue = value;
    if (typeof value !== "string" && value.toDateString)     // Is this a Date?
      stringValue = value.toDateString();

    return stringValue;
  }

  public async convertFromString(value: string): Promise<any> {
    if (null === value || undefined === value)
      return null;

    const dateValue = new Date(value);
    return dateValue;
  }

  public isLessGreaterType(): boolean { return true; }

  public sortCompare(valueA: any, valueB: any, _ignoreCase?: boolean): number {
    return valueA.valueOf() - valueB.valueOf();
  }

  public isEqualTo(valueA: any, valueB: any): boolean {
    return valueA.valueOf() === valueB.valueOf();
  }

  public isNotEqualTo(valueA: any, valueB: any): boolean {
    return valueA.valueOf() !== valueB.valueOf();
  }

  public isLessThan(a: any, b: any): boolean {
    return a.valueOf() < b.valueOf();
  }

  public isLessThanOrEqualTo(a: any, b: any): boolean {
    return a.valueOf() <= b.valueOf();
  }

  public isGreaterThan(a: any, b: any): boolean {
    return a.valueOf() > b.valueOf();
  }

  public isGreaterThanOrEqualTo(a: any, b: any): boolean {
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
