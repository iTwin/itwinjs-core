/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Quantity
 */

import { QuantityConstants } from "../Constants";
import { QuantityError, QuantityStatus } from "../Exception";
import { UnitProps, UnitsProvider } from "../Interfaces";
import {
  DecimalPrecision, FormatTraits, formatTraitsToArray, FormatType, FractionalPrecision,
  getTraitString, parseFormatTrait, parseFormatType, parsePrecision, parseRatioType, parseScientificType, parseShowSignOption,
  RatioType, ScientificType,
  ShowSignOption,
} from "./FormatEnums";
import { CloneOptions, CustomFormatProps, FormatProps, isCustomFormatProps } from "./Interfaces";

// cSpell:ignore ZERONORMALIZED, nosign, onlynegative, signalways, negativeparentheses
// cSpell:ignore trailzeroes, keepsinglezero, zeroempty, keepdecimalpoint, applyrounding, fractiondash, showunitlabel, prependunitlabel, exponentonlynegative

/** A base Format class with shared properties and functionality between quantity and ecschema-metadata Format classes
 * @beta
 */
export class BaseFormat {
  private _name = "";
  protected _roundFactor: number = 0.0;
  protected _type: FormatType = FormatType.Decimal; // required; options are decimal, fractional, scientific, station
  protected _precision: number = DecimalPrecision.Six; // required
  protected _showSignOption: ShowSignOption = ShowSignOption.OnlyNegative; // options: noSign, onlyNegative, signAlways, negativeParentheses
  protected _decimalSeparator: string = QuantityConstants.LocaleSpecificDecimalSeparator;
  protected _thousandSeparator: string = QuantityConstants.LocaleSpecificThousandSeparator;
  protected _uomSeparator = " "; // optional; default is " "; defined separator between magnitude and the unit
  protected _stationSeparator = "+"; // optional; default is "+"
  protected _formatTraits: FormatTraits = FormatTraits.Uninitialized;
  protected _spacer: string = " "; // optional; default is " "
  protected _includeZero: boolean = true; // optional; default is true
  protected _minWidth?: number; // optional; positive int
  protected _scientificType?: ScientificType; // required if type is scientific; options: normalized, zeroNormalized
  protected _stationOffsetSize?: number; // required when type is station; positive integer > 0
  protected _ratioType?: RatioType; // required if type is ratio; options: oneToN, NToOne, ValueBased, useGreatestCommonDivisor
  protected _azimuthBase?: number; // value always clockwise from north
  protected _azimuthBaseUnit?: UnitProps; // unit for azimuthBase value
  protected _azimuthCounterClockwise?: boolean; // if set to true, azimuth values are returned counter-clockwise from base
  protected _revolutionUnit?: UnitProps; // unit that represents a revolution, required for bearing or azimuth types
  protected _allowMathematicOperations: boolean = false; // optional; enables calculating mathematic operations like addition and subtraction; default is false.

  constructor(name: string) {
    this._name = name;
  }

  public get name(): string { return this._name; }

  public get roundFactor(): number { return this._roundFactor; }
  public set roundFactor(roundFactor: number) { this._roundFactor = roundFactor; }

  public get type(): FormatType { return this._type; }
  public set type(formatType: FormatType) { this._type = formatType; }

  public get precision(): DecimalPrecision | FractionalPrecision { return this._precision; }
  public set precision(precision: DecimalPrecision | FractionalPrecision) { this._precision = precision; }

  public get minWidth(): number | undefined { return this._minWidth; }
  public set minWidth(minWidth: number | undefined) { this._minWidth = minWidth; }

  public get scientificType(): ScientificType | undefined { return this._scientificType; }
  public set scientificType(scientificType: ScientificType | undefined) { this._scientificType = scientificType; }

  public get ratioType(): RatioType | undefined { return this._ratioType; }
  public set ratioType(ratioType: RatioType | undefined) { this._ratioType = ratioType; }

  public get showSignOption(): ShowSignOption { return this._showSignOption; }
  public set showSignOption(showSignOption: ShowSignOption) { this._showSignOption = showSignOption; }

  public get decimalSeparator(): string { return this._decimalSeparator; }
  public set decimalSeparator(decimalSeparator: string) { this._decimalSeparator = decimalSeparator; }

