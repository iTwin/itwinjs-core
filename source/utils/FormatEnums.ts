/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
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

export function parseFormatTrait(stringToCheck: string, currentFormatTrait: number): number {
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

export function parseFormatType(jsonObjType: string, formatName: string): FormatType | undefined {
  let formatType;
  switch (jsonObjType.toLowerCase()) {
    case "decimal":
      formatType = FormatType.Decimal;
      break;
    case "scientific":
      formatType = FormatType.Scientific;
      break;
    case "station":
      formatType = FormatType.Station;
      break;
    case "fractional":
      formatType = FormatType.Fractional;
      break;
    default:
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${formatName} has an invalid 'type' attribute.`);
  }
  return formatType;
}
export function parseDecimalPrecision(jsonObjPrecision: number, formatName: string): number | undefined {
  let precision;
  switch (jsonObjPrecision) {
    case 0:
      precision = DecimalPrecision.Zero;
      break;
    case 1:
      precision = DecimalPrecision.One;
      break;
    case 2:
      precision = DecimalPrecision.Two;
      break;
    case 3:
      precision = DecimalPrecision.Three;
      break;
    case 4:
      precision = DecimalPrecision.Four;
      break;
    case 5:
      precision = DecimalPrecision.Five;
      break;
    case 6:
      precision = DecimalPrecision.Six;
      break;
    case 7:
      precision = DecimalPrecision.Seven;
      break;
    case 8:
      precision = DecimalPrecision.Eight;
      break;
    case 9:
      precision = DecimalPrecision.Nine;
      break;
    case 10:
      precision = DecimalPrecision.Ten;
      break;
    case 11:
      precision = DecimalPrecision.Eleven;
      break;
    case 12:
      precision = DecimalPrecision.Twelve;
      break;
    default:
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${formatName} has an invalid 'precision' attribute.`);
  }
  return precision;
}

export function parseFractionalPrecision(jsonObjPrecision: number, formatName: string) {
  let precision;
  switch (jsonObjPrecision) {
    case 1:
      precision = FractionalPrecision.One;
      break;
    case 2:
      precision = FractionalPrecision.Two;
      break;
    case 4:
      precision = FractionalPrecision.Four;
      break;
    case 8:
      precision = FractionalPrecision.Eight;
      break;
    case 16:
      precision = FractionalPrecision.Sixteen;
      break;
    case 32:
      precision = FractionalPrecision.ThirtyTwo;
      break;
    case 64:
      precision = FractionalPrecision.SixtyFour;
      break;
    case 128:
      precision = FractionalPrecision.OneHundredTwentyEight;
      break;
    case 256:
      precision = FractionalPrecision.TwoHundredFiftySix;
      break;
    default:
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${formatName} has an invalid 'precision' attribute.`);
  }
  return precision;
}

export function parsePrecision(jsonObjPrecision: number, formatName: string, type: FormatType): number | undefined {
  let precision;
  switch (type) { // type must be decimal, fractional, scientific, or station
    case FormatType.Decimal:
    case FormatType.Scientific:
    case FormatType.Station:
      precision = parseDecimalPrecision(jsonObjPrecision, formatName);
      break;
    case FormatType.Fractional:
      precision = parseFractionalPrecision(jsonObjPrecision, formatName);
      break;
    default:
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${formatName} has an invalid 'type' attribute.`);
  }
  return precision;
}

export function parseScientificType(jsonObjScientificType: string, formatName: string) {
  let scientificType;
  switch (jsonObjScientificType) {
    case "normalized":
      scientificType = ScientificType.Normalized;
      break;
    case "zeronormalized":
      scientificType = ScientificType.ZeroNormalized;
      break;
    default:
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${formatName} has an invalid 'scientificType' attribute.`);
  }
  return scientificType;
}

export function parseShowSignOption(jsonObjShowSignOption: string, formatName: string) {
  let showSignOption;
  switch (jsonObjShowSignOption) {
    case "nosign":
      showSignOption = ShowSignOption.NoSign;
      break;
    case "onlynegative":
      showSignOption = ShowSignOption.OnlyNegative;
      break;
    case "signalways":
      showSignOption = ShowSignOption.SignAlways;
      break;
    case "negativeparentheses":
      showSignOption = ShowSignOption.NegativeParentheses;
      break;
    default:
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${formatName} has an invalid 'showSignOption' attribute.`);
  }
  return showSignOption;
}
