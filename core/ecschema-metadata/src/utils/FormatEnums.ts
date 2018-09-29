/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { ECObjectsError, ECObjectsStatus } from "../Exception";

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

// parse and toString methods

export function scientificTypeToString(scientificType: ScientificType): string {
  if (scientificType === ScientificType.Normalized)
    return "Normalized";
  else
    return "ZeroNormalized";
}

export function parseScientificType(scientificType: string, formatName: string): ScientificType {
  switch (scientificType.toUpperCase()) {
    case "NORMALIZED":
      return ScientificType.Normalized;
    case "ZERONORMALIZED":
      return ScientificType.ZeroNormalized;
    default:
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${formatName} has an invalid 'scientificType' attribute.`);
  }
}

export function showSignOptionToString(showSign: ShowSignOption): string {
  switch (showSign) {
    case ShowSignOption.NegativeParentheses:
      return "NegativeParentheses";
    case ShowSignOption.NoSign:
      return "NoSign";
    case ShowSignOption.OnlyNegative:
      return "OnlyNegative";
    case ShowSignOption.SignAlways:
      return "SignAlways";
  }
}

export function parseShowSignOption(showSignOption: string, formatName: string): ShowSignOption {
  switch (showSignOption.toUpperCase()) {
    case "NOSIGN":
      return ShowSignOption.NoSign;
    case "ONLYNEGATIVE":
      return ShowSignOption.OnlyNegative;
    case "SIGNALWAYS":
      return ShowSignOption.SignAlways;
    case "NEGATIVEPARENTHESES":
      return ShowSignOption.NegativeParentheses;
    default:
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${formatName} has an invalid 'showSignOption' attribute.`);
  }
}

export function formatTraitsToArray(currentFormatTrait: FormatTraits): string[] {
  const formatTraitsArr = Array<string>();
  if ((currentFormatTrait & FormatTraits.TrailZeroes) === FormatTraits.TrailZeroes)
    formatTraitsArr.push("trailZeroes");
  if ((currentFormatTrait & FormatTraits.KeepSingleZero) === FormatTraits.KeepSingleZero)
    formatTraitsArr.push("keepSingleZero");
  if ((currentFormatTrait & FormatTraits.ZeroEmpty) === FormatTraits.ZeroEmpty)
    formatTraitsArr.push("zeroEmpty");
  if ((currentFormatTrait & FormatTraits.KeepDecimalPoint) === FormatTraits.KeepDecimalPoint)
    formatTraitsArr.push("keepDecimalPoint");
  if ((currentFormatTrait & FormatTraits.ApplyRounding) === FormatTraits.ApplyRounding)
    formatTraitsArr.push("applyRounding");
  if ((currentFormatTrait & FormatTraits.FractionDash) === FormatTraits.FractionDash)
    formatTraitsArr.push("fractionDash");
  if ((currentFormatTrait & FormatTraits.ShowUnitLabel) === FormatTraits.ShowUnitLabel)
    formatTraitsArr.push("showUnitLabel");
  if ((currentFormatTrait & FormatTraits.PrependUnitLabel) === FormatTraits.PrependUnitLabel)
    formatTraitsArr.push("prependUnitLabel");
  if ((currentFormatTrait & FormatTraits.Use1000Separator) === FormatTraits.Use1000Separator)
    formatTraitsArr.push("use1000Separator");
  if ((currentFormatTrait & FormatTraits.ExponentOnlyNegative) === FormatTraits.ExponentOnlyNegative)
    formatTraitsArr.push("exponentOnlyNegative");
  return formatTraitsArr;
}

