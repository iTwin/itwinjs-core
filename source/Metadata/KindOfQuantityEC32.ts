/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import SchemaItem from "./SchemaItem";
import { ECObjectsError, ECObjectsStatus } from "../Exception";
import { SchemaItemType } from "../ECObjects";
import { SchemaItemVisitor, LazyLoadedInvertedUnit, LazyLoadedUnit } from "../Interfaces";
import Schema from "./Schema";
import Format, { MutableFormat } from "../Metadata/Format";
import Unit from "../Metadata/Unit";
import InvertedUnit from "../Metadata/InvertedUnit";
import { DelayedPromiseWithProps } from "../DelayedPromise";
import KindOfQuantity from "./KindOfQuantity";

export const formatStringRgx = /([\w.:]+)(\(([^\)]+)\))?(\[([^\|\]]+)([\|])?([^\]]+)?\])?(\[([^\|\]]+)([\|])?([^\]]+)?\])?(\[([^\|\]]+)([\|])?([^\]]+)?\])?(\[([^\|\]]+)([\|])?([^\]]+)?\])?/;

interface FormatOverride {
  formatName: string;
  precision?: number;
  unitLabels?: Array<[string, string | undefined]>;
}

/**
 * A Typescript class representation of a KindOfQuantity.
 */
export default class KindOfQuantityEC32 extends SchemaItem {
  public readonly schemaItemType!: SchemaItemType.KindOfQuantity; // tslint:disable-line
  protected _precision: number = 1.0;
  protected _presentationUnits: Format[];
  protected _persistenceUnit?: LazyLoadedUnit | LazyLoadedInvertedUnit;

  get precision() { return this._precision; }

  get presentationUnits(): Format[] | undefined { return this._presentationUnits; }

  get persistenceUnit(): LazyLoadedUnit | LazyLoadedInvertedUnit | undefined { return this._persistenceUnit; }

  set persistenceUnit(persistenceUnit: LazyLoadedUnit| LazyLoadedInvertedUnit | undefined) { this._persistenceUnit = persistenceUnit; }

  constructor(schema: Schema, name: string) {
    super(schema, name);
    this.schemaItemType = SchemaItemType.KindOfQuantity;
    this._presentationUnits = [];
  }

  public get defaultPresentationFormat(): undefined | Format {
    return this!.presentationUnits!.length === 0 ? undefined : this!.presentationUnits![0];
  }

  /**
   *
   * @param parent
   * @param precision
   * @param unitLabelOverrides
   * @param isDefault
   */
  protected addPresentationFormat(parent: Format, precision: number | undefined, unitLabelOverrides: Array<[Unit|InvertedUnit, string | undefined]> | undefined, isDefault: boolean = false): Format {
    // TODO need to verify that the format provided isn't already an override

    if (unitLabelOverrides && parent.composite && parent.composite.units && parent.composite.units.length !== unitLabelOverrides.length)
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `Cannot add presetantion format to KindOfQuantity '${this.name}' because the number of unit overrides is inconsistent with the number in the Format '${parent.name}'.`);

    // no overrides
    if (undefined === precision && (undefined === unitLabelOverrides || 0 === unitLabelOverrides.length)) {
      (isDefault) ? this._presentationUnits.splice(0, 0, parent) : this._presentationUnits.push(parent);
      return parent;
    }

