/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module TypeConverters
 */

import { TypeConverter, StandardTypeConverterTypeNames } from "./TypeConverter";
import { TypeConverterManager } from "./TypeConverterManager";
import { Primitives } from "@bentley/ui-abstract";

/** Operators for string types
 * @public
 */
export interface StringOperatorProcessor {
  /** Determines if one string starts with another string */
  startsWith(a: string, b: string, caseSensitive: boolean): boolean;
  /** Determines if one string ends with another string */
  endsWith(a: string, b: string, caseSensitive: boolean): boolean;
  /** Determines if one string contains another string */
  contains(a: string, b: string, caseSensitive: boolean): boolean;
  /** Determines if one string does not contain another string */
  doesNotContain(a: string, b: string, caseSensitive: boolean): boolean;
  /** Determines if one string is contained within another string */
  isContainedIn(a: string, b: string, caseSensitive: boolean): boolean;
  /** Determines if one string is not contained within another string */
  isNotContainedIn(a: string, b: string, caseSensitive: boolean): boolean;
  /** Determines if a string is empty */
  isEmpty(a: string): boolean;
  /** Determines if a string is not empty */
  isNotEmpty(a: string): boolean;
}

/**
 * String Type Converter.
 * @public
 */
export class StringTypeConverter extends TypeConverter implements StringOperatorProcessor {
  public convertToString(value?: Primitives.String) {
    return value ? value.toString() : "";
  }

  public convertFromString(value: string) {
    return value;
  }

  public sortCompare(valueA: Primitives.String, valueB: Primitives.String, ignoreCase?: boolean): number {
    if (ignoreCase)
      return valueA.toLocaleLowerCase().localeCompare(valueB.toLocaleLowerCase());
    else
      return valueA.localeCompare(valueB);
  }

  public get isStringType(): boolean { return true; }

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

TypeConverterManager.registerConverter(StandardTypeConverterTypeNames.Text, StringTypeConverter);
TypeConverterManager.registerConverter(StandardTypeConverterTypeNames.String, StringTypeConverter);
