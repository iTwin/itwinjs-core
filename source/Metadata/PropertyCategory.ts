/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import SchemaChild from "./SchemaChild";
import { ECObjectsError, ECObjectsStatus } from "../Exception";
import { SchemaChildType } from "../ECObjects";
import { SchemaChildVisitor } from "../Interfaces";
import Schema from "./Schema";

export default class PropertyCategory extends SchemaChild {
  public readonly type: SchemaChildType.PropertyCategory;
  protected _priority: number;

  get priority() { return this._priority; }

  constructor(schema: Schema, name: string, label?: string, description?: string) {
    super(schema, name, label, description);
    this.key.type = SchemaChildType.PropertyCategory;
  }

  public async fromJson(jsonObj: any) {
    await super.fromJson(jsonObj);

    if (jsonObj.priority) {
      if (typeof(jsonObj.priority) !== "number")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The PropertyCategory ${this.name} has an invalid 'priority' attribute. It should be of type 'number'.`);
      this._priority = jsonObj.priority;
    }
  }

  public async accept(visitor: SchemaChildVisitor) {
    if (visitor.visitPropertyCategory)
      await visitor.visitPropertyCategory(this);
  }
}
