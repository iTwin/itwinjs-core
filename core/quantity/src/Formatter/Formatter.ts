/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Quantity
 */

import { QuantityConstants } from "../Constants";
import { QuantityError, QuantityStatus } from "../Exception";
import { FormatterSpec } from "./FormatterSpec";
import { DecimalPrecision, FormatTraits, FormatType, FractionalPrecision, ScientificType, ShowSignOption } from "./FormatEnums";
import { Quantity } from "../Quantity";

/**  rounding additive
 * @internal
 */
const FPV_ROUNDFACTOR = 0.50000000001;

/** A private helper class used to format fraction part of value into a numerator and denominator.
 * @internal
 */
class FractionalNumeric {
  private _integral: number = 0;
  private _numerator: number = 0;
  private _denominator: number = 1;
  private _greatestCommonFactor: number = 1;
  private _textParts: string[] = [];

  constructor(value: number, precision: FractionalPrecision, reduce: boolean) {
    this.calculate(value, precision as number);
    this.formTextParts(reduce);
  }

  private calculate(value: number, denominator: number) {
    const positiveValue = Math.abs(value);
    this._denominator = denominator;
    this._integral = Math.floor(positiveValue);
    const fractionPart = positiveValue - this._integral;
    this._numerator = Math.floor(fractionPart * this._denominator + FPV_ROUNDFACTOR);

    if (0 !== denominator && (this._numerator / this._denominator) === 1) {
      this._numerator = 0;
      this._integral += 1;
    } else {
      this._greatestCommonFactor = this.getGreatestCommonFactor(this._numerator, this._denominator);
    }
  }

  /** Determine the GCD given two values. This value can be used to reduce a fraction.
   * See algorithm description http://en.wikipedia.org/wiki/Euclidean_algorithm
   */
  private getGreatestCommonFactor(numerator: number, denominator: number): number {
    let r;
    while (denominator !== 0) {
      r = numerator % denominator;
      numerator = denominator;
      denominator = r;
    }
    return (numerator < 0) ? -numerator : numerator;
  }

  public get greatestCommonFactor(): number { return this._greatestCommonFactor; }
  public get hasFractionPart(): boolean { return this._textParts.length > 0; }
  public get isZero(): boolean { return 0 === this._numerator; }

  public getIntegralString(): string {
    if (this._textParts.length > 0)
      return this._textParts[0];

    return "";
  }

  public getNumeratorString(): string {
    if (this._textParts.length >= 3)
      return this._textParts[1];

    return "";
  }

  public getDenominatorString(): string {
    if (this._textParts.length >= 3)
      return this._textParts[2];

    return "";
  }

  private formTextParts(reduce: boolean): void {
    let numerator = this._numerator;
    let denominator = this._denominator;

    if (reduce && this._greatestCommonFactor > 1) {
      numerator /= this.greatestCommonFactor;
      denominator /= this.greatestCommonFactor;
    }

    this._textParts.push(this._integral.toFixed(0));
    if (numerator > 0) {
      this._textParts.push(numerator.toFixed(0));
      this._textParts.push(denominator.toFixed(0));
    }
  }
}

/** A helper class that contains methods used to format quantity values based on a format that are defined via the Format class.
 * @beta
 */
export class Formatter {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  private static FPV_MINTHRESHOLD = 1.0e-14;

  private static isNegligible(value: number): boolean { return (Math.abs(value) < Formatter.FPV_MINTHRESHOLD); }

  /** Return floating point value rounded by specific rounding factor.
   *  @param value    Value to be rounded.
   *  @param roundTo  Rounding factor.
   */
  private static roundDouble(value: number, roundTo: number): number {
    if (Formatter.isNegligible(roundTo))
      return value;

    roundTo = Math.abs(roundTo);
    let rnd = FPV_ROUNDFACTOR + (value / roundTo);
    const iVal = Math.floor(rnd);
    rnd = iVal * roundTo;
    return (value < 0.0) ? -rnd : rnd;
  }

