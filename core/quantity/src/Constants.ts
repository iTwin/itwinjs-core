/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

export class QuantityConstants {
  // cSpell:ignore ZERONORMALIZED
  public static readonly SCIENTIFIC_TYPE_NORMALIZED: string = "Normalized";
  public static readonly SCIENTIFIC_TYPE_ZERONORMALIZED: string = "ZeroNormalized";
  public static readonly SCIENTIFIC_TYPE_UPPER_NORMALIZED: string = "NORMALIZED";
  public static readonly SCIENTIFIC_TYPE_UPPER_ZERONORMALIZED: string = "ZERONORMALIZED";

  public static readonly CHAR_COMMA = 44;
  public static readonly CHAR_SPACE = 32;
  public static readonly CHAR_NUMBER = 35;
  public static readonly CHAR_PLUS = 43;
  public static readonly CHAR_MINUS = 45;
  public static readonly CHAR_PERIOD = 46;
  public static readonly CHAR_SLASH = 47;
  public static readonly CHAR_DIVISION_SLASH = 8725;
  public static readonly CHAR_FRACTION_SLASH = 8260;
  public static readonly CHAR_ONE_QUARTER = 188;
  public static readonly CHAR_ONE_HALF = 189;
  public static readonly CHAR_THREE_QUARTER = 190;
  public static readonly CHAR_DIGIT_ZERO = 48;
  public static readonly CHAR_DIGIT_NINE = 57;
  public static readonly CHAR_UPPER_E = 69;
  public static readonly CHAR_LOWER_E = 101;
  private static _LOCALE_DECIMAL_SEPARATOR = "";
  private static _LOCALE_THOUSAND_SEPARATOR = "";

  public static get LocaleSpecificDecimalSeparator(): string {
    if (QuantityConstants._LOCALE_DECIMAL_SEPARATOR.length > 0)
      return QuantityConstants._LOCALE_DECIMAL_SEPARATOR;

    QuantityConstants._LOCALE_DECIMAL_SEPARATOR = ".";
    const matches = (12345.6789).toLocaleString()!.match(/345(.*)67/);
    if (matches && matches.length > 1)
      QuantityConstants._LOCALE_DECIMAL_SEPARATOR = matches[1];

    return QuantityConstants._LOCALE_DECIMAL_SEPARATOR;
  }

  public static get LocaleSpecificThousandSeparator(): string {
    if (QuantityConstants._LOCALE_THOUSAND_SEPARATOR.length > 0)
      return QuantityConstants._LOCALE_THOUSAND_SEPARATOR;

    QuantityConstants._LOCALE_THOUSAND_SEPARATOR = ",";
    const matches = (12345.6789).toLocaleString()!.match(/12(.*)345/);
    if (matches && matches.length > 0)
      QuantityConstants._LOCALE_THOUSAND_SEPARATOR = matches[1];

    return QuantityConstants._LOCALE_THOUSAND_SEPARATOR;
  }
}
