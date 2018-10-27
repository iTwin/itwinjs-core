/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import InvertedUnit from "./InvertedUnit";
import Schema from "./Schema";
import SchemaItem from "./SchemaItem";
import Unit from "./Unit";
import { FormatProps } from "./../Deserialization/JsonProps";
import { SchemaItemType } from "./../ECObjects";
import { ECObjectsError, ECObjectsStatus } from "./../Exception";
import { SchemaItemVisitor } from "./../Interfaces";
import {
  DecimalPrecision, FormatTraits, formatTraitsToArray, FormatType, formatTypeToString,
  FractionalPrecision, parseFormatTrait, parseFormatType, parsePrecision, parseScientificType,
  parseShowSignOption, ScientificType, scientificTypeToString, ShowSignOption, showSignOptionToString,
} from "./../utils/FormatEnums";

export interface IFormat {
  readonly name: string;
  readonly roundFactor: number;
  readonly type: FormatType;
  readonly precision: DecimalPrecision | FractionalPrecision;
  readonly minWidth: number | undefined;
  readonly formatTraits: FormatTraits;
  readonly showSignOption: ShowSignOption;
  readonly decimalSeparator: string;
  readonly thousandSeparator: string;
  readonly uomSeparator: string;
  readonly scientificType?: ScientificType;
  readonly stationSeparator?: string;
  readonly stationOffsetSize?: number;
  readonly spacer?: string;
  readonly includeZero?: boolean;
  readonly units?: Array<[Unit | InvertedUnit, string | undefined]>;
}

export default class Format extends SchemaItem implements IFormat {
  public readonly schemaItemType!: SchemaItemType.Format; // tslint:disable-line
  protected _roundFactor: number;
  protected _type: FormatType; // required; options are decimal, frational, scientific, station
  protected _precision: number; // required
  protected _showSignOption: ShowSignOption; // options: noSign, onlyNegative, signAlways, negativeParentheses
  protected _decimalSeparator: string; // optional; default is based on current locale.... TODO: Default is based on current locale
  protected _thousandSeparator: string; // optional; default is based on current locale.... TODO: Default is based on current locale
  protected _uomSeparator: string; // optional; default is " "; defined separator between magnitude and the unit
  protected _stationSeparator: string; // optional; default is "+"
  protected _formatTraits: FormatTraits;
  protected _spacer: string; // optional; default is " "
  protected _includeZero: boolean; // optional; default is true
  protected _minWidth?: number; // optional; positive int
  protected _scientificType?: ScientificType; // required if type is scientific; options: normalized, zeroNormalized
  protected _stationOffsetSize?: number; // required when type is station; positive integer > 0
  protected _units?: Array<[Unit | InvertedUnit, string | undefined]>;

  constructor(schema: Schema, name: string) {
    super(schema, name);
    this.schemaItemType = SchemaItemType.Format;

    this._roundFactor = 0.0;
    this._type = FormatType.Decimal;
    this._precision = DecimalPrecision.Six;
    this._showSignOption = ShowSignOption.OnlyNegative;
    this._decimalSeparator = ".";
    this._thousandSeparator = ",";
    this._uomSeparator = " ";
    this._stationSeparator = "+";
    this._formatTraits = 0x0;
    this._spacer = " ";
    this._includeZero = true;
  }

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
  get units(): Array<[Unit | InvertedUnit, string | undefined]> | undefined { return this._units; }

  private verifyFormatTraitsOptions(formatTraitsFromJson: string | string[]) {
    const formatTraits = (Array.isArray(formatTraitsFromJson)) ? formatTraitsFromJson : formatTraitsFromJson.split(/,|;|\|/);
    formatTraits.forEach((formatTraitsString: string) => { // for each element in the string array
      this._formatTraits = parseFormatTrait(formatTraitsString, this.formatTraits);
    });
  }

  public hasFormatTrait(formatTrait: FormatTraits) {
    return (this._formatTraits & formatTrait) === formatTrait;
  }

  protected setUnits(units: Array<[Unit | InvertedUnit, string | undefined]> | undefined) {
    // TODO: Need to do validation
    this._units = units;
  }
  protected setPrecision(precision: number) { this._precision = precision; }

