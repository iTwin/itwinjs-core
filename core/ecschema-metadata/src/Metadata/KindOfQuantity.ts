/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Metadata
 */

import { DelayedPromiseWithProps } from "../DelayedPromise.js";
import { KindOfQuantityProps } from "../Deserialization/JsonProps.js";
import { XmlSerializationUtils } from "../Deserialization/XmlSerializationUtils.js";
import { SchemaItemType } from "../ECObjects.js";
import { ECObjectsError, ECObjectsStatus } from "../Exception.js";
import { LazyLoadedInvertedUnit, LazyLoadedUnit } from "../Interfaces.js";
import { Format } from "./Format.js";
import { InvertedUnit } from "./InvertedUnit.js";
import { OverrideFormat, OverrideFormatProps } from "./OverrideFormat.js";
import { SchemaItem } from "./SchemaItem.js";
import { Unit } from "./Unit.js";

/** A Typescript class representation of a KindOfQuantity.
 * @beta
 */
export class KindOfQuantity extends SchemaItem {
  public override readonly schemaItemType = KindOfQuantity.schemaItemType;
  public static override get schemaItemType() { return SchemaItemType.KindOfQuantity; }
  protected _relativeError: number = 1.0;
  protected _presentationFormats: Array<Format | OverrideFormat> = new Array<Format | OverrideFormat>();
  protected _persistenceUnit?: LazyLoadedUnit | LazyLoadedInvertedUnit;

  /** The first presentation format in the list of Formats. */
  public get defaultPresentationFormat(): Format | OverrideFormat | undefined { return this.presentationFormats[0]; }

  /** A list of presentation formats. */
  public get presentationFormats(): Array<Format | OverrideFormat> { return this._presentationFormats; }

  public get persistenceUnit(): LazyLoadedUnit | LazyLoadedInvertedUnit | undefined { return this._persistenceUnit; }
  protected set persistenceUnit(value: LazyLoadedUnit | LazyLoadedInvertedUnit | undefined) { this._persistenceUnit = value; }

  public get relativeError() { return this._relativeError; }

  /**
   *
   * @param format The Format to add to this KindOfQuantity
   * @param isDefault
   */
  protected addPresentationFormat(format: Format | OverrideFormat, isDefault: boolean = false) {
    // TODO: Add some sort of validation?
    (isDefault) ? this._presentationFormats.splice(0, 0, format) : this._presentationFormats.push(format);
  }

  /** Creates an OverrideFormat in the context of this KindOfQuantity.
   * @param parent The Format to override.
   * @param precision The precision override
   * @param unitLabelOverrides The list of unit and label overrides.
   */
  protected createFormatOverride(parent: Format, precision?: number, unitLabelOverrides?: Array<[Unit | InvertedUnit, string | undefined]>): OverrideFormat {
    if (unitLabelOverrides && parent.units && parent.units.length !== unitLabelOverrides.length)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `Cannot add presentation format to KindOfQuantity '${this.name}' because the number of unit overrides is inconsistent with the number in the Format '${parent.name}'.`);

