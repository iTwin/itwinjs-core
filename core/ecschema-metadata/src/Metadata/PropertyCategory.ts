/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
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

  /**
   * Save this PropertyCategory's properties to an object for serializing to JSON.
   * @param standalone Serialization includes only this object (as opposed to the full schema).
   * @param includeSchemaVersion Include the Schema's version information in the serialized object.
   */
  public toJSON(standalone: boolean = false, includeSchemaVersion: boolean = false): PropertyCategoryProps {
    const schemaJson = super.toJSON(standalone, includeSchemaVersion) as any;
    schemaJson.priority = this.priority;
    return schemaJson;
  }

  /** @internal */
  public async toXml(schemaXml: Document): Promise<Element> {
    const itemElement = await super.toXml(schemaXml);
    itemElement.setAttribute("priority", this.priority.toString());
    return itemElement;
  }

  public fromJSONSync(propertyCategoryProps: PropertyCategoryProps) {
    super.fromJSONSync(propertyCategoryProps);
    this._priority = propertyCategoryProps.priority;
  }

  public async fromJSON(propertyCategoryProps: PropertyCategoryProps) {
    this.fromJSONSync(propertyCategoryProps);
  }
}
