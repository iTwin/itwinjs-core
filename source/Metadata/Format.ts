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
  TrailZeroes = 0x1,
  KeepSingleZero = 0x2,
  ZeroEmpty = 0x4,
  KeepDecimalPoint = 0x8,
  ApplyRounding = 0x10,
  FractionDash = 0x20,
  ShowUnitLabel = 0x40,
  PrependUnitLabel = 0x80,
  Use1000Separator = 0x100,
  ExponentOnlyNegative = 0x200,
}

export const enum FractionalPrecision {
  One = 1,
  Two = 2,
  Four = 4,
  Eight = 8,
  Sixteen = 16,
  ThirtyTwo = 32,
  SixtyFour = 64,
  OneHundredTwentyEight = 128,
  TwoHundredFiftySix = 256,
}

export const enum DecimalPrecision {
  Zero = 0,
  One = 1,
  Two = 2,
  Three = 3,
  Four = 4,
  Five = 5,
  Six = 6,
  Seven = 7,
  Eight = 8,
  Nine = 9,
  Ten = 10,
  Eleven = 11,
  Twelve = 12,
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

function parseFormatTrait(stringToCheck: string, currentFormatTrait: number): number {
  let formatTrait = currentFormatTrait;
  switch (stringToCheck) {
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
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `Format has an invalid 'formatTraits' option.`);
  }
  return formatTrait;
}

function parseFormatType(jsonObjType: string, formatName: string): FormatType | undefined {
  let formatType;
  switch (jsonObjType.toLowerCase()) {
    case "decimal":
      formatType = FormatType.Decimal;
      break;
    case "scientific":
      formatType = FormatType.Scientific;
      break;
    case "station":
      formatType = FormatType.Station;
      break;
    case "fractional":
      formatType = FormatType.Fractional;
      break;
    default:
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${formatName} has an invalid 'type' attribute.`);
  }
  return formatType;
}
function parseDecimalPrecision(jsonObjPrecision: number, formatName: string): number | undefined {
  let precision;
  switch (jsonObjPrecision) {
    case 0:
      precision = DecimalPrecision.Zero;
      break;
    case 1:
      precision = DecimalPrecision.One;
      break;
    case 2:
      precision = DecimalPrecision.Two;
      break;
    case 3:
      precision = DecimalPrecision.Three;
      break;
    case 4:
      precision = DecimalPrecision.Four;
      break;
    case 5:
      precision = DecimalPrecision.Five;
      break;
    case 6:
      precision = DecimalPrecision.Six;
      break;
    case 7:
      precision = DecimalPrecision.Seven;
      break;
    case 8:
      precision = DecimalPrecision.Eight;
      break;
    case 9:
      precision = DecimalPrecision.Nine;
      break;
    case 10:
      precision = DecimalPrecision.Ten;
      break;
    case 11:
      precision = DecimalPrecision.Eleven;
      break;
    case 12:
      precision = DecimalPrecision.Twelve;
      break;
    default:
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${formatName} has an invalid 'precision' attribute.`);
  }
  return precision;
}

function parseFractionalPrecision(jsonObjPrecision: number, formatName: string) {
  let precision;
  switch (jsonObjPrecision) {
    case 1:
      precision = FractionalPrecision.One;
      break;
    case 2:
      precision = FractionalPrecision.Two;
      break;
    case 4:
      precision = FractionalPrecision.Four;
      break;
    case 8:
      precision = FractionalPrecision.Eight;
      break;
    case 16:
      precision = FractionalPrecision.Sixteen;
      break;
    case 32:
      precision = FractionalPrecision.ThirtyTwo;
      break;
    case 64:
      precision = FractionalPrecision.SixtyFour;
      break;
    case 128:
      precision = FractionalPrecision.OneHundredTwentyEight;
      break;
    case 256:
      precision = FractionalPrecision.TwoHundredFiftySix;
      break;
    default:
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${formatName} has an invalid 'precision' attribute.`);
  }
  return precision;
}

function parsePrecision(jsonObjPrecision: number, formatName: string, type: FormatType): number | undefined {
  let precision;
  switch (type) { // type must be decimal, fractional, scientific, or station
    case FormatType.Decimal:
    case FormatType.Scientific:
    case FormatType.Station:
      precision = parseDecimalPrecision(jsonObjPrecision, formatName);
      break;
    case FormatType.Fractional:
      precision = parseFractionalPrecision(jsonObjPrecision, formatName);
      break;
    default:
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${formatName} has an invalid 'type' attribute.`);
  }
  return precision;
}

