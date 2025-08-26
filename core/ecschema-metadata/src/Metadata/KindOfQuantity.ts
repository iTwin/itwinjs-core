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
import { LazyLoadedFormat, LazyLoadedInvertedUnit, LazyLoadedUnit } from "../Interfaces";
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
  private _presentationFormats: Array<LazyLoadedFormat | OverrideFormat> = [];
  private _persistenceUnit?: LazyLoadedUnit | LazyLoadedInvertedUnit;

  /** The first presentation format in the list of Formats. */
  public get defaultPresentationFormat(): LazyLoadedFormat | OverrideFormat | undefined { return this.presentationFormats[0]; }

  /** A list of presentation formats. */
  public get presentationFormats(): Array<LazyLoadedFormat | OverrideFormat> { return this._presentationFormats; }

  /** Persistence unit */
  public get persistenceUnit(): LazyLoadedUnit | LazyLoadedInvertedUnit | undefined { return this._persistenceUnit; }

  public get relativeError() { return this._relativeError; }

  /**
   *
   * @param format The Format to add to this KindOfQuantity
   * @param isDefault
   * @internal
   */
  protected addPresentationFormat(format: LazyLoadedFormat | OverrideFormat, isDefault: boolean = false) {
    // TODO: Add some sort of validation?
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    (isDefault) ? this._presentationFormats.splice(0, 0, format) : this._presentationFormats.push(format);
  }

  /** Creates an OverrideFormat in the context of this KindOfQuantity.
   * @param parent The Format to override.
   * @param precision The precision override
   * @param unitLabelOverrides The list of unit and label overrides.
   * @internal
   */
  protected createFormatOverride(parent: Format, precision?: number, unitLabelOverrides?: Array<[LazyLoadedUnit | LazyLoadedInvertedUnit, string | undefined]>): OverrideFormat {
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
        this.addPresentationFormat(new DelayedPromiseWithProps(format.key, async () => format));
        continue;
      }

      let unitAndLabels: Array<[LazyLoadedUnit | LazyLoadedInvertedUnit, string | undefined]> | undefined;
      if (undefined !== presFormatOverride.unitAndLabels) {
        if (4 < presFormatOverride.unitAndLabels.length)
          throw new ECSchemaError(ECSchemaStatus.InvalidECJson, ``);

        unitAndLabels = [];
        for (const unitOverride of presFormatOverride.unitAndLabels) {
          const unitOrInverted = await this.schema.lookupItem(unitOverride[0]);

          if(Unit.isUnit(unitOrInverted))
            unitAndLabels.push([new DelayedPromiseWithProps(unitOrInverted.key, async () => unitOrInverted), unitOverride[1]]);
          else if(InvertedUnit.isInvertedUnit(unitOrInverted))
            unitAndLabels.push([new DelayedPromiseWithProps(unitOrInverted.key, async () => unitOrInverted), unitOverride[1]]);
          else
            throw new ECSchemaError(ECSchemaStatus.InvalidECJson, `Unable to locate SchemaItem ${unitOverride[0]}.`);
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
        this.addPresentationFormat(new DelayedPromiseWithProps(format.key, async () => format));
        continue;
      }

      let unitAndLabels: Array<[LazyLoadedUnit | LazyLoadedInvertedUnit, string | undefined]> | undefined;
      if (undefined !== presFormatOverride.unitAndLabels) {
        if (4 < presFormatOverride.unitAndLabels.length)
          throw new ECSchemaError(ECSchemaStatus.InvalidECJson, ``);

        unitAndLabels = [];
        for (const unitOverride of presFormatOverride.unitAndLabels) {
          const unitOrInverted = this.schema.lookupItemSync(unitOverride[0]);
          if(Unit.isUnit(unitOrInverted))
            unitAndLabels.push([new DelayedPromiseWithProps(unitOrInverted.key, async () => unitOrInverted), unitOverride[1]]);
          else if(InvertedUnit.isInvertedUnit(unitOrInverted))
            unitAndLabels.push([new DelayedPromiseWithProps(unitOrInverted.key, async () => unitOrInverted), unitOverride[1]]);
          else
          throw new ECSchemaError(ECSchemaStatus.InvalidECJson, `Unable to locate SchemaItem ${unitOverride[0]}.`);
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
      schemaJson.presentationUnits = this.presentationFormats.map((format) => format.fullName);
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
      const presUnitStrings: string[] = [];
      for(const format of this.presentationFormats) {
        if (!OverrideFormat.isOverrideFormat(format)) {
          const resolvedFormat = await format;
          presUnitStrings.push(XmlSerializationUtils.createXmlTypedName(this.schema, resolvedFormat.schema, format.name));
          continue;
        }
        presUnitStrings.push(format.fullNameXml(this.schema));
      };
      itemElement.setAttribute("presentationUnits", presUnitStrings.join(";"));
    }
    itemElement.setAttribute("relativeError", this.relativeError.toString());

    return itemElement;
  }

  public override fromJSONSync(kindOfQuantityProps: KindOfQuantityProps): void {
    super.fromJSONSync(kindOfQuantityProps);
    this._relativeError = kindOfQuantityProps.relativeError;

    const unitItemKey = this.schema.getSchemaItemKey(kindOfQuantityProps.persistenceUnit);
    this._persistenceUnit = new DelayedPromiseWithProps(unitItemKey, async () => {
      const unitItem = await this.schema.lookupItem(unitItemKey, Unit)
        || await this.schema.lookupItem(unitItemKey, InvertedUnit);

      if (undefined === unitItem)
        throw new ECSchemaError(ECSchemaStatus.InvalidECJson, `Unable to locate the unit ${kindOfQuantityProps.persistenceUnit}.`);

      return unitItem;
    }) as LazyLoadedUnit | LazyLoadedInvertedUnit;

    if (undefined !== kindOfQuantityProps.presentationUnits)
      this.processPresentationUnitsSync(kindOfQuantityProps.presentationUnits);
  }

  public override async fromJSON(kindOfQuantityProps: KindOfQuantityProps): Promise<void> {
    this.fromJSONSync(kindOfQuantityProps);
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
  public abstract override addPresentationFormat(format: LazyLoadedFormat | OverrideFormat, isDefault: boolean): void;
  public abstract override createFormatOverride(parent: Format, precision?: number, unitLabelOverrides?: Array<[LazyLoadedUnit | LazyLoadedInvertedUnit, string | undefined]>): OverrideFormat;
  public abstract override setDisplayLabel(displayLabel: string): void;
  public abstract override setPersistenceUnit(value: LazyLoadedUnit | LazyLoadedInvertedUnit | undefined): void;
  public abstract override setRelativeError(relativeError: number): void;
}
