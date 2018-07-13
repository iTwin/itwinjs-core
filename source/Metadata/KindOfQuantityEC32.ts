/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import SchemaItem from "./SchemaItem";
import { ECObjectsError, ECObjectsStatus } from "../Exception";
import { SchemaItemType, SchemaItemKey } from "../ECObjects";
import { SchemaItemVisitor, LazyLoadedInvertedUnit, LazyLoadedUnit, LazyLoadedFormat } from "../Interfaces";
import Schema from "./Schema";
import Format, { MutableFormat } from "../Metadata/Format";
import Unit from "../Metadata/Unit";
import InvertedUnit from "../Metadata/InvertedUnit";
import { DelayedPromiseWithProps } from "../DelayedPromise";
import KindOfQuantity from "./KindOfQuantity";

export const formatStringRgx: RegExp = RegExp(/([\w.:]+)(\(([^\)]+)\))?(\[([^\|\]]+)([\|])?([^\]]+)?\])?(\[([^\|\]]+)([\|])?([^\]]+)?\])?(\[([^\|\]]+)([\|])?([^\]]+)?\])?(\[([^\|\]]+)([\|])?([^\]]+)?\])?/);

/**
 * A Typescript class representation of a KindOfQuantity.
 */
export default class KindOfQuantityEC32 extends SchemaItem {
  public readonly schemaItemType!: SchemaItemType.KindOfQuantity; // tslint:disable-line
  protected _precision: number = 1.0;
  protected _presentationUnits?: LazyLoadedFormat[];
  protected _persistenceUnit?: LazyLoadedUnit | LazyLoadedInvertedUnit;

  public static readonly unitRgx: RegExp = RegExp(/^\[(u\s*\:\s*)?([\w\.]+)\s*(\|)?\s*(.*)?\s*\]$/);
  get precision() { return this._precision; }

  get presentationUnits(): LazyLoadedFormat[] | undefined { return this._presentationUnits; }

  get persistenceUnit(): LazyLoadedUnit | LazyLoadedInvertedUnit | undefined { return this._persistenceUnit; }

  set persistenceUnit(persistenceUnit: LazyLoadedUnit| LazyLoadedInvertedUnit | undefined) { this._persistenceUnit = persistenceUnit; }

  constructor(schema: Schema, name: string) {
    super(schema, name);
    this.schemaItemType = SchemaItemType.KindOfQuantity;
    this._presentationUnits = [];
  }

  public get defaultPresentationFormat(): undefined | LazyLoadedFormat {
    return this!.presentationUnits!.length === 0 ? undefined : this!.presentationUnits![0];
  }

  private processPresentationUnits(presentationUnitsJson: string | string[]) {
    const presUnitsArr = (Array.isArray(presentationUnitsJson)) ? presentationUnitsJson : presentationUnitsJson.split(";");
    for (const formatString of presUnitsArr) {
      this!._presentationUnits!.push(this.parseFormatString(formatString));
    }
  }

  public async fromJson(jsonObj: any) {
    this.fromJsonSync(jsonObj);
  }

