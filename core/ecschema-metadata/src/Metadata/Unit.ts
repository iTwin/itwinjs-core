/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Metadata
 */

import { DelayedPromiseWithProps } from "../DelayedPromise";
import { SchemaItemUnitProps } from "../Deserialization/JsonProps";
import { XmlSerializationUtils } from "../Deserialization/XmlSerializationUtils";
import { SchemaItemType } from "../ECObjects";
import { ECSchemaError, ECSchemaStatus } from "../Exception";
import { LazyLoadedPhenomenon, LazyLoadedUnitSystem } from "../Interfaces";
import { SchemaItemKey } from "../SchemaKey";
import { Phenomenon } from "./Phenomenon";
import { Schema } from "./Schema";
import { SchemaItem } from "./SchemaItem";
import { UnitSystem } from "./UnitSystem";

/**
 * An abstract class that adds the ability to define Units and everything that goes with them, within an ECSchema as a
 * first-class concept is to allow the iModel to not be dependent on any hard-coded Units
 * @public @preview
 */
export class Unit extends SchemaItem {
  public override readonly schemaItemType = Unit.schemaItemType;
  /** @internal */
  public static override get schemaItemType() { return SchemaItemType.Unit; }
  private _phenomenon?: LazyLoadedPhenomenon;
  private _unitSystem?: LazyLoadedUnitSystem;
  private _definition: string;
  private _numerator?: number;
  private _denominator?: number;
  private _offset?: number;

  /** @internal */
  constructor(schema: Schema, name: string) {
    super(schema, name);
    this._definition = "";
  }

  public get phenomenon(): LazyLoadedPhenomenon | undefined { return this._phenomenon; }
  public get unitSystem(): LazyLoadedUnitSystem | undefined { return this._unitSystem; }
  public get definition(): string { return this._definition; }
  public get numerator(): number { return this._numerator ?? 1.0; }
  public get offset(): number { return this._offset ?? 0.0; }
  public get denominator(): number { return this._denominator ?? 1.0; }
  public get hasNumerator(): boolean { return (this._numerator !== undefined); }
  public get hasOffset(): boolean { return (this._offset !== undefined); }
  public get hasDenominator(): boolean { return (this._denominator !== undefined); }

  /**
   * Returns true if a conversion can be calculated between the input units
   * @alpha
   */
  public static async areCompatible(unitA: Unit, unitB: Unit): Promise<boolean> {
    const unitAPhenomenon = await unitA.phenomenon;
    const unitBPhenomenon = await unitB.phenomenon;

    if (!unitAPhenomenon || !unitBPhenomenon || !unitAPhenomenon.key.matches(unitBPhenomenon.key))
      return false;
    return true;
  }

  /**
   * Type guard to check if the SchemaItem is of type Unit.
   * @param item The SchemaItem to check.
   * @returns True if the item is a Unit, false otherwise.
   */
  public static isUnit(item?: SchemaItem): item is Unit {
    if (item && item.schemaItemType === SchemaItemType.Unit)
      return true;

    return false;
  }

  /**
   * Save this Unit's properties to an object for serializing to JSON.
   * @param standalone Serialization includes only this object (as opposed to the full schema).
   * @param includeSchemaVersion Include the Schema's version information in the serialized object.
   */
  public override toJSON(standalone: boolean = false, includeSchemaVersion: boolean = false): SchemaItemUnitProps {
    const schemaJson = super.toJSON(standalone, includeSchemaVersion) as any;
    schemaJson.phenomenon = this.phenomenon!.fullName;
    schemaJson.unitSystem = this.unitSystem!.fullName;
    schemaJson.definition = this.definition;
    if (this.hasNumerator)
      schemaJson.numerator = this.numerator;
    if (this.hasDenominator)
      schemaJson.denominator = this.denominator;
    if (this.hasOffset)
      schemaJson.offset = this.offset;
    return schemaJson;
  }

