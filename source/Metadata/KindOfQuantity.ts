/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import SchemaChild from "./SchemaChild";
import { ECObjectsError, ECObjectsStatus } from "../Exception";
import { SchemaChildType } from "../ECObjects";
import { SchemaChildVisitor } from "../Interfaces";
import Schema from "./Schema";

export class FormatUnitSpec {
  public unit: string;
  public format: string;
}

/**
 * A Typescript class representation of a KindOfQuantity.
 */
export default class KindOfQuantity extends SchemaChild {
  public readonly type: SchemaChildType.KindOfQuantity;
  protected _precision: number;
  protected _presentationUnits: FormatUnitSpec[];
  protected _persistenceUnit: FormatUnitSpec;

  get precision() { return this._precision; }

  get presentationUnits() { return this._presentationUnits; }

  get persistenceUnit() { return this._persistenceUnit; }

  constructor(schema: Schema, name: string, label?: string, description?: string) {
    super(schema, name, label, description);
    this.key.type = SchemaChildType.KindOfQuantity;
  }

  public get defaultPresentationUnit() {
    return this.presentationUnits.length === 0 ? undefined : this.presentationUnits[0];
  }

  public async fromJson(jsonObj: any) {
    await super.fromJson(jsonObj);

    if (jsonObj.precision) {
      if (typeof(jsonObj.precision) !== "number")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The KindOfQuantity ${this.name} has an invalid 'precision' attribute. It should be of type 'number'.`);
      this._precision = jsonObj.precision;
    }

    if (jsonObj.presentationUnits)
      this._presentationUnits = jsonObj.presentationUnits as FormatUnitSpec[];

    if (jsonObj.persistenceUnit)
      this._persistenceUnit = jsonObj.persistenceUnit as FormatUnitSpec;
  }

  public async accept(visitor: SchemaChildVisitor) {
    if (visitor.visitKindOfQuantity)
      await visitor.visitKindOfQuantity(this);
  }
}
