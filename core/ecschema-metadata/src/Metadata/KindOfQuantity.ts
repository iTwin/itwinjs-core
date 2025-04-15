/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Metadata
 */

import { DelayedPromiseWithProps } from "../DelayedPromise";
import { KindOfQuantityProps } from "../Deserialization/JsonProps";
import { XmlSerializationUtils } from "../Deserialization/XmlSerializationUtils";
import { SchemaItemType } from "../ECObjects";
import { ECSchemaError, ECSchemaStatus } from "../Exception";
import { LazyLoadedInvertedUnit, LazyLoadedUnit } from "../Interfaces";
import { Format } from "./Format";
import { InvertedUnit } from "./InvertedUnit";
import { OverrideFormat, OverrideFormatProps } from "./OverrideFormat";
import { SchemaItem } from "./SchemaItem";
import { Unit } from "./Unit";

/** A Typescript class representation of a KindOfQuantity.
 * @public @preview
 */
export class KindOfQuantity extends SchemaItem {
  public override readonly schemaItemType = KindOfQuantity.schemaItemType;
  /** @internal */
  public static override get schemaItemType() { return SchemaItemType.KindOfQuantity; }
  private _relativeError: number = 1.0;
  private _presentationFormats: Array<Format | OverrideFormat> = new Array<Format | OverrideFormat>();
  private _persistenceUnit?: LazyLoadedUnit | LazyLoadedInvertedUnit;

  /** The first presentation format in the list of Formats. */
  public get defaultPresentationFormat(): Format | OverrideFormat | undefined { return this.presentationFormats[0]; }

  /** A list of presentation formats. */
  public get presentationFormats(): Array<Format | OverrideFormat> { return this._presentationFormats; }

  /** Persistence unit */
  public get persistenceUnit(): LazyLoadedUnit | LazyLoadedInvertedUnit | undefined { return this._persistenceUnit; }

  public get relativeError() { return this._relativeError; }

  /**
   *
   * @param format The Format to add to this KindOfQuantity
   * @param isDefault
   * @internal
   */
  protected addPresentationFormat(format: Format | OverrideFormat, isDefault: boolean = false) {
    // TODO: Add some sort of validation?
    (isDefault) ? this._presentationFormats.splice(0, 0, format) : this._presentationFormats.push(format);
  }

  /** Creates an OverrideFormat in the context of this KindOfQuantity.
   * @param parent The Format to override.
   * @param precision The precision override
   * @param unitLabelOverrides The list of unit and label overrides.
   * @internal
   */
  protected createFormatOverride(parent: Format, precision?: number, unitLabelOverrides?: Array<[Unit | InvertedUnit, string | undefined]>): OverrideFormat {
    if (unitLabelOverrides && parent.units && parent.units.length !== unitLabelOverrides.length)
      throw new ECSchemaError(ECSchemaStatus.InvalidECJson, `Cannot add presentation format to KindOfQuantity '${this.name}' because the number of unit overrides is inconsistent with the number in the Format '${parent.name}'.`);

    if (parent.units && 0 === parent.units.length && unitLabelOverrides && 0 < unitLabelOverrides.length)
      throw new ECSchemaError(ECSchemaStatus.InvalidECJson, `Cannot add a presentation format to KindOfQuantity '${this.name}' without any units and no unit overrides.`);

    // TODO: Check compatibility of Unit overrides with the persistence unit

    return new OverrideFormat(parent, precision, unitLabelOverrides);
  }

  private async processPresentationUnits(presentationUnitsJson: string | string[]): Promise<void> {
    const presUnitsArr = Array.isArray(presentationUnitsJson) ? presentationUnitsJson : presentationUnitsJson.split(";");
    for (const formatString of presUnitsArr) {
      const presFormatOverride: OverrideFormatProps = OverrideFormat.parseFormatString(formatString);

      const format = await this.schema.lookupItem(presFormatOverride.name, Format);
      if (undefined === format || format.schemaItemType !== SchemaItemType.Format)
        throw new ECSchemaError(ECSchemaStatus.InvalidECJson, `Unable to locate Format '${presFormatOverride.name}' for the presentation unit on KindOfQuantity ${this.fullName}.`);

      if (undefined === presFormatOverride.precision && undefined === presFormatOverride.unitAndLabels) {
        this.addPresentationFormat(format);
        continue;
      }

      let unitAndLabels: Array<[Unit | InvertedUnit, string | undefined]> | undefined;
      if (undefined !== presFormatOverride.unitAndLabels) {
        if (4 < presFormatOverride.unitAndLabels.length)
          throw new ECSchemaError(ECSchemaStatus.InvalidECJson, ``);

        unitAndLabels = [];
        for (const unitOverride of presFormatOverride.unitAndLabels) {
          const unitOrInverted = await this.schema.lookupItem(unitOverride[0]);
          if (undefined === unitOrInverted || (!Unit.isUnit(unitOrInverted) && !InvertedUnit.isInvertedUnit(unitOrInverted)))
            throw new ECSchemaError(ECSchemaStatus.InvalidECJson, `Unable to locate SchemaItem ${unitOverride[0]}.`);

          unitAndLabels.push([unitOrInverted, unitOverride[1]]);
        }
      }

      const overrideFormat = this.createFormatOverride(format, presFormatOverride.precision, unitAndLabels);
      this.addPresentationFormat(overrideFormat);
    }
  }

