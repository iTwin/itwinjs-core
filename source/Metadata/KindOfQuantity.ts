/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import SchemaItem from "./SchemaItem";
import { ECObjectsError, ECObjectsStatus } from "../Exception";
import { SchemaItemType } from "../ECObjects";
import { SchemaItemVisitor } from "../Interfaces";
import Schema from "./Schema";
import Format from "../Metadata/Format";
import Unit from "../Metadata/Unit";
import { LazyLoadedUnit } from "../Interfaces";
import { DelayedPromiseWithProps } from "../DelayedPromise";
import { BentleyStatus } from "@bentley/bentleyjs-core/lib/Bentley";

/**
 * A Typescript class representation of a KindOfQuantity.
 */
export default class KindOfQuantity extends SchemaItem {
  public readonly schemaItemType!: SchemaItemType.KindOfQuantity; // tslint:disable-line
  protected _precision: number = 1.0;
  protected _presentationUnits?: string[];
  protected _persistenceUnit?: LazyLoadedUnit;
  protected _formats?: any;
  protected _units?: any;

  public static readonly formatStringRgx: RegExp = RegExp(/([\w,:]+)(\(([^\)]+)\))?(\[([^\|\]]+)([\|])?([^\]]+)?\])?(\[([^\|\]]+)([\|])?([^\]]+)?\])?(\[([^\|\]]+)([\|])?([^\]]+)?\])?(\[([^\|\]]+)([\|])?([^\]]+)?\])?/);
  public static readonly unitRgx: RegExp = RegExp(/^\[(u\s*\:\s*)?([\w]+)\s*(\|)?\s*(.*)?\s*\]$/);
  get precision() { return this._precision; }

  get presentationUnits(): string[] | undefined { return this._presentationUnits; }

  get persistenceUnit(): LazyLoadedUnit | undefined { return this._persistenceUnit; }

  set persistenceUnit(persistenceUnit: LazyLoadedUnit | undefined) { this._persistenceUnit = persistenceUnit; }

  get formats() { return this._units; }

  get units() { return this._formats; }

  constructor(schema: Schema, name: string) {
    super(schema, name, SchemaItemType.KindOfQuantity);
    this._presentationUnits = [];
  }

  public get defaultPresentationUnit() {
    return this!.presentationUnits!.length === 0 ? undefined : this!.presentationUnits![0];
  }

  private processPresentationUnits(presentationUnitsJson: string | string[]) {
    if (presentationUnitsJson instanceof Array) {
      presentationUnitsJson.forEach((formatString: string) => {
        if (!KindOfQuantity.formatStringRgx.test(formatString)) // throw if formatString is invalid
          throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `KindOfQuantity has an invalid 'presentationUnits' option.`);
        this!._presentationUnits!.push(formatString); // push otherwise
      });
    } else {
        presentationUnitsJson.split(";").forEach((formatString: string) => {
          if (!KindOfQuantity.formatStringRgx.test(formatString)) // throw if formatString is invalid
            throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `KindOfQuantity has an invalid 'presentationUnits' option.`);
          this!._presentationUnits!.push(formatString); // push otherwise
        });
    }
  }

  public static async parseFormatString(schema: Schema, formatName: string, formatString: string): Promise<object | BentleyStatus> {
    // given name of format, figure out units
    let precision: any = null;
    let numUnits: number | undefined;
    let unitArray: Array<[string, string | undefined]>;
    let unit: any = null;
    let index = 4;
    if (!KindOfQuantity.formatStringRgx.test(formatString))
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `Format string has incorrect format.`);
    const match = formatString.split(KindOfQuantity.formatStringRgx);
    if (match[1] !== formatName) // handle format first to fail fast
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `Format names do not match.`);
    const matchedFormat = await schema.getItem<Format>(match[1], true);
    if (!matchedFormat)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, ``);
    numUnits = matchedFormat!.composite!.units!.length; // get how many units this format has
    if (match[2] !== undefined && match[3] !== undefined) { // if formatString contains optional override of the precision defined in Format
      precision = +match[3].split(",")[0]; // override the precision value
      if (!Number.isInteger(precision)) // precision value must be an integer
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `Precision must be an integer.`);
    } else {
      precision = null; // precision is not present in the format string
    }
    matchedFormat.precision = precision;
    if (formatString.match(/\[/g)!.length !== numUnits) // count number of left brackets in string- same as coutning number of units
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `Incorrect number of unit overrides.`);
    unitArray = new Array<[string, string | undefined]>();
    while ( index < match.length - 1 ) { // index 0 and 21 are empty strings when there are 4 units
      if ( match[index] !== undefined) {
        unit = match[index].split(KindOfQuantity.unitRgx);
        let foundUnitName: boolean = false;
        let unitLabelToPush: string;
        matchedFormat!.composite!.units!.forEach((value: [string, string | undefined]) => {
          if ( unit[2].toLowerCase() === value[0].toLowerCase() ) { // we found a match for this unitName
            if (unit[4] === undefined) // if unit override label is undefined, use empty string for label
              unitLabelToPush = "";
            else
              unitLabelToPush = unit[4]; // override label isnt defined... push old label
            unitArray.push([unit[2], unitLabelToPush]);
            foundUnitName = true;
          }
        });
        if ( foundUnitName === false )
          throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `Cannot find unit name ${unit[2]}.`);
      } else
        break;
      index += 4;
    }
    return {FormatName: formatName, Precision: precision, Units: unitArray};
  }

  public async fromJson(jsonObj: any) {
    await super.fromJson(jsonObj);

    if (undefined === jsonObj.precision)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The KindOfQuantity ${this.name} is missing the required attribute 'precision'.`);
    if (typeof(jsonObj.precision) !== "number")
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The KindOfQuantity ${this.name} has an invalid 'precision' attribute. It should be of type 'number'.`);
    this._precision = jsonObj.precision;

    if (undefined === jsonObj.persistenceUnit)
    throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The KindOfQuantity ${this.name} is missing the required attribute 'persistenceUnit'.`);
    if (typeof(jsonObj.persistenceUnit) !== "string")
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The KindOfQuantity ${this.name} has an invalid 'persistenceUnit' attribute. It should be of type 'string'.`);
    const persistenceUnit = await this.schema.getItem<Unit>(jsonObj.persistenceUnit, true);
    if (!persistenceUnit)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, ``);
    this._persistenceUnit = new DelayedPromiseWithProps(persistenceUnit.key, async () => persistenceUnit);

    if (undefined !== jsonObj.presentationUnits) {
      if (!Array.isArray(jsonObj.presentationUnits) && typeof(jsonObj.presentationUnits) !== "string") // must be a string or an array
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The KindOfQuantity ${this.name} has an invalid 'presentationUnits' attribute. It should be either type 'string[]' or type 'string'.`);
      this.processPresentationUnits(jsonObj.presentationUnits);
    }
  }

  public async accept(visitor: SchemaItemVisitor) {
    if (visitor.visitKindOfQuantity)
      await visitor.visitKindOfQuantity(this);
  }
}
