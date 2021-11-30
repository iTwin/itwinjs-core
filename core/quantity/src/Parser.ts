/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Quantity
 */

import { QuantityConstants } from "./Constants";
import { Format } from "./Formatter/Format";
import { FormatTraits, FormatType } from "./Formatter/FormatEnums";
import { AlternateUnitLabelsProvider, PotentialParseUnit, QuantityProps, UnitConversion, UnitConversionSpec, UnitProps, UnitsProvider } from "./Interfaces";
import { ParserSpec } from "./ParserSpec";
import { Quantity } from "./Quantity";

/** Possible parser errors
 * @beta
 */
export enum ParseError {
  UnableToGenerateParseTokens = 1,
  NoValueOrUnitFoundInString,
  UnitLabelSuppliedButNotMatched,
  UnknownUnit,
  UnableToConvertParseTokensToQuantity,
  InvalidParserSpec,
}

/** Parse error result from [[Parser.parseToQuantityValue]] or [[Parser.parseToQuantityValue]].
 * @beta
 */
export interface ParseQuantityError {
  /** Union discriminator for [[QuantityParseResult]]. */
  ok: false;
  /** The specific error that occurred during parsing. */
  error: ParseError;
}

/** Successful result from [[Parser.parseToQuantityValue]] or [[Parser.parseToQuantityValue]].
 * @beta
 */
export interface ParsedQuantity {
  /** Union discriminator for [[QuantityParseResult]]. */
  ok: true;
  /** The magnitude of the parsed quantity. */
  value: number;
}

/**
 * Defines Results of parsing a string input by a user into its desired value type
 * @beta
 */
export type QuantityParseResult = ParsedQuantity | ParseQuantityError;

/** A ParseToken holds either a numeric or string token extracted from a string that represents a quantity value.
 * @beta
 */
class ParseToken {
  public value: number | string;

  constructor(value: string | number) {
    if (typeof value === "string") this.value = value.trim();
    else this.value = value;
  }

  public get isString(): boolean { return typeof this.value === "string"; }
  public get isNumber(): boolean { return typeof this.value === "number"; }
}

/** A ScientificToken holds an index and string representing the exponent.
 * @beta
 */
class ScientificToken {
  public index: number;
  public exponent = "";

  constructor(index: number, exponent?: string) {
    this.index = index;
    if (exponent) this.exponent = exponent;
  }
}

/** A FractionToken holds an index and the fraction value of numerator / denominator.
 * @beta
 */
class FractionToken {
  public index: number;
  public fraction = 0.0;
  public exponent = "";

  constructor(index: number, fraction?: number) {
    this.index = index;
    if (fraction) this.fraction = fraction;
  }
}

/** A Parser class that is used to break a string that represents a quantity value into tokens.
 * @beta
 */
export class Parser {
  private static _log = false;

  public static isParsedQuantity(item: QuantityParseResult): item is ParsedQuantity {
    return item.ok;
  }

  public static isParseError(item: QuantityParseResult): item is ParseQuantityError {
    return !item.ok;
  }

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

    // eslint-disable-next-line @typescript-eslint/prefer-for-of
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
              if (fractSymbol.fraction !== 0.0) {
                i = fractSymbol.index;
                if (signToken.length > 0) {
                  wipToken = signToken + wipToken;
                  if (signToken === "-") fraction = 0 - fraction;
                  signToken = "";
                }

                const valueWithFraction = parseFloat(wipToken) + fraction;
                tokens.push(new ParseToken(valueWithFraction));
                processingNumber = false;
                wipToken = "";
              }
              continue;
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

