/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/
import { FormatProps } from "./Interfaces";
import { UnitProps, UnitsProvider, UnitConversion } from "../Interfaces";
import { QuantityStatus, QuantityError } from "../Exception";
import { QuantityConstants } from "../Constants";
import {
  FormatType, ScientificType, ShowSignOption, DecimalPrecision, FractionalPrecision, FormatTraits,
} from "./FormatEnums";

// cSpell:ignore ZERONORMALIZED, nosign, onlynegative, signalways, negativeparentheses
// cSpell:ignore trailzeroes, keepsinglezero, zeroempty, keepdecimalpoint, applyrounding, fractiondash, showunitlabel, prependunitlabel, exponentonlynegative

/** A class used to both define the specifications for formatting a quantity values and the methods to do the formatting. */
export class Format implements FormatProps {
  private _name = "";

  protected _roundFactor: number = 0.0;
  protected _type: FormatType = FormatType.Decimal; // required; options are decimal, fractional, scientific, station
  protected _precision: number = DecimalPrecision.Six; // required
  protected _minWidth?: number; // optional; positive int
  protected _scientificType?: ScientificType; // required if type is scientific; options: normalized, zeroNormalized
  protected _showSignOption: ShowSignOption = ShowSignOption.OnlyNegative; // options: noSign, onlyNegative, signAlways, negativeParentheses
  protected _decimalSeparator: string = QuantityConstants.LocaleSpecificDecimalSeparator;
  protected _thousandSeparator: string = QuantityConstants.LocaleSpecificThousandSeparator;
  protected _uomSeparator = " "; // optional; default is " "; defined separator between magnitude and the unit
  protected _stationSeparator = "+"; // optional; default is "+"
  protected _stationOffsetSize?: number; // required when type is station; positive integer > 0
  protected _formatTraits: FormatTraits = 0x0;
  protected _spacer: string = " "; // optional; default is " "
  protected _includeZero: boolean = true; // optional; default is true
  protected _units?: Array<[UnitProps, string | undefined]>;

  /** Constructor
   *  @param name     The name of a format specification. TODO: make optional or remove
   */
  constructor(name: string) {
    this._name = name;
  }

  get name(): string { return this._name; }
  get roundFactor(): number { return this._roundFactor; }
  get type(): FormatType { return this._type; }
  get precision(): DecimalPrecision | FractionalPrecision { return this._precision; }
  get minWidth(): number | undefined { return this._minWidth; }
  get scientificType(): ScientificType | undefined { return this._scientificType; }
  get showSignOption(): ShowSignOption { return this._showSignOption; }
  get decimalSeparator(): string { return this._decimalSeparator; }
  get thousandSeparator(): string { return this._thousandSeparator; }
  get uomSeparator(): string { return this._uomSeparator; }
  get stationSeparator(): string { return this._stationSeparator; }
  get stationOffsetSize(): number | undefined { return this._stationOffsetSize; }
  get formatTraits(): FormatTraits { return this._formatTraits; }
  get spacer(): string | undefined { return this._spacer; }
  get includeZero(): boolean | undefined { return this._includeZero; }
  get units(): Array<[UnitProps, string | undefined]> | undefined { return this._units; }
  get hasUnits(): boolean { return this._units !== undefined && this._units.length > 0; }

  // parse and toString methods
  public static scientificTypeToString(scientificType: ScientificType): string {
    if (scientificType === ScientificType.Normalized)
      return "Normalized";
    else
      return "ZeroNormalized";
  }

  /** This method parses input string that is typically extracted for persisted JSON data and validates that the string is a valid ScientificType. Throws exception if not valid. */
  public static parseScientificType(scientificType: string, formatName: string): ScientificType {
    switch (scientificType) {
      case "normalized":
        return ScientificType.Normalized;
      case "zeronormalized":
        return ScientificType.ZeroNormalized;
      default:
        throw new QuantityError(QuantityStatus.InvalidJson, `The Format ${formatName} has an invalid 'SCIENTIFIC_TYPE' attribute.`);
    }
  }

