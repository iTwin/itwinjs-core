/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import SchemaItem from "./SchemaItem";
import { ECObjectsError, ECObjectsStatus } from "../Exception";
import { SchemaItemType } from "../ECObjects";
import { SchemaItemVisitor } from "../Interfaces";
import Schema from "./Schema";
import UnitSystem from "../Metadata/UnitSystem";
import Phenomenon from "../Metadata/Phenomenon";
import { LazyLoadedUnitSystem, LazyLoadedPhenomenon } from "../Interfaces";
import { DelayedPromiseWithProps } from "../DelayedPromise";

/**
 * An abstract class that adds the ability to define Units and everything that goes with them, within an ECSchema as a
 * first-class concept is to allow the iModel to not be dependent on any hard-coded Units
 */
export default class Unit extends SchemaItem {
  public readonly schemaItemType!: SchemaItemType.Unit; // tslint:disable-line
  protected _phenomenon?: LazyLoadedPhenomenon;
  protected _unitSystem?: LazyLoadedUnitSystem;
  protected _definition: string;
  protected _numerator = 1.0;
  protected _denominator = 1.0;
  protected _offset = 0.0;

  constructor(schema: Schema, name: string) {
    super(schema, name);
    this.schemaItemType = SchemaItemType.Unit;
    this._definition = "";
  }

  get phenomenon(): LazyLoadedPhenomenon | undefined { return this._phenomenon; }
  get unitSystem(): LazyLoadedUnitSystem | undefined {return this._unitSystem; }
  get definition(): string { return this._definition; }
  get numerator(): number { return this._numerator; }
  get offset(): number { return this._offset; }
  get denominator(): number { return this._denominator; }

  private loadUnitProperties(jsonObj: any) {
    if (undefined === jsonObj.definition)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Unit ${this.name} does not have the required 'definition' attribute.`);
    if (typeof(jsonObj.definition) !== "string")
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Unit ${this.name} has an invalid 'definition' attribute. It should be of type 'string'.`);
    if (this._definition !== "" && jsonObj.definition.toLowerCase() !== this._definition.toLowerCase())
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Unit ${this.name} has an invalid 'definition' attribute.`);
    else if (this._definition === "") // this is the default value for the definition, which we assigned in the constructor
      this._definition = jsonObj.definition; // so, if we have yet to define the definition variable, assign it the json definition

    if (undefined !== jsonObj.numerator) { // optional; default is 1.0
      if (typeof(jsonObj.numerator) !== "number")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Unit ${this.name} has an invalid 'numerator' attribute. It should be of type 'number'.`);
      if (jsonObj.numerator !== this._numerator) // if numerator isnt default value of 1.0, reassign numerator variable
        this._numerator = jsonObj.numerator;
    }

    if (undefined !== jsonObj.denominator) { // optional; default is 1.0
      if (typeof(jsonObj.denominator) !== "number")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Unit ${this.name} has an invalid 'denominator' attribute. It should be of type 'number'.`);
      if (jsonObj.denominator !== this._denominator) // if denominator isnt default value of 1.0, reassign denominator variable
        this._denominator = jsonObj.denominator;
    }

    if (undefined !== jsonObj.offset) { // optional; default is 0.0
      if (typeof(jsonObj.offset) !== "number")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Unit ${this.name} has an invalid 'offset' attribute. It should be of type 'number'.`);
      if (jsonObj.offset !== this._offset) // if offset isnt default value of 1.0, reassign offset variable
        this._offset = jsonObj.offset;
    }
  }

  /**
   * Populates this Unit with the values from the provided.
   */
  public async fromJson(jsonObj: any): Promise<void> {
    await super.fromJson(jsonObj);
    if (undefined === jsonObj.phenomenon)
    throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Unit ${this.name} does not have the required 'phenomenon' attribute.`);
    if (typeof(jsonObj.phenomenon) !== "string")
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Unit ${this.name} has an invalid 'phenomenon' attribute. It should be of type 'string'.`);
    const phenomenon = await this.schema.getItem<Phenomenon>(jsonObj.phenomenon, true);
    if (!phenomenon)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `Cannot find Phenomenon ${jsonObj.phenomenon}.`);
    this._phenomenon =   new DelayedPromiseWithProps(phenomenon.key, async () => phenomenon);

    if (undefined === jsonObj.unitSystem)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Unit ${this.name} does not have the required 'unitSystem' attribute.`);
    if (typeof(jsonObj.unitSystem) !== "string")
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Unit ${this.name} has an invalid 'unitSystem' attribute. It should be of type 'string'.`);
    const unitSystem = await this.schema.getItem<UnitSystem>(jsonObj.unitSystem, true);
    if (!unitSystem)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `Cannot find Unit System ${jsonObj.unitSystem}.`);
    this._unitSystem =   new DelayedPromiseWithProps(unitSystem.key, async () => unitSystem);

    this.loadUnitProperties(jsonObj);
  }

  /**
   * Populates this Unit with the values from the provided.
   */
  public fromJsonSync(jsonObj: any): void {
    super.fromJsonSync(jsonObj);
    if (undefined === jsonObj.phenomenon)
    throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Unit ${this.name} does not have the required 'phenomenon' attribute.`);
    if (typeof(jsonObj.phenomenon) !== "string")
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Unit ${this.name} has an invalid 'phenomenon' attribute. It should be of type 'string'.`);
    const phenomenon = this.schema.getItemSync<Phenomenon>(jsonObj.phenomenon, true);
    if (!phenomenon)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `Cannot find Phenomenon ${jsonObj.phenomenon}.`);
    this._phenomenon =   new DelayedPromiseWithProps(phenomenon.key, async () => phenomenon);

    if (undefined === jsonObj.unitSystem)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Unit ${this.name} does not have the required 'unitSystem' attribute.`);
    if (typeof(jsonObj.unitSystem) !== "string")
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Unit ${this.name} has an invalid 'unitSystem' attribute. It should be of type 'string'.`);
    const unitSystem = this.schema.getItemSync<UnitSystem>(jsonObj.unitSystem, true);
    if (!unitSystem)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `Cannot find Unit System ${jsonObj.unitSystem}.`);
    this._unitSystem =   new DelayedPromiseWithProps(unitSystem.key, async () => unitSystem);

    this.loadUnitProperties(jsonObj);
  }

  public async accept(visitor: SchemaItemVisitor) {
    if (visitor.visitUnit)
      await visitor.visitUnit(this);
  }
}
