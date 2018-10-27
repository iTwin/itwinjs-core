/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import Schema from "./Schema";
import SchemaItem from "./SchemaItem";
import Phenomenon from "./Phenomenon";
import UnitSystem from "./UnitSystem";
import { DelayedPromiseWithProps } from "./../DelayedPromise";
import { SchemaItemType } from "./../ECObjects";
import { UnitProps } from "./../Deserialization/JsonProps";
import { ECObjectsError, ECObjectsStatus } from "./../Exception";
import { LazyLoadedPhenomenon, LazyLoadedUnitSystem, SchemaItemVisitor } from "./../Interfaces";
import { SchemaItemKey } from "./../SchemaKey";

/**
 * An abstract class that adds the ability to define Units and everything that goes with them, within an ECSchema as a
 * first-class concept is to allow the iModel to not be dependent on any hard-coded Units
 */
export default class Unit extends SchemaItem {
  public readonly schemaItemType!: SchemaItemType.Unit; // tslint:disable-line
  protected _phenomenon?: LazyLoadedPhenomenon;
  protected _unitSystem?: LazyLoadedUnitSystem;
  protected _definition: string;
  protected _numerator: number;
  protected _denominator: number;
  protected _offset: number;

  constructor(schema: Schema, name: string) {
    super(schema, name);
    this.schemaItemType = SchemaItemType.Unit;
    this._definition = "";
    this._numerator = 1.0;
    this._denominator = 1.0;
    this._offset = 0.0;
  }

  get phenomenon(): LazyLoadedPhenomenon | undefined { return this._phenomenon; }
  get unitSystem(): LazyLoadedUnitSystem | undefined { return this._unitSystem; }
  get definition(): string { return this._definition; }
  get numerator(): number { return this._numerator; }
  get offset(): number { return this._offset; }
  get denominator(): number { return this._denominator; }

  public toJson(standalone: boolean, includeSchemaVersion: boolean) {
    const schemaJson = super.toJson(standalone, includeSchemaVersion);
    schemaJson.phenomenon = this.phenomenon!.fullName;
    schemaJson.unitSystem = this.unitSystem!.fullName;
    schemaJson.definition = this.definition;
    if (undefined !== this.numerator)
      schemaJson.numerator = this.numerator;
    if (undefined !== this.denominator)
      schemaJson.denominator = this.denominator;
    if (undefined !== this.offset)
      schemaJson.offset = this.offset;
    return schemaJson;
  }

  public deserializeSync(unitProps: UnitProps) {
    super.deserializeSync(unitProps);

    const phenomenonSchemaItemKey = this.schema.getSchemaItemKey(unitProps.phenomenon);
    if (!phenomenonSchemaItemKey)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `Unable to locate the phenomenon ${unitProps.phenomenon}.`);
    this._phenomenon = new DelayedPromiseWithProps<SchemaItemKey, Phenomenon>(phenomenonSchemaItemKey,
      async () => {
        const phenom = await this.schema.lookupItem<Phenomenon>(phenomenonSchemaItemKey);
        if (undefined === phenom)
          throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `Unable to locate the phenomenon ${unitProps.phenomenon}.`);
        return phenom;
      });

    const unitSystemSchemaItemKey = this.schema.getSchemaItemKey(unitProps.unitSystem);
    if (!unitSystemSchemaItemKey)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `Unable to locate the unitSystem ${unitProps.unitSystem}.`);
    this._unitSystem = new DelayedPromiseWithProps<SchemaItemKey, UnitSystem>(unitSystemSchemaItemKey,
      async () => {
        const unitSystem = await this.schema.lookupItem<UnitSystem>(unitSystemSchemaItemKey);
        if (undefined === unitSystem)
          throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `Unable to locate the unitSystem ${unitProps.unitSystem}.`);
        return unitSystem;
      });

    if (this._definition !== "" && unitProps.definition.toLowerCase() !== this._definition.toLowerCase())
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Unit ${this.name} has an invalid 'definition' attribute.`);
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

  public async deserialize(unitProps: UnitProps) {
    this.deserializeSync(unitProps);
  }

  public async accept(visitor: SchemaItemVisitor) {
    if (visitor.visitUnit)
      await visitor.visitUnit(this);
  }
}
