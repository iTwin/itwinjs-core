/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/
import { QuantityConstants } from "../Constants";
import { UnitProps, QuantityProps } from "../Interfaces";
import { QuantityStatus, QuantityError } from "../Exception";
import { Format } from "./Format";
import { FormatType, ScientificType, ShowSignOption, DecimalPrecision, FractionalPrecision, FormatTraits } from "./FormatEnums";

const FPV_MINTHRESHOLD = 1.0e-14;       // format parameter default values
const FPV_ROUNDFACTOR = 0.50000000001;  // rounding additive

/** A private helper class used to format fraction part of value into a numerator and denominator. */
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
    if (this._textParts.length > 0) return this._textParts[0];
    return "";
  }

  public getNumeratorString(): string {
    if (this._textParts.length >= 3) return this._textParts[1];
    return "";
  }

  public getDenominatorString(): string {
    if (this._textParts.length >= 3) return this._textParts[2];
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

/** A class used to format quantity values. */
export class Formatter {
  private _roundFactor: number = 0.0;

  public get roundFactor(): number { return this._roundFactor; }
  public set roundFactor(factor: number) { this._roundFactor = factor; }

  private getEffectiveRoundFactor(roundFactor: number): number { return this.isIgnored(roundFactor) ? this._roundFactor : roundFactor; }
  private isNegligible(value: number): boolean { return (Math.abs(value) < FPV_MINTHRESHOLD); }
  private isIgnored(value: number): boolean { return (value < 0.0 || Math.abs(value) < FPV_MINTHRESHOLD); }

  /** Return floating point value rounded by specific rounding factor.
   *  @param value    Value to be rounded.
   *  @param roundTo  Rounding factor.
   */
  private roundDouble(value: number, roundTo: number): number {
    if (this.isNegligible(roundTo))
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
  private integerPartToText(wholePart: number, format: Format): string {
    // build invariant string represent wholePart
    let formattedValue = wholePart.toFixed(0);

    if ((formattedValue.length > 3) && (format.hasFormatTraitSet(FormatTraits.Use1000Separator) && (format.thousandSeparator.length > 0))) {
      let numSeparators = Math.floor(formattedValue.length / 3);
      let groupLength = formattedValue.length % 3;

      if (groupLength === 0) {
        numSeparators = numSeparators - 1;
        groupLength = groupLength + 3;
      }

      let outString = formattedValue.substr(0, groupLength);

      for (let i = 1; i <= numSeparators; i += 1) {
        outString = outString + format.thousandSeparator + formattedValue.substr(groupLength, 3);
        groupLength = groupLength + 3;
      }

      formattedValue = outString;
    }

    return formattedValue;
  }

  /** Trim trailing "0" from the text that represent the fractional part of a floating point value.
   *  @param strVal   The value string.
   */
  private trimTrailingZeroes(strVal: string): string {
    let lastNonZeroCharIndex = -1;
    for (let i = strVal.length - 1; i >= 0; i--) {
      if (strVal.charCodeAt(i) !== QuantityConstants.CHAR_DIGIT_ZERO) {
        lastNonZeroCharIndex = i;
        break;
      }
    }
    if (lastNonZeroCharIndex >= 0)
      return strVal.substr(0, lastNonZeroCharIndex + 1);
    return "";
  }

  /** Format a quantity value into a composite format such as ft-in or deg-min-sec.
   *  @param compositeValue   The value for this part of the composite
   *  @param isLastPart       If false the composite value should be a whole value, if true then the value should be formatted as a floating point value.
   *  @param label            Label for this part of the composite. This will be either the default unit label or a custom label specified the format specification.
   */
  private formatCompositePart(compositeValue: number, isLastPart: boolean, label: string, format: Format): string {
    let componentText = "";
    if (!isLastPart) {
      componentText = this.integerPartToText(compositeValue, format);
    } else {
      componentText = this.formatMagnitude(compositeValue, format);
    }

    if (format.hasFormatTraitSet(FormatTraits.ShowUnitLabel)) {
      componentText = componentText + format.uomSeparator + label;
    } else {
      if (!isLastPart) componentText = componentText + ":";
    }

    return componentText;
  }

  /** Format a quantity value into a composite format such as ft-in or deg-min-sec.
   *  @param magnitude   quantity value
   *  @param fromUnit    quantity unit
   */
  private async formatComposite(magnitude: number, fromUnit: UnitProps, format: Format): Promise<string> {
    const compositeStrings: string[] = [];

    // Caller will deal with appending +||-||() value sign as specified by formatting options so just format positive value
    let posMagnitude = Math.abs(magnitude);

    if ((Math.abs(posMagnitude) < 0.0001) && format.hasFormatTraitSet(FormatTraits.ZeroEmpty)) return Promise.resolve("");

    // tslint:disable-next-line:prefer-for-of
    for (let i = 0; i < format.units!.length; i++) {
      const currentUnit = format.units![i][0];
      const currentLabel = format.units![i][1] ? format.units![i][1]! : currentUnit.label;
      const unitConversion = await format.unitsProvider.getConversion(fromUnit, currentUnit);

      if (unitConversion.factor < 1.0)
        throw new QuantityError(QuantityStatus.InvalidCompositeFormat, `The Format ${format.name} has a invalid unit specification..`);
      if (i > 0 && unitConversion.offset !== 0)
        throw new QuantityError(QuantityStatus.InvalidCompositeFormat, `The Format ${format.name} has a invalid unit specification..`);

      const unitValue = (posMagnitude * unitConversion.factor) + unitConversion.offset; // offset should only ever be defined for major unit
      if (i < format.units!.length - 1) {
        const wholePart = Math.floor(unitValue);
        const componentText = this.formatCompositePart(wholePart, false, currentLabel, format);
        posMagnitude = unitValue - wholePart;
        compositeStrings.push(componentText);
      } else {
        const componentText = this.formatCompositePart(unitValue, true, currentLabel, format);
        compositeStrings.push(componentText);
      }
      // now convert from current unit to next composite unit
      fromUnit = currentUnit;
    }

    const formattedValue = compositeStrings.join(format.spacer ? format.spacer : "");
    return Promise.resolve(formattedValue);
  }

  /** Format a quantity value into a single text string. Imitate how formatting done by server method NumericFormatSpec::FormatDouble.
   *  @param magnitude   quantity value
   */
  private formatMagnitude(magnitude: number, format: Format): string {
    let posMagnitude = Math.abs(magnitude);
    if ((Math.abs(posMagnitude) < 0.0001) && format.hasFormatTraitSet(FormatTraits.ZeroEmpty)) return "";

    if (format.hasFormatTraitSet(FormatTraits.ApplyRounding))
      posMagnitude = Math.abs(this.roundDouble(magnitude, this.getEffectiveRoundFactor(format.roundFactor)));

    const isSci = ((posMagnitude > 1.0e12) || format.type === FormatType.Scientific);
    const isDecimal = (isSci || format.type === FormatType.Decimal);
    const isFractional = (!isDecimal && format.type === FormatType.Fractional);
    /*const usesStops = format.type === FormatType.Station;*/
    const isPrecisionZero = format.precision === DecimalPrecision.Zero;
    const isKeepSingleZero = format.hasFormatTraitSet(FormatTraits.KeepSingleZero);
    const precisionScale = Math.pow(10.0, format.precision);
    const isKeepTrailingZeroes = format.hasFormatTraitSet(FormatTraits.TrailZeroes);
    let expInt = 0.0;

    if (isSci && (posMagnitude !== 0.0)) {
      let exp = Math.log10(posMagnitude);
      let negativeExp = false;
      if (exp < 0.0) {
        exp = -exp;
        negativeExp = true;
      }

      expInt = Math.floor(exp);
      if (format.type === FormatType.Scientific) {
        if (format.scientificType === ScientificType.ZeroNormalized && posMagnitude > 1.0) expInt += 1.0;
        else if (format.scientificType === ScientificType.Normalized && posMagnitude < 1.0) expInt += 1.0;
        if (negativeExp) expInt = -expInt;
      }
      const factor = Math.pow(10.0, -expInt);
      posMagnitude *= factor;
    }

    let formattedValue = "";
    if (isDecimal) {
      const actualVal = isPrecisionZero ? posMagnitude + FPV_ROUNDFACTOR : posMagnitude + FPV_MINTHRESHOLD;
      let wholePart = Math.floor(actualVal);
      let fractionPart = actualVal - wholePart;
      if (!isPrecisionZero) {
        fractionPart = Math.abs(fractionPart) * precisionScale + FPV_ROUNDFACTOR;
        if (fractionPart >= precisionScale) {
          wholePart += 1;
          fractionPart -= precisionScale;
        }
      }

      formattedValue = this.integerPartToText(wholePart, format);
      if (isPrecisionZero) {
        if (isKeepSingleZero) {
          formattedValue = formattedValue + format.decimalSeparator + "0";
        }
      } else {
        fractionPart = Math.floor(fractionPart) / precisionScale;
        let fractionString = fractionPart.toFixed(format.precision);
        // remove leading "0."
        fractionString = fractionString.substr(2).padEnd(format.precision, "0");
        if (!isKeepTrailingZeroes) fractionString = this.trimTrailingZeroes(fractionString);
        if (fractionString.length > 0)
          formattedValue = formattedValue + format.decimalSeparator + fractionString;
        else {
          if (format.hasFormatTraitSet(FormatTraits.KeepDecimalPoint))
            formattedValue = formattedValue + format.decimalSeparator;
        }
      }

      if (isSci) {
        const expString = "e" + expInt.toFixed(0);
        formattedValue = formattedValue + expString;
      }
    } else if (isFractional) {
      const fn = new FractionalNumeric(posMagnitude, format.precision as FractionalPrecision, true);
      formattedValue = fn.getIntegralString();

      if (!fn.isZero && fn.hasFractionPart) {
        const wholeFractionSeparator = format.hasFormatTraitSet(FormatTraits.FractionDash) ? "-" : " ";
        const fractionString = fn.getNumeratorString() + "/" + fn.getDenominatorString();
        formattedValue = formattedValue + wholeFractionSeparator + fractionString;
      }
    } else /* if (usesStops)*/ {
      // we assume that stopping value is always positive
      const denominator = (Math.pow(10, format.stationOffsetSize!));
      const tVal = Math.floor(posMagnitude); // this is the integer part only
      const hiPart = Math.floor(tVal / denominator);
      const lowPart = tVal - hiPart * denominator;
      const fract = posMagnitude - tVal;
      const fractionPart = Math.floor(0.5 + fract * precisionScale);
      const stationString = hiPart.toFixed(0) + format.stationSeparator + lowPart.toFixed(0).padStart(format.stationOffsetSize!, "0");
      let fractionString = "";
      if (fractionPart > 0) {
        fractionString = fractionPart.toFixed(0).padEnd(format.precision, "0");
        if (!isKeepTrailingZeroes) fractionString = this.trimTrailingZeroes(fractionString);
        formattedValue = stationString + format.decimalSeparator + fractionString;
      } else {
        if (isKeepTrailingZeroes)
          fractionString = format.decimalSeparator + "".padEnd(format.precision, "0");
        else if (format.hasFormatTraitSet(FormatTraits.KeepDecimalPoint))
          fractionString = format.decimalSeparator;
        formattedValue = stationString + fractionString;
      }
    }
    return formattedValue;
  }

  /** Format a quantity value into a single text string based on the current format specification of this class.
   *  @param quantity   A QuantityProps object the defines the magnitude and unit of the quantity to format.
   */
  public async formatQuantity(quantity: QuantityProps, format: Format): Promise<string> {
    const valueIsNegative = quantity.magnitude < 0.0;
    let prefix = "";
    let suffix = "";
    let formattedValue = "";
    switch (format.showSignOption) {
      case ShowSignOption.NegativeParentheses:
        if (valueIsNegative) {
          prefix = "(";
          suffix = ")";
        }
        break;

      case ShowSignOption.OnlyNegative:
        if (valueIsNegative) prefix = "-";
        break;

      case ShowSignOption.SignAlways:
        if (valueIsNegative) prefix = "-";
        else prefix = "+";
        break;

      case ShowSignOption.NoSign:
      default:
        break;
    }

    let formattedMagnitude = "";

    if (format.hasComposite) {
      formattedMagnitude = await this.formatComposite(quantity.magnitude, quantity.unit, format);
    } else {
      formattedMagnitude = this.formatMagnitude(quantity.magnitude, format);
      if (formattedMagnitude.length > 0 && format.hasFormatTraitSet(FormatTraits.ShowUnitLabel)) {
        if (format.hasFormatTraitSet(FormatTraits.PrependUnitLabel))
          formattedMagnitude = quantity.unit.label + format.uomSeparator + formattedMagnitude;
        else
          formattedMagnitude = formattedMagnitude + format.uomSeparator + quantity.unit.label;
      }
    }
    // add Sign prefix and suffix as necessary
    if ((prefix.length > 0 || suffix.length > 0) && formattedMagnitude.length > 0)
      formattedValue = prefix + formattedMagnitude + suffix;
    else
      formattedValue = formattedMagnitude;

    if (format.minWidth && format.minWidth < formattedValue.length)
      formattedValue.padStart(format.minWidth, " ");

    return Promise.resolve(formattedValue);
  }

}
