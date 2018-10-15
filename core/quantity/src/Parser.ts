/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { QuantityConstants } from "./Constants";
import { QuantityProps, UnitsProvider } from "./Interfaces";
import { Quantity } from "./Quantity";
import { Format } from "./Formatter/Format";
import { FormatType, FormatTraits } from "./Formatter/FormatEnums";

/** A ParseToken holds either a numeric or string toke extracted from a string that represents a quantity value. */
class ParseToken {
  public value: number | string;

  constructor(value: string | number) {
    if (typeof value === "string") this.value = value.trim();
    else this.value = value;
  }

  public get isString(): boolean { return typeof this.value === "string"; }
  public get isNumber(): boolean { return typeof this.value === "number"; }
}

class ScientificToken {
  public index: number;
  public exponent = "";

  constructor(index: number, exponent?: string) {
    this.index = index;
    if (exponent) this.exponent = exponent;
  }
}

class FractionToken {
  public index: number;
  public fraction = 0.0;
  public exponent = "";

  constructor(index: number, fraction?: number) {
    this.index = index;
    if (fraction) this.fraction = fraction;
  }
}

/** A Parser class that is used to break a string that represents a quantity value into tokens. */
export class Parser {
  private static checkForScientificNotation(index: number, stringToParse: string, uomSeparatorToIgnore: number): ScientificToken {
    let exponentString = "";
    let i = index + 1;

    for (; i < stringToParse.length; i++) {
      const charCode = stringToParse.charCodeAt(i);
      if (Parser.isDigit(charCode) || ((charCode === QuantityConstants.CHAR_MINUS || charCode === QuantityConstants.CHAR_PLUS) && (i === (index + 1)))) {
        exponentString = exponentString.concat(stringToParse[i]);
      } else {
        i = uomSeparatorToIgnore === charCode ? i : i - 1;
        break;
      }
    }

    if (exponentString.length > 1 || ((exponentString.length === 1) && (exponentString.charCodeAt(0) !== QuantityConstants.CHAR_MINUS) && (exponentString.charCodeAt(0) !== QuantityConstants.CHAR_PLUS)))
      return new ScientificToken(i, exponentString);

    return new ScientificToken(index);
  }

  private static checkForFractions(index: number, stringToParse: string, uomSeparatorToIgnore: number, numeratorStr?: string): FractionToken {
    let numeratorToken = "";
    let denominatorToken = "";
    let processingNumerator = true;
    let i = index;
    if (numeratorStr && numeratorStr.length > 0) {
      numeratorToken = numeratorStr;
      processingNumerator = false;
    }

    for (; i < stringToParse.length; i++) {
      const charCode = stringToParse.charCodeAt(i);
      if (Parser.isDigit(charCode)) {
        if (processingNumerator) {
          numeratorToken = numeratorToken.concat(stringToParse[i]);
        } else {
          denominatorToken = denominatorToken.concat(stringToParse[i]);
        }
      } else {
        if (processingNumerator && (charCode === QuantityConstants.CHAR_SLASH || charCode === QuantityConstants.CHAR_DIVISION_SLASH || charCode === QuantityConstants.CHAR_DIVISION_SLASH)) {
          processingNumerator = false;
        } else {
          if (uomSeparatorToIgnore !== charCode) i = i - 1; // skip over uom separator after fraction
          break;
        }
      }
    }

    if (numeratorToken.length > 0 && denominatorToken.length > 0) {
      const numerator = parseInt(numeratorToken, 10);
      const denominator = parseInt(denominatorToken, 10);
      if (denominator > 0)
        return new FractionToken(i, numerator / denominator);
      return new FractionToken(i);
    }

    return new FractionToken(index + 1);
  }

  private static isDigit(charCode: number): boolean {
    return (charCode >= QuantityConstants.CHAR_DIGIT_ZERO) && (charCode <= QuantityConstants.CHAR_DIGIT_NINE);
  }

  private static isDigitOrDecimalSeparator(charCode: number, format: Format): boolean {
    return (charCode === format.decimalSeparator.charCodeAt(0)) || Parser.isDigit(charCode);
  }

