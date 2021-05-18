/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Quantity
 */

/** @beta */
export enum FormatTraits {
  /** Show trailing zeroes to requested precision */
  TrailZeroes = 0x1,
  /** Indicates that the fractional part of the number is required when the fraction is zero */
  KeepSingleZero = 0x2,
  /** Zero magnitude returns blank display value */
  ZeroEmpty = 0x4,
  /** Show decimal point when value to right of decimal is empty */
  KeepDecimalPoint = 0x8,
  /** Use the rounding factor. Not yet supported  */
  ApplyRounding = 0x10,
  /** Show a dash between whole value and fractional value */
  FractionDash = 0x20,
  /** Append the quantity's unit label */
  ShowUnitLabel = 0x40,
  /** Prepend unit label. Not yet supported */
  PrependUnitLabel = 0x80,
  /** show a grouping in each group of 1000. */
  Use1000Separator = 0x100,
  /** Indicates that if an exponent value is positive to not include a `+`. By default a sign, `+` or `-`, is always shown. Not yet supported */
  ExponentOnlyNegative = 0x200,
}

/** Precision for Fractional formatted value types. Range from Whole (1/1) through 1/256.
 * @beta */
export enum FractionalPrecision {
  One = 1,
  Two = 2,
  Four = 4,
  Eight = 8,
  Sixteen = 16,
  ThirtyTwo = 32,
  SixtyFour = 64,
  OneHundredTwentyEight = 128,
  TwoHundredFiftySix = 256,
}

/** Precision for Decimal, Scientific, and Station formatted value types. Range from 1/(10^0) through 1/(10^12).
 * @beta */
export enum DecimalPrecision {
  Zero = 0,
  One = 1,
  Two = 2,
  Three = 3,
  Four = 4,
  Five = 5,
  Six = 6,
  Seven = 7,
  Eight = 8,
  Nine = 9,
  Ten = 10,
  Eleven = 11,
  Twelve = 12,
}

/** Supported format types
 *  @beta */
export enum FormatType {
  /** Decimal display (ie 2.125) */
  Decimal,
  /** Fractional display (ie 2-1/8) */
  Fractional,
  /** Scientific Notation (ie 1.04e3) */
  Scientific,
  /** Civil Engineering Stationing (ie 1+00). */
  Station,
}

/** required if type is scientific
 * @beta */
export enum ScientificType {
  /** Non-zero value left of decimal point (ie 1.2345e3) */
  Normalized,
  /** Zero value left of decimal point (ie 0.12345e4) */
  ZeroNormalized,
}

/** Determines how the sign of values are displayed
 * @beta */
export enum ShowSignOption {
  /** Never show a sign even if the value is negative. */
  NoSign,
  /** Only show a sign when the value is negative. */
  OnlyNegative,
  /** Always show a sign whether the value is positive or negative. */
  SignAlways,
  /** Only show a sign when the value is negative but use parentheses instead of a negative sign. For example, -10 is formatted as `(10)`. */
  NegativeParentheses,
}
