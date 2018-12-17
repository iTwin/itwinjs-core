/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { Schema } from "./Schema";
import { SchemaItem } from "./SchemaItem";
import { SchemaItemType } from "./../ECObjects";
import { SchemaItemVisitor } from "./../Interfaces";

export class UnitSystem extends SchemaItem {
  public readonly schemaItemType!: SchemaItemType.UnitSystem; // tslint:disable-line

  constructor(schema: Schema, name: string) {
    super(schema, name);
    this.schemaItemType = SchemaItemType.UnitSystem;
  }

  public async accept(visitor: SchemaItemVisitor) {
    if (visitor.visitUnitSystem)
      await visitor.visitUnitSystem(this);
  }

  public acceptSync(visitor: SchemaItemVisitor) {
    if (visitor.visitUnitSystemSync)
      visitor.visitUnitSystemSync(this);
  }
}
