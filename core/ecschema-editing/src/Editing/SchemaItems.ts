/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Editing
 */

import { ECObjectsError, ECObjectsStatus, Schema, SchemaItem, SchemaItemKey, SchemaItemProps, SchemaItemType, SchemaKey } from "@itwin/ecschema-metadata";
import { SchemaContextEditor } from "./Editor";
import { ECEditingStatus, SchemaEditingError, SchemaId, SchemaItemId } from "./Exception";
import { MutableSchema } from "./Mutable/MutableSchema";
import { MutableSchemaItem } from "./Mutable/MutableSchemaItem";

export type CreateSchemaItem<T extends SchemaItem> = (schema: MutableSchema) => (name: string, ...args: any[]) => Promise<T>;
export type CreateSchemaItemFromProps<T extends SchemaItem> = (props: SchemaItemProps, ...args: any[]) => Promise<T>;

/**
 * @internal
 * A class allowing you to edit the schema item base class.
 */
export abstract class SchemaItems {
  protected schemaItemType: SchemaItemType;
  protected schemaEditor: SchemaContextEditor;

  public constructor(schemaItemType: SchemaItemType, schemaEditor: SchemaContextEditor) {
    this.schemaItemType = schemaItemType;
    this.schemaEditor = schemaEditor;
  }

  /**
   * Sets the SchemaItem description.
   * @param schemaItemKey The SchemaItemKey of the SchemaItem
   * @param description The new description to set.
   */
  public async setDescription(schemaItemKey: SchemaItemKey, description: string) {
    const item = await this.getSchemaItem<MutableSchemaItem>(schemaItemKey)
      .catch((e: any) => {
        throw new SchemaEditingError(ECEditingStatus.SetDescription, new SchemaItemId(this.schemaItemType, schemaItemKey), e);
      });
    item.setDescription(description);
  }

  /**
   * Sets the SchemaItem display label.
   * @param schemaItemKey The SchemaItemKey of the SchemaItem
   * @param label The new label to set.
   */
  public async setDisplayLabel(schemaItemKey: SchemaItemKey, label: string) {
    const item = await this.getSchemaItem<MutableSchemaItem>(schemaItemKey)
      .catch((e: any) => {
        throw new SchemaEditingError(ECEditingStatus.SetLabel, new SchemaItemId(this.schemaItemType, schemaItemKey), e);
      });
    item.setDisplayLabel(label);
  }

  protected async getSchema(schemaKey: SchemaKey): Promise<MutableSchema> {
    const schema = await this.schemaEditor.getSchema(schemaKey);
    if (schema === undefined)
      throw new SchemaEditingError(ECEditingStatus.SchemaNotFound, new SchemaId(schemaKey));

    return schema;
  }

  protected async getSchemaItem<T extends SchemaItem>(schemaItemKey: SchemaItemKey, schemaItemType?: SchemaItemType | null): Promise<T>{
    const schemaItem =  await this.schemaEditor.schemaContext.getSchemaItem<T>(schemaItemKey);
    schemaItemType = schemaItemType === null ? undefined : schemaItemType ?? this.schemaItemType;

    if (!schemaItem) {
      throw new SchemaEditingError(ECEditingStatus.SchemaItemNotFoundInContext, new SchemaItemId(schemaItemType ?? this.schemaItemType, schemaItemKey));
    }

    if (schemaItemType && schemaItemType !== schemaItem.schemaItemType) {
      throw new SchemaEditingError(ECEditingStatus.InvalidSchemaItemType, new SchemaItemId(schemaItemType ?? this.schemaItemType, schemaItemKey));
    }

    return schemaItem;
  }

  protected async lookupSchemaItem<T extends SchemaItem>(schemaOrKey: MutableSchema | SchemaKey, schemaItemKey: SchemaItemKey, schemaItemType?: SchemaItemType | null): Promise<T>{
    schemaItemType = schemaItemType === null ? undefined : schemaItemType ?? this.schemaItemType;

    let schema: Schema;
    if (schemaOrKey instanceof SchemaKey) {
      schema = await this.getSchema(schemaOrKey);
    } else {
      schema = schemaOrKey;
    }

    const schemaItem = await schema.lookupItem<T>(schemaItemKey);
    if (schemaItem === undefined)
      throw new SchemaEditingError(ECEditingStatus.SchemaItemNotFound, new SchemaItemId(schemaItemType ?? this.schemaItemType, schemaItemKey));

    if (schemaItemType && schemaItemType !== schemaItem.schemaItemType) {
      throw new SchemaEditingError(ECEditingStatus.InvalidSchemaItemType, new SchemaItemId(schemaItemType ?? this.schemaItemType, schemaItemKey));
    }

    return schemaItem;
  }

  protected async createSchemaItem<T extends SchemaItem>(schemaKey: SchemaKey, type: SchemaItemType, create: CreateSchemaItem<T>, name: string, ...args: any[]): Promise<T> {
    const schema = await this.getSchema(schemaKey);
    try {
      const boundCreate = create(schema);
      return await boundCreate(name, ...args);
    } catch (e) {
      if (e instanceof ECObjectsError && e.errorNumber === ECObjectsStatus.DuplicateItem) {
        throw new SchemaEditingError(ECEditingStatus.SchemaItemNameAlreadyExists, new SchemaItemId(type, name, schema.schemaKey));
      } else {
        throw new Error(`Failed to create class ${name} in schema ${schema.fullName}.`);
      }
    }
  }

  protected async createSchemaItemFromProps<T extends SchemaItem>(schemaKey: SchemaKey, type: SchemaItemType, create: CreateSchemaItem<T>, props: SchemaItemProps): Promise<T> {
    if (props.name === undefined)
      throw new SchemaEditingError(ECEditingStatus.SchemaItemNameNotSpecified, new SchemaItemId(type, "", schemaKey));

    const newItem = await this.createSchemaItem<T>(schemaKey, type, create, props.name);
    await newItem.fromJSON(props);

    return newItem;
  }
}
