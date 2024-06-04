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

export type CreateSchemaItem<T extends SchemaItem> = (name: string, ...args: any[]) => Promise<T>;
export type CreateSchemaItemFromProps<T extends SchemaItem> = (props: SchemaItemProps, ...args: any[]) => Promise<T>;

/**
 * @internal
 * A class allowing you to edit the schema item base class.
 */
export class SchemaItems {
  public constructor(protected schemaItemType: SchemaItemType, protected _schemaEditor: SchemaContextEditor) { }

  public async getSchema(schemaKey: SchemaKey): Promise<MutableSchema> {
    const schema = await this._schemaEditor.getSchema(schemaKey);
    if (schema === undefined)
      throw new SchemaEditingError(ECEditingStatus.SchemaNotFound, new SchemaId(schemaKey));

    return schema;
  }

  public async getSchemaItem<T extends SchemaItem>(schemaItemKey: SchemaItemKey, schemaItemType?: SchemaItemType | null): Promise<T>{
    const schemaItem =  await this._schemaEditor.schemaContext.getSchemaItem<T>(schemaItemKey);
    schemaItemType = schemaItemType === null ? undefined : schemaItemType ?? this.schemaItemType;

    if (!schemaItem) {
      throw new SchemaEditingError(ECEditingStatus.SchemaItemNotFoundInContext, new SchemaItemId(schemaItemType ?? this.schemaItemType, schemaItemKey));
    }

    if (schemaItemType && schemaItemType !== schemaItem.schemaItemType) {
      throw new SchemaEditingError(ECEditingStatus.InvalidSchemaItemType, new SchemaItemId(schemaItemType ?? this.schemaItemType, schemaItemKey));
    }

    return schemaItem;
  }

  public async lookupSchemaItem<T extends SchemaItem>(schemaOrKey: MutableSchema | SchemaKey, schemaItemKey: SchemaItemKey, schemaItemType?: SchemaItemType | null): Promise<T>{
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
      return await create(name, ...args);
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
