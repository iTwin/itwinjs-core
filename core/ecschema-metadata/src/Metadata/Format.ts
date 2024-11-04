/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Metadata
 */

import { SchemaItemFormatProps } from "../Deserialization/JsonProps";
import { XmlSerializationUtils } from "../Deserialization/XmlSerializationUtils";
import { SchemaItemType } from "../ECObjects";
import { ECObjectsError, ECObjectsStatus } from "../Exception";
import {
  BaseFormat, DecimalPrecision, FormatTraits, formatTraitsToArray, FormatType, FractionalPrecision,
  ScientificType, ShowSignOption,
} from "@itwin/core-quantity";
import { InvertedUnit } from "./InvertedUnit";
import { Schema } from "./Schema";
import { SchemaItem } from "./SchemaItem";
import { Unit } from "./Unit";

/**
 * @beta
 */
export class Format extends SchemaItem {
  public override readonly schemaItemType!: SchemaItemType.Format;
  protected _base: BaseFormat;
  protected _units?: Array<[Unit | InvertedUnit, string | undefined]>;

  constructor(schema: Schema, name: string) {
    super(schema, name);
    this.schemaItemType = SchemaItemType.Format;

    this._base = new BaseFormat(name);
  }

  public get roundFactor(): number { return this._base.roundFactor; }
  public get type(): FormatType { return this._base.type; }
  public get precision(): DecimalPrecision | FractionalPrecision { return this._base.precision; }
  public get minWidth(): number | undefined { return this._base.minWidth; }
  public get scientificType(): ScientificType | undefined { return this._base.scientificType; }
  public get showSignOption(): ShowSignOption { return this._base.showSignOption; }
  public get decimalSeparator(): string { return this._base.decimalSeparator; }
  public get thousandSeparator(): string { return this._base.thousandSeparator; }
  public get uomSeparator(): string { return this._base.uomSeparator; }
  public get stationSeparator(): string { return this._base.stationSeparator; }
  public get stationOffsetSize(): number | undefined { return this._base.stationOffsetSize; }
  public get formatTraits(): FormatTraits { return this._base.formatTraits; }
  public get spacer(): string | undefined { return this._base.spacer; }
  public get includeZero(): boolean | undefined { return this._base.includeZero; }
  public get units(): Array<[Unit | InvertedUnit, string | undefined]> | undefined { return this._units; }

  private parseFormatTraits(formatTraitsFromJson: string | string[]) {
    return this._base.parseFormatTraits(formatTraitsFromJson);
  }

  public hasFormatTrait(formatTrait: FormatTraits) {
    return this._base.hasFormatTraitSet(formatTrait);
  }