  public get thousandSeparator(): string { return this._thousandSeparator; }
  public set thousandSeparator(thousandSeparator: string) { this._thousandSeparator = thousandSeparator; }

  public get uomSeparator(): string { return this._uomSeparator; }
  public set uomSeparator(uomSeparator: string) { this._uomSeparator = uomSeparator; }

  public get stationSeparator(): string { return this._stationSeparator; }
  public set stationSeparator(stationSeparator: string) { this._stationSeparator = stationSeparator; }

  public get stationOffsetSize(): number | undefined { return this._stationOffsetSize; }
  public set stationOffsetSize(stationOffsetSize: number | undefined) { stationOffsetSize = this._stationOffsetSize = stationOffsetSize; }

  public get allowMathematicOperations(): boolean { return this._allowMathematicOperations; }
  public set allowMathematicOperations(allowMathematicOperations: boolean) { this._allowMathematicOperations = allowMathematicOperations; }

  public get formatTraits(): FormatTraits { return this._formatTraits; }
  public set formatTraits(formatTraits: FormatTraits) { this._formatTraits = formatTraits; }

  public get spacer(): string | undefined { return this._spacer; }
  public set spacer(spacer: string | undefined) { this._spacer = spacer ?? this._spacer; }
  public get spacerOrDefault(): string { return this._spacer ?? " "; }

  public get includeZero(): boolean | undefined { return this._includeZero; }
  public set includeZero(includeZero: boolean | undefined) { this._includeZero = includeZero ?? this._includeZero; }

  // default "north" is applied by the formatter (quarter rotation counter clockwise from east, the value depends on the units used)
  public get azimuthBase(): number | undefined { return this._azimuthBase; }
  public set azimuthBase(azimuthBase: number | undefined) { this._azimuthBase = azimuthBase; }

  public get azimuthBaseUnit(): UnitProps | undefined { return this._azimuthBaseUnit; }
  public set azimuthBaseUnit(azimuthBaseUnit: UnitProps | undefined) { this._azimuthBaseUnit = azimuthBaseUnit; }

  public get azimuthCounterClockwise(): boolean | undefined { return this._azimuthCounterClockwise; }
  public set azimuthCounterClockwise(azimuthCounterClockwise: boolean | undefined) { this._azimuthCounterClockwise = azimuthCounterClockwise; }
  public get azimuthClockwiseOrDefault(): boolean { return !this._azimuthCounterClockwise; }

  public get revolutionUnit(): UnitProps | undefined { return this._revolutionUnit; }
  public set revolutionUnit(revolutionUnit: UnitProps | undefined) { this._revolutionUnit = revolutionUnit; }

  /** This method parses input string that is typically extracted for persisted JSON data and validates that the string is a valid FormatType. Throws exception if not valid. */
  public parseFormatTraits(formatTraitsFromJson: string | string[]) {
    const formatTraits = (Array.isArray(formatTraitsFromJson)) ? formatTraitsFromJson : formatTraitsFromJson.split(/,|;|\|/);
    formatTraits.forEach((formatTraitsString: string) => { // for each element in the string array
      const formatTrait = parseFormatTrait(formatTraitsString, this.name);
      this._formatTraits = this.formatTraits | formatTrait;
    });
  }

  /** This method returns true if the formatTrait is set in this Format object. */
  public hasFormatTraitSet(formatTrait: FormatTraits): boolean {
    return (this._formatTraits & formatTrait) === formatTrait;
  }

