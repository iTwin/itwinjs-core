/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Editing
 */

import { ECObjectsError, ECObjectsStatus, PropertyCategoryProps, SchemaItemKey, SchemaItemType, SchemaKey } from "@itwin/ecschema-metadata";
import { SchemaContextEditor } from "./Editor";
import { MutablePropertyCategory } from "./Mutable/MutablePropertyCategory";
import { ECEditingError, ECEditingStatus } from "./Exception";

/**
 * @alpha
 * A class allowing you to create schema items of type Property Category.
 */
export class PropertyCategories {
  public constructor(protected _schemaEditor: SchemaContextEditor) { }

  public async create(schemaKey: SchemaKey, name: string, priority: number, displayLabel?: string): Promise<SchemaItemKey> {
    const schema = await this._schemaEditor.getSchema(schemaKey);
    if (schema === undefined)
      throw new ECEditingError(ECEditingStatus.SchemaNotFound, `Schema Key ${schemaKey.toString(true)} not found in context`);

    let newPropCategory: MutablePropertyCategory;
    try {
      newPropCategory = await schema.createPropertyCategory(name) as MutablePropertyCategory;
    } catch (e) {
      if (e instanceof ECObjectsError && e.errorNumber === ECObjectsStatus.DuplicateItem) {
        throw new ECEditingError(ECEditingStatus.SchemaItemNameAlreadyExists, `PropertyCategory ${name} already exists in the schema ${schema.fullName}.`);
      } else {
        throw new ECEditingError(ECEditingStatus.Unknown, `Failed to create PropertyCategory ${name} in schema ${schema.fullName}.`);
      }
    }

    newPropCategory.setPriority(priority);
    if (displayLabel)
      newPropCategory.setDisplayLabel(displayLabel);

    return newPropCategory.key;
  }

  public async createFromProps(schemaKey: SchemaKey, propertyCategoryProps: PropertyCategoryProps): Promise<SchemaItemKey> {
    const schema = await this._schemaEditor.getSchema(schemaKey);
    if (schema === undefined)
      throw new ECEditingError(ECEditingStatus.SchemaNotFound, `Schema Key ${schemaKey.toString(true)} not found in context`);

    if (propertyCategoryProps.name === undefined)
      throw new ECEditingError(ECEditingStatus.SchemaItemNameNotSpecified, `No name was supplied within props.`);

    let newPropCategory: MutablePropertyCategory;
    try {
      newPropCategory = await schema.createPropertyCategory(propertyCategoryProps.name) as MutablePropertyCategory;
    } catch (e) {
      if (e instanceof ECObjectsError && e.errorNumber === ECObjectsStatus.DuplicateItem) {
        throw new ECEditingError(ECEditingStatus.SchemaItemNameAlreadyExists, `PropertyCategory ${propertyCategoryProps.name} already exists in the schema ${schema.fullName}.`);
      } else {
        throw new ECEditingError(ECEditingStatus.Unknown, `Failed to create PropertyCategory ${propertyCategoryProps.name} in schema ${schema.fullName}.`);
      }
    }

    await newPropCategory.fromJSON(propertyCategoryProps);
    return newPropCategory.key;
  }

  public async setPriority(propCategoryKey: SchemaItemKey, priority: number): Promise<void> {
    const propertyCategory = (await this._schemaEditor.schemaContext.getSchemaItem<MutablePropertyCategory>(propCategoryKey));

    if (propertyCategory === undefined)
      throw new ECEditingError(ECEditingStatus.SchemaItemNotFound, `Property Category ${propCategoryKey.fullName} not found in schema context.`);

    if (propertyCategory.schemaItemType !== SchemaItemType.PropertyCategory)
      throw new ECEditingError(ECEditingStatus.InvalidSchemaItemType, `Expected ${propCategoryKey.fullName} to be of type Property Category.`);

    propertyCategory.setPriority(priority);
  }
}
