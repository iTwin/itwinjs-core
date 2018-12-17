/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { Format, IFormat } from "./Format";
import { InvertedUnit } from "./InvertedUnit";
import { OverrideFormat } from "./OverrideFormat";
import { Schema } from "./Schema";
import { SchemaItem } from "./SchemaItem";
import { Unit } from "./Unit";
import { DelayedPromiseWithProps } from "./../DelayedPromise";
import { KindOfQuantityProps } from "./../Deserialization/JsonProps";
import { SchemaItemType } from "./../ECObjects";
import { ECObjectsError, ECObjectsStatus } from "./../Exception";
import { LazyLoadedInvertedUnit, LazyLoadedUnit, SchemaItemVisitor } from "./../Interfaces";
import { formatStringRgx } from "./../utils/FormatEnums";

/**
 * A Typescript class representation of a KindOfQuantity.
 */
export class KindOfQuantity extends SchemaItem {
  public readonly schemaItemType!: SchemaItemType.KindOfQuantity; // tslint:disable-line
  protected _relativeError: number;
  protected _presentationUnits: Array<Format | OverrideFormat>;
  protected _persistenceUnit?: LazyLoadedUnit | LazyLoadedInvertedUnit;

  get relativeError() { return this._relativeError; }

  get presentationUnits(): Array<Format | OverrideFormat> | undefined { return this._presentationUnits; }

  get persistenceUnit(): LazyLoadedUnit | LazyLoadedInvertedUnit | undefined { return this._persistenceUnit; }

  set persistenceUnit(persistenceUnit: LazyLoadedUnit | LazyLoadedInvertedUnit | undefined) { this._persistenceUnit = persistenceUnit; }

  constructor(schema: Schema, name: string) {
    super(schema, name);
    this.schemaItemType = SchemaItemType.KindOfQuantity;
    this._presentationUnits = [];
    this._relativeError = 1.0;
  }

  public get defaultPresentationFormat(): undefined | Format | OverrideFormat {
    return this.presentationUnits![0];
  }

  /**
   *
   * @param format The Format to add to this KindOfQuantity
   * @param isDefault
   */
  protected addPresentationFormat(format: Format | OverrideFormat, isDefault: boolean = false) {
    // TODO: Add some sort of validation?
    (isDefault) ? this._presentationUnits.splice(0, 0, format) : this._presentationUnits.push(format);
  }

  /**
   * Parses
   * @param formatString
   */
  private parseFormatString(formatString: string): OverrideFormat {
    const match = formatString.split(formatStringRgx); // split string based on regex groups
    if (undefined === match[1])
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, ``);

    const returnValue: any = { name: match[1] };

    if (undefined !== match[2] && undefined !== match[3]) {
      const overrideString = match[2];
      const tokens: string[] = [];
      let prevPos = 1; // Initial position is the character directly after the opening '(' in the override string.
      let currPos;

      // TODO need to include `,` as a valid search argument.
      while (-1 !== (currPos = overrideString.indexOf(")", prevPos))) { // tslint:disable-line
        tokens.push(overrideString.substr(prevPos, currPos - prevPos));
        prevPos = currPos + 1;
      }

      if (overrideString.length > 0 && undefined === tokens.find((token) => {
        return "" !== token; // there is at least one token that is not empty.
      })) {
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, ``);
      }

      // The first override parameter overrides the default precision of the format
      const precisionIndx: number = 0;

