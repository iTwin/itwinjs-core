/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/
import SchemaItem from "./SchemaItem";
import { ECObjectsError, ECObjectsStatus } from "../Exception";
import { SchemaItemType } from "../ECObjects";
import { SchemaItemVisitor } from "../Interfaces";
import Schema from "./Schema";

export default class Phenomenon extends SchemaItem {
  public readonly schemaItemType!: SchemaItemType.Phenomenon; // tslint:disable-line
  protected _definition: string; // Contains a combination of Phenomena names which form this Phenomenon. Each Phenomena name is separated by a * and may have an exponent, specified using parentheses

  constructor(schema: Schema, name: string) {
    super(schema, name, SchemaItemType.Phenomenon);
    this._definition = "";
  }

  get definition(): string { return this._definition; }

  public async fromJson(jsonObj: any): Promise<void> {
    await super.fromJson(jsonObj);

    if (undefined === jsonObj.definition)
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Phenomenon ${jsonObj.name} does not have the required 'definition' attribute.`);
    else if (typeof(jsonObj.definition) !== "string")
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Phenomenon ${jsonObj.name} has an invalid 'definition' attribute. It should be of type 'string'.`);
    else if (this._definition !== "" && jsonObj.definition.toLowerCase() !== this._definition.toLowerCase())
      throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The Phenomenon ${jsonObj.name} has an invalid 'definition' attribute.`);
    else if (this._definition === "") // this is the default value for the definition, which we assigned in the constructor
      this._definition = jsonObj.definition; // so, if we have yet to define the definition variable, assign it the json definition
  }

  public async accept(visitor: SchemaItemVisitor) {
    if (visitor.visitPhenomenon)
      await visitor.visitPhenomenon(this);
  }
}
