/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/
import SchemaItem from "./SchemaItem";
import { ECObjectsError, ECObjectsStatus } from "../Exception";
import { SchemaItemType } from "../ECObjects";
import { SchemaItemVisitor } from "../Interfaces";
import Schema from "./Schema";
import Unit from "./Unit";
import InvertedUnit from "./InvertedUnit";
import { FormatType, ScientificType, ShowSignOption, DecimalPrecision, FractionalPrecision, FormatTraits,
        parseFormatTrait, parseFormatType, parsePrecision, parseScientificType, parseShowSignOption } from "../utils/FormatEnums";

export default class Format extends SchemaItem {
  public readonly schemaItemType!: SchemaItemType.Format; // tslint:disable-line
  protected _roundFactor: number = 0.0;
  protected _type?: FormatType; // required; options are decimal, frational, scientific, station
  protected _precision?: number; // required
  protected _minWidth?: number; // optional; positive int
  protected _scientificType?: ScientificType; // required if type is scientific; options: normalized, zeroNormalized
  protected _showSignOption: ShowSignOption = ShowSignOption.OnlyNegative; // options: noSign, onlyNegative, signAlways, negativeParentheses
  protected _decimalSeparator: string = "."; // optional; default is based on current locale.... TODO: Default is based on current locale
  protected _thousandSeparator: string = ","; // optional; default is based on current locale.... TODO: Default is based on current locale
  protected _uomSeparator = " "; // optional; default is " "; defined separator between magnitude and the unit
  protected _stationSeparator = "+"; // optional; default is "+"
  protected _stationOffsetSize?: number; // required when type is station; positive integer > 0
  protected _formatTraits = 0x0;
  protected _spacer: string = " "; // optional; default is " "
  protected _includeZero: boolean = true; // optional; default is true
  protected _units?: Array<[Unit | InvertedUnit, string | undefined]>;

  constructor(schema: Schema, name: string) {
    super(schema, name);
    this.schemaItemType = SchemaItemType.Format;
  }

  get roundFactor(): number { return this._roundFactor; }
  get type(): FormatType | undefined { return this._type; }
  get precision(): DecimalPrecision | FractionalPrecision | undefined { return this._precision; }
  get minWidth(): number | undefined { return this._minWidth; }
  get scientificType(): ScientificType | undefined { return this._scientificType; }
  get showSignOption(): ShowSignOption { return this._showSignOption; }
  get decimalSeparator(): string { return this._decimalSeparator; }
  get thousandSeparator(): string { return this._thousandSeparator; }
  get uomSeparator(): string  { return this._uomSeparator; }
  get stationSeparator(): string  { return this._stationSeparator; }
  get stationOffsetSize(): number | undefined { return this._stationOffsetSize; }
  get formatTraits(): FormatTraits { return this._formatTraits; }
  get spacer(): string { return this._spacer; }
  get includeZero(): boolean { return this._includeZero; }
  get units(): Array<[Unit | InvertedUnit, string | undefined]> | undefined  { return this._units; }

  private verifyFormatTraitsOptions(formatTraitsFromJson: string | string[]) {
    const formatTraits = (Array.isArray(formatTraitsFromJson)) ? formatTraitsFromJson : formatTraitsFromJson.split(/,|;|\|/);
    formatTraits.forEach((formatTraitsString: string) => { // for each element in the string array
      this._formatTraits = parseFormatTrait(formatTraitsString.toLowerCase(), this.formatTraits);
    });
  }

  public hasFormatTrait(formatTrait: FormatTraits) {
    return (this._formatTraits & formatTrait) === formatTrait;
  }

  protected setUnits(units: Array<[Unit | InvertedUnit, string | undefined]> | undefined) {
    // TODO: Need to do validation
    this._units = units;
  }
  protected setPrecision(precision: number | undefined) { this._precision = precision; }