  public loadFormatProperties(formatProps: FormatProps) {
    this._type = parseFormatType(formatProps.type, this.name);

    if (formatProps.precision !== undefined) {
      if (!Number.isInteger(formatProps.precision)) // mut be an integer
        throw new QuantityError(QuantityStatus.InvalidJson, `The Format ${this.name} has an invalid 'precision' attribute. It should be an integer.`);

      this._precision = parsePrecision(formatProps.precision, this._type, this.name);
    }
    if (this.type === FormatType.Scientific) {
      if (undefined === formatProps.scientificType) // if format type is scientific and scientific type is undefined, throw
        throw new QuantityError(QuantityStatus.InvalidJson, `The Format ${this.name} is 'Scientific' type therefore the attribute 'scientificType' is required.`);

      this._scientificType = parseScientificType(formatProps.scientificType, this.name);
    }

    if (this.type === FormatType.Ratio){
      if (undefined === formatProps.ratioType)
        throw new QuantityError(QuantityStatus.InvalidJson, `The Format ${this.name} is 'Ratio' type therefore the attribute 'ratioType' is required.`);

      this._ratioType = parseRatioType(formatProps.ratioType, this.name);
    }

    if (undefined !== formatProps.roundFactor) { // optional; default is 0.0
      if (typeof (formatProps.roundFactor) !== "number")
        throw new QuantityError(QuantityStatus.InvalidJson, `The Format ${this.name} has an invalid 'roundFactor' attribute. It should be of type 'number'.`);
      if (formatProps.roundFactor !== this.roundFactor) // if roundFactor isn't default value of 0.0, reassign roundFactor variable
        this._roundFactor = formatProps.roundFactor;
    }

    if (undefined !== formatProps.minWidth) { // optional
      if (!Number.isInteger(formatProps.minWidth) || formatProps.minWidth < 0) // must be a positive int
        throw new QuantityError(QuantityStatus.InvalidJson, `The Format ${this.name} has an invalid 'minWidth' attribute. It should be a positive integer.`);
      this._minWidth = formatProps.minWidth;
    }
    if (FormatType.Station === this.type) {
      if (undefined === formatProps.stationOffsetSize)
        throw new QuantityError(QuantityStatus.InvalidJson, `The Format ${this.name} is 'Station' type therefore the attribute 'stationOffsetSize' is required.`);
      if (!Number.isInteger(formatProps.stationOffsetSize) || formatProps.stationOffsetSize < 0) // must be a positive int > 0
        throw new QuantityError(QuantityStatus.InvalidJson, `The Format ${this.name} has an invalid 'stationOffsetSize' attribute. It should be a positive integer.`);
      this._stationOffsetSize = formatProps.stationOffsetSize;
    }

    if (undefined !== formatProps.showSignOption) { // optional; default is "onlyNegative"
      this._showSignOption = parseShowSignOption(formatProps.showSignOption, this.name);
    }

    if (undefined !== formatProps.formatTraits && formatProps.formatTraits.length !== 0) { // FormatTraits is optional
      if (!Array.isArray(formatProps.formatTraits) && typeof (formatProps.formatTraits) !== "string") // must be either an array of strings or a string
        throw new QuantityError(QuantityStatus.InvalidJson, `The Format ${this.name} has an invalid 'formatTraits' attribute. It should be of type 'string' or 'string[]'.`);
      this.parseFormatTraits(formatProps.formatTraits); // check that all of the options for formatTraits are valid. If now, throw
    }

    if (undefined !== formatProps.decimalSeparator) { // optional
      if (typeof (formatProps.decimalSeparator) !== "string") // not a string or not a one character string
        throw new QuantityError(QuantityStatus.InvalidJson, `The Format ${this.name} has an invalid 'decimalSeparator' attribute. It should be of type 'string'.`);
      if (formatProps.decimalSeparator.length > 1)
        throw new QuantityError(QuantityStatus.InvalidJson, `The Format ${this.name} has an invalid 'decimalSeparator' attribute. It should be an empty or one character string.`);
      this._decimalSeparator = formatProps.decimalSeparator;
    }

    if (undefined !== formatProps.thousandSeparator) { // optional
      if (typeof (formatProps.thousandSeparator) !== "string")
        throw new QuantityError(QuantityStatus.InvalidJson, `The Format ${this.name} has an invalid 'thousandSeparator' attribute. It should be of type 'string'.`);
      if (formatProps.thousandSeparator.length > 1)
        throw new QuantityError(QuantityStatus.InvalidJson, `The Format ${this.name} has an invalid 'thousandSeparator' attribute. It should be an empty or one character string.`);
      this._thousandSeparator = formatProps.thousandSeparator;
    }

    if (undefined !== formatProps.uomSeparator) { // optional; default is " "
      if (typeof (formatProps.uomSeparator) !== "string")
        throw new QuantityError(QuantityStatus.InvalidJson, `The Format ${this.name} has an invalid 'uomSeparator' attribute. It should be of type 'string'.`);
      if (formatProps.uomSeparator.length < 0 || formatProps.uomSeparator.length > 1)
        throw new QuantityError(QuantityStatus.InvalidJson, `The Format ${this.name} has an invalid 'uomSeparator' attribute. It should be an empty or one character string.`);
      this._uomSeparator = formatProps.uomSeparator;
    }

    if (undefined !== formatProps.stationSeparator) { // optional; default is "+"
      if (typeof (formatProps.stationSeparator) !== "string")
        throw new QuantityError(QuantityStatus.InvalidJson, `The Format ${this.name} has an invalid 'stationSeparator' attribute. It should be of type 'string'.`);
      if (formatProps.stationSeparator.length > 1)
        throw new QuantityError(QuantityStatus.InvalidJson, `The Format ${this.name} has an invalid 'stationSeparator' attribute. It should be an empty or one character string.`);
      this._stationSeparator = formatProps.stationSeparator;
    }

    if (undefined !== formatProps.azimuthBase) { // optional; default is a quarter rotation (90 degrees) which represents north
      if (typeof (formatProps.azimuthBase) !== "number")
        throw new QuantityError(QuantityStatus.InvalidJson, `The Format ${this.name} has an invalid 'azimuthBase' attribute. It should be of type 'number'.`);
      this._azimuthBase = formatProps.azimuthBase;
    }

    if (undefined !== formatProps.azimuthCounterClockwise) { // optional; default is false
      if (typeof (formatProps.azimuthCounterClockwise) !== "boolean")
        throw new QuantityError(QuantityStatus.InvalidJson, `The Format ${this.name} has an invalid 'azimuthCounterClockwise' attribute. It should be of type 'boolean'.`);
      this._azimuthCounterClockwise = formatProps.azimuthCounterClockwise;
    }
    if (undefined !== formatProps.allowMathematicOperations) { // optional; default is false
      if (typeof (formatProps.allowMathematicOperations) !== "boolean")
        throw new QuantityError(QuantityStatus.InvalidJson, `The Format ${this.name} has an invalid 'allowMathematicOperations' attribute. It should be of type 'boolean'.`);
      this._allowMathematicOperations = formatProps.allowMathematicOperations;
    }
  }
}