    if (parent.units && 0 === parent.units.length && unitLabelOverrides && 0 < unitLabelOverrides.length)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `Cannot add a presentation format to KindOfQuantity '${this.name}' without any units and no unit overrides.`);

    // TODO: Check compatibility of Unit overrides with the persistence unit

    return new OverrideFormat(parent, precision, unitLabelOverrides);
  }

  private async processPresentationUnits(presentationUnitsJson: string | string[]): Promise<void> {
    const presUnitsArr = Array.isArray(presentationUnitsJson) ? presentationUnitsJson : presentationUnitsJson.split(";");
    for (const formatString of presUnitsArr) {
      const presFormatOverride: OverrideFormatProps = OverrideFormat.parseFormatString(formatString);

      const format = await this.schema.lookupItem(presFormatOverride.name, Format);
      if (undefined === format || format.schemaItemType !== SchemaItemType.Format)
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `Unable to locate Format '${presFormatOverride.name}' for the presentation unit on KindOfQuantity ${this.fullName}.`);

      if (undefined === presFormatOverride.precision && undefined === presFormatOverride.unitAndLabels) {
        this.addPresentationFormat(format);
        continue;
      }

      let unitAndLabels: Array<[Unit | InvertedUnit, string | undefined]> | undefined;
      if (undefined !== presFormatOverride.unitAndLabels) {
        if (4 < presFormatOverride.unitAndLabels.length)
          throw new ECObjectsError(ECObjectsStatus.InvalidECJson, ``);

        unitAndLabels = [];
        for (const unitOverride of presFormatOverride.unitAndLabels) {
          const unitOrInverted = await this.schema.lookupItem(unitOverride[0]);
          if (undefined === unitOrInverted || (!Unit.isUnit(unitOrInverted) && !InvertedUnit.isInvertedUnit(unitOrInverted)))
            throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `Unable to locate SchemaItem ${unitOverride[0]}.`);

          unitAndLabels.push([unitOrInverted, unitOverride[1]]);
        }
      }

      const overrideFormat: OverrideFormat = this.createFormatOverride(format, presFormatOverride.precision, unitAndLabels);
      this.addPresentationFormat(overrideFormat);
    }
  }

  private processPresentationUnitsSync(presentationUnitsJson: string | string[]): void {
    const presUnitsArr = Array.isArray(presentationUnitsJson) ? presentationUnitsJson : presentationUnitsJson.split(";");
    for (const formatString of presUnitsArr) {
      const presFormatOverride: OverrideFormatProps = OverrideFormat.parseFormatString(formatString);

      const format = this.schema.lookupItemSync(presFormatOverride.name, Format);
      if (undefined === format || format.schemaItemType !== SchemaItemType.Format)
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `Unable to locate Format '${presFormatOverride.name}' for the presentation unit on KindOfQuantity ${this.fullName}.`);

      if (undefined === presFormatOverride.precision && undefined === presFormatOverride.unitAndLabels) {
        this.addPresentationFormat(format);
        continue;
      }

      let unitAndLabels: Array<[Unit | InvertedUnit, string | undefined]> | undefined;
      if (undefined !== presFormatOverride.unitAndLabels) {
        if (4 < presFormatOverride.unitAndLabels.length)
          throw new ECObjectsError(ECObjectsStatus.InvalidECJson, ``);

        unitAndLabels = [];
        for (const unitOverride of presFormatOverride.unitAndLabels) {
          const unitOrInverted = this.schema.lookupItemSync(unitOverride[0]);
          if (undefined === unitOrInverted || (!Unit.isUnit(unitOrInverted) && !InvertedUnit.isInvertedUnit(unitOrInverted)))
            throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `Unable to locate SchemaItem ${unitOverride[0]}.`);

          unitAndLabels.push([unitOrInverted, unitOverride[1]]);
        }
      }

      const overrideFormat: OverrideFormat = this.createFormatOverride(format, presFormatOverride.precision, unitAndLabels);
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
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Unit ${kindOfQuantityProps.persistenceUnit} does not exist.`);

    if (!Unit.isUnit(persistenceUnit) && !InvertedUnit.isInvertedUnit(persistenceUnit))
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The item ${kindOfQuantityProps.persistenceUnit} is not a Unit or InvertedUnit.`);

    if(Unit.isUnit(persistenceUnit))
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
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Unit ${kindOfQuantityProps.persistenceUnit} does not exist.`);

    if (!Unit.isUnit(persistenceUnit) && !InvertedUnit.isInvertedUnit(persistenceUnit))
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The item ${kindOfQuantityProps.persistenceUnit} is not a Unit or InvertedUnit.`);

    if(Unit.isUnit(persistenceUnit))
      this._persistenceUnit = new DelayedPromiseWithProps(persistenceUnit.key, async () => persistenceUnit);
    else
      this._persistenceUnit = new DelayedPromiseWithProps(persistenceUnit.key, async () => persistenceUnit);


    if (undefined !== kindOfQuantityProps.presentationUnits)
      await this.processPresentationUnits(kindOfQuantityProps.presentationUnits);
  }

  /**
   * @alpha
   * Used for schema editing.
   */
  protected setRelativeError(relativeError: number): void {
    this._relativeError = relativeError;
  }

  /**
   * Type guard to check if the SchemaItem is of type KindOfQuantity.
   * @param item The SchemaItem to check.
   * @returns True if the item is a KindOfQuantity, false otherwise.
   */
  public static isKindOfQuantity(item?: SchemaItem): item is KindOfQuantity {
    return item?.schemaItemType === SchemaItemType.KindOfQuantity;
  }

  /**
   * Type assertion to check if the SchemaItem is of type KindOfQuantity.
   * @param item The SchemaItem to check.
   * @returns The item cast to KindOfQuantity if it is a KindOfQuantity, undefined otherwise.
   */
  public static assertIsKindOfQuantity(item?: SchemaItem): asserts item is KindOfQuantity {
    if (!this.isKindOfQuantity(item))
      throw new ECObjectsError(ECObjectsStatus.InvalidSchemaItemType, `Expected '${SchemaItemType.KindOfQuantity}' (KindOfQuantity)`);
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
}
