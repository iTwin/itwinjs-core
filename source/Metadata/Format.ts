/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/
import SchemaItem from "./SchemaItem";
import { ECObjectsError, ECObjectsStatus } from "../Exception";
import { SchemaItemType } from "../ECObjects";
import { SchemaItemVisitor } from "../Interfaces";
import Schema from "./Schema";

// A Composite defines additional information about a format and whether the magnitude should be split and display using multiple Units.
export interface Composite {
  spacer?: string;
  includeZero?: boolean;
  units?: Array<[string, string | undefined]>;
}

export const enum Type {
  Decimal = "decimal",
  Fractional = "fractional",
  Scientific = "scientific",
  Station  = "station",
}

export const enum ScientificType { // required if type is scientific; options: normalized, zeroNormalized
  Normalized = "normalized",
  ZeroNormalized = "zeronormalized",
}

export const enum ShowSignOption { // default is no sign
  NoSign = "nosign",
  OnlyNegative = "onlynegative",
  SignAlways = "signalways",
  NegativeParentheses = "negativeparentheses",
}

export default class Format extends SchemaItem {
  public readonly schemaItemType!: SchemaItemType.Format; // tslint:disable-line
  protected _roundFactor: number = 0.0;
  protected _type: Type;
  protected _precision?: number; // required
  protected _minWidth?: number; // optional; positive int
  protected _scientificType?: ScientificType; // required if type is scientific; options: normalized, zeroNormalized
  protected _showSignOption: ShowSignOption = ShowSignOption.OnlyNegative; // options: noSign, onlyNegative, signAlways, negativeParentheses
  protected _formatTraits?: Map<string, boolean>; // optional in json; Maps (format traits option -> boolean) indicating whether option is present or not
  protected _decimalSeparator?: string; // optional; default is based on current locale.... TODO: Default is based on current locale
  protected _thousandSeparator?: string; // optional; default is based on current locale.... TODO: Default is based on current locale
  protected _uomSeparator = " "; // optional; default is " "; defined separator between magnitude and the unit
  protected _stationSeparator = "+"; // optional; default is "+"
  protected _stationOffsetSize?: number; // required when type is station; positive integer>0
  protected _composite?: Composite;

  private static readonly precisionArray = [1, 2, 4, 8, 16, 32, 64, 128, 256];
  private static readonly formatTraitsArray = ["trailZeroes", "keepSingleZero", "zeroEmpty", "keepDecimalPoint", "applyRounding", "fractionDash", "showUnitLabel", "prependUnitLabel", "use1000Separator", "exponentOnlyNegative"];

  constructor(schema: Schema, name: string) {
    super(schema, name, SchemaItemType.Format);
    this._type = Type.Decimal; // Need to init this value to something...will change in fromJson
  }

  get roundFactor(): number { return this._roundFactor; }
  get type(): Type { return this._type; }
  get precision(): number | undefined { return this._precision; }
  set precision(precision: number | undefined) { this._precision = precision; }
  get minWidth(): number | undefined { return this._minWidth; }
  get scientificType(): ScientificType | undefined { return this._scientificType; }
  get showSignOption(): ShowSignOption { return this._showSignOption; }
  get formatTraits(): Map<string, boolean> | undefined { return this._formatTraits; }
  get decimalSeparator(): string | undefined  { return this._decimalSeparator; }
  get thousandSeparator(): string | undefined { return this._thousandSeparator; }
  get uomSeparator(): string  { return this._uomSeparator; }
  get stationSeparator(): string  { return this._stationSeparator; }
  get stationOffsetSize(): number | undefined { return this._stationOffsetSize; }
  get composite(): Composite | undefined { return this._composite; }

