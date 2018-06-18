/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import SchemaItem from "./SchemaItem";
import { ECObjectsError, ECObjectsStatus } from "../Exception";
import { SchemaItemType } from "../ECObjects";
import { SchemaItemVisitor } from "../Interfaces";
import Schema from "./Schema";

export default class PropertyCategory extends SchemaItem {
  public readonly type!: SchemaItemType.PropertyCategory; // tslint:disable-line
  protected _priority: number = 0;

  get priority() { return this._priority; }

  constructor(schema: Schema, name: string) {
    super(schema, name, SchemaItemType.PropertyCategory);
  }

  public async fromJson(jsonObj: any): Promise<void> {
    await super.fromJson(jsonObj);
    this.propertyCategoryFromJson(jsonObj);
  }

  public fromJsonSync(jsonObj: any): void {
    super.fromJsonSync(jsonObj);
    this.propertyCategoryFromJson(jsonObj);
  }

  public propertyCategoryFromJson(jsonObj: any): void {
    if (undefined !== jsonObj.priority) {
      if (typeof(jsonObj.priority) !== "number")
        throw new ECObjectsError(ECObjectsStatus.InvalidECJson, `The PropertyCategory ${this.name} has an invalid 'priority' attribute. It should be of type 'number'.`);
      this._priority = jsonObj.priority;
    }
  }

  public async accept(visitor: SchemaItemVisitor) {
    if (visitor.visitPropertyCategory)
      await visitor.visitPropertyCategory(this);
  }
}