  /** Generate a formatted text string integer value insert 1000 separators if appropriate.
   *  @param wholePart    Integer value to be formatted.
   */
  private static integerPartToText(wholePart: number, spec: FormatterSpec): string {
    // build invariant string represent wholePart
    let formattedValue = wholePart.toFixed(0);

    if ((formattedValue.length > 3) && (spec.format.hasFormatTraitSet(FormatTraits.Use1000Separator) && (spec.format.thousandSeparator.length > 0))) {
      let numSeparators = Math.floor(formattedValue.length / 3);
      let groupLength = formattedValue.length % 3;

      if (groupLength === 0) {
        numSeparators = numSeparators - 1;
        groupLength = groupLength + 3;
      }

      let outString = formattedValue.substring(0, groupLength);

      for (let i = 1; i <= numSeparators; i += 1) {
        outString = outString + spec.format.thousandSeparator + formattedValue.substring(groupLength, groupLength + 3);
        groupLength = groupLength + 3;
      }

      formattedValue = outString;
    }

    return formattedValue;
  }

  /** Trim trailing "0" from the text that represent the fractional part of a floating point value.
   *  @param strVal   The value string.
   */
  private static trimTrailingZeroes(strVal: string): string {
    let lastNonZeroCharIndex = -1;
    for (let i = strVal.length - 1; i >= 0; i--) {
      if (strVal.charCodeAt(i) !== QuantityConstants.CHAR_DIGIT_ZERO) {
        lastNonZeroCharIndex = i;
        break;
      }
    }
    if (lastNonZeroCharIndex >= 0)
      return strVal.substring(0, lastNonZeroCharIndex + 1);
    return "";
  }

  /** Format a quantity value into a composite format such as ft-in or deg-min-sec.
   *  @param compositeValue   The value for this part of the composite
   *  @param isLastPart       If false the composite value should be a whole value, if true then the value should be formatted as a floating point value.
   *  @param label            Label for this part of the composite. This will be either the default unit label or a custom label specified the format specification.
   */
  private static formatCompositePart(compositeValue: number, isLastPart: boolean, label: string, spec: FormatterSpec): string {
    let componentText = "";
    if (!isLastPart) {
      componentText = Formatter.integerPartToText(compositeValue, spec);
      if(spec.format.minWidth) { // integerPartToText does not do this padding
        componentText = this.countAndPad(componentText, spec.format.minWidth);
      }
    } else {
      componentText = Formatter.formatMagnitude(compositeValue, spec);
    }

    if (spec.format.hasFormatTraitSet(FormatTraits.ShowUnitLabel)) {
      componentText = componentText + spec.format.uomSeparator + label;
    }

    return componentText;
  }

  /** Format a quantity value into a composite format such as ft-in or deg-min-sec.
   *  @param magnitude   quantity value
   *  @param fromUnit    quantity unit
   */
  private static formatComposite(magnitude: number, spec: FormatterSpec): string {
    const compositeStrings: string[] = [];

    // Caller will deal with appending +||-||() value sign as specified by formatting options so just format positive value
    let posMagnitude = Math.abs(magnitude);

    // eslint-disable-next-line @typescript-eslint/prefer-for-of
    for (let i = 0; i < spec.unitConversions.length; i++) {
      const currentLabel = spec.unitConversions[i].label;
      const unitConversion = spec.unitConversions[i].conversion;

      if (i > 0 && unitConversion.factor < 1.0)
        throw new QuantityError(QuantityStatus.InvalidCompositeFormat, `The Format ${spec.format.name} has a invalid unit specification..`);
      if (i > 0 && unitConversion.offset !== 0)
        throw new QuantityError(QuantityStatus.InvalidCompositeFormat, `The Format ${spec.format.name} has a invalid unit specification..`);

      let unitValue = (posMagnitude * unitConversion.factor) + unitConversion.offset + Formatter.FPV_MINTHRESHOLD; // offset should only ever be defined for major unit
      if (0 === i) {
        const precisionScale = Math.pow(10, 8);  // use a fixed round off precision of 8 to avoid loss of precision in actual magnitude
        unitValue = Math.floor(unitValue * precisionScale + FPV_ROUNDFACTOR) / precisionScale;
        if ((Math.abs(unitValue) < 0.0001) && spec.format.hasFormatTraitSet(FormatTraits.ZeroEmpty))
          return "";
      }

      if (i < spec.format.units!.length - 1) {
        const wholePart = Math.floor(unitValue);
        const componentText = Formatter.formatCompositePart(wholePart, false, currentLabel, spec);
        posMagnitude = unitValue - wholePart;
        compositeStrings.push(componentText);
      } else {
        const componentText = Formatter.formatCompositePart(unitValue, true, currentLabel, spec);
        compositeStrings.push(componentText);
      }
    }

    return compositeStrings.join(spec.format.spacerOrDefault);
  }