  /**
   * Creates a Unit with the provided name and label and adds it to this unit array
   * @param name The name of the Unit
   * @param label A localized display label that is used instead of the name in a GUI.
   */
  private createUnitSync(name: string, label?: string) {
    let newUnit: Unit | InvertedUnit | undefined;
    if (name === undefined || typeof (name) !== "string" || (label !== undefined && typeof (label) !== "string")) // throws if name is undefined or name isnt a string or if label is defined and isnt a string
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
    if (name === undefined || typeof (name) !== "string" || (label !== undefined && typeof (label) !== "string")) // throws if name is undefined or name isnt a string or if label is defined and isnt a string
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `This Composite has a unit with an invalid 'name' or 'label' attribute.`);
    for (const unit of this.units!) {
      const unitObj = unit[0].name;
      if (unitObj.toLowerCase() === (name.split(".")[1]).toLowerCase()) // duplicate names are not allowed- take unit name after "."
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The unit ${unitObj} has a duplicate name.`);
    }
    newUnit = await this.schema.lookupItem<Unit | InvertedUnit>(name);
    if (!newUnit)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, ``);
    this.units!.push([newUnit, label]);
  }

  private typecheck(formatProps: FormatProps) {
    this._type = parseFormatType(formatProps.type, this.name);
    this._precision = parsePrecision(formatProps.precision!, this.name, this._type);

    if (this.type === FormatType.Scientific) {
      if (undefined === formatProps.scientificType) // if format type is scientific and scientific type is undefined, throw
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${this.name} has type 'Scientific' therefore attribute 'scientificType' is required.`);
      this._scientificType = parseScientificType(formatProps.scientificType, this.name);
    }

    if (this.type === FormatType.Station) {
      if (undefined === formatProps.stationOffsetSize)
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${this.name} has type 'Station' therefore attribute 'stationOffsetSize' is required.`);
      this._stationOffsetSize = formatProps.stationOffsetSize;
    }

    if (undefined !== formatProps.roundFactor) {
      if (formatProps.roundFactor !== this.roundFactor)
        this._roundFactor = formatProps.roundFactor;
    }

    if (undefined !== formatProps.minWidth) {
      this._minWidth = formatProps.minWidth;
    }

    if (undefined !== formatProps.showSignOption) {
      this._showSignOption = parseShowSignOption(formatProps.showSignOption, this.name);
    }

    if (undefined !== formatProps.formatTraits && formatProps.formatTraits.length !== 0) {
      this.verifyFormatTraitsOptions(formatProps.formatTraits);
    }

    if (undefined !== formatProps.decimalSeparator) {
      this._decimalSeparator = formatProps.decimalSeparator;
    }

    if (undefined !== formatProps.thousandSeparator) {
      this._thousandSeparator = formatProps.thousandSeparator;
    }

    if (undefined !== formatProps.uomSeparator) {
      this._uomSeparator = formatProps.uomSeparator;
    }

    if (undefined !== formatProps.stationSeparator) {
      this._stationSeparator = formatProps.stationSeparator;
    }
    if (undefined !== formatProps.composite) {
      this._units = new Array<[Unit | InvertedUnit, string | undefined]>();
      if (formatProps.composite.includeZero !== undefined) {
        this._includeZero = formatProps.composite.includeZero;
      }
      if (formatProps.composite.spacer !== undefined) {
        this._spacer = formatProps.composite.spacer;
      }
    }
  }

  public deserializeSync(formatProps: FormatProps) {
    super.deserializeSync(formatProps);
    this.typecheck(formatProps);
    if (undefined !== formatProps.composite) {
      for (const unit of formatProps.composite.units!) {
        this.createUnitSync(unit.name, unit.label);
      }
    }
  }

  public async deserialize(formatProps: FormatProps) {
    super.deserialize(formatProps);
    this.typecheck(formatProps);
    if (undefined !== formatProps.composite) {
      for (const unit of formatProps.composite.units!) {
        await this.createUnit(unit.name, unit.label);
      }
    }
  }

  public toJson(standalone: boolean, includeSchemaVersion: boolean) {
    const schemaJson = super.toJson(standalone, includeSchemaVersion);
    schemaJson.type = formatTypeToString(this.type!);
    schemaJson.precision = this.precision;
    if (undefined !== this.roundFactor)
      schemaJson.roundFactor = this.roundFactor;
    if (undefined !== this.minWidth)
      schemaJson.minWidth = this.minWidth;
    if (undefined !== this.showSignOption)
      schemaJson.showSignOption = showSignOptionToString(this.showSignOption);
    if (undefined !== this.formatTraits)
      schemaJson.formatTraits = formatTraitsToArray(this.formatTraits);
    if (undefined !== this.decimalSeparator)
      schemaJson.decimalSeparator = this.decimalSeparator;
    if (undefined !== this.thousandSeparator)
      schemaJson.thousandSeparator = this.thousandSeparator;
    if (undefined !== this.uomSeparator)
      schemaJson.uomSeparator = this.uomSeparator;
    if (undefined !== this.scientificType)
      schemaJson.scientificType = scientificTypeToString(this.scientificType);
    if (undefined !== this.stationOffsetSize)
      schemaJson.stationOffsetSize = this.stationOffsetSize;
    if (undefined !== this.stationSeparator)
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
    }
    return schemaJson;
  }

  public async accept(visitor: SchemaItemVisitor) {
    if (visitor.visitFormat)
      await visitor.visitFormat(this);
  }
}
