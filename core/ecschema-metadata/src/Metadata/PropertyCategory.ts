/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { Schema } from "./Schema";
import { SchemaItem } from "./SchemaItem";
import { PropertyCategoryProps } from "./../Deserialization/JsonProps";
import { SchemaItemType } from "./../ECObjects";

/**
 * @beta
 */
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

  /** @internal */
  public async toXml(schemaXml: Document): Promise<Element> {
    const itemElement = await super.toXml(schemaXml);
    itemElement.setAttribute("priority", this.priority.toString());
    return itemElement;
  }

  public deserializeSync(propertyCategoryProps: PropertyCategoryProps) {
    super.deserializeSync(propertyCategoryProps);
    this._priority = propertyCategoryProps.priority;
  }

  public async deserialize(propertyCategoryProps: PropertyCategoryProps) {
    this.deserializeSync(propertyCategoryProps);
  }
}