  /** @internal */
  public override async toXml(schemaXml: Document): Promise<Element> {
    const itemElement = await super.toXml(schemaXml);

    const phenomenon = await this.phenomenon;
    if (undefined !== phenomenon) {
      const phenomenonName = XmlSerializationUtils.createXmlTypedName(this.schema, phenomenon.schema, phenomenon.name);
      itemElement.setAttribute("phenomenon", phenomenonName);
    }

    const unitSystem = await this.unitSystem;
    if (undefined !== unitSystem) {
      const unitSystemName = XmlSerializationUtils.createXmlTypedName(this.schema, unitSystem.schema, unitSystem.name);
      itemElement.setAttribute("unitSystem", unitSystemName);
    }

    itemElement.setAttribute("definition", this.definition);
    if (this.hasNumerator)
      itemElement.setAttribute("numerator", this.numerator.toString());
    if (this.hasDenominator)
      itemElement.setAttribute("denominator", this.denominator.toString());
    if (this.hasOffset)
      itemElement.setAttribute("offset", this.offset.toString());

    return itemElement;
  }

  public override fromJSONSync(unitProps: SchemaItemUnitProps) {
    super.fromJSONSync(unitProps);

    const phenomenonSchemaItemKey = this.schema.getSchemaItemKey(unitProps.phenomenon);
    this._phenomenon = new DelayedPromiseWithProps<SchemaItemKey, Phenomenon>(phenomenonSchemaItemKey, async () => {
      const phenom = await this.schema.lookupItem(phenomenonSchemaItemKey, Phenomenon);
      if (undefined === phenom)
        throw new ECSchemaError(ECSchemaStatus.InvalidECJson, `Unable to locate the phenomenon ${unitProps.phenomenon}.`);
      return phenom;
    });

    const unitSystemSchemaItemKey = this.schema.getSchemaItemKey(unitProps.unitSystem);
    this._unitSystem = new DelayedPromiseWithProps<SchemaItemKey, UnitSystem>(unitSystemSchemaItemKey, async () => {
      const unitSystem = await this.schema.lookupItem(unitSystemSchemaItemKey, UnitSystem);
      if (undefined === unitSystem)
        throw new ECSchemaError(ECSchemaStatus.InvalidECJson, `Unable to locate the unitSystem ${unitProps.unitSystem}.`);
      return unitSystem;
    });

    if (this._definition !== "" && unitProps.definition.toLowerCase() !== this._definition.toLowerCase())
      throw new ECSchemaError(ECSchemaStatus.InvalidECJson, `The Unit ${this.name} has an invalid 'definition' attribute.`);
    else if (this._definition === "")
      this._definition = unitProps.definition;

    if (undefined !== unitProps.numerator) {
      if (unitProps.numerator !== this._numerator)
        this._numerator = unitProps.numerator;
    }

    if (undefined !== unitProps.denominator) {
      if (unitProps.denominator !== this._denominator)
        this._denominator = unitProps.denominator;
    }

    if (undefined !== unitProps.offset) {
      if (unitProps.offset !== this._offset)
        this._offset = unitProps.offset;
    }
  }

  public override async fromJSON(unitProps: SchemaItemUnitProps) {
    this.fromJSONSync(unitProps);
  }

  /** @internal */
  protected async setPhenomenon(phenomenon: LazyLoadedPhenomenon) {
    this._phenomenon = phenomenon;
  }

  /** @internal */
  protected async setUnitSystem(unitSystem: LazyLoadedUnitSystem) {
    this._unitSystem = unitSystem;
  }

  /** @internal */
  protected async setDefinition(definition: string) {
    this._definition = definition;
  }

  /**
   * Type assertion to check if the SchemaItem is of type Unit.
   * @param item The SchemaItem to check.
   * @returns The item cast to Unit if it is a Unit, undefined otherwise.
   * @internal
   */
  public static assertIsUnit(item?: SchemaItem): asserts item is Unit {
    if (!this.isUnit(item))
      throw new ECSchemaError(ECSchemaStatus.InvalidSchemaItemType, `Expected '${SchemaItemType.Unit}' (Unit)`);
  }
}
/**
 * @internal
 * An abstract class used for schema editing.
 */
export abstract class MutableUnit extends Unit {
  public abstract override setPhenomenon(phenomenon: LazyLoadedPhenomenon): Promise<void>;
  public abstract override setUnitSystem(unitSystem: LazyLoadedUnitSystem): Promise<void>;
  public abstract override setDefinition(definition: string): Promise<void>;
  public abstract override setDisplayLabel(displayLabel: string): void;
}
