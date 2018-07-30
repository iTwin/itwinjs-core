/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module TypeConverters */

import { TypeConverter } from "./TypeConverter";
import { TypeConverterManager } from "./TypeConverterManager";

/** Operators for string types */
export interface StringOperatorProcessor {
  startsWith(a: string, b: string, caseSensitive: boolean): boolean;
  endsWith(a: string, b: string, caseSensitive: boolean): boolean;
  contains(a: string, b: string, caseSensitive: boolean): boolean;
  doesNotContain(a: string, b: string, caseSensitive: boolean): boolean;
  isContainedIn(a: string, b: string, caseSensitive: boolean): boolean;
  isNotContainedIn(a: string, b: string, caseSensitive: boolean): boolean;
  isEmpty(a: string): boolean;
  isNotEmpty(a: string): boolean;
}

/**
 * String Type Converter.
 */
export class StringTypeConverter extends TypeConverter implements StringOperatorProcessor {
  public async convertToString(value: any): Promise<string> {
    return value ? String(value) : "";
  }

  public async convertFromString(value: string): Promise<any> {
    return value;
  }

  public sortCompare(valueA: any, valueB: any, ignoreCase?: boolean): number {
    let result = 0;

    const stringA = valueA as string;
    const stringB = valueB as string;

    try {
      if (ignoreCase)
        result = stringA.toLocaleLowerCase().localeCompare(stringB.toLocaleLowerCase());
      else
        result = stringA.localeCompare(stringB);
    } catch (ex) {
      return 0;
    }

    return result;
  }

  public isStringType(): boolean { return true; }

  public startsWith(valueA: string, valueB: string, caseSensitive: boolean): boolean {
    if (!valueA || !valueB)
      return false;

    if (caseSensitive)
      return (valueA.substr(0, valueB.length) === valueB);

    return (valueA.toLocaleUpperCase().substr(0, valueB.length) === valueB.toLocaleUpperCase());
  }

  public endsWith(valueA: string, valueB: string, caseSensitive: boolean): boolean {
    if (!valueA || !valueB)
      return false;

    const position = valueA.length - valueB.length;
    if (position < 0)
      return false;

    let lastIndex: number;
    if (caseSensitive)
      lastIndex = valueA.indexOf(valueB, position);
    else
      lastIndex = valueA.toLocaleUpperCase().indexOf(valueB.toLocaleUpperCase(), position);

    return lastIndex !== -1 && lastIndex === position;
  }

  public contains(valueA: string, valueB: string, caseSensitive: boolean): boolean {
    if (!valueA || !valueB)
      return false;

    if (valueB.length > valueA.length)
      return false;

    if (caseSensitive)
      return valueA.indexOf(valueB, 0) !== -1;

    return valueA.toLocaleUpperCase().indexOf(valueB.toLocaleUpperCase(), 0) !== -1;
  }

  public doesNotContain(valueA: string, valueB: string, caseSensitive: boolean): boolean {
    return !this.contains(valueA, valueB, caseSensitive);
  }

  public isContainedIn(valueA: string, valueB: string, caseSensitive: boolean): boolean {
    return this.contains(valueB, valueA, caseSensitive);
  }

  public isNotContainedIn(valueA: string, valueB: string, caseSensitive: boolean): boolean {
    return this.doesNotContain(valueB, valueA, caseSensitive);
  }

  public isEmpty(valueA: string): boolean {
    return valueA.length === 0;
  }

  public isNotEmpty(valueA: string): boolean {
    return !this.isEmpty(valueA);
  }
}

TypeConverterManager.registerConverter("text", StringTypeConverter);