      if (tokens.length >= precisionIndx + 1) {
        if (tokens[precisionIndx].length > 0) {
          const precision = Number.parseInt(tokens[precisionIndx], undefined);
          if (Number.isNaN(precision))
            throw new ECObjectsError(ECObjectsStatus.InvalidECJson, ``);
          returnValue.precision = precision;
        }
      }
    }

    let i = 4;
    while (i < match.length) {
      if (undefined === match[i])
        break;
      // Unit override required
      if (undefined === match[i + 1])
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, ``);

      if (undefined === returnValue.units)
        returnValue.units = [];

      if (undefined !== match[i + 2]) // matches '|'
        returnValue.units.push([{ name: match[i + 1] }, match[i + 3]]); // add unit name and label override
      else
        returnValue.units.push([{ name: match[i + 1] }, undefined]); // add unit name

      i += 4;
    }

    return returnValue;
  }

  /**
   *
   * @param parent The Format to override.
   * @param name The name of the new Format.  In most cases should be the FormatString representing the override.
   * @param precision
   * @param unitLabelOverrides
   * @param isDefault
   */
  protected createFormatOverride(parent: Format, name: string, precision?: number, unitLabelOverrides?: Array<[Unit | InvertedUnit, string | undefined]>) {
    // TODO need to verify that the format provided isn't already an override

    if (unitLabelOverrides && parent.units && parent.units.length !== unitLabelOverrides.length)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `Cannot add presetantion format to KindOfQuantity '${this.name}' because the number of unit overrides is inconsistent with the number in the Format '${parent.name}'.`);

    if (parent.units && 0 === parent.units.length && unitLabelOverrides && 0 < unitLabelOverrides.length)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `Cannot add a presetantion format to KindOfQuantity '${this.name}' without any units and no unit overrides.`);

    // TODO check compatibility of Unit overrides with the persisitence unit

    if (undefined === name)
      throw new ECObjectsError(ECObjectsStatus.InvalidECName, ``);

    return new OverrideFormat(parent, name, precision, unitLabelOverrides);
  }

  private async processPresentationUnits(presentationUnitsJson: string | string[]) {
    const presUnitsArr = (Array.isArray(presentationUnitsJson)) ? presentationUnitsJson : presentationUnitsJson.split(";");
    for (const formatString of presUnitsArr) {
      const presFormatOverride = this.parseFormatString(formatString);

      const format = await this.schema.lookupItem<Format>(presFormatOverride.name);
      if (undefined === format)
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `Unable to locate format '${presFormatOverride.name}' for the presentation unit on KindOfQuantity ${this.fullName}.`);

      if (undefined === presFormatOverride.precision && undefined === presFormatOverride.units) {
        this.addPresentationFormat(format);
        continue;
      }

      let unitAndLabels: Array<[Unit | InvertedUnit, string | undefined]> | undefined;
      if (undefined !== presFormatOverride.units) {
        if (4 < presFormatOverride.units.length)
          throw new ECObjectsError(ECObjectsStatus.InvalidECJson, ``);

        unitAndLabels = [];
        for (const unitOverride of presFormatOverride.units) {
          const unit = await this.schema.lookupItem<Unit | InvertedUnit>(unitOverride[0].name);
          if (undefined === unit)
            throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `Unable to locate SchemaItem ${unitOverride[0].name}.`);

          unitAndLabels.push([unit!, unitOverride[1]]);
        }
      }

      const overrideFormat: OverrideFormat = this.createFormatOverride(format, formatString, presFormatOverride.precision, unitAndLabels);
      this.addPresentationFormat(overrideFormat);
    }
  }

  private processPresentationUnitsSync(presentationUnitsJson: string | string[]) {
    const presUnitsArr = (Array.isArray(presentationUnitsJson)) ? presentationUnitsJson : presentationUnitsJson.split(";");
    for (const formatString of presUnitsArr) {
      const presFormatOverride = this.parseFormatString(formatString);

      const format = this.schema.lookupItemSync<Format>(presFormatOverride.name);
      if (undefined === format)
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `Unable to locate format '${presFormatOverride.name}' for the presentation unit on KindOfQuantity ${this.fullName}.`);

      if (undefined === presFormatOverride.precision && undefined === presFormatOverride.units) {
        this.addPresentationFormat(format);
        continue;
      }

      let unitAndLabels: Array<[Unit | InvertedUnit, string | undefined]> | undefined;
      if (undefined !== presFormatOverride.units) {
        if (4 < presFormatOverride.units.length)
          throw new ECObjectsError(ECObjectsStatus.InvalidECJson, ``);

        unitAndLabels = [];
        for (const unitOverride of presFormatOverride.units) {
          const unit = this.schema.lookupItemSync<Unit | InvertedUnit>(unitOverride[0].name);
          if (undefined === unit)
            throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `Unable to locate SchemaItem ${unitOverride[0].name}.`);

          unitAndLabels.push([unit!, unitOverride[1]]);
        }
      }

      const overrideFormat: OverrideFormat = this.createFormatOverride(format, formatString, presFormatOverride.precision, unitAndLabels);
      this.addPresentationFormat(overrideFormat);
    }
  }

  public toJson(standalone: boolean, includeSchemaVersion: boolean) {
    const schemaJson = super.toJson(standalone, includeSchemaVersion);
    schemaJson.relativeError = this.relativeError;
    schemaJson.persistenceUnit = this.persistenceUnit!.fullName;
    if (this.presentationUnits !== undefined) {
      schemaJson.presentationUnits = [];
      this.presentationUnits.forEach((unit: IFormat) => {
        schemaJson.presentationUnits.push(unit.name);
      });
    }
    return schemaJson;
  }

  public deserializeSync(kindOfQuantityProps: KindOfQuantityProps) {
    super.deserializeSync(kindOfQuantityProps);
    this._relativeError = kindOfQuantityProps.relativeError;

    const persistenceUnit = this.schema.lookupItemSync<Unit>(kindOfQuantityProps.persistenceUnit);
    if (undefined === persistenceUnit)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The SchemaItem ${kindOfQuantityProps.persistenceUnit} does not exist.`);
    else
      this._persistenceUnit = new DelayedPromiseWithProps(persistenceUnit.key, async () => persistenceUnit);

    if (kindOfQuantityProps.presentationUnits)
      this.processPresentationUnitsSync(kindOfQuantityProps.presentationUnits);
  }

  public async deserialize(kindOfQuantityProps: KindOfQuantityProps) {
    await super.deserialize(kindOfQuantityProps);
    this._relativeError = kindOfQuantityProps.relativeError;

    const persistenceUnit = await this.schema.lookupItem<Unit>(kindOfQuantityProps.persistenceUnit);
    if (undefined === persistenceUnit)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The SchemaItem ${kindOfQuantityProps.persistenceUnit} does not exist.`);
    else
      this._persistenceUnit = new DelayedPromiseWithProps(persistenceUnit.key, async () => persistenceUnit);

    if (kindOfQuantityProps.presentationUnits)
      await this.processPresentationUnits(kindOfQuantityProps.presentationUnits);
  }

  public async accept(visitor: SchemaItemVisitor) {
    if (visitor.visitKindOfQuantity)
      await visitor.visitKindOfQuantity((this as any) as KindOfQuantity);
  }
  public acceptSync(visitor: SchemaItemVisitor) {
    if (visitor.visitKindOfQuantitySync)
      visitor.visitKindOfQuantitySync((this as any) as KindOfQuantity);
  }
}
