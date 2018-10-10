/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
export const enum FormatTraits {
  TrailZeroes = 0x1,
  KeepSingleZero = 0x2,
  ZeroEmpty = 0x4,
  KeepDecimalPoint = 0x8,
  ApplyRounding = 0x10,
  FractionDash = 0x20,
  ShowUnitLabel = 0x40,
  PrependUnitLabel = 0x80,
  Use1000Separator = 0x100,
  ExponentOnlyNegative = 0x200,
}

export const enum FractionalPrecision {
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

export const enum DecimalPrecision {
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

export const enum FormatType {
  Decimal,
  Fractional,
  Scientific,
  Station,
}

export const enum ScientificType { // required if type is scientific; options: normalized, zeroNormalized
  Normalized,
  ZeroNormalized,
}

export const enum ShowSignOption { // default is no sign
  NoSign,
  OnlyNegative,
  SignAlways,
  NegativeParentheses,
}