  /** Method used when generating a JSON object that represents this Format. */
  public static showSignOptionToString(showSign: ShowSignOption): string {
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

  /** This method parses input string that is typically extracted for persisted JSON data and validates that the string is a valid ShowSignOption. Throws exception if not valid. */
  public static parseShowSignOption(showSignOption: string, formatName: string): ShowSignOption {
    switch (showSignOption.toLowerCase()) {
      case "nosign":
        return ShowSignOption.NoSign;
      case "onlynegative":
        return ShowSignOption.OnlyNegative;
      case "signalways":
        return ShowSignOption.SignAlways;
      case "negativeparentheses":
        return ShowSignOption.NegativeParentheses;
      default:
        throw new QuantityError(QuantityStatus.InvalidJson, `The Format ${formatName} has an invalid 'showSignOption' attribute.`);
    }
  }

  /** Method used when generating a JSON object that represents this Format. */
  public static formatTraitsToArray(currentFormatTrait: FormatTraits): string[] {
    const formatTraitsArr = Array<string>();
    if ((currentFormatTrait & FormatTraits.TrailZeroes) === FormatTraits.TrailZeroes) formatTraitsArr.push("trailZeroes");
    if ((currentFormatTrait & FormatTraits.KeepSingleZero) === FormatTraits.KeepSingleZero) formatTraitsArr.push("keepSingleZero");
    if ((currentFormatTrait & FormatTraits.ZeroEmpty) === FormatTraits.ZeroEmpty) formatTraitsArr.push("zeroEmpty");
    if ((currentFormatTrait & FormatTraits.KeepDecimalPoint) === FormatTraits.KeepDecimalPoint) formatTraitsArr.push("keepDecimalPoint");
    if ((currentFormatTrait & FormatTraits.ApplyRounding) === FormatTraits.ApplyRounding) formatTraitsArr.push("applyRounding");
    if ((currentFormatTrait & FormatTraits.FractionDash) === FormatTraits.FractionDash) formatTraitsArr.push("fractionDash");
    if ((currentFormatTrait & FormatTraits.ShowUnitLabel) === FormatTraits.ShowUnitLabel) formatTraitsArr.push("showUnitLabel");
    if ((currentFormatTrait & FormatTraits.PrependUnitLabel) === FormatTraits.PrependUnitLabel) formatTraitsArr.push("prependUnitLabel");
    if ((currentFormatTrait & FormatTraits.Use1000Separator) === FormatTraits.Use1000Separator) formatTraitsArr.push("use1000Separator");
    if ((currentFormatTrait & FormatTraits.ExponentOnlyNegative) === FormatTraits.ExponentOnlyNegative) formatTraitsArr.push("exponentOnlyNegative");

    return formatTraitsArr;
  }

  /** This method parses input string that is typically extracted for persisted JSON data and validates that the string is a valid FormatTrait. Throws exception if not valid. */
  public static parseFormatTrait(stringToCheck: string, currentFormatTrait: number): FormatTraits {
    let formatTrait = currentFormatTrait;
    switch (stringToCheck.toLowerCase()) {
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
        throw new QuantityError(QuantityStatus.InvalidJson, `Format has an invalid 'formatTraits' option.`);
    }
    return formatTrait;
  }

  /** Method used when generating a JSON object that represents this Format. */
  public static formatTypeToString(type: FormatType): string {
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

  /** This method parses input string that is typically extracted for persisted JSON data and validates that the string is a valid FormatType. Throws exception if not valid. */
  public static parseFormatType(jsonObjType: string, formatName: string): FormatType {
    switch (jsonObjType.toLowerCase()) {
      case "decimal":
        return FormatType.Decimal;
      case "scientific":
        return FormatType.Scientific;
      case "station":
        return FormatType.Station;
      case "fractional":
        return FormatType.Fractional;
      default:
        throw new QuantityError(QuantityStatus.InvalidJson, `The Format ${formatName} has an invalid 'type' attribute.`);
    }
  }

  /** This method validates the input value, that is typically extracted for persisted JSON data, is a valid DecimalPrecision. Throws exception if not valid. */
  public static parseDecimalPrecision(jsonObjPrecision: number): DecimalPrecision {
    switch (jsonObjPrecision) {
      case 0:
        return DecimalPrecision.Zero;
      case 1:
        return DecimalPrecision.One;
      case 2:
        return DecimalPrecision.Two;
      case 3:
        return DecimalPrecision.Three;
      case 4:
        return DecimalPrecision.Four;
      case 5:
        return DecimalPrecision.Five;
      case 6:
        return DecimalPrecision.Six;
      case 7:
        return DecimalPrecision.Seven;
      case 8:
        return DecimalPrecision.Eight;
      case 9:
        return DecimalPrecision.Nine;
      case 10:
        return DecimalPrecision.Ten;
      case 11:
        return DecimalPrecision.Eleven;
      case 12:
        return DecimalPrecision.Twelve;
      default:
        throw new QuantityError(QuantityStatus.InvalidJson, `The 'precision' attribute must be an integer in the range 0-12.`);
    }
  }

  /** This method validates the input value, that is typically extracted for persisted JSON data, is a valid FractionalPrecision. Throws exception if not valid. */
  public static parseFractionalPrecision(jsonObjPrecision: number, formatName: string): FractionalPrecision {
    switch (jsonObjPrecision) {
      case 1:
        return FractionalPrecision.One;
      case 2:
        return FractionalPrecision.Two;
      case 4:
        return FractionalPrecision.Four;
      case 8:
        return FractionalPrecision.Eight;
      case 16:
        return FractionalPrecision.Sixteen;
      case 32:
        return FractionalPrecision.ThirtyTwo;
      case 64:
        return FractionalPrecision.SixtyFour;
      case 128:
        return FractionalPrecision.OneHundredTwentyEight;
      case 256:
        return FractionalPrecision.TwoHundredFiftySix;
      default:
        throw new QuantityError(QuantityStatus.InvalidJson, `The Format ${formatName} has an invalid 'precision' attribute.`);
    }
  }

  /** This method validates the input value, that is typically extracted for persisted JSON data, is a valid DecimalPrecision or FractionalPrecision. Throws exception if not valid. */
  public static parsePrecision(precision: number, formatName: string, type: FormatType): DecimalPrecision | FractionalPrecision {
    switch (type) { // type must be decimal, fractional, scientific, or station
      case FormatType.Decimal:
      case FormatType.Scientific:
      case FormatType.Station:
        return Format.parseDecimalPrecision(precision);
      case FormatType.Fractional:
        return Format.parseFractionalPrecision(precision, formatName);
    }
  }

  private verifyFormatTraitsOptions(formatTraitsFromJson: string | string[]) {
    const formatTraits = (Array.isArray(formatTraitsFromJson)) ? formatTraitsFromJson : formatTraitsFromJson.split(/,|;|\|/);
    formatTraits.forEach((formatTraitsString: string) => { // for each element in the string array
      this._formatTraits = Format.parseFormatTrait(formatTraitsString, this.formatTraits);
    });
  }

  /** This method returns true if the formatTrait is set in this Format object. */
  public hasFormatTraitSet(formatTrait: FormatTraits): boolean {
    return (this._formatTraits & formatTrait) === formatTrait;
  }

  private async createUnit(unitsProvider: UnitsProvider, name: string, label?: string): Promise<void> {
    let newUnit: UnitProps | undefined;
    if (name === undefined || typeof (name) !== "string" || (label !== undefined && typeof (label) !== "string")) // throws if name is undefined or name isn't a string or if label is defined and isn't a string
      return Promise.reject(new QuantityError(QuantityStatus.InvalidJson, `This Composite has a unit with an invalid 'name' or 'label' attribute.`));
    for (const unit of this.units!) {
      const unitObj = unit[0].name;
      if (unitObj.toLowerCase() === name.toLowerCase()) // duplicate names are not allowed
        return Promise.reject(new QuantityError(QuantityStatus.InvalidJson, `The unit ${unitObj} has a duplicate name.`));
    }
    newUnit = await unitsProvider.findUnit(name);
    if (!newUnit || !newUnit.isValid)
      return Promise.reject(new QuantityError(QuantityStatus.InvalidJson, `Invalid unit name '${name}'.`));
    this.units!.push([newUnit, label]);
  }

  private loadFormatProperties(jsonObj: any) {
    if (undefined === jsonObj.type) // type is required
      throw new QuantityError(QuantityStatus.InvalidJson, `The Format ${this.name} does not have the required 'type' attribute.`);
    if (typeof (jsonObj.type) !== "string")
      throw new QuantityError(QuantityStatus.InvalidJson, `The Format ${this.name} has an invalid 'type' attribute. It should be of type 'string'.`);
    this._type = Format.parseFormatType(jsonObj.type, this.name);

    if (undefined === jsonObj.precision) // precision is required
      throw new QuantityError(QuantityStatus.InvalidJson, `The Format ${this.name} does not have the required 'precision' attribute.`);
    else if (typeof (jsonObj.precision) !== "number") // must be a number
      throw new QuantityError(QuantityStatus.InvalidJson, `The Format ${this.name} has an invalid 'precision' attribute. It should be of type 'number'.`);
    else if (!Number.isInteger(jsonObj.precision)) // must be an integer
      throw new QuantityError(QuantityStatus.InvalidJson, `The Format ${this.name} has an invalid 'precision' attribute. It should be an integer.`);
    this._precision = Format.parsePrecision(jsonObj.precision, this.name, this._type as FormatType);

    if (this.type === FormatType.Scientific) {
      if (undefined === jsonObj.scientificType) // if format type is scientific and scientific type is undefined, throw
        throw new QuantityError(QuantityStatus.InvalidJson, `The Format ${this.name} has type 'Scientific' therefore attribute 'scientificType' is required.`);
      if (typeof (jsonObj.scientificType) !== "string")
        throw new QuantityError(QuantityStatus.InvalidJson, `The Format ${this.name} has an invalid 'scientificType' attribute. It should be of type 'string'.`);
      this._scientificType = Format.parseScientificType(jsonObj.scientificType.toLowerCase(), this.name);
    }

    if (this.type === FormatType.Station) {
      if (undefined === jsonObj.stationOffsetSize)
        throw new QuantityError(QuantityStatus.InvalidJson, `The Format ${this.name} has type 'Station' therefore attribute 'stationOffsetSize' is required.`);
      if (typeof (jsonObj.stationOffsetSize) !== "number")
        throw new QuantityError(QuantityStatus.InvalidJson, `The Format ${this.name} has an invalid 'stationOffsetSize' attribute. It should be of type 'number'.`);
      if (!Number.isInteger(jsonObj.stationOffsetSize) || jsonObj.stationOffsetSize <= 0) // must be a positive int > 0
        throw new QuantityError(QuantityStatus.InvalidJson, `The Format ${this.name} has an invalid 'stationOffsetSize' attribute. It should be a positive integer.`);
      this._stationOffsetSize = jsonObj.stationOffsetSize;
    }

    if (undefined !== jsonObj.roundFactor) { // optional; default is 0.0
      if (typeof (jsonObj.roundFactor) !== "number")
        throw new QuantityError(QuantityStatus.InvalidJson, `The Format ${this.name} has an invalid 'roundFactor' attribute. It should be of type 'number'.`);
      if (jsonObj.roundFactor !== this.roundFactor) // if roundFactor isn't default value of 0.0, reassign roundFactor variable
        this._roundFactor = jsonObj.roundFactor;
    }

    if (undefined !== jsonObj.minWidth) { // optional
      if (typeof (jsonObj.minWidth) !== "number")
        throw new QuantityError(QuantityStatus.InvalidJson, `The Format ${this.name} has an invalid 'minWidth' attribute. It should be of type 'number'.`);
      if (!Number.isInteger(jsonObj.minWidth) || jsonObj.minWidth < 0) // must be a positive int
        throw new QuantityError(QuantityStatus.InvalidJson, `The Format ${this.name} has an invalid 'minWidth' attribute. It should be a positive integer.`);
      this._minWidth = jsonObj.minWidth;
    }

    if (undefined !== jsonObj.showSignOption) { // optional; default is "onlyNegative"
      if (typeof (jsonObj.showSignOption) !== "string")
        throw new QuantityError(QuantityStatus.InvalidJson, `The Format ${this.name} has an invalid 'showSignOption' attribute. It should be of type 'string'.`);
      this._showSignOption = Format.parseShowSignOption(jsonObj.showSignOption, this.name);
    }

    if (undefined !== jsonObj.formatTraits && jsonObj.formatTraits.length !== 0) { // FormatTraits is optional
      if (!Array.isArray(jsonObj.formatTraits) && typeof (jsonObj.formatTraits) !== "string") // must be either an array of strings or a string
        throw new QuantityError(QuantityStatus.InvalidJson, `The Format ${this.name} has an invalid 'formatTraits' attribute. It should be of type 'string' or 'string[]'.`);
      this.verifyFormatTraitsOptions(jsonObj.formatTraits); // check that all of the options for formatTraits are valid. If now, throw
    }

    if (undefined !== jsonObj.decimalSeparator) { // optional
      if (typeof (jsonObj.decimalSeparator) !== "string") // not a string or not a one character string
        throw new QuantityError(QuantityStatus.InvalidJson, `The Format ${this.name} has an invalid 'decimalSeparator' attribute. It should be of type 'string'.`);
      if (jsonObj.decimalSeparator.length !== 1)
        throw new QuantityError(QuantityStatus.InvalidJson, `The Format ${this.name} has an invalid 'decimalSeparator' attribute. It must be a one character string.`);
      this._decimalSeparator = jsonObj.decimalSeparator;
    }

    if (undefined !== jsonObj.thousandSeparator) { // optional
      if (typeof (jsonObj.thousandSeparator) !== "string")
        throw new QuantityError(QuantityStatus.InvalidJson, `The Format ${this.name} has an invalid 'thousandSeparator' attribute. It should be of type 'string'.`);
      if (jsonObj.thousandSeparator.length !== 1)
        throw new QuantityError(QuantityStatus.InvalidJson, `The Format ${this.name} has an invalid 'thousandSeparator' attribute. It must be a one character string.`);
      this._thousandSeparator = jsonObj.thousandSeparator;
    }

    if (undefined !== jsonObj.uomSeparator) { // optional; default is " "
      if (typeof (jsonObj.uomSeparator) !== "string")
        throw new QuantityError(QuantityStatus.InvalidJson, `The Format ${this.name} has an invalid 'uomSeparator' attribute. It should be of type 'string'.`);
      if (jsonObj.uomSeparator.length < 0 || jsonObj.uomSeparator.length > 1)
        throw new QuantityError(QuantityStatus.InvalidJson, `The Format ${this.name} has an invalid 'uomSeparator' attribute. It must be empty or a string with a single character.`);
      this._uomSeparator = jsonObj.uomSeparator;
    }

    if (undefined !== jsonObj.stationSeparator) { // optional; default is "+"
      if (typeof (jsonObj.stationSeparator) !== "string")
        throw new QuantityError(QuantityStatus.InvalidJson, `The Format ${this.name} has an invalid 'stationSeparator' attribute. It should be of type 'string'.`);
      if (jsonObj.stationSeparator.length !== 1)
        throw new QuantityError(QuantityStatus.InvalidJson, `The Format ${this.name} has an invalid 'stationSeparator' attribute. It must be a one character string.`);
      this._stationSeparator = jsonObj.stationSeparator;
    }
  }

  /**
   * Populates this Format with the values from the provided.
   */
  public async fromJson(unitsProvider: UnitsProvider, jsonObj: any): Promise<void> {
    this.loadFormatProperties(jsonObj);

    if (undefined !== jsonObj.composite) { // optional
      this._units = new Array<[UnitProps, string | undefined]>();
      if (jsonObj.composite.includeZero !== undefined) {
        if (typeof (jsonObj.composite.includeZero) !== "boolean") // includeZero must be a boolean IF it is defined
          return Promise.reject(new QuantityError(QuantityStatus.InvalidJson, `The Format ${this.name} has a Composite with an invalid 'includeZero' attribute. It should be of type 'boolean'.`));
        this._includeZero = jsonObj.composite.includeZero;
      }
      if (jsonObj.composite.spacer !== undefined) {  // spacer must be a string IF it is defined
        if (typeof (jsonObj.composite.spacer) !== "string")
          return Promise.reject(new QuantityError(QuantityStatus.InvalidJson, `The Format ${this.name} has a Composite with an invalid 'spacer' attribute. It must be of type 'string'.`));
        if (jsonObj.composite.spacer.length < 0 || jsonObj.composite.spacer.length > 1)
          return Promise.reject(new QuantityError(QuantityStatus.InvalidJson, `The Format ${this.name} has a Composite with an invalid 'spacer' attribute. It must be empty or a string with a single character.`));
        this._spacer = jsonObj.composite.spacer;
      }
      if (jsonObj.composite.units !== undefined) { // if composite is defined, it must be an array with 1-4 units
        if (!Array.isArray(jsonObj.composite.units)) { // must be an array
          return Promise.reject(new QuantityError(QuantityStatus.InvalidJson, `The Format ${this.name} has a Composite with an invalid 'units' attribute. It must be of type 'array'`));
        }
        if (jsonObj.composite.units.length > 0 && jsonObj.composite.units.length <= 4) { // Composite requires 1-4 units
          try {
            const createUnitPromises: Array<Promise<void>> = [];
            for (const unit of jsonObj.composite.units) {
              createUnitPromises.push(this.createUnit(unitsProvider, unit.name, unit.label));
            }

            await Promise.all(createUnitPromises);
          } catch (e) {
            return Promise.reject(e);
          }
        }
      }
      if (undefined === this.units || this.units.length === 0)
        return Promise.reject(new QuantityError(QuantityStatus.InvalidJson, `The Format ${this.name} has a Composite with no valid 'units'`));
    }
  }

  /**
   * Returns a JSON object that contain the specification for this Format.
   */
  public toJson() {
    const schemaJson: { [value: string]: any } = {};
    schemaJson.type = Format.formatTypeToString(this.type!);
    schemaJson.precision = this.precision;
    schemaJson.roundFactor = this.roundFactor;
    if (undefined !== this.minWidth) schemaJson.minWidth = this.minWidth;
    schemaJson.showSignOption = Format.showSignOptionToString(this.showSignOption);
    schemaJson.formatTraits = Format.formatTraitsToArray(this.formatTraits);
    schemaJson.decimalSeparator = this.decimalSeparator;
    schemaJson.thousandSeparator = this.thousandSeparator;
    schemaJson.uomSeparator = this.uomSeparator;
    if (undefined !== this.scientificType) schemaJson.scientificType = Format.scientificTypeToString(this.scientificType);
    if (undefined !== this.stationOffsetSize) schemaJson.stationOffsetSize = this.stationOffsetSize;
    schemaJson.stationSeparator = this.stationSeparator;
    if (undefined !== this.units) {
      const composite: { [value: string]: any } = {};
      composite.spacer = this.spacer;
      composite.includeZero = this.includeZero;
      composite.units = [];
      this.units.forEach((unit: any) => {
        if (undefined !== unit[1])
          composite.units.push({
            name: unit[0].name,
            label: unit[1],
          });
        else
          composite.units.push({
            name: unit[0].name,
          });
      });
      schemaJson.composite = composite;
    } else { }

    return schemaJson;
  }
}

/** Interface the defines the format of the data needed to convert a quantity from one unit to another. */
export interface UnitConversionSpec {
  name: string;
  label: string;
  conversion: UnitConversion;
}

/** A class that contains both formatting information and the conversion factors necessary to convert from an input unit to the units specified in the format. */
export class FormatterSpec {
  private _name = "";
  private _conversions: UnitConversionSpec[] = [];  // max four entries
  private _format: Format;

  /** Constructor
   *  @param name     The name of a format specification.
   *  @param format   Defines the output format for the quantity value.
   *  @param conversions An array of conversion factors necessary to convert from an input unit to the units specified in the format..
   */
  constructor(name: string, format: Format, conversions?: UnitConversionSpec[]) {
    this._name = name;
    this._format = format;
    if (conversions) this._conversions = conversions;
  }

  get name(): string { return this._name; }
  /** Returns an array of UnitConversionSpecs, one for each unit that is to be shown in the formatted quantity string. */
  get unitConversions(): UnitConversionSpec[] { return this._conversions; }
  get format(): Format { return this._format; }

  /** Static async method to create a FormatSpec given the format and unit of the quantity that will be passed to the Formatter. The input unit will
   * be used to generate conversion information for each unit specified in the Format. This method is async due to the fact that the units provider must make
   * async calls to lookup unit definitions.
   *  @param name     The name of a format specification.
   *  @param unitsProvider The units provider is used to look up unit definitions and provide conversion information for converting between units.
   *  @param inputUnit The unit the value to be formatted. This unit is often referred to as persistence unit.
   */
  public static async create(name: string, format: Format, unitsProvider: UnitsProvider, inputUnit?: UnitProps): Promise<FormatterSpec> {
    const conversions: UnitConversionSpec[] = [];

    if (format.units) {
      let convertFromUnit = inputUnit;
      for (const unit of format.units) {
        let unitConversion: UnitConversion;
        if (convertFromUnit) {
          unitConversion = await unitsProvider.getConversion(convertFromUnit, unit[0]);
        } else {
          unitConversion = ({ factor: 1.0, offset: 0.0 }) as UnitConversion;
        }
        const unitLabel = (unit[1] && unit[1]!.length > 0) ? unit[1]! : unit[0].label;
        const spec = ({ name: unit[0].name, label: unitLabel, conversion: unitConversion }) as UnitConversionSpec;

        conversions.push(spec);
        convertFromUnit = unit[0];
      }
    } else {
      // if format is only numeric and a input unit is defined set spec to use the input unit as the format unit
      if (inputUnit) {
        const spec: UnitConversionSpec = { name: inputUnit.name, label: inputUnit.label, conversion: { factor: 1.0, offset: 0.0 } };
        conversions.push(spec);
      }
    }

    return Promise.resolve(new FormatterSpec(name, format, conversions));
  }
}