  public fromJsonSync(jsonObj: any) {
    super.fromJsonSync(jsonObj);
    this.loadKOQProperties(jsonObj);
    if (undefined === jsonObj.persistenceUnit)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The KindOfQuantity ${this.name} is missing the required attribute 'persistenceUnit'.`);
    if (typeof(jsonObj.persistenceUnit) !== "string")
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The KindOfQuantity ${this.name} has an invalid 'persistenceUnit' attribute. It should be of type 'string'.`);
    const persistenceUnitSchemaItemKey = this.schema.getSchemaItemKey(jsonObj.persistenceUnit);
    if (!persistenceUnitSchemaItemKey)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `Unable to locate the persistence unit ${jsonObj.persistenceUnit}.`);
    this._persistenceUnit = new DelayedPromiseWithProps<SchemaItemKey, Unit>(persistenceUnitSchemaItemKey,
      async () => {
        const unit = await this.schema.getItem<Unit>(persistenceUnitSchemaItemKey.name);
        if (undefined === unit)
          throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `Unable to locate the persistence unit ${jsonObj.persistenceUnit}.`);
        return unit;
      });

    if (undefined !== jsonObj.presentationUnits) {
      if (!Array.isArray(jsonObj.presentationUnits) && typeof(jsonObj.presentationUnits) !== "string") // must be a string or an array
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The KindOfQuantity ${this.name} has an invalid 'presentationUnits' attribute. It should be either type 'string[]' or type 'string'.`);
      this.processPresentationUnits(jsonObj.presentationUnits);
    }
  }

  private processUnitLabel(overrideLabel: string, unitName: string): [LazyLoadedUnit | LazyLoadedInvertedUnit, string] {
    let unitLabelToPush: string = ""; // if unit override label is undefined, use empty string for label
    if (overrideLabel !== undefined) // override label is defined... push old label
      unitLabelToPush = overrideLabel;
    const unitSchemaItemKey = this.schema.getSchemaItemKey(unitName);
    if (!unitSchemaItemKey)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `Unable to locate the unit ${unitName}.`);
    const newUnit = new DelayedPromiseWithProps<SchemaItemKey, Unit | InvertedUnit>(unitSchemaItemKey,
      async () => {
        const unit = await this.schema.getItem<Unit | InvertedUnit>(unitSchemaItemKey.name);
        if (undefined === unit)
          throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `Unable to locate the unit ${unitName}.`);
        return unit;
    }) as LazyLoadedUnit | LazyLoadedInvertedUnit;
    return [newUnit, unitLabelToPush]; // return new unit label entry
  }

  private parseFormatString(formatString: string): LazyLoadedFormat {
    let numUnits: number | undefined;
    let unitArray: Array<[LazyLoadedUnit | LazyLoadedInvertedUnit, string | undefined]>;

    // function to determine number of unit overrides from index
    const getNumUnitOverrides = ((x: number) => {
      if (x === 4) return 0; // if index is 4, that means there are 0 units
      else {
        return (x - 4) / 4;
      }
    });

    // function to figure out if there are any precision or unit overrides in the formatString
    const overrides = ((formatName: string[]) => {
       // index 2 is precision override, index 4 is first unit override
       // if both are undefined, there are no overrides and we can return
      if (formatName[2] === undefined && formatName[4] === undefined) return false;
      else return true;
    });

    const match = formatString.split(formatStringRgx); // split string based on regex groups
    const matchedFormat = this.schema.getItemSync<Format>(match[1], true); // get format object
    if (!matchedFormat)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `Cannot find Format ${match[1]}.`);
    if (!overrides(match)) // check if there are any precision or unit overrides in this formatString and return early if there are
      return new DelayedPromiseWithProps<SchemaItemKey, Format>(matchedFormat.key, async () => matchedFormat);

    let newFormat: Format = new Format(this.schema, matchedFormat.name);
    newFormat = Object.assign(newFormat, matchedFormat); // copy the matchedFormat as soon as we know there are going to be overrides
    if (matchedFormat!.composite !== undefined)
      numUnits = matchedFormat!.composite!.units!.length; // get how many units this format object has

    if (match[2] !== undefined && match[3] !== undefined) { // if formatString contains optional override of the precision defined in Format
      const precision = +match[3].split(",")[0]; // override the precision value, take the first value if it is a list
      if (!Number.isInteger(precision)) // precision value must be an integer
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `Precision override must be an integer.`);
      (newFormat as MutableFormat).setPrecision(precision); // set the precision value of the new format object
    }

    unitArray = new Array<[LazyLoadedUnit | LazyLoadedInvertedUnit, string | undefined]>(); // array to hold [lazyloadedunit | lazyloadedinvertedLabel, unitLabel?] entries
    let index = 4;  // units reside at indices 4,8,12,16
    while ( index < match.length - 1 ) { // index 0 and 21 are empty strings
      if ( match[index] !== undefined) { // this unit is defined
        let foundUnitName: boolean = false; // did we find a matching unit name in the format?
        if (newFormat.composite === undefined) { // if no units in format, units in format string are used
          unitArray.push(this.processUnitLabel(match[index + 3], match[index + 1]));
          foundUnitName = true;
        } else { // if composite is defined
          for (const compUnit of matchedFormat!.composite!.units!) {
            if ( match[index + 1].split(".")[1].toLowerCase() === (compUnit["0"].name).toLowerCase()) { // we found a match for this unitName
              unitArray.push(this.processUnitLabel(match[index + 3], match[index + 1]));
              foundUnitName = true;
            }
          }
        }
        if ( foundUnitName === false )
          throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `Cannot find unit name ${match[index + 1]}.`);
      } else
        break;
      index += 4; // add 4 to get to next unit
    }
    const numOverrides = getNumUnitOverrides(index);

    if (newFormat.composite === undefined) // if composite is not defined, number of units depends on format string
      numUnits = numOverrides;
    if (numOverrides !== numUnits) //  # of override units be = # of unit in the composite only if composite is defined - composite is require to have #units > 0
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `Number of unit overrides must match number of units present in Format.`);
    if (numOverrides === 0 && numUnits > 0) // if there are no unit overrides and the number of format Units is not zero
      unitArray = matchedFormat!.composite!.units as Array<[LazyLoadedUnit | LazyLoadedInvertedUnit, string | undefined]>; // use the format's composite's units

    (newFormat as MutableFormat).setUnits(unitArray);
    return new DelayedPromiseWithProps<SchemaItemKey, Format>(newFormat.key, async () => newFormat);
  }

  private loadKOQProperties(jsonObj: any) {
    if (undefined === jsonObj.precision)
    throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The KindOfQuantity ${this.name} is missing the required attribute 'precision'.`);
    if (typeof(jsonObj.precision) !== "number")
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The KindOfQuantity ${this.name} has an invalid 'precision' attribute. It should be of type 'number'.`);
    this._precision = jsonObj.precision;
  }

  public async accept(visitor: SchemaItemVisitor) {
    if (visitor.visitKindOfQuantity)
      await visitor.visitKindOfQuantity((this as any) as KindOfQuantity);
  }
}