function parseScientificType(jsonObjScientificType: string, formatName: string) {
  let scientificType;
  switch (jsonObjScientificType) {
    case "normalized":
      scientificType = ScientificType.Normalized;
      break;
    case "zeronormalized":
      scientificType = ScientificType.ZeroNormalized;
      break;
    default:
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${formatName} has an invalid 'scientificType' attribute.`);
  }
  return scientificType;
}

function parseShowSignOption(jsonObjShowSignOption: string, formatName: string) {
  let showSignOption;
  switch (jsonObjShowSignOption) {
    case "nosign":
      showSignOption = ShowSignOption.NoSign;
      break;
    case "onlynegative":
      showSignOption = ShowSignOption.OnlyNegative;
      break;
    case "signalways":
      showSignOption = ShowSignOption.SignAlways;
      break;
    case "negativeparentheses":
      showSignOption = ShowSignOption.NegativeParentheses;
      break;
    default:
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${formatName} has an invalid 'showSignOption' attribute.`);
  }
  return showSignOption;
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
  get composite(): Composite | undefined { return this._composite; }
  get formatTraits(): FormatTraits { return this._formatTraits; }

  private verifyFormatTraitsOptions(formatTraitsFromJson: string | string[]) {
    const formatTraits = (Array.isArray(formatTraitsFromJson)) ? formatTraitsFromJson : formatTraitsFromJson.split(/,|;|\|/);
    formatTraits.forEach((formatTraitsString: string) => { // for each element in the string array
      this._formatTraits = parseFormatTrait(formatTraitsString.toLowerCase(), this.formatTraits);
    });
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

  /**
   * Creates a Unit with the provided name and label and adds it to the this Composite.
   * @param name The name of the Unit
   * @param label A localized display label that is used instead of the name in a GUI.
   */
  private createUnitSync(name: string, label?: string) {
    let newUnit: Unit | InvertedUnit | undefined;
    if (name === undefined || typeof(name) !== "string" || (label !== undefined && typeof(label) !== "string")) // throws if name is undefined or name isnt a string or if label is defined and isnt a string
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `This Composite has a unit with an invalid 'name' or 'label' attribute.`);
    const units =  this._composite!.units!;
    for (const unit of units) {
      const unitObj = unit[0].name;
      if (unitObj.toLowerCase() === (name.split(".")[1]).toLowerCase()) // no duplicate names- take unit name after "."
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The unit ${unitObj} has a duplicate name.`);
    }
    newUnit = this.schema.getItemSync<Unit | InvertedUnit>(name, true);
    if (!newUnit)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, ``);
    const unitToBeAdded = new DelayedPromiseWithProps(newUnit.key, async () => newUnit) as LazyLoadedUnit | LazyLoadedInvertedUnit;
    this._composite!.units!.push([unitToBeAdded, label]);
  }

  private async createUnit(name: string, label?: string) {
    let newUnit: Unit | InvertedUnit | undefined;
    if (name === undefined || typeof(name) !== "string" || (label !== undefined && typeof(label) !== "string")) // throws if name is undefined or name isnt a string or if label is defined and isnt a string
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `This Composite has a unit with an invalid 'name' or 'label' attribute.`);
    const units =  this._composite!.units!;
    for (const unit of units) {
      const unitObj = unit[0].name;
      if (unitObj.toLowerCase() === (name.split(".")[1]).toLowerCase()) // no duplicate names- take unit name after "."
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The unit ${unitObj} has a duplicate name.`);
    }
    newUnit = await this.schema.getItem<Unit | InvertedUnit>(name, true);
    if (!newUnit)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, ``);
    const unitToBeAdded = new DelayedPromiseWithProps(newUnit.key, async () => newUnit) as LazyLoadedUnit | LazyLoadedInvertedUnit;
    this._composite!.units!.push([unitToBeAdded, label]);
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
  public fromJsonSync(jsonObj: any): void {
    super.fromJsonSync(jsonObj);
    this.loadFormatProperties(jsonObj);
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
  public abstract setUnits(units: Array<[LazyLoadedUnit | LazyLoadedInvertedUnit, string | undefined]> | undefined): void;
}
