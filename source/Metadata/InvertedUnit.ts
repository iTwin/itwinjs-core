/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import SchemaItem from "./SchemaItem";
import { ECObjectsError, ECObjectsStatus } from "../Exception";
import { SchemaItemType } from "../ECObjects";
import { SchemaItemVisitor, LazyLoadedUnitSystem, LazyLoadedUnit } from "../Interfaces";
import Schema from "./Schema";
import UnitSystem from "./UnitSystem";
import Unit from "./Unit";
import { DelayedPromiseWithProps } from "../DelayedPromise";

/**
 * An InvertedUnit is a specific type of Unit that describes the inverse of a single Unit whose dimensional derivation is unit-less.
 */
export default class InvertedUnit extends SchemaItem {
  public readonly schemaItemType!: SchemaItemType.InvertedUnit; // tslint:disable-line
  protected _invertsUnit?: LazyLoadedUnit; // required
  protected _unitSystem?: LazyLoadedUnitSystem; // required

  constructor(schema: Schema, name: string) {
    super(schema, name);
    this.schemaItemType = SchemaItemType.InvertedUnit;
  }

  get invertsUnit(): LazyLoadedUnit | undefined { return this._invertsUnit; }
  get unitSystem(): LazyLoadedUnitSystem | undefined { return this._unitSystem; }

  /**
   * Populates this Inverted Unit with the values from the provided.
   */
  public async fromJson(jsonObj: any): Promise<void> {
    await super.fromJson(jsonObj);
    if (undefined === jsonObj.invertsUnit)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The InvertedUnit ${this.name} does not have the required 'invertsUnit' attribute.`);
    if (typeof(jsonObj.invertsUnit) !== "string")
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The InvertedUnit ${this.name} has an invalid 'invertsUnit' attribute. It should be of type 'string'.`);
    const invertsUnit = await this.schema.getItem<Unit>(jsonObj.invertsUnit, true);
    if (!invertsUnit)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `Cannot find the Unit ${jsonObj.invertsUnit}.`);
    this._invertsUnit = new DelayedPromiseWithProps(invertsUnit.key, async () => invertsUnit);

    if (undefined === jsonObj.unitSystem)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The InvertedUnit ${this.name} does not have the required 'unitSystem' attribute.`);
    if (typeof(jsonObj.unitSystem) !== "string")
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The InvertedUnit ${this.name} has an invalid 'unitSystem' attribute. It should be of type 'string'.`);
    const unitSystem = await this.schema.getItem<UnitSystem>(jsonObj.unitSystem, true);
    if (!unitSystem)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `Cannot find the Unit System ${jsonObj.unitSystem}.`);
    this._unitSystem = new DelayedPromiseWithProps(unitSystem.key, async () => unitSystem);
  }

  /**
   * Populates this Inverted Unit with the values from the provided.
   */
  public fromJsonSync(jsonObj: any): void {
    super.fromJsonSync(jsonObj);
    if (undefined === jsonObj.invertsUnit)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The InvertedUnit ${this.name} does not have the required 'invertsUnit' attribute.`);
    if (typeof(jsonObj.invertsUnit) !== "string")
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The InvertedUnit ${this.name} has an invalid 'invertsUnit' attribute. It should be of type 'string'.`);
    const invertsUnit = this.schema.getItemSync<Unit>(jsonObj.invertsUnit, true);
    if (!invertsUnit)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `Cannot find the Unit ${jsonObj.invertsUnit}.`);
    this._invertsUnit = new DelayedPromiseWithProps(invertsUnit.key, async () => invertsUnit);

    if (undefined === jsonObj.unitSystem)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The InvertedUnit ${this.name} does not have the required 'unitSystem' attribute.`);
    if (typeof(jsonObj.unitSystem) !== "string")
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The InvertedUnit ${this.name} has an invalid 'unitSystem' attribute. It should be of type 'string'.`);
    const unitSystem = this.schema.getItemSync<UnitSystem>(jsonObj.unitSystem, true);
    if (!unitSystem)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `Cannot find the Unit System ${jsonObj.unitSystem}.`);
    this._unitSystem = new DelayedPromiseWithProps(unitSystem.key, async () => unitSystem);
  }

  public async accept(visitor: SchemaItemVisitor) {
    if (visitor.visitInvertedUnit)
      await visitor.visitInvertedUnit(this);
  }
}