  /** Format a quantity value into a single text string. Imitate how formatting done by server method NumericFormatSpec::FormatDouble.
   *  @param magnitude   quantity value
   */
  private static formatMagnitude(magnitude: number, spec: FormatterSpec): string {
    let posMagnitude = Math.abs(magnitude);
    if ((Math.abs(posMagnitude) < 0.0001) && spec.format.hasFormatTraitSet(FormatTraits.ZeroEmpty))
      return "";

    if (spec.format.hasFormatTraitSet(FormatTraits.ApplyRounding))
      posMagnitude = Math.abs(Formatter.roundDouble(magnitude, spec.format.roundFactor));

    const isSci = ((posMagnitude > 1.0e12) || spec.format.type === FormatType.Scientific);
    const isDecimal = (isSci || spec.format.type === FormatType.Decimal || spec.format.type === FormatType.Bearing || spec.format.type === FormatType.Azimuth);
    const isFractional = (!isDecimal && spec.format.type === FormatType.Fractional);
    /* const usesStops = spec.format.type === FormatType.Station; */
    const isPrecisionZero = spec.format.precision === DecimalPrecision.Zero;
    const isKeepSingleZero = spec.format.hasFormatTraitSet(FormatTraits.KeepSingleZero);
    const precisionScale = Math.pow(10.0, spec.format.precision);
    const isKeepTrailingZeroes = spec.format.hasFormatTraitSet(FormatTraits.TrailZeroes);
    let expInt = 0.0;

    if (isSci && (posMagnitude !== 0.0)) {
      let exp = Math.log10(posMagnitude);
      let negativeExp = false;
      if (exp < 0.0) {
        exp = -exp;
        negativeExp = true;
      }

      expInt = Math.floor(exp);
      if (spec.format.type === FormatType.Scientific) {
        if (spec.format.scientificType === ScientificType.ZeroNormalized && posMagnitude > 1.0)
          expInt += 1.0;
        else if (spec.format.scientificType === ScientificType.Normalized && posMagnitude < 1.0)
          expInt += 1.0;

        if (negativeExp)
          expInt = -expInt;
      }

      const factor = Math.pow(10.0, -expInt);
      posMagnitude *= factor;
    }

    let formattedValue = "";
    if (isDecimal) {
      const actualVal = isPrecisionZero ? posMagnitude + FPV_ROUNDFACTOR : posMagnitude + Formatter.FPV_MINTHRESHOLD;
      let wholePart = Math.floor(actualVal);
      let fractionPart = actualVal - wholePart;
      if (!isPrecisionZero) {
        fractionPart = Math.abs(fractionPart) * precisionScale + FPV_ROUNDFACTOR;
        if (fractionPart >= precisionScale) {
          wholePart += 1;
          fractionPart -= precisionScale;
        }
      }

      formattedValue = Formatter.integerPartToText(wholePart, spec);
      if (isPrecisionZero) {
        if (spec.format.hasFormatTraitSet(FormatTraits.KeepDecimalPoint) && !isKeepSingleZero)
          formattedValue = formattedValue + spec.format.decimalSeparator;
        else if (isKeepSingleZero)
          formattedValue = `${formattedValue + spec.format.decimalSeparator}0`;
      } else {
        fractionPart = Math.floor(fractionPart) / precisionScale;
        let fractionString = fractionPart.toFixed(spec.format.precision);
        // remove leading "0."
        fractionString = fractionString.substring(2).padEnd(spec.format.precision, "0");
        if (!isKeepTrailingZeroes)
          fractionString = Formatter.trimTrailingZeroes(fractionString);

        if (fractionString.length > 0)
          formattedValue = formattedValue + spec.format.decimalSeparator + fractionString;
        else {
          if (spec.format.hasFormatTraitSet(FormatTraits.KeepDecimalPoint))
            formattedValue = formattedValue + spec.format.decimalSeparator + (isKeepSingleZero ? "0" : "");
        }
      }

      if (isSci) {
        const expString = `e${expInt.toFixed(0)}`;
        formattedValue = formattedValue + expString;
      }
    } else if (isFractional) {
      const fn = new FractionalNumeric(posMagnitude, spec.format.precision as FractionalPrecision, true);
      formattedValue = fn.getIntegralString();

      if (!fn.isZero && fn.hasFractionPart) {
        const wholeFractionSeparator = spec.format.hasFormatTraitSet(FormatTraits.FractionDash) ? "-" : " ";
        const fractionString = `${fn.getNumeratorString()}/${fn.getDenominatorString()}`;
        formattedValue = formattedValue + wholeFractionSeparator + fractionString;
      }
    } else /* if (usesStops)*/ {
      // we assume that stopping value is always positive
      posMagnitude = Math.floor(posMagnitude * precisionScale + FPV_ROUNDFACTOR) / precisionScale;

      const denominator = (Math.pow(10, spec.format.stationOffsetSize!));
      const tVal = Math.floor(posMagnitude); // this is the integer part only
      const hiPart = Math.floor(tVal / denominator);
      const lowPart = tVal - hiPart * denominator;
      const fract = posMagnitude - tVal;
      const fractionPart = Math.floor(fract * precisionScale + FPV_ROUNDFACTOR);
      const stationString = hiPart.toFixed(0) + spec.format.stationSeparator + lowPart.toFixed(0).padStart(spec.format.stationOffsetSize!, "0");
      let fractionString = "";
      if (fractionPart > 0) {
        fractionString = (fractionPart/precisionScale).toFixed(spec.format.precision);
        // remove leading "0."
        fractionString = fractionString.substring(2).padEnd(spec.format.precision, "0");
        if (!isKeepTrailingZeroes)
          fractionString = Formatter.trimTrailingZeroes(fractionString);

        formattedValue = stationString + spec.format.decimalSeparator + fractionString;
      } else {
        if (isKeepTrailingZeroes)
          fractionString = spec.format.decimalSeparator + "".padEnd(spec.format.precision, "0");
        else if (spec.format.hasFormatTraitSet(FormatTraits.KeepDecimalPoint))
          fractionString = spec.format.decimalSeparator;
        formattedValue = stationString + fractionString;
      }
    }

    if(spec.format.minWidth) {
      formattedValue = this.countAndPad(formattedValue, spec.format.minWidth);
    }

    return formattedValue;
  }

