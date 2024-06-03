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
import { ECEditingStatus, SchemaEditingError, SchemaItemId } from "./Exception";
import { SchemaItems } from "./SchemaItems";

/**
 * @alpha
 * A class allowing you to create schema items of type Property Category.
 */
export class PropertyCategories extends SchemaItems {
  public constructor(schemaEditor: SchemaContextEditor) {
    super(SchemaItemType.PropertyCategory, schemaEditor);
  }

  public async create(schemaKey: SchemaKey, name: string, priority: number, displayLabel?: string): Promise<SchemaItemKey> {
    let newPropCategory: MutablePropertyCategory;

    try {
      const schema = await this.getSchema(schemaKey);
      const boundCreate = schema.createPropertyCategory.bind(schema);
      newPropCategory = (await this.createSchemaItem<PropertyCategory>(schemaKey, this.schemaItemType, boundCreate, name)) as MutablePropertyCategory;
      newPropCategory.setPriority(priority);
      if (displayLabel)
        newPropCategory.setDisplayLabel(displayLabel);

    } catch (e: any) {
      throw new SchemaEditingError(ECEditingStatus.CreateSchemaItemFailed, new SchemaItemId(this.schemaItemType, name, schemaKey), e);
    }

    return newPropCategory.key;
  }

  public async createFromProps(schemaKey: SchemaKey, propertyCategoryProps: PropertyCategoryProps): Promise<SchemaItemKey> {
    let newPropCategory: MutablePropertyCategory;
    try {
      const schema = await this.getSchema(schemaKey);
      const boundCreate = schema.createPropertyCategory.bind(schema);
      newPropCategory = await this.createSchemaItemFromProps<PropertyCategory>(schemaKey, this.schemaItemType, boundCreate, propertyCategoryProps) as MutablePropertyCategory;
    } catch (e: any) {
      throw new SchemaEditingError(ECEditingStatus.CreateSchemaItemFromProps, new SchemaItemId(this.schemaItemType, propertyCategoryProps.name!, schemaKey), e);
    }

    return newPropCategory.key;
  }

  public async setPriority(propCategoryKey: SchemaItemKey, priority: number): Promise<void> {
    try {
      const propertyCategory = await this.getSchemaItem<MutablePropertyCategory>(propCategoryKey);
      propertyCategory.setPriority(priority);
    } catch(e: any) {
      throw new SchemaEditingError(ECEditingStatus.SetPropertyCategoryPriority, new SchemaItemId(this.schemaItemType, propCategoryKey), e);
    }
  }
}