  /**
   * Adds a Unit, or InvertedUnit, with an optional label override.
   * @param unit The Unit, or InvertedUnit, to add to this Format.
   * @param label A label that overrides the label defined within the Unit when a value is formatted.
   */
  protected addUnit(unit: Unit | InvertedUnit, label?: string) {
    if (undefined === this._units)
      this._units = [];
    else { // Validate that a duplicate is not added.
      for (const existingUnit of this._units) {
        if (unit.fullName.toLowerCase() === existingUnit[0].fullName.toLowerCase())
          throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${this.fullName} has duplicate units, '${unit.fullName}'.`); // TODO: Validation - this should be a validation error not a hard failure.
      }
    }

    this._units.push([unit, label]);
  }

  protected setPrecision(precision: number) { this._base.precision = precision; }

  private typecheck(formatProps: SchemaItemFormatProps) {
    this._base.loadFormatProperties(formatProps);

    if (undefined !== formatProps.composite) { // TODO: This is duplicated below when the units need to be processed...
      if (undefined !== formatProps.composite.includeZero)
        this._base.includeZero = formatProps.composite.includeZero;

      if (undefined !== formatProps.composite.spacer) {
        if (formatProps.composite.spacer.length > 1)
          throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${this.fullName} has a composite with an invalid 'spacer' attribute. It should be an empty or one character string.`);
        this._base.spacer = formatProps.composite.spacer;
      }

      // Composite requires 1-4 units
      if (formatProps.composite.units.length <= 0 || formatProps.composite.units.length > 4)
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Format ${this.fullName} has an invalid 'Composite' attribute. It should have 1-4 units.`);
    }
  }

  public override fromJSONSync(formatProps: SchemaItemFormatProps) {
    super.fromJSONSync(formatProps);
    this.typecheck(formatProps);
    if (undefined === formatProps.composite)
      return;

    // Units are separated from the rest of the deserialization because of the need to have separate sync and async implementation
    for (const unit of formatProps.composite.units) {
      const newUnit = this.schema.lookupItemSync<Unit | InvertedUnit>(unit.name);
      if (undefined === newUnit)
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, ``);
      this.addUnit(newUnit, unit.label);
    }
  }

  public override async fromJSON(formatProps: SchemaItemFormatProps) {
    await super.fromJSON(formatProps);
    this.typecheck(formatProps);
    if (undefined === formatProps.composite)
      return;

    // Units are separated from the rest of the deserialization because of the need to have separate sync and async implementation
    for (const unit of formatProps.composite.units) {
      const newUnit = await this.schema.lookupItem<Unit | InvertedUnit>(unit.name);
      if (undefined === newUnit)
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, ``);
      this.addUnit(newUnit, unit.label);
    }
  }

  /**
   * Save this Format's properties to an object for serializing to JSON.
   * @param standalone Serialization includes only this object (as opposed to the full schema).
   * @param includeSchemaVersion Include the Schema's version information in the serialized object.
   */
  public override toJSON(standalone: boolean = false, includeSchemaVersion: boolean = false): SchemaItemFormatProps {
    const schemaJson = super.toJSON(standalone, includeSchemaVersion) as any;
    schemaJson.type = this.type;
    schemaJson.precision = this.precision;

    // this._spacer = " ";
    // this._includeZero = true;

    // Serialize the minimal amount of information needed so anything that is the same as the default, do not serialize.
    if (0.0 !== this.roundFactor)
      schemaJson.roundFactor = this.roundFactor;
    if (ShowSignOption.OnlyNegative !== this.showSignOption)
      schemaJson.showSignOption = this.showSignOption;
    if (FormatTraits.Uninitialized !== this.formatTraits)
      schemaJson.formatTraits = formatTraitsToArray(this.formatTraits);
    if ("." !== this.decimalSeparator)
      schemaJson.decimalSeparator = this.decimalSeparator;
    if ("," !== this.thousandSeparator)
      schemaJson.thousandSeparator = this.thousandSeparator;
    if (" " !== this.uomSeparator)
      schemaJson.uomSeparator = this.uomSeparator;

    if (undefined !== this.minWidth)
      schemaJson.minWidth = this.minWidth;

    if (FormatType.Scientific === this.type && undefined !== this.scientificType)
      schemaJson.scientificType = this.scientificType;

    if (FormatType.Station === this.type) {
      if (undefined !== this.stationOffsetSize)
        schemaJson.stationOffsetSize = this.stationOffsetSize;
      if (" " !== this.stationSeparator)
        schemaJson.stationSeparator = this.stationSeparator;
    }

    if (undefined === this.units)
      return schemaJson;

    schemaJson.composite = {};

    if (" " !== this.spacer)
      schemaJson.composite.spacer = this.spacer;

    if (true !== this.includeZero)
      schemaJson.composite.includeZero = this.includeZero;

    schemaJson.composite.units = [];
    for (const unit of this.units) {
      schemaJson.composite.units.push({
        name: unit[0].fullName,
        label: unit[1],
      });
    }

    return schemaJson;
  }

  /** @internal */
  public override async toXml(schemaXml: Document): Promise<Element> {
    const itemElement = await super.toXml(schemaXml);
    itemElement.setAttribute("type", this.type.toLowerCase());
    itemElement.setAttribute("precision", this.precision.toString());
    itemElement.setAttribute("roundFactor", this.roundFactor.toString());
    itemElement.setAttribute("showSignOption", this.showSignOption);
    itemElement.setAttribute("decimalSeparator", this.decimalSeparator);
    itemElement.setAttribute("thousandSeparator", this.thousandSeparator);
    itemElement.setAttribute("uomSeparator", this.uomSeparator);
    itemElement.setAttribute("stationSeparator", this.stationSeparator);

    if (undefined !== this.minWidth)
      itemElement.setAttribute("minWidth", this.minWidth.toString());
    if (undefined !== this.scientificType)
      itemElement.setAttribute("scientificType", this.scientificType);
    if (undefined !== this.stationOffsetSize)
      itemElement.setAttribute("stationOffsetSize", this.stationOffsetSize.toString());

    const formatTraits = formatTraitsToArray(this.formatTraits);
    if (formatTraits.length > 0)
      itemElement.setAttribute("formatTraits", formatTraits.join("|"));

    if (undefined !== this.units) {
      const compositeElement = schemaXml.createElement("Composite");
      if (undefined !== this.spacer)
        compositeElement.setAttribute("spacer", this.spacer);
      if (undefined !== this.includeZero)
        compositeElement.setAttribute("includeZero", this.includeZero.toString());

      this.units.forEach(([unit, label]) => {
        const unitElement = schemaXml.createElement("Unit");
        if (undefined !== label)
          unitElement.setAttribute("label", label);
        const unitName = XmlSerializationUtils.createXmlTypedName(this.schema, unit.schema, unit.name);
        unitElement.textContent = unitName;
        compositeElement.appendChild(unitElement);
      });

      itemElement.appendChild(compositeElement);
    }

    return itemElement;
  }

  /**
   * @alpha Used in schema editing.
   */
  protected setFormatType(formatType: FormatType) {
    this._base.type = formatType;
  }

  /**
   * @alpha Used in schema editing.
   */
  protected setRoundFactor(roundFactor: number) {
    this._base.roundFactor = roundFactor;
  }

  /**
   * @alpha Used in schema editing.
   */
  protected setShowSignOption(signOption: ShowSignOption) {
    this._base.showSignOption = signOption;
  }

  /**
   * @alpha Used in schema editing.
   */
  protected setDecimalSeparator(separator: string) {
    this._base.decimalSeparator = separator;
  }

  /**
   * @alpha Used in schema editing.
   */
  protected setThousandSeparator(separator: string) {
    this._base.thousandSeparator = separator;
  }

  /**
   * @alpha Used in schema editing.
   */
  protected setUomSeparator(separator: string) {
    this._base.uomSeparator = separator;
  }

  /**
   * @alpha Used in schema editing.
   */
  protected setStationSeparator(separator: string) {
    this._base.stationSeparator = separator;
  }
}

/**
 * @internal
 * An abstract class used for schema editing.
 */
export abstract class MutableFormat extends Format {
  public abstract override addUnit(unit: Unit | InvertedUnit, label?: string): void;
  public abstract override setPrecision(precision: number): void;
  public abstract override setFormatType(formatType: FormatType): void;
  public abstract override setRoundFactor(roundFactor: number): void;
  public abstract override setShowSignOption(signOption: ShowSignOption): void;
  public abstract override setDecimalSeparator(separator: string): void;
  public abstract override setThousandSeparator(separator: string): void;
  public abstract override setUomSeparator(separator: string): void;
  public abstract override setStationSeparator(separator: string): void;
  public abstract override setDisplayLabel(displayLabel: string): void;
}
