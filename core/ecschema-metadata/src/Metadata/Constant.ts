/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Metadata
 */

import { DelayedPromiseWithProps } from "../DelayedPromise";
import { ConstantProps } from "../Deserialization/JsonProps";
import { XmlSerializationUtils } from "../Deserialization/XmlSerializationUtils";
import { SchemaItemType } from "../ECObjects";
import { ECSchemaError, ECSchemaStatus } from "../Exception";
import { LazyLoadedPhenomenon } from "../Interfaces";
import { SchemaItemKey } from "../SchemaKey";
import { Phenomenon } from "./Phenomenon";
import { Schema } from "./Schema";
import { SchemaItem } from "./SchemaItem";

/**
 * A Constant is a specific type of Unit that represents a number.
 * @public @preview
 */
export class Constant extends SchemaItem {
  public override readonly schemaItemType = Constant.schemaItemType;
  /** @internal */
  public static override get schemaItemType() { return SchemaItemType.Constant; }
  private _phenomenon?: LazyLoadedPhenomenon;
  private _definition: string;
  private _numerator?: number;
  private _denominator?: number;

  /** @internal */
  constructor(schema: Schema, name: string) {
    super(schema, name);
    this._definition = "";
  }

  public get phenomenon(): LazyLoadedPhenomenon | undefined { return this._phenomenon; }
  public get definition(): string { return this._definition; }
  public get numerator(): number { return this._numerator ?? 1.0; }
  public get denominator(): number { return this._denominator ?? 1.0; }
  public get hasNumerator(): boolean { return (this._numerator !== undefined); }
  public get hasDenominator(): boolean { return (this._denominator !== undefined); }

  /**
   * Save this Constants properties to an object for serializing to JSON.
   * @param standalone Serialization includes only this object (as opposed to the full schema).
   * @param includeSchemaVersion Include the Schema's version information in the serialized object.
   */
  public override toJSON(standalone: boolean = false, includeSchemaVersion: boolean = false): ConstantProps {
    const schemaJson = super.toJSON(standalone, includeSchemaVersion) as any;
    if (this.phenomenon !== undefined)
      schemaJson.phenomenon = this.phenomenon.fullName;
    schemaJson.definition = this.definition;
    if (this.hasNumerator)
      schemaJson.numerator = this.numerator;
    if (this.hasDenominator)
      schemaJson.denominator = this.denominator;
    return schemaJson as ConstantProps;
  }

  /** @internal */
  public override async toXml(schemaXml: Document): Promise<Element> {
    const itemElement = await super.toXml(schemaXml);
    itemElement.setAttribute("definition", this.definition);
    if (this.hasNumerator)
      itemElement.setAttribute("numerator", this.numerator.toString());
    if (this.hasDenominator)
      itemElement.setAttribute("denominator", this.denominator.toString());

    const phenomenon = await this.phenomenon;
    if (undefined !== phenomenon) {
      const phenomenonName = XmlSerializationUtils.createXmlTypedName(this.schema, phenomenon.schema, phenomenon.name);
      itemElement.setAttribute("phenomenon", phenomenonName);
    }

    return itemElement;
  }

  public override fromJSONSync(constantProps: ConstantProps) {
    super.fromJSONSync(constantProps);

    const schemaItemKey = this.schema.getSchemaItemKey(constantProps.phenomenon);
    if (!schemaItemKey)
      throw new ECSchemaError(ECSchemaStatus.InvalidECJson, `Unable to locate the phenomenon ${constantProps.phenomenon}.`);
    this._phenomenon = new DelayedPromiseWithProps<SchemaItemKey, Phenomenon>(schemaItemKey,
      async () => {
        const phenom = await this.schema.lookupItem(schemaItemKey, Phenomenon);
        if (undefined === phenom)
          throw new ECSchemaError(ECSchemaStatus.InvalidECJson, `Unable to locate the phenomenon ${constantProps.phenomenon}.`);
        return phenom;
      });

    if (this._definition !== "" && constantProps.definition.toLowerCase() !== this._definition.toLowerCase())
      throw new ECSchemaError(ECSchemaStatus.InvalidECJson, `The Constant ${this.name} has an invalid 'definition' attribute.`);
    else if (this._definition === "")
      this._definition = constantProps.definition;

    if (undefined !== constantProps.numerator) {
      if (constantProps.numerator !== this._numerator)
        this._numerator = constantProps.numerator;
    }

    if (undefined !== constantProps.denominator) {
      if (constantProps.denominator !== this._denominator)
        this._denominator = constantProps.denominator;
    }
  }

  public override async fromJSON(constantProps: ConstantProps) {
    this.fromJSONSync(constantProps);
  }

  /**
   * @param phenomenon A LazyLoadedPhenomenon.
   * @internal
   */
  protected setPhenomenon(phenomenon: LazyLoadedPhenomenon) {
    this._phenomenon = phenomenon;
  }

  /**
   * @internal
   */
  protected setDefinition(definition: string) {
    this._definition = definition;
  }

  /**
   * @internal
   */
  protected setNumerator(numerator: number) {
    this._numerator = numerator;
  }

  /**
   * @internal
   */
  protected setDenominator(denominator: number) {
    this._denominator = denominator;
  }

  /**
   * Type guard to check if the SchemaItem is of type Constant.
   * @param item The SchemaItem to check.
   * @returns True if the item is a Constant, false otherwise.
   */
  public static isConstant(item?: SchemaItem): item is Constant {
    if (item && item.schemaItemType === SchemaItemType.Constant)
      return true;

    return false;
  }

  /**
   * Type assertion to check if the SchemaItem is of type Constant.
   * @param item The SchemaItem to check.
   * @returns The item cast to Constant if it is a Constant, undefined otherwise.
   * @internal
   */
  public static assertIsConstant(item?: SchemaItem): asserts item is Constant {
    if (!this.isConstant(item))
      throw new ECSchemaError(ECSchemaStatus.InvalidSchemaItemType, `Expected '${SchemaItemType.Constant}' (Constant)`);
  }
}
/**
 * @internal
 * An abstract class used for schema editing.
 */
export abstract class MutableConstant extends Constant {
  public abstract override setPhenomenon(phenomenon: LazyLoadedPhenomenon): void;
  public abstract override setDefinition(definition: string): void;
  public abstract override setNumerator(numerator: number): void;
  public abstract override setDenominator(denominator: number): void;
  public abstract override setDisplayLabel(displayLabel: string): void;
}