export function parseFormatTrait(stringToCheck: string, currentFormatTrait: number): FormatTraits {
  let formatTrait = currentFormatTrait;
  switch (stringToCheck) {
    case "trailzeroes":
      formatTrait = currentFormatTrait | FormatTraits.TrailZeroes;
      break;
    case "keepsinglezero":
      formatTrait = currentFormatTrait | FormatTraits.KeepSingleZero;
      break;
    case "zeroempty":
      formatTrait = currentFormatTrait | FormatTraits.ZeroEmpty;
      break;
    case "keepdecimalpoint":
      formatTrait = currentFormatTrait | FormatTraits.KeepDecimalPoint;
      break;
    case "applyrounding":
      formatTrait = currentFormatTrait | FormatTraits.ApplyRounding;
      break;
    case "fractiondash":
      formatTrait = currentFormatTrait | FormatTraits.FractionDash;
      break;
    case "showunitlabel":
      formatTrait = currentFormatTrait | FormatTraits.ShowUnitLabel;
      break;
    case "prependunitlabel":
      formatTrait = currentFormatTrait | FormatTraits.PrependUnitLabel;
      break;
    case "use1000separator":
      formatTrait = currentFormatTrait | FormatTraits.Use1000Separator;
      break;
    case "exponentonlynegative":
      formatTrait = currentFormatTrait | FormatTraits.ExponentOnlyNegative;
      break;
    default:
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `Format has an invalid 'formatTraits' option.`);
  }
  return formatTrait;
}

export function formatTypeToString(type: FormatType): string {
  switch (type) {
    case FormatType.Decimal:
      return "Decimal";
    case FormatType.Scientific:
      return "Scientific";
    case FormatType.Station:
      return "Station";
    case FormatType.Fractional:
      return "Fractional";
  }
}

export function parseFormatType(jsonObjType: string, formatName: string): FormatType {
  switch (jsonObjType.toUpperCase()) {
    case "DECIMAL":
      return FormatType.Decimal;
      break;
    case "SCIENTIFIC":
      return FormatType.Scientific;
      break;
    case "STATION":
      return FormatType.Station;
      break;
    case "FRACTIONAL":
      return FormatType.Fractional;
      break;
    default:
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${formatName} has an invalid 'type' attribute.`);
  }
}

export function parseDecimalPrecision(jsonObjPrecision: number): DecimalPrecision {
  switch (jsonObjPrecision) {
    case 0:
      return DecimalPrecision.Zero;
      break;
    case 1:
      return DecimalPrecision.One;
      break;
    case 2:
      return DecimalPrecision.Two;
      break;
    case 3:
      return DecimalPrecision.Three;
      break;
    case 4:
      return DecimalPrecision.Four;
      break;
    case 5:
      return DecimalPrecision.Five;
      break;
    case 6:
      return DecimalPrecision.Six;
      break;
    case 7:
      return DecimalPrecision.Seven;
      break;
    case 8:
      return DecimalPrecision.Eight;
      break;
    case 9:
      return DecimalPrecision.Nine;
      break;
    case 10:
      return DecimalPrecision.Ten;
      break;
    case 11:
      return DecimalPrecision.Eleven;
      break;
    case 12:
      return DecimalPrecision.Twelve;
      break;
    default:
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The 'precision' attribute must be an integer in the range 0-12.`);
  }
}

export function parseFractionalPrecision(jsonObjPrecision: number, formatName: string): FractionalPrecision {
  switch (jsonObjPrecision) {
    case 1:
      return FractionalPrecision.One;
      break;
    case 2:
      return FractionalPrecision.Two;
      break;
    case 4:
      return FractionalPrecision.Four;
      break;
    case 8:
      return FractionalPrecision.Eight;
      break;
    case 16:
      return FractionalPrecision.Sixteen;
      break;
    case 32:
      return FractionalPrecision.ThirtyTwo;
      break;
    case 64:
      return FractionalPrecision.SixtyFour;
      break;
    case 128:
      return FractionalPrecision.OneHundredTwentyEight;
      break;
    case 256:
      return FractionalPrecision.TwoHundredFiftySix;
      break;
    default:
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${formatName} has an invalid 'precision' attribute.`);
  }
}

export function parsePrecision(precision: number, formatName: string, type: FormatType): DecimalPrecision | FractionalPrecision {
  switch (type) { // type must be decimal, fractional, scientific, or station
    case FormatType.Decimal:
    case FormatType.Scientific:
    case FormatType.Station:
      return parseDecimalPrecision(precision);
      break;
    case FormatType.Fractional:
      return parseFractionalPrecision(precision, formatName);
      break;
    default:
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${formatName} has an invalid 'type' attribute.`);
  }
}
