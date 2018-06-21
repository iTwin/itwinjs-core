/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/
import SchemaItem from "./SchemaItem";
import { ECObjectsError, ECObjectsStatus } from "../Exception";
import { SchemaItemType } from "../ECObjects";
import { SchemaItemVisitor } from "../Interfaces";
import Schema from "./Schema";
import Unit from "./Unit";
import { LazyLoadedUnit, LazyLoadedInvertedUnit } from "../Interfaces";
import { DelayedPromiseWithProps } from "../DelayedPromise";
import InvertedUnit from "./InvertedUnit";

// A Composite defines additional information about a format and whether the magnitude should be split and display using multiple Units.
export interface Composite {
  spacer?: string;
  includeZero: boolean;
  units?: Array<[LazyLoadedUnit | LazyLoadedInvertedUnit, string | undefined]>;
}

export const enum FormatTraits {
  trailZeroes = 0x1,
  keepSingleZero = 0x2,
  zeroEmpty = 0x4,
  keepDecimalPoint = 0x8,
  applyRounding = 0x10,
  fractionDash = 0x20,
  showUnitLabel = 0x40,
  prependUnitLabel = 0x80,
  use1000Separator = 0x100,
  exponentOnlyNegative = 0x200,
}

export const enum FractionalPrecision {
  one = 1,
  two = 2,
  four = 4,
  eight = 8,
  sixteen = 16,
  thirtytwo = 32,
  sixtyfour = 64,
  onehundredtwentyeight = 128,
  twohundredfiftysix = 256,
}

export const enum DecimalPrecision {
  zero = 0,
  one = 1,
  two = 2,
  three = 3,
  four = 4,
  five = 5,
  six = 6,
  seven = 7,
  eight = 8,
  nine = 9,
  ten = 10,
  eleven = 11,
  tweleve = 12,
}

export const enum FormatType {
  Decimal,
  Fractional,
  Scientific,
  Station,
}

export const enum ScientificType { // required if type is scientific; options: normalized, zeroNormalized
  Normalized,
  ZeroNormalized,
}

