/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import SchemaItem from "./SchemaItem";
import { ECObjectsError, ECObjectsStatus } from "../Exception";
import { SchemaItemType } from "../ECObjects";
import { SchemaItemVisitor } from "../Interfaces";
import Schema from "./Schema";

/**
 * An InvertedUnit is a a specific type of Unit that describes the inverse of a single Unit whose dimensional derivation is unit-less.
 */
export default class InvertedUnit extends SchemaItem {
  public readonly schemaItemType!: SchemaItemType.InvertedUnit; // tslint:disable-line
  protected _invertsUnit: string; // required
  protected _unitSystem?: string; // required

  constructor(schema: Schema, name: string) {
    super(schema, name, SchemaItemType.InvertedUnit);
    this._invertsUnit = "";
  }

  get invertsUnit(): string | undefined { return this._invertsUnit; }
  get unitSystem(): string | undefined {return this._unitSystem; }

  public async fromJson(jsonObj: any): Promise<void> {
    await super.fromJson(jsonObj);

    if (undefined === jsonObj.invertsUnit)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The InvertedUnit ${jsonObj.name} does not have the required 'invertsUnit' attribute.`);
    if (typeof(jsonObj.invertsUnit) !== "string")
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The InvertedUnit ${jsonObj.name} has an invalid 'invertsUnit' attribute. It should be of type 'string'.`);
    else if (this._invertsUnit !== "" && jsonObj.invertsUnit.toLowerCase() !== this._invertsUnit.toLowerCase())
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, ``);
    else if (this._invertsUnit === "") // this is the default value for the invertsUnit, which we assigned in the constructor
      this._invertsUnit = jsonObj.invertsUnit; // so, if we have yet to define the invertsUnit variable, assign it the json invertsUnit

    if (undefined === jsonObj.unitSystem)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The InvertedUnit ${jsonObj.name} does not have the required 'unitSystem' attribute.`);
    if (typeof(jsonObj.unitSystem) !== "string")
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The InvertedUnit ${jsonObj.name} has an invalid 'unitSystem' attribute. It should be of type 'string'.`);
    else if (this._unitSystem !== undefined && jsonObj.unitSystem.toLowerCase() !== this._unitSystem.toLowerCase())
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, ``);
    else if (this._unitSystem === undefined) // if we have yet to define the unitSystem variable, assign it the json unitSystem
      this._unitSystem = jsonObj.unitSystem;

  }
  public async accept(visitor: SchemaItemVisitor) {
    if (visitor.visitInvertedUnit)
      await visitor.visitInvertedUnit(this);
  }
}