  private static countAndPad(value: string, minWidth: number): string {
    const regex = /[\d,.]/g;
    const matches = value.match(regex);
    const count = matches ? matches.length : 0;
    if (count < minWidth) {
      value = value.padStart(minWidth, "0");
    }
    return value;
  }

  /** Format a quantity value into a single text string based on the current format specification of this class.
   *  @param magnitude   defines the value to spec.format.
   *  @param spec      A FormatterSpec object the defines specification for the magnitude and unit conversions for the formatter.
   */
  public static formatQuantity(magnitude: number, spec: FormatterSpec): string {
    const valueIsNegative = magnitude < 0.0;
    let prefix = "";
    let suffix = "";
    let formattedValue = "";
    if(spec.format.type === FormatType.Bearing || spec.format.type === FormatType.Azimuth) {
      const result = this.processBearingAndAzimuth(magnitude, spec);
      magnitude = result.magnitude;
      prefix = result.prefix ?? "";
      suffix = result.suffix ?? "";
    }

    switch (spec.format.showSignOption) {
      case ShowSignOption.NegativeParentheses:
        if (valueIsNegative) {
          prefix += "(";
          suffix = `)${suffix}`;
        }
        break;

      case ShowSignOption.OnlyNegative:
        if (valueIsNegative)
          prefix += "-";

        break;

      case ShowSignOption.SignAlways:
        if (valueIsNegative)
          prefix += "-";
        else
          prefix += "+";

        break;

      case ShowSignOption.NoSign:
      default:
        break;
    }

    let formattedMagnitude = "";

    if (spec.format.hasUnits) {
      formattedMagnitude = Formatter.formatComposite(magnitude, spec);
    } else {
      // unitless quantity
      formattedMagnitude = Formatter.formatMagnitude(magnitude, spec);
      if (formattedMagnitude.length > 0 && spec.unitConversions.length > 0 && spec.format.hasFormatTraitSet(FormatTraits.ShowUnitLabel)) {
        if (spec.format.hasFormatTraitSet(FormatTraits.PrependUnitLabel))
          formattedMagnitude = spec.unitConversions[0].label + spec.format.uomSeparator + formattedMagnitude;
        else
          formattedMagnitude = formattedMagnitude + spec.format.uomSeparator + spec.unitConversions[0].label;
      }
    }
    // add Sign prefix and suffix as necessary
    if ((prefix.length > 0 || suffix.length > 0) && formattedMagnitude.length > 0)
      formattedValue = prefix + formattedMagnitude + suffix;
    else
      formattedValue = formattedMagnitude;

    return formattedValue;
  }