export const enum ShowSignOption { // default is no sign
  NoSign,
  OnlyNegative,
  SignAlways,
  NegativeParentheses,
}

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
  protected _composite?: Composite;
  protected _formatTraits = 0x0;

  constructor(schema: Schema, name: string) {
    super(schema, name, SchemaItemType.Format);
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
  get composite(): Composite | undefined { return this._composite; }
  get formatTraits(): number { return this._formatTraits; }

  private verifyFormatTraitsOptions(formatTraitsFromJson: string | string[]) {
      if (Array.isArray(formatTraitsFromJson)) {
        formatTraitsFromJson.forEach((formatTraitsString: string) => { // for each element in the string array
          this.parseFormatTrait(formatTraitsString);
        });
      } else { // formatTraitsFromJson is a string separated by ',', ';', '|'
        formatTraitsFromJson.split(/,|;|\|/).forEach((formatTraitsString: string) => {
          this.parseFormatTrait(formatTraitsString);
        });
      }
  }

  public hasFormatTrait(formatTrait: FormatTraits) {
    return (this._formatTraits & formatTrait) === formatTrait;
  }

  protected setUnits(units: Array<[LazyLoadedUnit | LazyLoadedInvertedUnit, string | undefined]> | undefined) {
    if (this._composite === undefined)
      this._composite = {includeZero: true, spacer: " ", units: new Array<[ LazyLoadedUnit | LazyLoadedInvertedUnit, string | undefined]>()};
    this._composite!.units = units;
  }
  protected setPrecision(precision: number | undefined) { this._precision = precision; }

  private parseFormatTrait(stringToCheck: string) {
    const lowerType = stringToCheck.toLowerCase();
    switch (lowerType) {
      case "trailzeroes":
        this._formatTraits = this._formatTraits | FormatTraits.trailZeroes;
        break;
      case "keepsinglezero":
        this._formatTraits = this._formatTraits | FormatTraits.keepSingleZero;
        break;
      case "zeroempty":
        this._formatTraits = this._formatTraits | FormatTraits.zeroEmpty;
        break;
      case "keepdecimalpoint":
        this._formatTraits = this._formatTraits | FormatTraits.keepDecimalPoint;
        break;
      case "applyrounding":
        this._formatTraits = this._formatTraits | FormatTraits.applyRounding;
        break;
      case "fractiondash":
        this._formatTraits = this._formatTraits | FormatTraits.fractionDash;
        break;
      case "showunitlabel":
        this._formatTraits = this._formatTraits | FormatTraits.showUnitLabel;
        break;
      case "prependunitlabel":
        this._formatTraits = this._formatTraits | FormatTraits.prependUnitLabel;
        break;
      case "use1000separator":
        this._formatTraits = this._formatTraits | FormatTraits.use1000Separator;
        break;
      case "exponentonlynegative":
        this._formatTraits = this._formatTraits | FormatTraits.exponentOnlyNegative;
        break;
      default:
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `Format has an invalid 'formatTraits' option.`);
    }
  }

  private parseFormatType(jsonObjType: string) {
    switch (jsonObjType.toLowerCase()) {
      case "decimal":
        this._type = FormatType.Decimal;
        break;
      case "scientific":
        this._type = FormatType.Scientific;
        break;
      case "station":
        this._type = FormatType.Station;
        break;
      case "fractional":
        this._type = FormatType.Fractional;
        break;
      default:
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${this.name} has an invalid 'type' attribute.`);
    }
  }
  private parseDecimalPrecision(jsonObjPrecision: number) {
    switch (jsonObjPrecision) {
      case 0:
        this._precision = DecimalPrecision.zero;
        break;
      case 1:
        this._precision = DecimalPrecision.one;
        break;
      case 2:
        this._precision = DecimalPrecision.two;
        break;
      case 3:
        this._precision = DecimalPrecision.three;
        break;
      case 4:
        this._precision = DecimalPrecision.four;
        break;
      case 5:
        this._precision = DecimalPrecision.five;
        break;
      case 6:
        this._precision = DecimalPrecision.six;
        break;
      case 7:
        this._precision = DecimalPrecision.seven;
        break;
      case 8:
        this._precision = DecimalPrecision.eight;
        break;
      case 9:
        this._precision = DecimalPrecision.nine;
        break;
      case 10:
        this._precision = DecimalPrecision.ten;
        break;
      case 11:
        this._precision = DecimalPrecision.eleven;
        break;
      case 12:
        this._precision = DecimalPrecision.tweleve;
        break;
      default:
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${this.name} has an invalid 'precision' attribute.`);
    }
  }

  private parseFractionalPrecision(jsonObjPrecision: number) {
    switch (jsonObjPrecision) {
      case 1:
        this._precision = FractionalPrecision.one;
        break;
      case 2:
        this._precision = FractionalPrecision.two;
        break;
      case 4:
        this._precision = FractionalPrecision.four;
        break;
      case 8:
        this._precision = FractionalPrecision.eight;
        break;
      case 16:
        this._precision = FractionalPrecision.sixteen;
        break;
      case 32:
        this._precision = FractionalPrecision.thirtytwo;
        break;
      case 64:
        this._precision = FractionalPrecision.sixtyfour;
        break;
      case 128:
        this._precision = FractionalPrecision.onehundredtwentyeight;
        break;
      case 256:
        this._precision = FractionalPrecision.twohundredfiftysix;
        break;
      default:
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${this.name} has an invalid 'precision' attribute.`);
    }
  }

  private parsePrecision(jsonObjPrecision: number) {
    switch (this._type) { // type must be decimal, fractional, scientific, or station
      case FormatType.Decimal:
      case FormatType.Scientific:
      case FormatType.Station:
        this.parseDecimalPrecision(jsonObjPrecision);
        break;
      case FormatType.Fractional:
        this.parseFractionalPrecision(jsonObjPrecision);
        break;
      default:
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${this.name} has an invalid 'type' attribute.`);
    }
  }

  private parseScientificType(jsonObjScientificType: string) {
    switch (jsonObjScientificType) {
      case "normalized":
        this._scientificType = ScientificType.Normalized;
        break;
      case "zeronormalized":
        this._scientificType = ScientificType.ZeroNormalized;
        break;
      default:
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${this.name} has an invalid 'scientificType' attribute.`);
    }
  }

  private parseShowSignOption(jsonObjShowSignOption: string) {
    switch (jsonObjShowSignOption) {
      case "nosign":
        this._showSignOption = ShowSignOption.NoSign;
        break;
      case "onlynegative":
        this._showSignOption = ShowSignOption.OnlyNegative;
        break;
      case "signalways":
        this._showSignOption = ShowSignOption.SignAlways;
        break;
      case "negativeparentheses":
        this._showSignOption = ShowSignOption.NegativeParentheses;
        break;
      default:
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${this.name} has an invalid 'showSignOption' attribute.`);
    }
  }

  /**
   * Creates a Unit with the provided name and label and adds it to the this Composite.
   * @param name The name of the Unit
   * @param label A localized display label that is used instead of the name in a GUI.
   */
  public async createUnit(name: string, label?: string) {
    let newUnit: Unit | InvertedUnit | undefined;
    if (name === undefined || typeof(name) !== "string" || (label !== undefined && typeof(label) !== "string")) // throws if name is undefined or name isnt a string or if label is defined and isnt a string
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `This Composite has a unit with an invalid 'name' or 'label' attribute.`);
    const units =  this._composite!.units!;
    for (const unit of units) {
      const unitObj = await unit[0];
      if (unitObj.name.toLowerCase() === (name.split(".")[1]).toLowerCase()) // no duplicate names- take unit name after "."
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The unit ${unitObj.name} has a duplicate name.`);
    }
    newUnit = await this.schema.getItem<Unit | InvertedUnit>(name, true);
    if (!newUnit)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, ``);
    const unitToBeAdded = new DelayedPromiseWithProps(newUnit.key, async () => newUnit) as LazyLoadedUnit | LazyLoadedInvertedUnit;
    this._composite!.units!.push([unitToBeAdded, label]);
  }

  public async formatFromJson(jsonObj: any) {
    if (undefined === jsonObj.type) // type is required
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${this.name} does not have the required 'type' attribute.`);
    if (typeof(jsonObj.type) !== "string")
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${this.name} has an invalid 'type' attribute. It should be of type 'string'.`);
    this.parseFormatType(jsonObj.type.toLowerCase());

    if (undefined === jsonObj.precision) // precision is required
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${this.name} does not have the required 'precision' attribute.`);
    else if (typeof(jsonObj.precision) !== "number") // must be a number
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${this.name} has an invalid 'precision' attribute. It should be of type 'number'.`);
    else if (!Number.isInteger(jsonObj.precision)) // must be an integer
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${this.name} has an invalid 'precision' attribute. It should be an integer.`);
    this.parsePrecision(jsonObj.precision);

    if (this.type === FormatType.Scientific) {
      if (undefined === jsonObj.scientificType) // if format type is scientific and scientific type is undefined, throw
       throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${this.name} has type 'Scientific' therefore attribute 'scientificType' is required.`);
      if (typeof(jsonObj.scientificType) !== "string")
       throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${this.name} has an invalid 'scientificType' attribute. It should be of type 'string'.`);
      this.parseScientificType(jsonObj.scientificType.toLowerCase());
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
      this.parseShowSignOption(jsonObj.showSignOption.toLowerCase());
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

    if (undefined !== jsonObj.composite) { // optional
      this._composite = {includeZero: true, spacer: " ", units: new Array<[ LazyLoadedUnit | LazyLoadedInvertedUnit, string | undefined]>()};
      if (jsonObj.composite.includeZero !== undefined) {
        if (typeof(jsonObj.composite.includeZero) !== "boolean") // includeZero must be a boolean IF it is defined
          throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${this.name} has a Composite with an invalid 'includeZero' attribute. It should be of type 'boolean'.`);
        this._composite!.includeZero = jsonObj.composite.includeZero; // if includeZero is defined and it is a boolean, we can assign it to this composite
      }
      if (jsonObj.composite.spacer !== undefined) {  // spacer must be a string IF it is defined
        if (typeof(jsonObj.composite.spacer) !== "string")
          throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${this.name} has a Composite with an invalid 'spacer' attribute. It must be of type 'string'.`);
        if (jsonObj.composite.spacer.length !== 1) // spacer must be a one character string
          throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${this.name} has a Composite with an invalid 'spacer' attribute. It must be a one character string.`);
        this._composite!.spacer = jsonObj.composite.spacer; // if spacer is defined and it is a one character string, we can assign it to this composite
      }
      if (jsonObj.composite.units !== undefined) { // if composite is defined, it must be an array with 1-4 units
        if (!Array.isArray(jsonObj.composite.units)) { // must be an array
          throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${this.name} has a Composite with an invalid 'units' attribute. It must be of type 'array'`);
        }
        if (jsonObj.composite.units.length > 0 && jsonObj.composite.units.length <= 4) { // Composite requires 1-4 units
          const units = jsonObj.composite.units;
          for (const unit of units) {
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
  public async fromJson(jsonObj: any): Promise<void> {
    await super.fromJson(jsonObj);
    await this.formatFromJson(jsonObj);
  }

  /**
   * Populates this Format with the values from the provided.
   */
  public fromJsonSync(jsonObj: any): void {
    super.fromJsonSync(jsonObj);
    this.formatFromJson(jsonObj);
  }

  public async accept(visitor: SchemaItemVisitor) {
    if (visitor.visitFormat)
      await visitor.visitFormat(this);
  }
}

export abstract class MutableFormat extends Format {
  public abstract setPrecision(precision: number): void;
  public abstract setUnits(units: Array<[LazyLoadedUnit | LazyLoadedInvertedUnit, string | undefined]> | undefined): void;
}