  private processPresentationUnitsSync(presentationUnitsJson: string | string[]): void {
    const presUnitsArr = Array.isArray(presentationUnitsJson) ? presentationUnitsJson : presentationUnitsJson.split(";");
    for (const formatString of presUnitsArr) {
      const presFormatOverride: OverrideFormatProps = OverrideFormat.parseFormatString(formatString);

      const format = this.schema.lookupItemSync(presFormatOverride.name, Format);
      if (undefined === format || format.schemaItemType !== SchemaItemType.Format)
        throw new ECSchemaError(ECSchemaStatus.InvalidECJson, `Unable to locate Format '${presFormatOverride.name}' for the presentation unit on KindOfQuantity ${this.fullName}.`);

      if (undefined === presFormatOverride.precision && undefined === presFormatOverride.unitAndLabels) {
        this.addPresentationFormat(format);
        continue;
      }

      let unitAndLabels: Array<[Unit | InvertedUnit, string | undefined]> | undefined;
      if (undefined !== presFormatOverride.unitAndLabels) {
        if (4 < presFormatOverride.unitAndLabels.length)
          throw new ECSchemaError(ECSchemaStatus.InvalidECJson, ``);

        unitAndLabels = [];
        for (const unitOverride of presFormatOverride.unitAndLabels) {
          const unitOrInverted = this.schema.lookupItemSync(unitOverride[0]);
          if (undefined === unitOrInverted || (!Unit.isUnit(unitOrInverted) && !InvertedUnit.isInvertedUnit(unitOrInverted)))
            throw new ECSchemaError(ECSchemaStatus.InvalidECJson, `Unable to locate SchemaItem ${unitOverride[0]}.`);

          unitAndLabels.push([unitOrInverted, unitOverride[1]]);
        }
      }

      const overrideFormat = this.createFormatOverride(format, presFormatOverride.precision, unitAndLabels);
      this.addPresentationFormat(overrideFormat);
    }
  }

  /**
   * Save this KindOfQuantity's properties to an object for serializing to JSON.
   * @param standalone Serialization includes only this object (as opposed to the full schema).
   * @param includeSchemaVersion Include the Schema's version information in the serialized object.
   */
  public override toJSON(standalone: boolean = false, includeSchemaVersion: boolean = false): KindOfQuantityProps {
    const schemaJson = super.toJSON(standalone, includeSchemaVersion) as any;
    schemaJson.relativeError = this.relativeError;
    schemaJson.persistenceUnit = this.persistenceUnit!.fullName;
    if (undefined !== this.presentationFormats && 0 < this.presentationFormats.length)
      schemaJson.presentationUnits = this.presentationFormats.map((format: Format | OverrideFormat) => format.fullName);
    return schemaJson;
  }

  /** @internal */
  public override async toXml(schemaXml: Document): Promise<Element> {
    const itemElement = await super.toXml(schemaXml);

    const persistenceUnit = await this.persistenceUnit;
    if (undefined !== persistenceUnit) {
      const unitName = XmlSerializationUtils.createXmlTypedName(this.schema, persistenceUnit.schema, persistenceUnit.name);
      itemElement.setAttribute("persistenceUnit", unitName);
    }

    if (undefined !== this.presentationFormats) {
      const presUnitStrings = this.presentationFormats.map((format: Format | OverrideFormat) => {
        if (!OverrideFormat.isOverrideFormat(format))
          return XmlSerializationUtils.createXmlTypedName(this.schema, format.schema, format.name);
        return format.fullNameXml(this.schema);
      });
      itemElement.setAttribute("presentationUnits", presUnitStrings.join(";"));
    }
    itemElement.setAttribute("relativeError", this.relativeError.toString());

    return itemElement;
  }