  /** Parse the quantity string and return and array of ParseTokens that represent the component invariant values and unit labels.
   * @param quantitySpecification The quantity string to ba parsed.
   */
  public static parseQuantitySpecification(quantitySpecification: string, format: Format): ParseToken[] {
    const tokens: ParseToken[] = [];
    const str = quantitySpecification.trim();
    let processingNumber = false;
    let wipToken = "";
    let signToken = "";
    let uomSeparatorToIgnore = 0;
    let fractionDashCode = 0;

    const skipCodes: number[] = [format.thousandSeparator.charCodeAt(0)];

    if (format.type === FormatType.Station && format.stationSeparator && format.stationSeparator.length === 1)
      skipCodes.push(format.stationSeparator.charCodeAt(0));

    if (format.type === FormatType.Fractional && format.hasFormatTraitSet(FormatTraits.FractionDash)) {
      fractionDashCode = QuantityConstants.CHAR_MINUS;
    }

    if (format.uomSeparator && format.uomSeparator !== " " && format.uomSeparator.length === 1) {
      uomSeparatorToIgnore = format.uomSeparator.charCodeAt(0);
      skipCodes.push(uomSeparatorToIgnore);
    }

    // tslint:disable-next-line:prefer-for-of
    for (let i = 0; i < str.length; i++) {
      const charCode = str.charCodeAt(i);
      if (Parser.isDigitOrDecimalSeparator(charCode, format)) {
        if (!processingNumber) {
          if (wipToken.length > 0) {
            tokens.push(new ParseToken(wipToken));
            wipToken = "";
          }
          processingNumber = true;
        }
        wipToken = wipToken.concat(str[i]);
      } else {
        if (processingNumber) {
          if (charCode === QuantityConstants.CHAR_SLASH || charCode === QuantityConstants.CHAR_FRACTION_SLASH || charCode === QuantityConstants.CHAR_DIVISION_SLASH) {
            const fractSymbol = Parser.checkForFractions(i + 1, str, uomSeparatorToIgnore, wipToken);
            let fraction = fractSymbol.fraction;
            i = fractSymbol.index;
            if (fractSymbol.fraction !== 0.0) {
              wipToken = "";
              if (signToken.length > 0) {
                if (signToken === "-") fraction = 0 - fraction;
                signToken = "";
              }

              tokens.push(new ParseToken(fraction));
              processingNumber = false;
              continue;
            }
          } else {
            // a space may signify end of number or start of decimal
            if (charCode === QuantityConstants.CHAR_SPACE || charCode === fractionDashCode) {
              const fractSymbol = Parser.checkForFractions(i + 1, str, uomSeparatorToIgnore);
              let fraction = fractSymbol.fraction;
              i = fractSymbol.index;
              if (fractSymbol.fraction !== 0.0) {
                if (signToken.length > 0) {
                  wipToken = signToken + wipToken;
                  if (signToken === "-") fraction = 0 - fraction;
                  signToken = "";
                }

                const valueWithFraction = parseFloat(wipToken) + fraction;
                tokens.push(new ParseToken(valueWithFraction));
                processingNumber = false;
                wipToken = "";
                continue;
              }
            } else {
              // an "E" or "e" may signify scientific notation
              if (charCode === QuantityConstants.CHAR_UPPER_E || charCode === QuantityConstants.CHAR_LOWER_E) {
                const exponentSymbol = Parser.checkForScientificNotation(i, str, uomSeparatorToIgnore);
                i = exponentSymbol.index;

                if (exponentSymbol.exponent && exponentSymbol.exponent.length > 0) {
                  if (signToken.length > 0) {
                    wipToken = signToken + wipToken;
                    signToken = "";
                  }

                  wipToken = wipToken + "e" + exponentSymbol.exponent;
                  const scientificValue = Number(wipToken);
                  tokens.push(new ParseToken(scientificValue));
                  processingNumber = false;
                  wipToken = "";
                  continue;
                }
              }
            }
          }

          // ignore any codes in skipCodes
          if (skipCodes.findIndex((ref) => ref === charCode) !== -1) continue;

          if (signToken.length > 0) {
            wipToken = signToken + wipToken;
            signToken = "";
          }

          tokens.push(new ParseToken(parseFloat(wipToken)));

          wipToken = (i < str.length) ? str[i] : "";
          processingNumber = false;
        } else {
          // not processing a number
          if (charCode === QuantityConstants.CHAR_PLUS || charCode === QuantityConstants.CHAR_MINUS) {
            signToken = str[i];
            continue;
          }

          wipToken = wipToken.concat(str[i]);
        }
      }
    }

    // handle case where end of input string is reached.
    if (wipToken.length > 0) {
      if (processingNumber) {
        if (signToken.length > 0) {
          wipToken = signToken + wipToken;
          signToken = "";
        }
        tokens.push(new ParseToken(parseFloat(wipToken)));
        processingNumber = false;
      } else {
        tokens.push(new ParseToken(wipToken));
      }
    }

    return tokens;
  }

