/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import SchemaItem from "./SchemaItem";
import { ECObjectsError, ECObjectsStatus } from "./../Exception";
import { SchemaItemType } from "./../ECObjects";
import { SchemaItemKey } from "./../SchemaKey";
import { SchemaItemVisitor, LazyLoadedUnitSystem, LazyLoadedUnit } from "./../Interfaces";
import Schema from "./Schema";
import UnitSystem from "./UnitSystem";
import Unit from "./Unit";
import { DelayedPromiseWithProps } from "./../DelayedPromise";

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

  public toJson(standalone: boolean, includeSchemaVersion: boolean) {
    const schemaJson = super.toJson(standalone, includeSchemaVersion);
    schemaJson.invertsUnit = this.invertsUnit!.name;
    schemaJson.unitSystem = this.unitSystem!.name;
    return schemaJson;
  }

  /**
   * Populates this Inverted Unit with the values from the provided.
   */
  public async fromJson(jsonObj: any): Promise<void> {
    this.fromJsonSync(jsonObj);
  }

  /**
   * Populates this Inverted Unit with the values from the provided.
   */
  public fromJsonSync(jsonObj: any): void {
    super.fromJsonSync(jsonObj);
    if (undefined === jsonObj.invertsUnit)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The InvertedUnit ${this.name} does not have the required 'invertsUnit' attribute.`);
    if (typeof (jsonObj.invertsUnit) !== "string")
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The InvertedUnit ${this.name} has an invalid 'invertsUnit' attribute. It should be of type 'string'.`);
    const unitSchemaItemKey = this.schema.getSchemaItemKey(jsonObj.invertsUnit);
    if (!unitSchemaItemKey)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `Unable to locate the invertsUnit ${jsonObj.invertsUnit}.`);
    this._invertsUnit = new DelayedPromiseWithProps<SchemaItemKey, Unit>(unitSchemaItemKey,
      async () => {
        const invertsUnit = await this.schema.lookupItem<Unit>(unitSchemaItemKey);
        if (undefined === invertsUnit)
          throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `Unable to locate the invertsUnit ${jsonObj.invertsUnit}.`);
        return invertsUnit;
      });

    if (undefined === jsonObj.unitSystem)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The InvertedUnit ${this.name} does not have the required 'unitSystem' attribute.`);
    if (typeof (jsonObj.unitSystem) !== "string")
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The InvertedUnit ${this.name} has an invalid 'unitSystem' attribute. It should be of type 'string'.`);
    const unitSystemSchemaItemKey = this.schema.getSchemaItemKey(jsonObj.unitSystem);
    if (!unitSystemSchemaItemKey)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `Unable to locate the unitSystem ${jsonObj.unitSystem}.`);
    this._unitSystem = new DelayedPromiseWithProps<SchemaItemKey, UnitSystem>(unitSystemSchemaItemKey,
      async () => {
        const unitSystem = await this.schema.lookupItem<UnitSystem>(unitSystemSchemaItemKey);
        if (undefined === unitSystem)
          throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `Unable to locate the unitSystem ${jsonObj.unitSystem}.`);
        return unitSystem;
      });
  }

  public async accept(visitor: SchemaItemVisitor) {
    if (visitor.visitInvertedUnit)
      await visitor.visitInvertedUnit(this);
  }
}