  private static processBearingAndAzimuth(magnitude: number, spec: FormatterSpec): {magnitude: number, prefix?: string, suffix?: string} {
    const type = spec.format.type;
    if (type !== FormatType.Bearing && type !== FormatType.Azimuth)
      return {magnitude};

    const revolution = this.getRevolution(spec);
    magnitude = this.normalizeAngle(magnitude, revolution);
    const quarterRevolution = revolution / 4;

    if (type === FormatType.Bearing) {
      let quadrant = 0;
      while (magnitude > quarterRevolution) {
        magnitude -= quarterRevolution;
        quadrant++;
      }
      let prefix, suffix: string;

      // Quadrants are
      // 1 0
      // 2 3
      // For quadrants 0 and 2 we have to subtract the angle from quarterRevolution degrees because they go clockwise
      if (quadrant === 0 || quadrant === 2)
        magnitude = quarterRevolution - magnitude;

      // TODO: at some point we will want to open this for localization, in the first release it's going to be hard coded
      if (quadrant === 0 || quadrant === 1)
        prefix = "N";

      if (quadrant === 2 || quadrant === 3)
        prefix = "S";

      if (quadrant === 0 || quadrant === 3)
        suffix = "E";

      if (quadrant === 1 || quadrant === 2)
        suffix = "W";

      // special case, if in quadrant 2 and value is very small, turn suffix to E because S00E is preferred over S00W
      if (quadrant === 2 && magnitude < 0.00000000001) // 1e-11 is a small value that is close to 0
        suffix = "E";

      return {magnitude, prefix, suffix: suffix!};
    }

    if (type === FormatType.Azimuth) {
      let azimuthBase = quarterRevolution; // default base is North
      if (spec.format.azimuthBase !== undefined) {
        if (spec.azimuthBaseConversion === undefined) {
          throw new QuantityError(QuantityStatus.MissingRequiredProperty, `Missing azimuth base conversion for interpreting ${spec.name}'s azimuth base.`);
        }
        const azBaseQuantity: Quantity = new Quantity(spec.format.azimuthBaseUnit, spec.format.azimuthBase);
        const azBaseConverted = azBaseQuantity.convertTo(spec.persistenceUnit, spec.azimuthBaseConversion);
        if (azBaseConverted === undefined || !azBaseConverted.isValid) {
          throw new QuantityError(QuantityStatus.UnsupportedUnit, `Failed to convert azimuth base unit to ${spec.persistenceUnit.name}.`);
        }
        azimuthBase = this.normalizeAngle(azBaseConverted.magnitude, revolution);
      }

      if (azimuthBase === quarterRevolution && spec.format.azimuthCounterClockwiseOrDefault)
        return {magnitude}; // no conversion necessary, the input is already using the result parameters (east base and counter clockwise)

      // subtract the base from the actual value
      magnitude -= azimuthBase;
      if (spec.format.azimuthCounterClockwiseOrDefault)
        return {magnitude: this.normalizeAngle(magnitude, revolution)};

      // turn it into a clockwise angle
      magnitude = revolution - magnitude;
      // normalize the result as it may have become negative or exceed the revolution
      magnitude = this.normalizeAngle(magnitude, revolution);
    }

    return {magnitude};
  }

  private static normalizeAngle(magnitude: number, revolution: number): number {
    magnitude = magnitude % revolution; // Strip anything that goes around more than once

    if (magnitude < 0) // If the value is negative, we want to normalize it to a positive angle
      magnitude += revolution;

    return magnitude;
  }

  private static getRevolution(spec: FormatterSpec): number {
    if (spec.revolutionConversion === undefined) {
      throw new QuantityError(QuantityStatus.MissingRequiredProperty, `Missing revolution unit conversion for calculating ${spec.name}'s revolution.`);
    }

    const revolution: Quantity = new Quantity(spec.format.revolutionUnit, 1.0);
    const converted = revolution.convertTo(spec.persistenceUnit, spec.revolutionConversion);
    if (converted === undefined || !converted.isValid) {
      throw new QuantityError(QuantityStatus.UnsupportedUnit, `Failed to convert revolution unit to ${spec.persistenceUnit.name}.`);
    }

    return converted.magnitude;
  }
}
