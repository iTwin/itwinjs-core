/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { Schema } from "./Schema";
import { SchemaItem } from "./SchemaItem";
import { PropertyCategoryProps } from "./../Deserialization/JsonProps";
import { SchemaItemType } from "./../ECObjects";
import { SchemaItemVisitor } from "./../Interfaces";

export class PropertyCategory extends SchemaItem {
  public readonly schemaItemType!: SchemaItemType.PropertyCategory; // tslint:disable-line
  protected _priority: number;

  get priority() { return this._priority; }

  constructor(schema: Schema, name: string) {
    super(schema, name);
    this.schemaItemType = SchemaItemType.PropertyCategory;
    this._priority = 0;
  }

  public toJson(standalone: boolean, includeSchemaVersion: boolean) {
    const schemaJson = super.toJson(standalone, includeSchemaVersion);
    schemaJson.priority = this.priority;
    return schemaJson;
  }

  public deserializeSync(propertyCategoryProps: PropertyCategoryProps) {
    super.deserializeSync(propertyCategoryProps);
    this._priority = propertyCategoryProps.priority;
  }

  public async deserialize(propertyCategoryProps: PropertyCategoryProps) {
    this.deserializeSync(propertyCategoryProps);
  }

  public async accept(visitor: SchemaItemVisitor) {
    if (visitor.visitPropertyCategory)
      await visitor.visitPropertyCategory(this);
  }

  public acceptSync(visitor: SchemaItemVisitor) {
    if (visitor.visitPropertyCategorySync)
      visitor.visitPropertyCategorySync(this);
  }
}