  private verifyFormatTraitsOptions(formatTraitsFromJson: string | string[]) {
      if (formatTraitsFromJson instanceof Array) {
        formatTraitsFromJson.forEach((formatTraitsString: string) => { // for each element in the string array
          if (Format.formatTraitsArray.indexOf(formatTraitsString) <= -1) // not a valid formatTraits option
            throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `Format has an invalid 'formatTraits' option.`);
          else {
            this._formatTraits!.set(formatTraitsString, true);
            return;
          }
        });
      } else { // formatTraitsFromJson is a string separated by ',', ';', '|'
        formatTraitsFromJson.split(/,|;|\|/).forEach((formatTraitsString: string) => {
          if (Format.formatTraitsArray.indexOf(formatTraitsString) <= -1) // not a valid formatTraits option
            throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `Format has an invalid 'formatTraits' option.`);
          else {
            this._formatTraits!.set(formatTraitsString, true);
            return;
          }
        });
      }
  }

    /**
     * Creates a Unit with the provided name and label and adds it to the this Composite.
     * @param name The name of the Unit
     * @param label A localized display label that is used instead of the name in a GUI.
     */
  public createUnit(name: string, label?: string) {
    if (name === undefined || typeof(name) !== "string" || (label !== undefined && typeof(label) !== "string")) // throws if name is undefined or name isnt a string or if label is defined and isnt a string
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `This Composite has a unit with an invalid 'name' or 'label' attribute.`);
    this._composite!.units!.forEach((unit: [string, string | undefined]) => { // Name must be unique within the Composite
      if (unit[0].toLowerCase() === name.toLowerCase())
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The unit ${name} has a duplicate name.`);
    });
    this._composite!.units!.push([name, label]);
  }

  public async fromJson(jsonObj: any): Promise<void> {
    await super.fromJson(jsonObj);

    if (undefined === jsonObj.type) // type is required
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${jsonObj.name} does not have the required 'type' attribute.`);
    if (typeof(jsonObj.type) !== "string")
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${jsonObj.name} has an invalid 'type' attribute. It should be of type 'string'.`);
    switch (jsonObj.type.toLowerCase()) {
      case "decimal":
        this._type = Type.Decimal;
        break;
      case "scientific":
        this._type = Type.Scientific;
        break;
      case "station":
        this._type = Type.Station;
        break;
      case "fractional":
        this._type = Type.Fractional;
        break;
      default:
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${jsonObj.name} has an invalid 'type' attribute.`);
    }

    if (undefined === jsonObj.precision) // precision is required
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${jsonObj.name} does not have the required 'precision' attribute.`);
    else if (typeof(jsonObj.precision) !== "number") // must be a number
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${jsonObj.name} has an invalid 'precision' attribute. It should be of type 'number'.`);
    else if (!Number.isInteger(jsonObj.precision)) // must be an integer
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${jsonObj.name} has an invalid 'precision' attribute. It should be an integer.`);
    switch (this._type) { // type must be decimal, fractional, scientific, or station
      case Type.Decimal:
      case Type.Scientific:
      case Type.Station:
        if (0 <= jsonObj.precision && jsonObj.precision <= 12) // Type is decimal, scientific or station, 0 - 12
          this._precision = jsonObj.precision;
        else
          throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${jsonObj.name} has an invalid 'precision' attribute.`);
        break;
      case Type.Fractional:
        if (Format.precisionArray.indexOf(jsonObj.precision) > -1)
          this._precision = jsonObj.precision;
        else
          throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${jsonObj.name} has an invalid 'precision' attribute.`);
        break;
      default:
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${jsonObj.name} has an invalid 'type' attribute.`);
    }

    if (this.type === Type.Scientific && undefined === jsonObj.scientificType) // if format type is scientific and scientific type is undefined, throw
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${jsonObj.name} does not have the required 'scientificType' attribute.`);
    else if (this.type === Type.Scientific) { // Type is scientific, scientific type is defined
      if (typeof(jsonObj.scientificType) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${jsonObj.name} has an invalid 'scientificType' attribute. It should be of type 'string'.`);
      switch (jsonObj.scientificType.toLowerCase()) {
        case "normalized":
          this._scientificType = ScientificType.Normalized;
          break;
        case "zeronormalized":
          this._scientificType = ScientificType.ZeroNormalized;
          break;
        default:
          throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${jsonObj.name} has an invalid 'scientificType' attribute.`);
      }
    }

    if (this.type === Type.Station && undefined === jsonObj.stationOffsetSize)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${jsonObj.name} does not have the required 'stationOffsetSize' attribute.`);
    else if (this.type === Type.Station) { // stationOffsetSize is required if type is station
      if (typeof(jsonObj.stationOffsetSize) !== "number")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${jsonObj.name} has an invalid 'stationOffsetSize' attribute. It should be of type 'number'.`);
      else if (!Number.isInteger(jsonObj.stationOffsetSize) || jsonObj.stationOffsetSize < 0) // must be a positive int > 0
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${jsonObj.name} has an invalid 'stationOffsetSize' attribute. It should be a positive integer greater than 0.`);
      this._stationOffsetSize = jsonObj.stationOffsetSize;
    }

    if (undefined !== jsonObj.roundFactor) { // optional; default is 0.0
      if (typeof(jsonObj.roundFactor) !== "number")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${jsonObj.name} has an invalid 'roundFactor' attribute. It should be of type 'number'.`);
      if (jsonObj.roundFactor !== this.roundFactor) // if roundFactor isnt default value of 0.0, reassign roundFactor variable
        this._roundFactor = jsonObj.roundFactor;
    }

    if (undefined !== jsonObj.minWidth) { // optional
      if (typeof(jsonObj.minWidth) !== "number")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${jsonObj.name} has an invalid 'minWidth' attribute. It should be of type 'number'.`);
      else if (Number.isInteger(jsonObj.minWidth) && jsonObj.minWidth > 0) // must be a positive int
        this._minWidth = jsonObj.minWidth;
      else
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${jsonObj.name} has an invalid 'minWidth' attribute.`);
    }

    if (undefined !== jsonObj.showSignOption) { // optional; default is "onlyNegative"
      if (typeof(jsonObj.showSignOption) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${jsonObj.name} has an invalid 'showSignOption' attribute. It should be of type 'string'.`);
      switch (jsonObj.showSignOption.toLowerCase()) {
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
          throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${jsonObj.name} has an invalid 'showSignOption' attribute.`);
      }
  }

    if (undefined !== jsonObj.formatTraits && jsonObj.formatTraits.length !== 0) { // FormatTraits is optional
      if (!(jsonObj.formatTraits instanceof Array) && typeof(jsonObj.formatTraits) !== "string") // must be either an array of strings or a string
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${jsonObj.name} has an invalid 'formatTraits' attribute. It should be of type 'string' or 'string[]'.`);
      this._formatTraits = new Map<string, boolean>();
      Format.formatTraitsArray.forEach((str: string) => { // fills Map with <formatTraits Option, false>
        this._formatTraits!.set(str, false);
      });
      this.verifyFormatTraitsOptions(jsonObj.formatTraits); // check that all of the options for formatTraits are valid. If now, throw
    }

    if (undefined !== jsonObj.decimalSeparator) { // optional
      if (typeof(jsonObj.decimalSeparator) !== "string") // not a string or not a one character string
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${jsonObj.name} has an invalid 'decimalSeparator' attribute. It should be of type 'string'.`);
      else if (typeof(jsonObj.decimalSeparator) === "string" && jsonObj.decimalSeparator.length !== 1)
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${jsonObj.name} has an invalid 'decimalSeparator' attribute.`);
      this._decimalSeparator = jsonObj.decimalSeparator;
    }

    if (undefined !== jsonObj.thousandSeparator) { // optional
      if (typeof(jsonObj.thousandSeparator) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${jsonObj.name} has an invalid 'thousandSeparator' attribute. It should be of type 'string'.`);
      else if (typeof(jsonObj.thousandSeparator) === "string" && jsonObj.thousandSeparator.length !== 1)
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${jsonObj.name} has an invalid 'thousandSeparator' attribute.`);
      this._thousandSeparator = jsonObj.thousandSeparator;
    }

    if (undefined !== jsonObj.uomSeparator) { // optional; default is " "
      if (typeof(jsonObj.uomSeparator) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${jsonObj.name} has an invalid 'uomSeparator' attribute. It should be of type 'string'.`);
      else if (typeof(jsonObj.uomSeparator) === "string" && jsonObj.uomSeparator.length !== 1)
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${jsonObj.name} has an invalid 'uomSeparator' attribute.`);
      this._uomSeparator = jsonObj.uomSeparator;
    }

    if (undefined !== jsonObj.stationSeparator) { // optional; default is "+"
      if (typeof(jsonObj.stationSeparator) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${jsonObj.name} has an invalid 'stationSeparator' attribute. It should be of type 'string'.`);
      else if (typeof(jsonObj.stationSeparator) === "string" && jsonObj.stationSeparator.length !== 1)
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${jsonObj.name} has an invalid 'stationSeparator' attribute.`);
      this._stationSeparator = jsonObj.stationSeparator;
    }

    if (undefined !== jsonObj.composite) { // optional
      this._composite = {includeZero: true, spacer: " ", units: new Array<[string, string | undefined]>()};
      if (jsonObj.composite.includeZero !== undefined) {
        if (typeof(jsonObj.composite.includeZero) !== "boolean") // includeZero must be a boolean IF it is defined
          throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${jsonObj.name} has a Composite with an invalid 'includeZero' attribute. It should be of type 'boolean'.`);
        this._composite!.includeZero = jsonObj.composite.includeZero; // if includeZero is defined and it is a boolean, we can assign it to this composite
      }
      if (jsonObj.composite.spacer !== undefined) {  // spacer must be a string IF it is defined
        if ((typeof(jsonObj.composite.spacer) === "string" && jsonObj.composite.spacer.length !== 1) || typeof(jsonObj.composite.spacer) !== "string") // spacer must be a one character string
          throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${jsonObj.name} has a Composite with an invalid 'spacer' attribute.`);
        this._composite!.spacer = jsonObj.composite.spacer; // if spacer is defined and it is a one character string, we can assign it to this composite
      }
      if (jsonObj.composite.units !== undefined && jsonObj.composite.units instanceof Array && jsonObj.composite.units.length !== 0 && jsonObj.composite.units.length <= 4) { // Composite requires 1-4 units, which must be an array of unit objects
        jsonObj.composite.units.forEach((unit: any) => { // for each unit
           this.createUnit(unit.name, unit.label); // create the unit
        });
      } else
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${jsonObj.name} has a Composite with an invalid 'units' attribute.`);
    }
  }

  public async accept(visitor: SchemaItemVisitor) {
    if (visitor.visitFormat)
      await visitor.visitFormat(this);
  }
}
