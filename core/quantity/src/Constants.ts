/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/* eslint-disable @typescript-eslint/naming-convention */

/** Constants used internally for both formatting and parsing.
 * @internal
 */
export class QuantityConstants {
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

  /** Return the decimal separator for the current locale. */
  public static get LocaleSpecificDecimalSeparator(): string {
    if (QuantityConstants._LOCALE_DECIMAL_SEPARATOR.length > 0)
      return QuantityConstants._LOCALE_DECIMAL_SEPARATOR;

    QuantityConstants._LOCALE_DECIMAL_SEPARATOR = ".";
    const matches = (12345.6789).toLocaleString().match(/345(.*)67/);
    if (matches && matches.length > 1)
      QuantityConstants._LOCALE_DECIMAL_SEPARATOR = matches[1];

    return QuantityConstants._LOCALE_DECIMAL_SEPARATOR;
  }

  /** Return the thousand separator for the current locale. */
  public static get LocaleSpecificThousandSeparator(): string {
    if (QuantityConstants._LOCALE_THOUSAND_SEPARATOR.length > 0)
      return QuantityConstants._LOCALE_THOUSAND_SEPARATOR;

    QuantityConstants._LOCALE_THOUSAND_SEPARATOR = ",";
    const matches = (12345.6789).toLocaleString().match(/12(.*)345/);
    if (matches && matches.length > 0)
      QuantityConstants._LOCALE_THOUSAND_SEPARATOR = matches[1];

    return QuantityConstants._LOCALE_THOUSAND_SEPARATOR;
  }
}