  /**
   * Creates a Unit with the provided name and label and adds it to this unit array
   * @param name The name of the Unit
   * @param label A localized display label that is used instead of the name in a GUI.
   */
  private createUnitSync(name: string, label?: string) {
    let newUnit: Unit | InvertedUnit | undefined;
    if (name === undefined || typeof(name) !== "string" || (label !== undefined && typeof(label) !== "string")) // throws if name is undefined or name isnt a string or if label is defined and isnt a string
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `This Composite has a unit with an invalid 'name' or 'label' attribute.`);
    for (const unit of this.units!) {
      const unitObj = unit[0].name;
      if (unitObj.toLowerCase() === (name.split(".")[1]).toLowerCase()) // no duplicate names- take unit name after "."
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The unit ${unitObj} has a duplicate name.`);
    }
    newUnit = this.schema.lookupItemSync<Unit | InvertedUnit>(name);
    if (!newUnit)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, ``);
    this.units!.push([newUnit, label]);
  }

  private async createUnit(name: string, label?: string) {
    let newUnit: Unit | InvertedUnit | undefined;
    if (name === undefined || typeof(name) !== "string" || (label !== undefined && typeof(label) !== "string")) // throws if name is undefined or name isnt a string or if label is defined and isnt a string
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `This Composite has a unit with an invalid 'name' or 'label' attribute.`);
    for ( const unit of this.units! ) {
      const unitObj = unit[0].name;
      if (unitObj.toLowerCase() === (name.split(".")[1]).toLowerCase()) // duplicate names are not allowed- take unit name after "."
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The unit ${unitObj} has a duplicate name.`);
    }
    newUnit = await this.schema.lookupItem<Unit | InvertedUnit>(name);
    if (!newUnit)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, ``);
    this.units!.push([newUnit, label]);
  }

  private loadFormatProperties(jsonObj: any) {
    if (undefined === jsonObj.type) // type is required
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${this.name} does not have the required 'type' attribute.`);
    if (typeof(jsonObj.type) !== "string")
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${this.name} has an invalid 'type' attribute. It should be of type 'string'.`);
    this._type = parseFormatType(jsonObj.type.toLowerCase(), this.name);

    if (undefined === jsonObj.precision) // precision is required
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${this.name} does not have the required 'precision' attribute.`);
    else if (typeof(jsonObj.precision) !== "number") // must be a number
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${this.name} has an invalid 'precision' attribute. It should be of type 'number'.`);
    else if (!Number.isInteger(jsonObj.precision)) // must be an integer
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${this.name} has an invalid 'precision' attribute. It should be an integer.`);
    this._precision = parsePrecision(jsonObj.precision, this.name, this._type as FormatType);

    if (this.type === FormatType.Scientific) {
      if (undefined === jsonObj.scientificType) // if format type is scientific and scientific type is undefined, throw
       throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${this.name} has type 'Scientific' therefore attribute 'scientificType' is required.`);
      if (typeof(jsonObj.scientificType) !== "string")
       throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${this.name} has an invalid 'scientificType' attribute. It should be of type 'string'.`);
      this._scientificType = parseScientificType(jsonObj.scientificType.toLowerCase(), this.name);
    }

    if (this.type === FormatType.Station) {
      if (undefined === jsonObj.stationOffsetSize)
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${this.name} has type 'Station' therefore attribute 'stationOffsetSize' is required.`);
      if (typeof(jsonObj.stationOffsetSize) !== "number")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${this.name} has an invalid 'stationOffsetSize' attribute. It should be of type 'number'.`);
      if (!Number.isInteger(jsonObj.stationOffsetSize) || jsonObj.stationOffsetSize < 0) // must be a positive int > 0
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${this.name} has an invalid 'stationOffsetSize' attribute. It should be a positive integer.`);
      this._stationOffsetSize = jsonObj.stationOffsetSize;
    }

    if (undefined !== jsonObj.roundFactor) { // optional; default is 0.0
      if (typeof(jsonObj.roundFactor) !== "number")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${this.name} has an invalid 'roundFactor' attribute. It should be of type 'number'.`);
      if (jsonObj.roundFactor !== this.roundFactor) // if roundFactor isnt default value of 0.0, reassign roundFactor variable
        this._roundFactor = jsonObj.roundFactor;
    }

    if (undefined !== jsonObj.minWidth) { // optional
      if (typeof(jsonObj.minWidth) !== "number")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${this.name} has an invalid 'minWidth' attribute. It should be of type 'number'.`);
      if (!Number.isInteger(jsonObj.minWidth) || jsonObj.minWidth < 0) // must be a positive int
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${this.name} has an invalid 'minWidth' attribute. It should be a positive integer.`);
      this._minWidth = jsonObj.minWidth;
    }

    if (undefined !== jsonObj.showSignOption) { // optional; default is "onlyNegative"
      if (typeof(jsonObj.showSignOption) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${this.name} has an invalid 'showSignOption' attribute. It should be of type 'string'.`);
      this._showSignOption = parseShowSignOption(jsonObj.showSignOption.toLowerCase(), this.name);
  }

    if (undefined !== jsonObj.formatTraits && jsonObj.formatTraits.length !== 0) { // FormatTraits is optional
      if (!Array.isArray(jsonObj.formatTraits) && typeof(jsonObj.formatTraits) !== "string") // must be either an array of strings or a string
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${this.name} has an invalid 'formatTraits' attribute. It should be of type 'string' or 'string[]'.`);
      this.verifyFormatTraitsOptions(jsonObj.formatTraits); // check that all of the options for formatTraits are valid. If now, throw
    }

    if (undefined !== jsonObj.decimalSeparator) { // optional
      if (typeof(jsonObj.decimalSeparator) !== "string") // not a string or not a one character string
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${this.name} has an invalid 'decimalSeparator' attribute. It should be of type 'string'.`);
      if (jsonObj.decimalSeparator.length !== 1)
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${this.name} has an invalid 'decimalSeparator' attribute. It must be a one character string.`);
      this._decimalSeparator = jsonObj.decimalSeparator;
    }

    if (undefined !== jsonObj.thousandSeparator) { // optional
      if (typeof(jsonObj.thousandSeparator) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${this.name} has an invalid 'thousandSeparator' attribute. It should be of type 'string'.`);
      if (jsonObj.thousandSeparator.length !== 1)
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${this.name} has an invalid 'thousandSeparator' attribute. It must be a one character string.`);
      this._thousandSeparator = jsonObj.thousandSeparator;
    }

    if (undefined !== jsonObj.uomSeparator) { // optional; default is " "
      if (typeof(jsonObj.uomSeparator) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${this.name} has an invalid 'uomSeparator' attribute. It should be of type 'string'.`);
      if (jsonObj.uomSeparator.length !== 1)
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${this.name} has an invalid 'uomSeparator' attribute. It must be a one character string.`);
      this._uomSeparator = jsonObj.uomSeparator;
    }

    if (undefined !== jsonObj.stationSeparator) { // optional; default is "+"
      if (typeof(jsonObj.stationSeparator) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${this.name} has an invalid 'stationSeparator' attribute. It should be of type 'string'.`);
      if (jsonObj.stationSeparator.length !== 1)
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${this.name} has an invalid 'stationSeparator' attribute. It must be a one character string.`);
      this._stationSeparator = jsonObj.stationSeparator;
    }
  }

  /**
   * Populates this Format with the values from the provided.
   */
  public async fromJson(jsonObj: any): Promise<void> {
    await super.fromJson(jsonObj);
    this.loadFormatProperties(jsonObj);
    if (undefined !== jsonObj.composite) { // optional
      this._units = new Array<[Unit | InvertedUnit, string | undefined]>();
      if (jsonObj.composite.includeZero !== undefined) {
        if (typeof(jsonObj.composite.includeZero) !== "boolean") // includeZero must be a boolean IF it is defined
          throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${this.name} has a Composite with an invalid 'includeZero' attribute. It should be of type 'boolean'.`);
        this._includeZero = jsonObj.composite.includeZero;
      }
      if (jsonObj.composite.spacer !== undefined) {  // spacer must be a string IF it is defined
        if (typeof(jsonObj.composite.spacer) !== "string")
          throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${this.name} has a Composite with an invalid 'spacer' attribute. It must be of type 'string'.`);
        if (jsonObj.composite.spacer.length !== 1) // spacer must be a one character string
          throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${this.name} has a Composite with an invalid 'spacer' attribute. It must be a one character string.`);
        this._spacer = jsonObj.composite.spacer;
      }
      if (jsonObj.composite.units !== undefined) { // if composite is defined, it must be an array with 1-4 units
        if (!Array.isArray(jsonObj.composite.units)) { // must be an array
          throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${this.name} has a Composite with an invalid 'units' attribute. It must be of type 'array'`);
        }
        if (jsonObj.composite.units.length > 0 && jsonObj.composite.units.length <= 4) { // Composite requires 1-4 units
          for (const unit of jsonObj.composite.units) {
             await this.createUnit(unit.name, unit.label); // create the unit
          }
        }
      } else
          throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${this.name} has an invalid 'Composite' attribute. It must have 1-4 units.`);
    }
  }

  /**
   * Populates this Format with the values from the provided.
   */
  public fromJsonSync(jsonObj: any): void {
    super.fromJsonSync(jsonObj);
    this.loadFormatProperties(jsonObj);
    if (undefined !== jsonObj.composite) { // optional
      this._units = new Array<[Unit | InvertedUnit, string | undefined]>();
      if (jsonObj.composite.includeZero !== undefined) {
        if (typeof(jsonObj.composite.includeZero) !== "boolean") // includeZero must be a boolean IF it is defined
          throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${this.name} has a Composite with an invalid 'includeZero' attribute. It should be of type 'boolean'.`);
        this._includeZero = jsonObj.composite.includeZero;
      }
      if (jsonObj.composite.spacer !== undefined) {  // spacer must be a string IF it is defined
        if (typeof(jsonObj.composite.spacer) !== "string")
          throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${this.name} has a Composite with an invalid 'spacer' attribute. It must be of type 'string'.`);
        if (jsonObj.composite.spacer.length !== 1) // spacer must be a one character string
          throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${this.name} has a Composite with an invalid 'spacer' attribute. It must be a one character string.`);
        this._spacer = jsonObj.composite.spacer;
      }
      if (jsonObj.composite.units !== undefined) { // if composite is defined, it must be an array with 1-4 units
        if (!Array.isArray(jsonObj.composite.units)) { // must be an array
          throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${this.name} has a Composite with an invalid 'units' attribute. It must be of type 'array'`);
        }
        if (jsonObj.composite.units.length > 0 && jsonObj.composite.units.length <= 4) { // Composite requires 1-4 units
          for (const unit of jsonObj.composite.units) {
             this.createUnitSync(unit.name, unit.label); // create the unit
          }
        }
      } else
          throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${this.name} has an invalid 'Composite' attribute. It must have 1-4 units.`);
    }
  }

  public async accept(visitor: SchemaItemVisitor) {
    if (visitor.visitFormat)
      await visitor.visitFormat(this);
  }
}

export abstract class MutableFormat extends Format {
  public abstract setPrecision(precision: number): void;
  public abstract setUnits(units: Array<[Unit | InvertedUnit, string | undefined]> | undefined): void;
}