  private static async createQuantityFromParseTokens(tokens: ParseToken[], format: Format, unitsProvider: UnitsProvider): Promise<QuantityProps> {
    const defaultUnit = format.units && format.units.length > 0 ? format.units[0][0] : undefined;

    // common case where single value is supplied
    if (tokens.length === 1) {
      if (tokens[0].isNumber) {
        return Promise.resolve(new Quantity(defaultUnit, tokens[0].value as number));
      } else {
        try {
          const unit = await unitsProvider.findUnit(tokens[0].value as string, defaultUnit ? defaultUnit.unitFamily : undefined);
          return Promise.resolve(new Quantity(unit));
        } catch (err) { }
      }
    }

    // common case where single value and single label are supplied
    if (tokens.length === 2) {
      if (tokens[0].isNumber && tokens[1].isString) {
        const unit = await unitsProvider.findUnit(tokens[1].value as string, defaultUnit ? defaultUnit.unitFamily : undefined);
        return Promise.resolve(new Quantity(unit, tokens[0].value as number));
      } else {  // unit specification comes before value (like currency)
        if (tokens[1].isNumber && tokens[0].isString) {
          const unit = await unitsProvider.findUnit(tokens[0].value as string, defaultUnit ? defaultUnit.unitFamily : undefined);
          return Promise.resolve(new Quantity(unit, tokens[1].value as number));
        }
      }
    }

    // common case where there are multiple value/label pairs
    if (tokens.length % 2 === 0) {
      let mag = 0.0;
      let masterUnit = defaultUnit;
      for (let i = 0; i < tokens.length; i = i + 2) {
        if (tokens[i].isNumber && tokens[i + 1].isString) {
          const value = tokens[i].value as number;
          const unit = await unitsProvider.findUnit(tokens[i + 1].value as string, defaultUnit ? defaultUnit.unitFamily : undefined);
          if (0 === i) {
            masterUnit = unit;
            mag = mag + value;
          } else {
            if (masterUnit) {
              const conversion = await unitsProvider.getConversion(unit, masterUnit);
              if (mag < 0.0)
                mag = mag - ((value * conversion.factor)) + conversion.offset;
              else
                mag = mag + ((value * conversion.factor)) + conversion.offset;
            }
          }
        }
      }
      return Promise.resolve(new Quantity(masterUnit, mag));
    }

    return Promise.resolve(new Quantity(defaultUnit));
  }

  /** Async method to generate a Quantity given a string that represents a quantity value and likely a unit label.
   *  @param inString A string that contains text represent a quantity.
   *  @param format   Defines the likely format of inString.
   *  @param unitsProvider required to look up units that may be specified in inString
   */
  public static parseIntoQuantity(inString: string, format: Format, unitsProvider: UnitsProvider): Promise<QuantityProps> {
    const tokens: ParseToken[] = Parser.parseQuantitySpecification(inString, format);
    if (tokens.length === 0)
      return Promise.resolve(new Quantity());

    return Parser.createQuantityFromParseTokens(tokens, format, unitsProvider);
  }
}
