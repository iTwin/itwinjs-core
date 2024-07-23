/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Editing
 */

import { PropertyCategory, PropertyCategoryProps, SchemaItemKey, SchemaItemType, SchemaKey } from "@itwin/ecschema-metadata";
import { SchemaContextEditor } from "./Editor";
import { MutablePropertyCategory } from "./Mutable/MutablePropertyCategory";
import { ECEditingStatus, SchemaEditingError } from "./Exception";
import { SchemaItems } from "./SchemaItems";
import { SchemaItemId } from "./SchemaItemIdentifiers";
import { SchemaEditType } from "./SchmaEditType";

/**
 * @alpha
 * A class allowing you to create schema items of type Property Category.
 */
export class PropertyCategories extends SchemaItems {
  public constructor(schemaEditor: SchemaContextEditor) {
    super(SchemaItemType.PropertyCategory, schemaEditor);
  }

  public async create(schemaKey: SchemaKey, name: string, priority: number, displayLabel?: string): Promise<SchemaItemKey> {
    try {
      const newPropCategory = await this.createSchemaItem<PropertyCategory>(schemaKey, this.schemaItemType, (schema) => schema.createPropertyCategory.bind(schema), name) as MutablePropertyCategory;
      newPropCategory.setPriority(priority);
      if (displayLabel)
        newPropCategory.setDisplayLabel(displayLabel);

      return newPropCategory.key;
    } catch (e: any) {
      throw new SchemaEditingError(SchemaEditType.CreateSchemaItemFailed, new SchemaItemId(this.schemaItemType, name, schemaKey), e);
    }
  }

  public async createFromProps(schemaKey: SchemaKey, propertyCategoryProps: PropertyCategoryProps): Promise<SchemaItemKey> {
    try {
      const newPropCategory = await this.createSchemaItemFromProps(schemaKey, this.schemaItemType, (schema) => schema.createPropertyCategory.bind(schema), propertyCategoryProps);
      return newPropCategory.key;
    } catch (e: any) {
      throw new SchemaEditingError(SchemaEditType.CreateSchemaItemFromProps, new SchemaItemId(this.schemaItemType, propertyCategoryProps.name!, schemaKey), e);
    }
  }

  public async setPriority(propCategoryKey: SchemaItemKey, priority: number): Promise<void> {
    try {
      const propertyCategory = await this.getSchemaItem<MutablePropertyCategory>(propCategoryKey);
      propertyCategory.setPriority(priority);
    } catch (e: any) {
      throw new SchemaEditingError(SchemaEditType.SetPropertyCategoryPriority, new SchemaItemId(this.schemaItemType, propCategoryKey), e);
    }
  }
}