    if (parent.composite && (!parent.composite.units || parent.composite.units.length === 0) && unitLabelOverrides && unitLabelOverrides.length > 0 )
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `Cannot add a presetantion format to KindOfQuantity '${this.name}' without any units and no unit overrides.`);

    // TODO check compatibility of Unit overrides with the persisitence unit

    // TODO fix the name to be overrideString, or possibly change to ???
    // const overrideString = createOverrideString(parent);
    let newFormat = new Format(parent.schema, parent.name);
    newFormat = Object.assign(newFormat, parent);

    if (isDefault)
      this._presentationUnits.splice(0, 0, newFormat); // inserting the format at the front of the array
    else
      this._presentationUnits.push(newFormat);

    if (precision) {
      // TODO need to verify against the type
      (newFormat as MutableFormat).setPrecision(precision);
    }

    if (unitLabelOverrides)
      (newFormat as MutableFormat).setUnits(unitLabelOverrides);

    return newFormat;
  }

  private async processPresentationUnits(presentationUnitsJson: string | string[]) {
    const presUnitsArr = (Array.isArray(presentationUnitsJson)) ? presentationUnitsJson : presentationUnitsJson.split(";");
    for (const formatString of presUnitsArr) {
      const presFormat = this.parseFormatString(formatString);

      const format = await this.schema.getItem<Format>(presFormat.formatName, true);
      if (undefined === format)
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `Unable to locate format '${presFormat.formatName}' for the presentation unit on KindOfQuantity ${this.fullName}.`);

      const unitAndLabels: Array<[Unit|InvertedUnit, string | undefined]> = [];
      if (undefined !== presFormat.unitLabels) {
        for (const unitOverride of presFormat.unitLabels) {
          const unit = await this.schema.getItem<Unit | InvertedUnit>(unitOverride[0], true);
          if (undefined === unit)
            throw new ECObjectsError(ECObjectsStatus.InvalidECJson, ``);

          unitAndLabels.push([unit!, unitOverride[1]]);
        }
      }

      this.addPresentationFormat(format, presFormat.precision, unitAndLabels);
    }
  }

  private processPresentationUnitsSync(presentationUnitsJson: string | string[]) {
    const presUnitsArr = (Array.isArray(presentationUnitsJson)) ? presentationUnitsJson : presentationUnitsJson.split(";");
    for (const formatString of presUnitsArr) {
      const presFormat = this.parseFormatString(formatString);

      const format = this.schema.getItemSync<Format>(presFormat.formatName, true);
      if (undefined === format)
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `Unable to locate format '${presFormat.formatName}' for the presentation unit on KindOfQuantity ${this.fullName}.`);

      const unitAndLabels: Array<[Unit|InvertedUnit, string | undefined]> = [];
      if (undefined !== presFormat.unitLabels) {
        for (const unitOverride of presFormat.unitLabels) {
          const unit = this.schema.getItemSync<Unit | InvertedUnit>(unitOverride[0], true);
          if (undefined === unit)
            throw new ECObjectsError(ECObjectsStatus.InvalidECJson, ``);

          unitAndLabels.push([unit!, unitOverride[1]]);
        }
      }

      this.addPresentationFormat(format, presFormat.precision, unitAndLabels);
    }
  }

  public async fromJson(jsonObj: any) {
    await super.fromJson(jsonObj);
    this.loadKOQProperties(jsonObj);
    if (undefined === jsonObj.persistenceUnit)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The KindOfQuantity ${this.name} is missing the required attribute 'persistenceUnit'.`);
    if (typeof(jsonObj.persistenceUnit) !== "string")
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The KindOfQuantity ${this.name} has an invalid 'persistenceUnit' attribute. It should be of type 'string'.`);

    const persistenceUnit = await this.schema.getItem<Unit>(jsonObj.persistenceUnit, true);
    if (!persistenceUnit)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `Cannot find the persistence unit ${jsonObj.persistenceUnit}.`);
    this._persistenceUnit = new DelayedPromiseWithProps(persistenceUnit.key, async () => persistenceUnit);

    if (undefined !== jsonObj.presentationUnits) {
      if (!Array.isArray(jsonObj.presentationUnits) && typeof(jsonObj.presentationUnits) !== "string") // must be a string or an array
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The KindOfQuantity ${this.name} has an invalid 'presentationUnits' attribute. It should be either type 'string[]' or type 'string'.`);
      await this.processPresentationUnits(jsonObj.presentationUnits);
    }
  }

  public fromJsonSync(jsonObj: any) {
    super.fromJsonSync(jsonObj);
    this.loadKOQProperties(jsonObj);
    if (undefined === jsonObj.persistenceUnit)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The KindOfQuantity ${this.name} is missing the required attribute 'persistenceUnit'.`);
    if (typeof(jsonObj.persistenceUnit) !== "string")
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The KindOfQuantity ${this.name} has an invalid 'persistenceUnit' attribute. It should be of type 'string'.`);
    const persistenceUnit = this.schema.getItemSync<Unit>(jsonObj.persistenceUnit, true);
    if (!persistenceUnit)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `Cannot find the persistence unit ${jsonObj.persistenceUnit}.`);
    this._persistenceUnit = new DelayedPromiseWithProps(persistenceUnit.key, async () => persistenceUnit);

    if (undefined !== jsonObj.presentationUnits) {
      if (!Array.isArray(jsonObj.presentationUnits) && typeof(jsonObj.presentationUnits) !== "string") // must be a string or an array
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The KindOfQuantity ${this.name} has an invalid 'presentationUnits' attribute. It should be either type 'string[]' or type 'string'.`);
      this.processPresentationUnitsSync(jsonObj.presentationUnits);
    }
  }

  /**
   * Parses
   * @param formatString
   */
  private parseFormatString(formatString: string): FormatOverride {
    const match = formatString.split(formatStringRgx); // split string based on regex groups
    if (undefined === match[1])
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, ``);

    const returnValue: any = { formatName: match[1]};

    if (undefined !== match[2] && undefined !== match[3]) {
      const overrideString = match[2];
      const tokens: string[] = [];
      let prevPos = 1;
      let currPos;

      while (-1 !== (currPos = overrideString.indexOf(",)", prevPos))) { // tslint:disable-line
        tokens.push(overrideString.substring(prevPos, currPos - prevPos));
        prevPos = currPos + 1;
      }

      if (overrideString.length > 0 && (() => {
          for (const token of tokens)
            if ("" === token)
              return false;
          return true;
        })) {
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, ``);
      }

      // The first override parameter overrides the default precision of the format
      const precisionIndx: number = 0;

      if (tokens.length >= precisionIndx + 1) {
        if (tokens[precisionIndx].length > 0) {
          if (Number.isInteger(tokens[precisionIndx] as any))
            returnValue.precision = (tokens[precisionIndx] as any) as number;
        }
      }
    }

    returnValue.unitLabels = [];

    let i = 4;
    while (i < match.length) {
      if (undefined === match[i])
        break;
      if (undefined === match[i + 1])
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, ``);

      if (undefined !== match[i + 2]) // matches '|'
        returnValue.unitLabels.push([match[i + 1], match[i + 3]]); // add unit name and label override
      else
        returnValue.unitLabels.push([match[i + 1], undefined]); // add unit name

      i += 4;
    }

    return returnValue;
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
