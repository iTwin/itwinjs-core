/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/
import { SchemaItemType } from "../ECObjects";
import { SchemaItemVisitor, LazyLoadedPhenomenon } from "../Interfaces";
import Schema from "./Schema";
import { ECObjectsError, ECObjectsStatus } from "../Exception";
import SchemaItem from "./SchemaItem";
import Phenomenon from "./Phenomenon";
import { DelayedPromiseWithProps } from "../DelayedPromise";

/**
 * A Constant is a specific type of Unit that represents a number.
 */
export default class Constant extends SchemaItem {
  public readonly schemaItemType!: SchemaItemType.Constant; // tslint:disable-line
  protected _phenomenon?: LazyLoadedPhenomenon;
  protected _definition: string;
  protected _numerator = 1.0;
  protected _denominator = 1.0;

  constructor(schema: Schema, name: string) {
    super(schema, name);
    this._definition = "";
    this.schemaItemType = SchemaItemType.Constant;
  }

  get phenomenon(): LazyLoadedPhenomenon | undefined { return this._phenomenon; }
  get definition(): string { return this._definition; }
  get numerator(): number { return this._numerator; }
  get denominator(): number { return this._denominator; }

  private loadConstantProperties(jsonObj: any) {
    if (undefined === jsonObj.definition)
    throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Constant ${this.name} does not have the required 'definition' attribute.`);
    if (typeof(jsonObj.definition) !== "string")
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Constant ${this.name} has an invalid 'definition' attribute. It should be of type 'string'.`);
    if (this._definition !== "" && jsonObj.definition.toLowerCase() !== this._definition.toLowerCase())
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Constant ${this.name} has an invalid 'definition' attribute.`);
    else if (this._definition === "") // this is the default value for the definition, which we assigned in the constructor
      this._definition = jsonObj.definition; // so, if we have yet to define the definition variable, assign it the json definition

    if (undefined !== jsonObj.numerator) { // optional; default is 1.0
      if (typeof(jsonObj.numerator) !== "number")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Constant ${this.name} has an invalid 'numerator' attribute. It should be of type 'number'.`);
      if (jsonObj.numerator !== this._numerator) // if numerator isnt default value of 1.0, reassign numerator variable
        this._numerator = jsonObj.numerator;
    }

    if (undefined !== jsonObj.denominator) { // optional; default is 1.0
      if (typeof(jsonObj.denominator) !== "number")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Constant ${this.name} has an invalid 'denominator' attribute. It should be of type 'number'.`);
      if (jsonObj.denominator !== this._denominator) // if denominator isnt default value of 1.0, reassign denominator variable
        this._denominator = jsonObj.denominator;
    }
  }

  /**
   * Populates this Constant with the values from the provided.
   */
  public async fromJson(jsonObj: any): Promise<void> {
    await super.fromJson(jsonObj);
    if (undefined === jsonObj.phenomenon)
    throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Constant ${this.name} does not have the required 'phenomenon' attribute.`);
    if (typeof(jsonObj.phenomenon) !== "string")
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Constant ${this.name} has an invalid 'phenomenon' attribute. It should be of type 'string'.`);
    const phenomenon = await this.schema.getItem<Phenomenon>(jsonObj.phenomenon, true);
    if (!phenomenon)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, ``);
    this._phenomenon = new DelayedPromiseWithProps(phenomenon.key, async () => phenomenon);
    this.loadConstantProperties(jsonObj);
  }

  /**
   * Populates this Constant with the values from the provided.
   */
  public fromJsonSync(jsonObj: any): void {
    super.fromJsonSync(jsonObj);
    if (undefined === jsonObj.phenomenon)
    throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Constant ${this.name} does not have the required 'phenomenon' attribute.`);
    if (typeof(jsonObj.phenomenon) !== "string")
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Constant ${this.name} has an invalid 'phenomenon' attribute. It should be of type 'string'.`);
    const phenomenon = this.schema.getItemSync<Phenomenon>(jsonObj.phenomenon, true);
    if (!phenomenon)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, ``);
    this._phenomenon = new DelayedPromiseWithProps(phenomenon.key, async () => phenomenon);
    this.loadConstantProperties(jsonObj);
  }

  public async accept(visitor: SchemaItemVisitor) {
    if (visitor.visitConstant)
      await visitor.visitConstant(this);
  }
}