                  wipToken = `${wipToken}e${exponentSymbol.exponent}`;
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
          if ((charCode === QuantityConstants.CHAR_PLUS || charCode === QuantityConstants.CHAR_MINUS)) {
            if (0 === tokens.length) // sign token only needed for left most value
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
        }
        tokens.push(new ParseToken(parseFloat(wipToken)));
      } else {
        tokens.push(new ParseToken(wipToken));
      }
    }

    return tokens;
  }

  private static async lookupUnitByLabel(unitLabel: string, format: Format, unitsProvider: UnitsProvider, altUnitLabelsProvider?: AlternateUnitLabelsProvider) {
    const defaultUnit = format.units && format.units.length > 0 ? format.units[0][0] : undefined;

    const labelToFind = unitLabel.toLowerCase();
    // First look in format for a label and matches
    if (format.units && format.units.length > 0) {
      const formatUnit = format.units.find(([unit, label]) => {
        if (label && label.toLowerCase() === labelToFind)
          return true;
        const alternateLabels = altUnitLabelsProvider?.getAlternateUnitLabels(unit);
        // check any alternate labels that may be defined for the Unit
        if (alternateLabels && alternateLabels.find((lbl) => lbl.toLowerCase() === labelToFind))
          return true;

        return false;
      });
      if (formatUnit)
        return formatUnit[0];
    }

    // now try to find a unit from the same family and system
    let foundUnit = await unitsProvider.findUnit(unitLabel, defaultUnit ? defaultUnit.phenomenon : undefined, defaultUnit ? defaultUnit.system : undefined);

    // if nothing found yet just limit to family
    if (!foundUnit.isValid && defaultUnit)
      foundUnit = await unitsProvider.findUnit(unitLabel, defaultUnit ? defaultUnit.phenomenon : undefined);
    return foundUnit;
  }

  private static async createQuantityFromParseTokens(tokens: ParseToken[], format: Format, unitsProvider: UnitsProvider, altUnitLabelsProvider?: AlternateUnitLabelsProvider): Promise<QuantityProps> {
    let defaultUnit = format.units && format.units.length > 0 ? format.units[0][0] : undefined;

    // common case where single value is supplied
    if (tokens.length === 1) {
      if (tokens[0].isNumber) {
        return new Quantity(defaultUnit, tokens[0].value as number);
      } else {
        const unit = await this.lookupUnitByLabel(tokens[0].value as string, format, unitsProvider, altUnitLabelsProvider);
        return new Quantity(unit);
      }
    }

    // common case where single value and single label are supplied
    if (tokens.length === 2) {
      if (tokens[0].isNumber && tokens[1].isString) {
        const unit = await this.lookupUnitByLabel(tokens[1].value as string, format, unitsProvider, altUnitLabelsProvider);
        if (undefined === defaultUnit)
          defaultUnit = unit;
        if (defaultUnit && defaultUnit.name === unit.name) {
          return new Quantity(defaultUnit, tokens[0].value as number);
        } else if (defaultUnit) {
          const conversion = await unitsProvider.getConversion(unit, defaultUnit);
          const mag = ((tokens[0].value as number * conversion.factor)) + conversion.offset;
          return new Quantity(defaultUnit, mag);
        }
      } else {  // unit specification comes before value (like currency)
        if (tokens[1].isNumber && tokens[0].isString) {
          const unit = await this.lookupUnitByLabel(tokens[0].value as string, format, unitsProvider, altUnitLabelsProvider);
          if (undefined === defaultUnit)
            defaultUnit = unit;
          if (defaultUnit && defaultUnit.name === unit.name) {
            return new Quantity(defaultUnit, tokens[1].value as number);
          } else if (defaultUnit) {
            const conversion = await unitsProvider.getConversion(unit, defaultUnit);
            const mag = ((tokens[1].value as number * conversion.factor)) + conversion.offset;
            return new Quantity(defaultUnit, mag);
          }
        }
      }
    }

    // common case where there are multiple value/label pairs
    if (tokens.length % 2 === 0) {
      let mag = 0.0;
      for (let i = 0; i < tokens.length; i = i + 2) {
        if (tokens[i].isNumber && tokens[i + 1].isString) {
          const value = tokens[i].value as number;
          const unit = await this.lookupUnitByLabel(tokens[i + 1].value as string, format, unitsProvider, altUnitLabelsProvider);
          if (undefined === defaultUnit)
            defaultUnit = unit;
          if (0 === i) {
            if (defaultUnit.name === unit.name)
              mag = value;
            else {
              const conversion = await unitsProvider.getConversion(unit, defaultUnit);
              mag = ((value * conversion.factor)) + conversion.offset;
            }
          } else {
            if (defaultUnit) {
              const conversion = await unitsProvider.getConversion(unit, defaultUnit);
              if (mag < 0.0)
                mag = mag - ((value * conversion.factor)) + conversion.offset;
              else
                mag = mag + ((value * conversion.factor)) + conversion.offset;
            }
          }
        }
      }
      return new Quantity(defaultUnit, mag);
    }

    return new Quantity(defaultUnit);
  }

  /** Async method to generate a Quantity given a string that represents a quantity value and likely a unit label.
   *  @param inString A string that contains text represent a quantity.
   *  @param format   Defines the likely format of inString.
   *  @param unitsProvider required to look up units that may be specified in inString
   */
  public static async parseIntoQuantity(inString: string, format: Format, unitsProvider: UnitsProvider, altUnitLabelsProvider?: AlternateUnitLabelsProvider): Promise<QuantityProps> {
    const tokens: ParseToken[] = Parser.parseQuantitySpecification(inString, format);
    if (tokens.length === 0)
      return new Quantity();

    return Parser.createQuantityFromParseTokens(tokens, format, unitsProvider, altUnitLabelsProvider);
  }

  /** method to get the Unit Conversion given a unit label */
  private static tryFindUnitConversion(unitLabel: string, unitsConversions: UnitConversionSpec[], preferredUnit?: UnitProps): UnitConversion | undefined {
    if (unitsConversions.length > 0) {
      const label = unitLabel.toLocaleLowerCase();

      /* A preferred unit is used to target a unit if a unit label is used in more that one unit definition from the same unit family.
       * An example is if "ft" is used as the unitLabel and the preferredUnit is "SURVEY_FT" since that unit has an alternate label of "ft" the
       * conversion to "SURVEY_FT" is returned. If no preferredUnit is specified then the unit "FT" would likely to have been found first.
       * If "in" is the unit label and "SURVEY_FT" is the preferredUnit then conversion to "SURVEY_IN" would be returned.
      */
      if (preferredUnit) {
        // if there is a preferred unit defined see if unit label matched it or one of its alternates
        const preferredConversion = unitsConversions.find((conversion) => conversion.name === preferredUnit.name);
        if (preferredConversion && preferredConversion.parseLabels) {
          if (-1 !== preferredConversion.parseLabels.findIndex((lbl) => lbl === label))
            return preferredConversion.conversion;
        }
        // see if we can find a matching unitLabel in any unit within the same system as the preferred unit
        const preferredSystemConversions = unitsConversions.filter((conversion) => conversion.system === preferredUnit.system);
        for (const conversion of preferredSystemConversions) {
          if (conversion.parseLabels) {
            if (-1 !== conversion.parseLabels.findIndex((lbl) => lbl === label))
              return conversion.conversion;
          }
        }
      }

      // if no unit found based on preferredUnit see if an unit label matches
      for (const conversion of unitsConversions) {
        if (conversion.parseLabels) {
          if (-1 !== conversion.parseLabels.findIndex((lbl) => lbl === label))
            return conversion.conversion;
        } else {
          // eslint-disable-next-line no-console
          console.log("ERROR: Parser expects to find parseLabels array populate with all possible unit labels for the unit.");
        }
      }
    }

    return undefined;
  }

  private static getQuantityValueFromParseTokens(tokens: ParseToken[], format: Format, unitsConversions: UnitConversionSpec[]): QuantityParseResult {
    const defaultUnit = format.units && format.units.length > 0 ? format.units[0][0] : undefined;
    // common case where single value is supplied
    if (tokens.length === 1) {
      if (tokens[0].isNumber) {
        if (defaultUnit) {
          const conversion = Parser.tryFindUnitConversion(defaultUnit.label, unitsConversions, defaultUnit);
          if (conversion) {
            const value = (tokens[0].value as number) * conversion.factor + conversion.offset;
            return { ok: true, value };
          }
        } else {
          // if no conversion or no defaultUnit, just return parsed number
          return { ok: true, value: tokens[0].value as number };
        }
      } else {
        // only the unit label was specified so assume magnitude of 1
        const conversion = Parser.tryFindUnitConversion(tokens[0].value as string, unitsConversions, defaultUnit);
        if (undefined !== conversion)
          return { ok: true, value: conversion.factor + conversion.offset };
        else
          return { ok: false, error: ParseError.NoValueOrUnitFoundInString };
      }
    }

    // common case where single value and single label are supplied
    if (tokens.length === 2) {
      if (tokens[0].isNumber && tokens[1].isString) {
        const conversion = Parser.tryFindUnitConversion(tokens[1].value as string, unitsConversions, defaultUnit);
        if (conversion) {
          const value = (tokens[0].value as number) * conversion.factor + conversion.offset;
          return { ok: true, value };
        }
        // if no conversion, just return parsed number and ignore value in second token
        return { ok: true, value: tokens[0].value as number };
      } else {  // unit specification comes before value (like currency)
        if (tokens[1].isNumber && tokens[0].isString) {
          const conversion = Parser.tryFindUnitConversion(tokens[0].value as string, unitsConversions, defaultUnit);
          if (conversion) {
            const value = (tokens[1].value as number) * conversion.factor + conversion.offset;
            return { ok: true, value };
          }
          // if no conversion, just return parsed number and ignore value in second token
          return { ok: true, value: tokens[1].value as number };
        }
      }
    }

    // common case where there are multiple value/label pairs
    if (tokens.length % 2 === 0) {
      let mag = 0.0;
      for (let i = 0; i < tokens.length; i = i + 2) {
        if (tokens[i].isNumber && tokens[i + 1].isString) {
          const value = tokens[i].value as number;
          const conversion = Parser.tryFindUnitConversion(tokens[i + 1].value as string, unitsConversions, defaultUnit);
          if (conversion) {
            if (mag < 0.0)
              mag = mag - ((value * conversion.factor)) + conversion.offset;
            else
              mag = mag + ((value * conversion.factor)) + conversion.offset;
          }
        }
      }
      return { ok: true, value: mag };
    }

    return { ok: false, error: ParseError.UnableToConvertParseTokensToQuantity };
  }

  /** Method to generate a Quantity given a string that represents a quantity value.
   *  @param inString A string that contains text represent a quantity.
   *  @param parserSpec unit label if not explicitly defined by user. Must have matching entry in supplied array of unitsConversions.
   *  @param defaultValue default value to return if parsing is un successful
   */
  public static parseQuantityString(inString: string, parserSpec: ParserSpec): QuantityParseResult {
    return Parser.parseToQuantityValue(inString, parserSpec.format, parserSpec.unitConversions);
  }

  /** Method to generate a Quantity given a string that represents a quantity value and likely a unit label.
   *  @param inString A string that contains text represent a quantity.
   *  @param format   Defines the likely format of inString. Primary unit serves as a default unit if no unit label found in string.
   *  @param unitsConversions dictionary of conversions used to convert from unit used in inString to output quantity
   */
  public static parseToQuantityValue(inString: string, format: Format, unitsConversions: UnitConversionSpec[]): QuantityParseResult {
    // ensure any labels defined in composite unit definition are specified in unitConversions
    if (format.units) {
      format.units.forEach(([unit, label]) => {
        if (label) {
          if (unit.label !== label) { // if default unit label does not match composite label ensure the label is in the list of parse labels for the conversion
            const unitConversion = unitsConversions.find((conversion) => conversion.name === unit.name);
            if (unitConversion && unitConversion.parseLabels && !unitConversion.parseLabels.find((entry) => entry === label))
              unitConversion.parseLabels.push(label);
          }
        }
      });
    }

    const tokens: ParseToken[] = Parser.parseQuantitySpecification(inString, format);
    if (tokens.length === 0)
      return { ok: false, error: ParseError.UnableToGenerateParseTokens };

    if (Parser._log) {
      // eslint-disable-next-line no-console
      console.log(`Parse tokens`);
      let i = 0;
      for (const token of tokens) {
        // eslint-disable-next-line no-console
        console.log(`  [${i++}] isNumber=${token.isNumber} isString=${token.isString} token=${token.value}`);
      }
    }

    return Parser.getQuantityValueFromParseTokens(tokens, format, unitsConversions);
  }

  /** Async Method used to create an array of UnitConversionSpec entries that can be used in synchronous calls to parse units. */
  public static async createUnitConversionSpecsForUnit(unitsProvider: UnitsProvider, outUnit: UnitProps, altUnitLabelsProvider?: AlternateUnitLabelsProvider): Promise<UnitConversionSpec[]> {
    const unitConversionSpecs: UnitConversionSpec[] = [];

    const familyUnits = await unitsProvider.getUnitsByFamily(outUnit.phenomenon);
    for (const unit of familyUnits) {
      const conversion = await unitsProvider.getConversion(unit, outUnit);
      const parseLabels: string[] = [unit.label.toLocaleLowerCase()];
      const alternateLabels = altUnitLabelsProvider?.getAlternateUnitLabels(unit);
      // add any alternate labels that may be defined for the Unit
      if (alternateLabels) {
        alternateLabels.forEach((label: string) => {
          const potentialLabel = label.toLocaleLowerCase();
          if (-1 === parseLabels.findIndex((lbl) => lbl === potentialLabel))
            parseLabels.push(label.toLocaleLowerCase());
        });
      }

      unitConversionSpecs.push({
        name: unit.name,
        label: unit.label,
        conversion,
        parseLabels,
        system: unit.system,
      });
    }
    return unitConversionSpecs;
  }

  /** Async Method used to create an array of UnitConversionSpec entries that can be used in synchronous calls to parse units. */
  public static async createUnitConversionSpecs(unitsProvider: UnitsProvider, outUnitName: string, potentialParseUnits: PotentialParseUnit[], altUnitLabelsProvider?: AlternateUnitLabelsProvider): Promise<UnitConversionSpec[]> {
    const unitConversionSpecs: UnitConversionSpec[] = [];

    const outUnit = await unitsProvider.findUnitByName(outUnitName);
    if (!outUnit || !outUnit.name || 0 === outUnit.name.length) {
      // eslint-disable-next-line no-console
      console.log(`[Parser.createUnitConversionSpecs] ERROR: Unable to locate out unit ${outUnitName}.`);
      return unitConversionSpecs;
    }

    for (const potentialParseUnit of potentialParseUnits) {
      const unit = await unitsProvider.findUnitByName(potentialParseUnit.unitName);
      if (!unit || !unit.name || 0 === unit.name.length) {
        // eslint-disable-next-line no-console
        console.log(`[Parser.createUnitConversionSpecs] ERROR: Unable to locate potential unit ${potentialParseUnit.unitName}.`);
        continue;
      }

      const conversion = await unitsProvider.getConversion(unit, outUnit);
      const parseLabels: string[] = [unit.label.toLocaleLowerCase()];
      const alternateLabels = altUnitLabelsProvider?.getAlternateUnitLabels(unit);
      // add any alternate labels that may be defined for the Unit
      if (alternateLabels) {
        alternateLabels.forEach((label: string) => {
          const potentialLabel = label.toLocaleLowerCase();
          if (-1 === parseLabels.findIndex((lbl) => lbl === potentialLabel))
            parseLabels.push(label.toLocaleLowerCase());
        });
      }

      // add any alternate labels that where provided by caller
      if (potentialParseUnit.altLabels) {
        potentialParseUnit.altLabels.forEach((label: string) => {
          const potentialLabel = label.toLocaleLowerCase();
          if (-1 === parseLabels.findIndex((lbl) => lbl === potentialLabel))
            parseLabels.push(label.toLocaleLowerCase());
        });
      }
      unitConversionSpecs.push({
        name: unit.name,
        label: unit.label,
        conversion,
        parseLabels,
        system: unit.system,
      });
    }
    return unitConversionSpecs;
  }
}
