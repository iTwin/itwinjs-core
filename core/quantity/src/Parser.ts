/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Quantity
 */

import { QuantityConstants } from "./Constants";
import { QuantityError, QuantityStatus } from "./Exception";
import { Format } from "./Formatter/Format";
import { FormatTraits, FormatType } from "./Formatter/FormatEnums";
import { AlternateUnitLabelsProvider, PotentialParseUnit, QuantityProps, UnitConversionProps, UnitConversionSpec, UnitProps, UnitsProvider } from "./Interfaces";
import { ParserSpec } from "./ParserSpec";
import { applyConversion, Quantity } from "./Quantity";

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
  BearingPrefixOrSuffixMissing,
  MathematicOperationFoundButIsNotAllowed,
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

enum Operator {
  addition = "+",
  subtraction = "-",
}

function isOperator(char: number | string): boolean {
  if(typeof char === "number"){
    // Convert the CharCode to string.
    char = String.fromCharCode(char);
  }
  return Object.values(Operator).includes(char as Operator);
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
  public value: number | string | Operator;
  public isOperator: boolean = false;

  constructor(value: string | number | Operator) {
    if (typeof value === "string"){
      this.value = value.trim();
      this.isOperator = isOperator(this.value);
    } else{
      this.value = value;
    }
  }

  public get isString(): boolean { return !this.isOperator && typeof this.value === "string"; }
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
    if (exponent)
      this.exponent = exponent;
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
    if (fraction)
      this.fraction = fraction;
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
          if (uomSeparatorToIgnore !== charCode)
            i = i - 1; // skip over uom separator after fraction

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
    let isStationSeparatorAdded = false;
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
        // Decimal separators must be replaced with '.' before converting to a number - parseFloat() only supports '.' as the decimal separator.
        const charToAdd = charCode === format.decimalSeparator.charCodeAt(0) ? "." : str[i];
        wipToken = wipToken.concat(charToAdd);
      } else {
        if (processingNumber) {
          if (charCode === QuantityConstants.CHAR_SLASH || charCode === QuantityConstants.CHAR_FRACTION_SLASH || charCode === QuantityConstants.CHAR_DIVISION_SLASH) {
            const fractSymbol = Parser.checkForFractions(i + 1, str, uomSeparatorToIgnore, wipToken);
            let fraction = fractSymbol.fraction;
            i = fractSymbol.index;
            if (fractSymbol.fraction !== 0.0) {
              wipToken = "";
              if (signToken.length > 0) {
                if (signToken === "-")
                  fraction = 0 - fraction;

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
                  if (signToken === "-")
                    fraction = 0 - fraction;

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

          if (format.type === FormatType.Station && charCode === format.stationSeparator.charCodeAt(0)){
            if(!isStationSeparatorAdded){
              isStationSeparatorAdded = true;
              continue;
            }
            isStationSeparatorAdded = false;
          } else if (skipCodes.findIndex((ref) => ref === charCode) !== -1){
            // ignore any codes in skipCodes
            continue;
          }

          if (signToken.length > 0) {
            wipToken = signToken + wipToken;
            signToken = "";
          }

          tokens.push(new ParseToken(parseFloat(wipToken)));

          wipToken = (i < str.length) ? str[i] : "";
          processingNumber = false;

          if(wipToken.length === 1 && isOperator(wipToken)){
            tokens.push(new ParseToken(wipToken)); // Push operator token.
            wipToken = "";
          }
        } else {
          // not processing a number
          if (isOperator(charCode)) {
            if(wipToken.length > 0){
              // There is a token is progress, process it now, before adding the new operator token.
              tokens.push(new ParseToken(wipToken));
              wipToken = "";
            }

            tokens.push(new ParseToken(str[i])); // Push an Operator Token in the list.
            continue;
          }

          if(wipToken.length === 0 && charCode === QuantityConstants.CHAR_SPACE){
            // Don't add space when the wip token is empty.
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

  private static isMathematicOperation(tokens: ParseToken[]){
    if(tokens.length > 1){
      // The loop starts at one because the first token can be a operator without it being maths. Ex: "-5FT"
      for(let i = 1; i < tokens.length; i++){
        if(tokens[i].isOperator)
          // Operator found, it's a math operation.
          return true;
      }
    }
    return false;
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

  /**
   * Get the output unit and all the conversion specs required to parse a given list of tokens.
   */
  private static async getRequiredUnitsConversionsToParseTokens(tokens: ParseToken[], format: Format, unitsProvider: UnitsProvider, altUnitLabelsProvider?: AlternateUnitLabelsProvider): Promise<{
    outUnit?: UnitProps;
    specs: UnitConversionSpec[];
  }> {
    let outUnit = (format.units && format.units.length > 0 ? format.units[0][0] : undefined);
    const unitConversions: UnitConversionSpec[] = [];
    const uniqueUnitLabels = [...new Set(tokens.filter((token) => token.isString).map((token) => token.value as string))];
    for(const label of uniqueUnitLabels){
      const unitProps = await this.lookupUnitByLabel(label, format, unitsProvider, altUnitLabelsProvider);
      if(!outUnit){
        // No default unit, assume that the first unit found is the desired output unit.
        outUnit = unitProps;
      }

      let spec = unitConversions.find((specB) => specB.name === unitProps.name);
      if(spec){
        // Already in the list, just add the label.
        spec.parseLabels?.push(label.toLocaleLowerCase());
      } else {
        // Add new conversion to the list.
        const conversion = await unitsProvider.getConversion(unitProps, outUnit);
        if(conversion){
          spec = {
            conversion,
            label: unitProps.label,
            system: unitProps.system,
            name: unitProps.name,
            parseLabels: [label.toLocaleLowerCase()],
          };
          unitConversions.push(spec);
        }
      }
    }

    return {outUnit, specs: unitConversions};
  }

  /**
   * Get the units information asynchronously, then convert the tokens into quantity using the synchronous tokens -> value.
   */
  private static async createQuantityFromParseTokens(tokens: ParseToken[], format: Format, unitsProvider: UnitsProvider, altUnitLabelsProvider?: AlternateUnitLabelsProvider): Promise<QuantityProps> {
    const unitConversionInfos = await this.getRequiredUnitsConversionsToParseTokens(tokens, format, unitsProvider, altUnitLabelsProvider);
    if(unitConversionInfos.outUnit){
      const value = Parser.getQuantityValueFromParseTokens(tokens, format, unitConversionInfos.specs, await unitsProvider.getConversion(unitConversionInfos.outUnit, unitConversionInfos.outUnit));
      if(value.ok){
        return new Quantity(unitConversionInfos.outUnit, value.value);
      }
    }

    return new Quantity();
  }

  /** Async method to generate a Quantity given a string that represents a quantity value and likely a unit label.
   *  @param inString A string that contains text represent a quantity.
   *  @param format   Defines the likely format of inString.
   *  @param unitsProvider required to look up units that may be specified in inString
   */
  public static async parseIntoQuantity(inString: string, format: Format, unitsProvider: UnitsProvider, altUnitLabelsProvider?: AlternateUnitLabelsProvider): Promise<QuantityProps> {
    const tokens: ParseToken[] = Parser.parseQuantitySpecification(inString, format);
    if (tokens.length === 0 || (!format.allowMathematicOperations && Parser.isMathematicOperation(tokens)))
      return new Quantity();

    return Parser.createQuantityFromParseTokens(tokens, format, unitsProvider, altUnitLabelsProvider);
  }

  /** method to get the Unit Conversion given a unit label */
  private static tryFindUnitConversion(unitLabel: string, unitsConversions: UnitConversionSpec[], preferredUnit?: UnitProps): UnitConversionProps | undefined {
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

  /**
   * Get what the unit conversion is for a unitless value.
   */
  private static getDefaultUnitConversion(tokens: ParseToken[], unitsConversions: UnitConversionSpec[], defaultUnit?: UnitProps){
    let unitConversion = defaultUnit ? Parser.tryFindUnitConversion(defaultUnit.label, unitsConversions, defaultUnit) : undefined;
    if(!unitConversion){
      // No default unit conversion, take the first valid unit.
      const uniqueUnitLabels = [...new Set(tokens.filter((token) => token.isString).map((token) => token.value as string))];
      for(const label of uniqueUnitLabels){
        unitConversion = Parser.tryFindUnitConversion(label, unitsConversions, defaultUnit);
        if(unitConversion !== undefined)
          return unitConversion;
      }
    }
    return unitConversion;
  }

  // Get the next token pair to parse into a quantity.
  private static getNextTokenPair(index: number, tokens: ParseToken[]): ParseToken[] | undefined {
    if(index >= tokens.length)
      return;

    // 6 possible combination of token pair.
    // Stringified to ease comparison later.
    const validCombinations = [
      JSON.stringify(["string"]), // ['FT']
      JSON.stringify(["string", "number"]), // ['$', 5] unit specification comes before value (like currency)
      JSON.stringify(["number"]), // [5]
      JSON.stringify(["number", "string"]), // [5, 'FT']
      JSON.stringify(["operator", "number"]), // ['-', 5]
      JSON.stringify(["operator", "number", "string"]), // ['-', 5, 'FT']
    ];

    // Push up to 3 tokens in the list, if the length allows it.
    const maxNbrTokensInThePair = Math.min(tokens.length - index, 3);
    const tokenPair = tokens.slice(index, index + maxNbrTokensInThePair);
    const currentCombination = tokenPair.map((token) => token.isOperator ? "operator" : (token.isNumber ? "number" : "string"));

    // Check if the token pair is valid. If not, try again by removing the last token util empty.
    // Ex: ['5', 'FT', '7'] invalid => ['5', 'FT'] valid returned
    for(let i = currentCombination.length - 1; i >= 0; i--){
      if(validCombinations.includes(JSON.stringify(currentCombination))){
        break;
      } else{
        currentCombination.pop();
        tokenPair.pop();
      }
    }

    return tokenPair.length > 0 ? tokenPair : undefined;
  }

  /**
   * Accumulate the given list of tokens into a single quantity value. Formatting the tokens along the way.
   */
  private static getQuantityValueFromParseTokens(tokens: ParseToken[], format: Format, unitsConversions: UnitConversionSpec[], defaultUnitConversion?: UnitConversionProps ): QuantityParseResult {
    const defaultUnit = format.units && format.units.length > 0 ? format.units[0][0] : undefined;
    defaultUnitConversion = defaultUnitConversion ? defaultUnitConversion : Parser.getDefaultUnitConversion(tokens, unitsConversions, defaultUnit);

    let tokenPair: ParseToken[] | undefined;
    let increment: number = 1;
    let mag = 0.0;
    // The sign is saved outside from the loop for cases like this. '-1m 50cm 10mm + 2m 30cm 40mm' => -1.51m + 2.34m
    let sign: 1 | -1 = 1;

    let compositeUnitIndex = 0;
    for (let i = 0; i < tokens.length; i = i + increment) {
      tokenPair = this.getNextTokenPair(i, tokens);
      if(!tokenPair || tokenPair.length === 0){
        return { ok: false, error: ParseError.UnableToConvertParseTokensToQuantity };
      }
      increment = tokenPair.length;

      // Keep the sign so its applied to the next tokens.
      if(tokenPair[0].isOperator){
        sign = tokenPair[0].value === Operator.addition ? 1 : -1;
        tokenPair.shift();
        compositeUnitIndex = 0; // Reset the composite unit index, the following tokens begin from start.
      }

      // unit specification comes before value (like currency)
      if(tokenPair.length === 2 && tokenPair[0].isString){
        // Invert it so the currency sign comes second.
        tokenPair = [tokenPair[1], tokenPair[0]];
      }

      if(tokenPair[0].isNumber){
        let value = sign * (tokenPair[0].value as number);
        let conversion: UnitConversionProps | undefined;
        if(tokenPair.length === 2 && tokenPair[1].isString){
          const spacer = format.spacerOrDefault;
          if(tokenPair[1].value !== spacer){ // ignore spacer
            conversion = Parser.tryFindUnitConversion(tokenPair[1].value as string, unitsConversions, defaultUnit);
          }
        }
        if (!conversion) {
          if (compositeUnitIndex > 0 && format.units && format.units.length > compositeUnitIndex) {
            // if this is not the first token, and we have a composite spec, look up the unit from the current index
            const presUnitAtIndex = format.units[compositeUnitIndex][0];
            conversion = Parser.tryFindUnitConversion(presUnitAtIndex.label, unitsConversions, presUnitAtIndex);
          } else if (defaultUnitConversion) {
            conversion = defaultUnitConversion;
          }
        }
        if (conversion) {
          value = applyConversion(value, conversion);
        }
        mag = mag + value;
        compositeUnitIndex++;
      } else {
        // only the unit label was specified so assume magnitude of 0
        const conversion = Parser.tryFindUnitConversion(tokenPair[0].value as string, unitsConversions, defaultUnit);
        if (conversion === undefined){
          // Unknown unit label
          return { ok: false, error: ParseError.NoValueOrUnitFoundInString };
        }
      }
    }
    return { ok: true, value: mag };
  }

  /** Method to generate a Quantity given a string that represents a quantity value.
   *  @param inString A string that contains text represent a quantity.
   *  @param parserSpec unit label if not explicitly defined by user. Must have matching entry in supplied array of unitsConversions.
   */
  public static parseQuantityString(inString: string, parserSpec: ParserSpec): QuantityParseResult {
    // ensure any labels defined in composite unit definition are specified in unitConversions
    if (parserSpec.format.units) {
      parserSpec.format.units.forEach(([unit, label]) => {
        if (label) {
          if (unit.label !== label) { // if default unit label does not match composite label ensure the label is in the list of parse labels for the conversion
            const unitConversion = parserSpec.unitConversions.find((conversion) => conversion.name === unit.name);
            if (unitConversion && unitConversion.parseLabels && !unitConversion.parseLabels.find((entry) => entry === label))
              unitConversion.parseLabels.push(label);
          }
        }
      });
    }

    if (parserSpec.format.type === FormatType.Bearing) {
      return this.parseBearingFormat(inString, parserSpec);
    }
    if (parserSpec.format.type === FormatType.Azimuth) {
      return this.parseAzimuthFormat(inString, parserSpec);
    }

    if (parserSpec.format.type === FormatType.Ratio) {
      return this.parseRatioFormat(inString, parserSpec);
    }

    return this.parseAndProcessTokens(inString, parserSpec.format, parserSpec.unitConversions);
  }

  /** Method to generate a Quantity given a string that represents a quantity value and likely a unit label.
   *  @param inString A string that contains text represent a quantity.
   *  @param format   Defines the likely format of inString. Primary unit serves as a default unit if no unit label found in string.
   *  @param unitsConversions dictionary of conversions used to convert from unit used in inString to output quantity
   */
  public static parseToQuantityValue(inString: string, format: Format, unitsConversions: UnitConversionSpec[]): QuantityParseResult {
    // TODO: This method is not able to do bearing and azimuth formatting and is overlapping with parseQuantityString.
    // We should consider deprecating and removing it, there do not seem to be any upstream callers at this moment

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

    if(format.type === FormatType.Bearing || format.type === FormatType.Azimuth || format.type === FormatType.Ratio) {
      // throw error indicating to call parseQuantityString instead
      throw new QuantityError(QuantityStatus.UnsupportedUnit, `Bearing, Azimuth or Ratio format must be parsed using a ParserSpec. Call parseQuantityString instead.`);
    }

    return this.parseAndProcessTokens(inString, format, unitsConversions);
  }

  private static parseBearingFormat(inString: string, spec: ParserSpec): QuantityParseResult {
    // TODO: at some point we will want to open this for localization, in the first release it's going to be hard coded
    enum DirectionLabel {
      North = "N",
      South = "S",
      East = "E",
      West = "W"
    }
    let matchedPrefix: DirectionLabel | null = null;
    let matchedSuffix: DirectionLabel | null = null;

    // check if input string begins with northLabel or southLabel and strip it off
    if (inString.startsWith(DirectionLabel.North)) {
      inString = inString.substring(DirectionLabel.North.length);
      matchedPrefix = DirectionLabel.North;
    } else if (inString.startsWith(DirectionLabel.South)) {
      inString = inString.substring(DirectionLabel.South.length);
      matchedPrefix = DirectionLabel.South;
    }

    // check if input string ends with eastLabel or westLabel and strip it off
    if (inString.endsWith(DirectionLabel.East)) {
      inString = inString.substring(0, inString.length - DirectionLabel.East.length);
      matchedSuffix = DirectionLabel.East;
    } else if (inString.endsWith(DirectionLabel.West)) {
      inString = inString.substring(0, inString.length - DirectionLabel.West.length);
      matchedSuffix = DirectionLabel.West;
    }

    if (matchedPrefix === null && matchedSuffix === null) {
      return { ok: false, error: ParseError.BearingPrefixOrSuffixMissing };
    }

    const parsedResult = this.parseAndProcessTokens(inString, spec.format, spec.unitConversions);
    if(this.isParseError(parsedResult) || !parsedResult.ok) {
      return parsedResult;
    }

    let magnitude = parsedResult.value;
    const revolution = this.getRevolution(spec);
    magnitude = this.normalizeAngle(magnitude, revolution);
    const quarterRevolution = revolution / 4;
    // we have to turn the value into an east base and counter clockwise (NW and SE are already counter clockwise)
    if (matchedPrefix === DirectionLabel.North) {
      if (matchedSuffix === DirectionLabel.West) {
        magnitude = revolution - magnitude;
      }
    } else if (matchedPrefix === DirectionLabel.South) {
      if (matchedSuffix === DirectionLabel.West) {
        magnitude = (2 * quarterRevolution) + magnitude;
      } else if (matchedSuffix === DirectionLabel.East) {
        magnitude = (2 * quarterRevolution) - magnitude;
      }
    }

    return { ok: true, value: magnitude };
  }

  private static parseAzimuthFormat(inString: string, spec: ParserSpec): QuantityParseResult {
    const parsedResult = this.parseAndProcessTokens(inString, spec.format, spec.unitConversions);
    if(this.isParseError(parsedResult) || !parsedResult.ok) {
      return parsedResult;
    }

    let magnitude = parsedResult.value;

    const revolution = this.getRevolution(spec);
    magnitude = this.normalizeAngle(magnitude, revolution);
    let azimuthBase = 0.0;
    if (spec.format.azimuthBase !== undefined) {
      if (spec.azimuthBaseConversion === undefined) {
        throw new QuantityError(QuantityStatus.MissingRequiredProperty, `Missing azimuth base conversion for interpreting ${spec.format.name}'s azimuth base.`);
      }
      const azBaseQuantity: Quantity = new Quantity(spec.format.azimuthBaseUnit, spec.format.azimuthBase);
      const azBaseConverted = azBaseQuantity.convertTo(spec.outUnit, spec.azimuthBaseConversion);
      if (azBaseConverted === undefined || !azBaseConverted.isValid) {
        throw new QuantityError(QuantityStatus.UnsupportedUnit, `Failed to convert azimuth base unit to ${spec.outUnit.name}.`);
      }
      azimuthBase = this.normalizeAngle(azBaseConverted.magnitude, revolution);
    }
    const inputIsClockwise = spec.format.azimuthClockwiseOrDefault;

    if(inputIsClockwise && azimuthBase === 0) {
      // parsed result already has the same base and orientation as our desired output
      return parsedResult;
    }

    if (inputIsClockwise)
      magnitude = azimuthBase + magnitude;
    else
      magnitude = azimuthBase - magnitude;

    magnitude = this.normalizeAngle(magnitude, revolution);

    return { ok: true, value: magnitude };
  }

  private static parseRatioFormat(inString: string, spec: ParserSpec): QuantityParseResult {
    if (!inString)
      return { ok: false, error: ParseError.NoValueOrUnitFoundInString };

    const parts = inString.split(":");
    if (parts.length > 2)
      return { ok: false, error: ParseError.UnableToConvertParseTokensToQuantity };

    const numerator = parseFloat(parts[0]);
    let denominator;
    if (parts.length === 1) {
      denominator = 1.0;
    } else {
      denominator = parseFloat(parts[1]);
    }

    if (isNaN(numerator) || isNaN(denominator))
      return { ok: false, error: ParseError.NoValueOrUnitFoundInString };

    const defaultUnit = spec.format.units && spec.format.units.length > 0 ? spec.format.units[0][0] : undefined;
    const unitConversion = defaultUnit ? Parser.tryFindUnitConversion(defaultUnit.label, spec.unitConversions, defaultUnit) : undefined;

    if (!unitConversion) {
      throw new QuantityError(QuantityStatus.MissingRequiredProperty, `Missing input unit or unit conversion for interpreting ${spec.format.name}.`);
    }

    if (denominator === 0){
      if (unitConversion.inversion && numerator === 1)
        return { ok: true, value: 0.0 };
      else
        return { ok: false, error: ParseError.MathematicOperationFoundButIsNotAllowed };
    }

    let quantity: Quantity;
    if (spec.format.units && spec.outUnit) {
      quantity = new Quantity(spec.format.units[0][0], numerator / denominator);
    } else {
      throw new QuantityError(QuantityStatus.MissingRequiredProperty, "Missing presentation unit or persistence unit for ratio format.");
    }

    let converted: Quantity | undefined;
    try {
      converted = quantity.convertTo(spec.outUnit, unitConversion);
    } catch (err){
      // for input of "0:N" with reversed unit
      if (err instanceof QuantityError && err.errorNumber === QuantityStatus.InvertingZero){
        return { ok: false, error: ParseError.MathematicOperationFoundButIsNotAllowed };
      }
    }

    if (converted === undefined || !converted.isValid) {
      throw new QuantityError(QuantityStatus.UnsupportedUnit, `Failed to convert from ${spec.format.units[0][0].name} to ${spec.outUnit.name} On format ${spec.format.name}.`);
    }

    return { ok: true, value: converted.magnitude };
  }

  // TODO: The following two methods are redundant with Formatter. We should consider consolidating them.
  private static normalizeAngle(magnitude: number, revolution: number): number {
    magnitude = magnitude % revolution; // Strip anything that goes around more than once

    if (magnitude < 0) // If the value is negative, we want to normalize it to a positive angle
      magnitude += revolution;

    return magnitude;
  }

  private static getRevolution(spec: ParserSpec): number {
    if (spec.revolutionConversion === undefined) {
      throw new QuantityError(QuantityStatus.MissingRequiredProperty, `Missing revolution unit conversion for calculating ${spec.format.name}'s revolution.`);
    }

    const revolution: Quantity = new Quantity(spec.format.revolutionUnit, 1.0);
    const converted = revolution.convertTo(spec.outUnit, spec.revolutionConversion);
    if (converted === undefined || !converted.isValid) {
      throw new QuantityError(QuantityStatus.UnsupportedUnit, `Failed to convert revolution unit to ${spec.outUnit.name} On format ${spec.format.name}.`);
    }

    return converted.magnitude;
  }

  private static parseAndProcessTokens(inString: string, format: Format, unitsConversions: UnitConversionSpec[]): QuantityParseResult {
    const tokens: ParseToken[] = Parser.parseQuantitySpecification(inString, format);
    if (tokens.length === 0)
      return { ok: false, error: ParseError.UnableToGenerateParseTokens };

    if(!format.allowMathematicOperations && Parser.isMathematicOperation(tokens)){
      return { ok: false, error: ParseError.MathematicOperationFoundButIsNotAllowed };
    }

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
