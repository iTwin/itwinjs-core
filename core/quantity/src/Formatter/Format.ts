/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/
import { FormatProps } from "./Interfaces";
import { UnitProps, UnitsProvider } from "../Interfaces";
import { QuantityStatus, QuantityError } from "../Exception";
import { QuantityConstants } from "../Constants";
import {
  FormatType, ScientificType, ShowSignOption, DecimalPrecision, FractionalPrecision, FormatTraits,
  parseFormatTrait, parseFormatType, parsePrecision, parseScientificType, parseShowSignOption, formatTypeToString,
  showSignOptionToString, formatTraitsToArray, scientificTypeToString,
} from "./FormatEnums";

/** A class use to both define the specifications for formatting a quantity values and the methods to do the formatting. */
export class Format implements FormatProps {
  private _name = "";
  private _unitsProvider: UnitsProvider;
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
   *  @param unitsProvider   A class that will lookup units by their unique name and provide conversion between units.
   */
  constructor(name: string, unitsProvider: UnitsProvider) {
    this._name = name;
    this._unitsProvider = unitsProvider;
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
  get unitsProvider(): UnitsProvider { return this._unitsProvider; }
  get hasComposite(): boolean { return this._units !== undefined && this._units.length > 0; }

  private verifyFormatTraitsOptions(formatTraitsFromJson: string | string[]) {
    const formatTraits = (Array.isArray(formatTraitsFromJson)) ? formatTraitsFromJson : formatTraitsFromJson.split(/,|;|\|/);
    formatTraits.forEach((formatTraitsString: string) => { // for each element in the string array
      this._formatTraits = parseFormatTrait(formatTraitsString.toLowerCase(), this.formatTraits);
    });
  }

  public hasFormatTraitSet(formatTrait: FormatTraits): boolean {
    return (this._formatTraits & formatTrait) === formatTrait;
  }

  private async createUnit(name: string, label?: string): Promise<void> {
    let newUnit: UnitProps | undefined;
    if (name === undefined || typeof (name) !== "string" || (label !== undefined && typeof (label) !== "string")) // throws if name is undefined or name isn't a string or if label is defined and isn't a string
      return Promise.reject(new QuantityError(QuantityStatus.InvalidJson, `This Composite has a unit with an invalid 'name' or 'label' attribute.`));
    for (const unit of this.units!) {
      const unitObj = unit[0].name;
      if (unitObj.toLowerCase() === name.toLowerCase()) // duplicate names are not allowed
        return Promise.reject(new QuantityError(QuantityStatus.InvalidJson, `The unit ${unitObj} has a duplicate name.`));
    }
    newUnit = await this.unitsProvider.findUnit(name);
    if (!newUnit || !newUnit.isValid)
      return Promise.reject(new QuantityError(QuantityStatus.InvalidJson, `Invalid unit name '${name}'.`));
    this.units!.push([newUnit, label]);
  }

  private loadFormatProperties(jsonObj: any) {
    if (undefined === jsonObj.type) // type is required
      throw new QuantityError(QuantityStatus.InvalidJson, `The Format ${this.name} does not have the required 'type' attribute.`);
    if (typeof (jsonObj.type) !== "string")
      throw new QuantityError(QuantityStatus.InvalidJson, `The Format ${this.name} has an invalid 'type' attribute. It should be of type 'string'.`);
    this._type = parseFormatType(jsonObj.type.toLowerCase(), this.name);

    if (undefined === jsonObj.precision) // precision is required
      throw new QuantityError(QuantityStatus.InvalidJson, `The Format ${this.name} does not have the required 'precision' attribute.`);
    else if (typeof (jsonObj.precision) !== "number") // must be a number
      throw new QuantityError(QuantityStatus.InvalidJson, `The Format ${this.name} has an invalid 'precision' attribute. It should be of type 'number'.`);
    else if (!Number.isInteger(jsonObj.precision)) // must be an integer
      throw new QuantityError(QuantityStatus.InvalidJson, `The Format ${this.name} has an invalid 'precision' attribute. It should be an integer.`);
    this._precision = parsePrecision(jsonObj.precision, this.name, this._type as FormatType);

    if (this.type === FormatType.Scientific) {
      if (undefined === jsonObj.scientificType) // if format type is scientific and scientific type is undefined, throw
        throw new QuantityError(QuantityStatus.InvalidJson, `The Format ${this.name} has type 'Scientific' therefore attribute 'scientificType' is required.`);
      if (typeof (jsonObj.scientificType) !== "string")
        throw new QuantityError(QuantityStatus.InvalidJson, `The Format ${this.name} has an invalid 'scientificType' attribute. It should be of type 'string'.`);
      this._scientificType = parseScientificType(jsonObj.scientificType.toLowerCase(), this.name);
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
      this._showSignOption = parseShowSignOption(jsonObj.showSignOption.toLowerCase(), this.name);
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
  public async fromJson(jsonObj: any): Promise<void> {
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
            for (const unit of jsonObj.composite.units) {
              await this.createUnit(unit.name, unit.label); // create the unit
            }
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
    schemaJson.type = formatTypeToString(this.type!);
    schemaJson.precision = this.precision;
    schemaJson.roundFactor = this.roundFactor;
    if (undefined !== this.minWidth) schemaJson.minWidth = this.minWidth;
    schemaJson.showSignOption = showSignOptionToString(this.showSignOption);
    schemaJson.formatTraits = formatTraitsToArray(this.formatTraits);
    schemaJson.decimalSeparator = this.decimalSeparator;
    schemaJson.thousandSeparator = this.thousandSeparator;
    schemaJson.uomSeparator = this.uomSeparator;
    if (undefined !== this.scientificType) schemaJson.scientificType = scientificTypeToString(this.scientificType);
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
