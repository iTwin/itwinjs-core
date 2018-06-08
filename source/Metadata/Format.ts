/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/
import { SchemaItemType, parseSchemaItemType, schemaItemTypeToString, ECName } from "../ECObjects";
import { SchemaItemVisitor } from "../Interfaces";
import Schema from "./Schema";
import { ECObjectsError, ECObjectsStatus } from "../Exception";
import { SchemaItem } from "..";
import { BentleyStatus } from "@bentley/bentleyjs-core/lib/Bentley";

export interface Unit {
  name: string;
  label?: string;
}

// A Composite defines additional information about a format and whether the magnitude should be split and display using multiple Units.
export interface Composite {
  spacer?: string;
  includeZero?: boolean;
  unitNames?: any;
  unitLabels?: any;
}

export default class Format extends SchemaItem {
  public readonly schema: Schema;
  public static readonly rgx: RegExp = RegExp(/(([\w,:]+)(\(([^\)]+)\))?(\[([^\|\]]+)([\|])?([^\|\]]+)?\])?(\[([^\|\]]+)([\|])?([^\|\]]+)?\])?(\[([^\|\]]+)([\|])?([^\|\]]+)?\])?(\[([^\|\]]+)([\|])?([^\|\]]+)?\])?)/);
  protected _name: ECName; // required
  protected _label?: string; // optional
  protected _description?: string; // description
  protected _roundFactor = 0.0; // double; optional
  protected _type?: "decimal" | "fractional" | "scientific" | "station"; // required; types: decimal, fractional, scientific, station
  protected _precision?: number; // required; int
  protected _minWidth?: number; // optional; positive int
  protected _scientificType?: "normalized" | "zeroNormalized"; // required if type is scientific; options: normalized, zeroNormalized
  protected _showSignOption = "onlyNegative"; // options: noSign, onlyNegative, signAlways, negativeParentheses
  protected _formatTraits?: Map<string, boolean>; // optional in json; Maps (format traits option -> boolean) indicating whether option is present or not
  protected _decimalSeparator?: string; // optional; default is based on current locale.... TODO: Default is based on current locale
  protected _thousandSeparator?: string; // optional; default is based on current locale.... TODO: Default is based on current locale
  protected _uomSeparator = " "; // optional; default is " "; defined separator between magnitude and the unit
  protected _stationSeparator = "+"; // optional; default is "+"
  protected _stationOffsetSize?: number; // required when type is station; positive integer>0
  protected _composite?: Composite;

  private readonly ec32Url: string = "https://dev.bentley.com/json_schemas/ec/32/draft-01/schemaitem";
  private static readonly precisionArray = [1, 2, 4, 8, 16, 32, 64, 128, 256];
  private static readonly typeArray = ["decimal", "fractional", "scientific", "station"];
  private static readonly scientificTypeArray = ["normalized", "zeroNormalized"];
  private static readonly showSignOptionsArray = ["noSign", "onlyNegative", "signAlways", "negativeParentheses"];
  private static readonly formatTraitsArray = ["trailZeroes", "keepSingleZero", "zeroEmpty", "keepDecimalPoint", "applyRounding", "fractionDash", "showUnitLabel", "prependUnitLabel", "use1000Separator", "exponentOnlyNegative"];

  constructor(schema: Schema, name: string) {
    super(schema, name, SchemaItemType.Format);
    this.schema = schema;
    this._name = new ECName(name);
  }

  public get type(): SchemaItemType { return SchemaItemType.Format; }

  get ecname(): ECName { return this._name; }
  get label(): string | undefined { return this._label; }
  get description(): string | undefined { return this._description; }
  get roundFactor(): number { return this._roundFactor; }
  get formattype(): "decimal" | "fractional" | "scientific" | "station" | undefined { return this._type; }
  get precision(): number | undefined { return this._precision; }
  get minWidth(): number | undefined { return this._minWidth; }
  get scientificType(): "normalized" | "zeroNormalized" | undefined { return this._scientificType; }
  get showSignOption(): string { return this._showSignOption; }
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
            throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${this.ecname.name} has an invalid 'formatTraits' option.`);
          else {
            this._formatTraits!.set(formatTraitsString, true);
            return;
          }
        });
      } else { // formatTraitsFromJson is a string separated by ',', ';', '|'
        formatTraitsFromJson.split(/,|;|\|/).forEach((formatTraitsString: string) => {
          if (Format.formatTraitsArray.indexOf(formatTraitsString) <= -1) // not a valid formatTraits option
            throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${this.ecname.name} has an invalid 'formatTraits' option.`);
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
    this._composite!.unitNames!.forEach((str: string) => { // Name must be unique within the Composite
      if (str.toLowerCase() === name.toLowerCase())
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The unit ${name} has a duplicate name.`);
    });
    this._composite!.unitNames!.push(name);
    if (label !== undefined)
      this._composite!.unitLabels!.push(label);
  }

    public parseFormatString(formatName: string, formatString: string): object | BentleyStatus {
      let precision: any = null;
      let unitNames: any = new Array<any>();
      let unitLabels: any = new Array<any>();
      let unit: any = null;
      let index = 5;
      if (!Format.rgx.test(formatString))
        return BentleyStatus.ERROR;
      const match = formatString.split(Format.rgx);
      if (match[2] !== formatName) // handle format first to fail fast
        return BentleyStatus.ERROR;
      if (match[3] !== undefined && match[4] !== undefined) { // if formatString contains optional override of the precision defined in Format
        precision = +match[4].split(",")[0]; // override the precision value
        if (!Number.isInteger(precision))
          return BentleyStatus.ERROR;
      } else {
        precision = null; // precision is not present in the format string
      }
      while ( index < match.length - 1 ) { // index 0 and 21 are empty strings when there are 4 units
        if ( match[index] !== undefined) { // TODO: unit name cannot be duplicate within Format
          unit = match[index].split(/\[(u\s*\:\s*)?([\w]+)\s*(\|)?\s*([\w]*(\([\w]+\))?)?\s*\]/);
          let foundUnitName: boolean = false;
          this!._composite!.unitNames!.forEach((str: string) => {
            if ( str.toLowerCase() === unit[2].toLowerCase() )
              foundUnitName = true;
          });
          if ( foundUnitName === false )
            return BentleyStatus.ERROR;
          unitNames.push(unit[2]);
          if ( unit[4] !== undefined )
            unitLabels.push(unit[4]);
        } else
          break;
        index += 4;
      }
      if ( unitNames.length === 0 ) unitNames = null;
      if ( unitLabels.length === 0 ) unitLabels = null;
      return {FormatName: formatName, Precision: precision, UnitList: unitNames, UnitLabels: unitLabels};
    }

  public async fromJson(jsonObj: any): Promise<void> {
    await super.fromJson(jsonObj);
    if (undefined === jsonObj.schemaItemType)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The SchemaItem ${this.name} is missing the required schemaItemType property.`);

    if (typeof(jsonObj.schemaItemType) !== "string")
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The SchemaItem ${this.name} has an invalid 'schemaItemType' attribute. It should be of type 'string'.`);

    if (parseSchemaItemType(jsonObj.schemaItemType) !== this.type)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The SchemaItem ${this.name} has an incompatible schemaItemType. It must be "${schemaItemTypeToString(this.type)}", not "${jsonObj.schemaItemType}".`);

    if (undefined !== jsonObj.name) { // name is required
      if (typeof(jsonObj.name) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${this.name} has an invalid 'name' attribute. It should be of type 'string'.`);
      if (jsonObj.name.toLowerCase() !== this.name.toLowerCase())
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${jsonObj.name} has an invalid 'name' attribute.`);
    } else // if name isn't defined, throw error
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${this.name} does not have the required 'name' attribute.`);

    if (undefined !== jsonObj.label) { // label is optional
      if (typeof(jsonObj.label) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${jsonObj.name} has an invalid 'label' attribute. It should be of type 'string'.`);
      this._label = jsonObj.label; // if json label is defined, assign it to the label variable for this Format
    }

    if (undefined !== jsonObj.description) { // description is optional
      if (typeof(jsonObj.description) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${jsonObj.name} has an invalid 'description' attribute. It should be of type 'string'.`);
      this._description = jsonObj.description; // if json description is defined, assign it to the description variable for this Format
    }

    if (undefined !== jsonObj.roundFactor) { // optional; default is 0.0
      if (typeof(jsonObj.roundFactor) !== "number")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${jsonObj.name} has an invalid 'roundFactor' attribute. It should be of type 'number'.`);
      if (jsonObj.roundFactor !== this.roundFactor) // if roundFactor isnt default value of 0.0, reassign roundFactor variable
        this._roundFactor = jsonObj.roundFactor;
    }

    if (undefined !== jsonObj.type) { // type is required
      if (typeof(jsonObj.type) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${jsonObj.name} has an invalid 'type' attribute. It should be of type 'string'.`);
      else if (Format.typeArray.indexOf(jsonObj) < -1) // not a valid option for type
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${jsonObj.name} has an invalid 'type' attribute.`);
      this._type = jsonObj.type;
    } else // if type isn't defined, throw error
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${jsonObj.name} does not have the required 'type' attribute.`);

    if (undefined !== jsonObj.precision && Number.isInteger(jsonObj.precision)) { // precision is required; must be an int
      if (typeof(jsonObj.precision) !== "number")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${jsonObj.name} has an invalid 'precision' attribute. It should be of type 'number'.`);
      switch (jsonObj.type) { // type must be decimal, fractional, scientific, or station
        case "decimal":
        case "scientific":
        case "station":
          if (0 <= jsonObj.precision && jsonObj.precision <= 12) // Type is decimal, scientific or station, 0 - 12
            this._precision = jsonObj.precision;
          else
            throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${jsonObj.name} has an invalid 'precision' attribute.`);
          break;
        case "fractional":
          if (Format.precisionArray.indexOf(jsonObj.precision) > -1)
            this._precision = jsonObj.precision;
          else
            throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${jsonObj.name} has an invalid 'precision' attribute.`);
          break;
        default:
          throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${jsonObj.name} has an invalid 'type' attribute.`);
      }
    } else // if precision isn't defined or is not an int, throw error
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${jsonObj.name} does not have the required 'precision' attribute.`);

    if (undefined !== jsonObj.minWidth) { // optional
      if (typeof(jsonObj.minWidth) !== "number")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${jsonObj.name} has an invalid 'minWidth' attribute. It should be of type 'number'.`);
      else if (Number.isInteger(jsonObj.minWidth) && jsonObj.minWidth > 0) // must be a positive int
        this._minWidth = jsonObj.minWidth;
      else
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${jsonObj.name} has an invalid 'minWidth' attribute.`);
    }

    if (undefined !== jsonObj.scientificType && this.formattype === "scientific") { // scientificType is required if type is scientific
      if (typeof(jsonObj.scientificType) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${jsonObj.name} has an invalid 'scientificType' attribute. It should be of type 'string'.`);
      else if (Format.scientificTypeArray.indexOf(jsonObj.scientificType) <= -1) // not a valid option for scientific type
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${jsonObj.name} has an invalid 'scientificType' attribute.`);
      this._scientificType = jsonObj.scientificType;
    } else if (this.formattype === "scientific") // if the type is scientific and scientificType is undefined, throw
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${jsonObj.name} does not have the required 'scientificType' attribute.`);

    if (undefined !== jsonObj.showSignOption) { // optional; default is "onlyNegative"
      if (typeof(jsonObj.showSignOption) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${jsonObj.name} has an invalid 'showSignOption' attribute. It should be of type 'string'.`);
      else if (Format.showSignOptionsArray.indexOf(jsonObj.showSignOption) <= -1) // not a valid option for showSignOption
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${jsonObj.name} has an invalid 'showSignOption' attribute.`);
      this._showSignOption = jsonObj.showSignOption;
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

    if (undefined !== jsonObj.stationOffsetSize && this.formattype === "station") { // stationOffsetSize is required if type is station
      if (typeof(jsonObj.stationOffsetSize) !== "number")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${jsonObj.name} has an invalid 'stationOffsetSize' attribute. It should be of type 'number'.`);
      else if (!Number.isInteger(jsonObj.stationOffsetSize) || jsonObj.stationOffsetSize < 0) // must be a positive int > 0
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${jsonObj.name} has an invalid 'stationOffsetSize' attribute. It should be a positive integer greater than 0.`);
      this._stationOffsetSize = jsonObj.stationOffsetSize;
    } else if (this.formattype === "station") // if the type is station and stationOffsetSize is undefined, throw
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${jsonObj.name} does not have the required 'stationOffsetSize' attribute.`);

    if (undefined !== jsonObj.composite) { // optional
      this._composite = {includeZero: true, spacer: " ", unitNames: new Array<string>(), unitLabels: new Array<string>()};
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

    if (undefined !== jsonObj.$schema) {
      if (typeof(jsonObj.$schema) !== "string")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${jsonObj.name} has an invalid 'schema' attribute. It should be of type 'string'.`);

      if (jsonObj.$schema.toLowerCase() !== this.ec32Url) // $schema value must be equal to the EC3.2 url
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${jsonObj.name} does not have the required schema URL.`);
    }

  }

  public async accept(visitor: SchemaItemVisitor) {
    if (visitor.visitFormat)
      await visitor.visitFormat(this);
  }
}