/** A class used to define the specifications for formatting quantity values. This class is typically loaded by reading [[FormatProps]].
 * @beta
 */
export class Format extends BaseFormat {
  protected _units?: Array<[UnitProps, string | undefined]>;
  protected _customProps?: any;  // used by custom formatters and parsers

  /** Constructor
   *  @param name     The name of a format specification. TODO: make optional or remove
   */
  constructor(name: string) {
    super(name);
  }

  public get units(): Array<[UnitProps, string | undefined]> | undefined { return this._units; }
  public get hasUnits(): boolean { return this._units !== undefined && this._units.length > 0; }
  public get customProps(): any { return this._customProps; }

  public static isFormatTraitSetInProps(formatProps: FormatProps, trait: FormatTraits) {
    if (!formatProps.formatTraits)
      return false;
    const formatTraits = Array.isArray(formatProps.formatTraits) ? formatProps.formatTraits : formatProps.formatTraits.split(/,|;|\|/);
    const traitStr = getTraitString(trait);
    return formatTraits.find((traitEntry) => traitStr === traitEntry) ? true : false;
  }

  private async createUnit(unitsProvider: UnitsProvider, name: string, label?: string): Promise<void> {
    if (name === undefined || typeof (name) !== "string" || (label !== undefined && typeof (label) !== "string")) // throws if name is undefined or name isn't a string or if label is defined and isn't a string
      throw new QuantityError(QuantityStatus.InvalidJson, `This Composite has a unit with an invalid 'name' or 'label' attribute.`);
    for (const unit of this.units!) {
      const unitObj = unit[0].name;
      if (unitObj.toLowerCase() === name.toLowerCase()) // duplicate names are not allowed
        throw new QuantityError(QuantityStatus.InvalidJson, `The unit ${unitObj} has a duplicate name.`);
    }
    const newUnit: UnitProps = await unitsProvider.findUnitByName(name);
    if (!newUnit || !newUnit.isValid)
      throw new QuantityError(QuantityStatus.InvalidJson, `Invalid unit name '${name}'.`);
    this.units!.push([newUnit, label]);
  }