  public override fromJSONSync(kindOfQuantityProps: KindOfQuantityProps): void {
    super.fromJSONSync(kindOfQuantityProps);
    this._relativeError = kindOfQuantityProps.relativeError;

    const persistenceUnit = this.schema.lookupItemSync(kindOfQuantityProps.persistenceUnit);
    if (undefined === persistenceUnit)
      throw new ECSchemaError(ECSchemaStatus.InvalidECJson, `The Unit ${kindOfQuantityProps.persistenceUnit} does not exist.`);

    if (!Unit.isUnit(persistenceUnit) && !InvertedUnit.isInvertedUnit(persistenceUnit))
      throw new ECSchemaError(ECSchemaStatus.InvalidECJson, `The item ${kindOfQuantityProps.persistenceUnit} is not a Unit or InvertedUnit.`);

    if (Unit.isUnit(persistenceUnit))
      this._persistenceUnit = new DelayedPromiseWithProps(persistenceUnit.key, async () => persistenceUnit);
    else
      this._persistenceUnit = new DelayedPromiseWithProps(persistenceUnit.key, async () => persistenceUnit);

    if (undefined !== kindOfQuantityProps.presentationUnits)
      this.processPresentationUnitsSync(kindOfQuantityProps.presentationUnits);
  }

  public override async fromJSON(kindOfQuantityProps: KindOfQuantityProps): Promise<void> {
    await super.fromJSON(kindOfQuantityProps);
    this._relativeError = kindOfQuantityProps.relativeError;

    const persistenceUnit = await this.schema.lookupItem(kindOfQuantityProps.persistenceUnit);
    if (undefined === persistenceUnit)
      throw new ECSchemaError(ECSchemaStatus.InvalidECJson, `The Unit ${kindOfQuantityProps.persistenceUnit} does not exist.`);

    if (!Unit.isUnit(persistenceUnit) && !InvertedUnit.isInvertedUnit(persistenceUnit))
      throw new ECSchemaError(ECSchemaStatus.InvalidECJson, `The item ${kindOfQuantityProps.persistenceUnit} is not a Unit or InvertedUnit.`);

    if (Unit.isUnit(persistenceUnit))
      this._persistenceUnit = new DelayedPromiseWithProps(persistenceUnit.key, async () => persistenceUnit);
    else
      this._persistenceUnit = new DelayedPromiseWithProps(persistenceUnit.key, async () => persistenceUnit);


    if (undefined !== kindOfQuantityProps.presentationUnits)
      await this.processPresentationUnits(kindOfQuantityProps.presentationUnits);
  }

  /**
   * Used for schema editing.
   * @internal
   */
  protected setRelativeError(relativeError: number): void {
    this._relativeError = relativeError;
  }

  /**
   * Used for schema editing.
   * @internal
   */
  protected setPersistenceUnit(value: LazyLoadedUnit | LazyLoadedInvertedUnit | undefined): void {
    this._persistenceUnit = value;
  }

  /**
   * Type guard to check if the SchemaItem is of type KindOfQuantity.
   * @param item The SchemaItem to check.
   * @returns True if the item is a KindOfQuantity, false otherwise.
   */
  public static isKindOfQuantity(item?: SchemaItem): item is KindOfQuantity {
    if (item && item.schemaItemType === SchemaItemType.KindOfQuantity)
      return true;

    return false;
  }

  /**
   * Type assertion to check if the SchemaItem is of type KindOfQuantity.
   * @param item The SchemaItem to check.
   * @returns The item cast to KindOfQuantity if it is a KindOfQuantity, undefined otherwise.
   * @internal
   */
  public static assertIsKindOfQuantity(item?: SchemaItem): asserts item is KindOfQuantity {
    if (!this.isKindOfQuantity(item))
      throw new ECSchemaError(ECSchemaStatus.InvalidSchemaItemType, `Expected '${SchemaItemType.KindOfQuantity}' (KindOfQuantity)`);
  }
}
/**
 * @internal
 * An abstract class used for schema editing.
 */
export abstract class MutableKindOfQuantity extends KindOfQuantity {
  public abstract override addPresentationFormat(format: Format | OverrideFormat, isDefault: boolean): void;
  public abstract override createFormatOverride(parent: Format, precision?: number, unitLabelOverrides?: Array<[Unit | InvertedUnit, string | undefined]>): OverrideFormat;
  public abstract override setDisplayLabel(displayLabel: string): void;
  public abstract override setPersistenceUnit(value: LazyLoadedUnit | LazyLoadedInvertedUnit | undefined): void;
  public abstract override setRelativeError(relativeError: number): void;
}