  /**
   *  Clone Format
   */
  public clone(options?: CloneOptions): Format {
    const newFormat = new Format(this.name);
    newFormat._roundFactor = this._roundFactor;
    newFormat._type = this._type;
    newFormat._precision = this._precision;
    newFormat._minWidth = this._minWidth;
    newFormat._scientificType = this._scientificType;
    newFormat._showSignOption = this._showSignOption;
    newFormat._decimalSeparator = this._decimalSeparator;
    newFormat._thousandSeparator = this._thousandSeparator;
    newFormat._uomSeparator = this._uomSeparator;
    newFormat._stationSeparator = this._stationSeparator;
    newFormat._stationOffsetSize = this._stationOffsetSize;
    newFormat._formatTraits = this._formatTraits;
    newFormat._spacer = this._spacer;
    newFormat._includeZero = this._includeZero;
    newFormat._azimuthBase = this._azimuthBase;
    newFormat._azimuthBaseUnit = this._azimuthBaseUnit;
    newFormat._azimuthCounterClockwise = this._azimuthCounterClockwise;
    newFormat._ratioType = this._ratioType;
    newFormat._revolutionUnit = this._revolutionUnit;
    newFormat._customProps = this._customProps;
    this._units && (newFormat._units = [...this._units]);

    if (newFormat._units) {
      if (options?.showOnlyPrimaryUnit) {
        if (newFormat._units.length > 1)
          newFormat._units.length = 1;
      }
    }

    if (undefined !== options?.traits)
      newFormat._formatTraits = options?.traits;

    if (undefined !== options?.type)
      newFormat._type = options.type;

    if (undefined !== options?.precision) {
      // ensure specified precision is valid
      const precision = parsePrecision(options?.precision, newFormat._type, newFormat.name);
      newFormat._precision = precision;
    }

    if (undefined !== options?.primaryUnit) {
      if (options.primaryUnit.unit) {
        const newUnits = new Array<[UnitProps, string | undefined]>();
        newUnits.push([options.primaryUnit.unit, options.primaryUnit.label]);
        newFormat._units = newUnits;
      } else if (options.primaryUnit.label && newFormat._units?.length) {
        // update label only
        newFormat._units[0][1] = options.primaryUnit.label;
      }
    }
    return newFormat;
  }

  /**
   * Populates this Format with the values from the provided.
   */
  public async fromJSON(unitsProvider: UnitsProvider, jsonObj: FormatProps): Promise<void> {
    this.loadFormatProperties(jsonObj);

    if (isCustomFormatProps(jsonObj))
      this._customProps = jsonObj.custom;

    if (undefined !== jsonObj.composite) { // optional
      this._units = new Array<[UnitProps, string | undefined]>();
      if (jsonObj.composite.includeZero !== undefined) {
        if (typeof (jsonObj.composite.includeZero) !== "boolean") // includeZero must be a boolean IF it is defined
          throw new QuantityError(QuantityStatus.InvalidJson, `The Format ${this.name} has a Composite with an invalid 'includeZero' attribute. It should be of type 'boolean'.`);
        this._includeZero = jsonObj.composite.includeZero;
      }
      if (jsonObj.composite.spacer !== undefined) {  // spacer must be a string IF it is defined
        if (typeof (jsonObj.composite.spacer) !== "string")
          throw new QuantityError(QuantityStatus.InvalidJson, `The Format ${this.name} has a Composite with an invalid 'spacer' attribute. It must be of type 'string'.`);
        if (jsonObj.composite.spacer.length > 1)
          throw new QuantityError(QuantityStatus.InvalidJson, `The Format ${this.name} has a Composite with an invalid 'spacer' attribute. It should be an empty or one character string.`);
        this._spacer = jsonObj.composite.spacer;
      }
      if (jsonObj.composite.units !== undefined) { // if composite is defined, it must be an array with 1-4 units
        if (!Array.isArray(jsonObj.composite.units)) { // must be an array
          throw new QuantityError(QuantityStatus.InvalidJson, `The Format ${this.name} has a Composite with an invalid 'units' attribute. It must be of type 'array'`);
        }
        if (jsonObj.composite.units.length > 0 && jsonObj.composite.units.length <= 4) { // Composite requires 1-4 units
          try {
            const createUnitPromises: Array<Promise<void>> = [];
            for (const unit of jsonObj.composite.units) {
              createUnitPromises.push(this.createUnit(unitsProvider, unit.name, unit.label));
            }

            await Promise.all(createUnitPromises);
          } catch (e) {
            throw e;
          }
        }
      }
      if (undefined === this.units || this.units.length === 0)
        throw new QuantityError(QuantityStatus.InvalidJson, `The Format ${this.name} has a Composite with no valid 'units'`);
    }

    if(this.type === FormatType.Azimuth || this.type === FormatType.Bearing) {
      // these units cannot be loaded from loadFormatProperties() because they require an async call, and the method signature is already public

      if (undefined !== jsonObj.azimuthBaseUnit) {
        if (typeof (jsonObj.azimuthBaseUnit) !== "string")
          throw new QuantityError(QuantityStatus.InvalidJson, `The Format ${this.name} has an invalid 'azimuthBaseUnit' attribute. It should be of type 'string'.`);

        const baseUnit: UnitProps = await unitsProvider.findUnitByName(jsonObj.azimuthBaseUnit);
        if (!baseUnit || !baseUnit.isValid)
          throw new QuantityError(QuantityStatus.InvalidJson, `Invalid unit name '${jsonObj.azimuthBaseUnit}' for azimuthBaseUnit in Format '${this.name}'.`);

        this._azimuthBaseUnit = baseUnit;
      }

      if (undefined !== jsonObj.revolutionUnit) {
        if (typeof (jsonObj.revolutionUnit) !== "string")
          throw new QuantityError(QuantityStatus.InvalidJson, `The Format ${this.name} has an invalid 'revolutionUnit' attribute. It should be of type 'string'.`);

        const revolutionUnit: UnitProps = await unitsProvider.findUnitByName(jsonObj.revolutionUnit);
        if (!revolutionUnit || !revolutionUnit.isValid)
          throw new QuantityError(QuantityStatus.InvalidJson, `Invalid unit name '${jsonObj.revolutionUnit}' for revolutionUnit in Format '${this.name}'.`);

        this._revolutionUnit = revolutionUnit;
      }

      if (this._revolutionUnit === undefined)
        throw new QuantityError(QuantityStatus.InvalidJson, `The Format ${this.name} is 'Azimuth' or 'Bearing' type therefore the attribute 'revolutionUnit' is required.`);
      if (this._azimuthBase !== undefined && this._azimuthBaseUnit === undefined)
        throw new QuantityError(QuantityStatus.InvalidJson, `The Format ${this.name} has an 'azimuthBase' attribute therefore the attribute 'azimuthBaseUnit' is required.`);
    }
  }

  /** Create a Format from FormatProps */
  public static async createFromJSON(name: string, unitsProvider: UnitsProvider, formatProps: FormatProps) {
    const actualFormat = new Format(name);
    await actualFormat.fromJSON(unitsProvider, formatProps);
    return actualFormat;
  }

  /**
   * Returns a JSON object that contain the specification for this Format.
   */
  public toJSON(): FormatProps {
    let composite;
    if (this.units) {
      const units = this.units.map((value) => {
        if (undefined !== value[1])
          return { name: value[0].name, label: value[1] };
        else
          return { name: value[0].name };
      });

      composite = {
        spacer: this.spacer,
        includeZero: this.includeZero,
        units,
      };
    }

    const azimuthBaseUnit = this.azimuthBaseUnit ? this.azimuthBaseUnit.name : undefined;
    const revolutionUnit = this.revolutionUnit ? this.revolutionUnit.name : undefined;

    const baseFormatProps: FormatProps = {
      type: this.type,
      precision: this.precision,
      roundFactor: this.roundFactor,
      minWidth: this.minWidth,
      showSignOption: this.showSignOption,
      formatTraits: formatTraitsToArray(this.formatTraits),
      decimalSeparator: this.decimalSeparator,
      thousandSeparator: this.thousandSeparator,
      uomSeparator: this.uomSeparator,
      scientificType: this.scientificType ? this.scientificType : undefined,
      ratioType: this.ratioType,
      stationOffsetSize: this.stationOffsetSize,
      stationSeparator: this.stationSeparator,
      azimuthBase: this.azimuthBase,
      azimuthBaseUnit,
      azimuthCounterClockwise: this.azimuthCounterClockwise,
      revolutionUnit,
      composite,
    };

    if (this.customProps)
      return {
        ...baseFormatProps,
        custom: this.customProps,
      } as CustomFormatProps;

    return baseFormatProps;
  }
}
