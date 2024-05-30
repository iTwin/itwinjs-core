/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Editing
 */

import { ECObjectsError, ECObjectsStatus, Schema, SchemaItem, SchemaItemKey, SchemaItemProps, SchemaItemType, SchemaKey } from "@itwin/ecschema-metadata";
import { SchemaContextEditor } from "./Editor";
import { ECEditingStatus, SchemaEditingError, schemaItemIdentifier, schemaItemIdentifierFromName } from "./Exception";
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
      throw new SchemaEditingError(ECEditingStatus.SchemaNotFound, {schemaKey});

    return schema;
  }

  public async getSchemaItem<T extends SchemaItem>(schemaItemKey: SchemaItemKey, schemaItemType?: SchemaItemType | null): Promise<T>{
    const schemaItem =  await this._schemaEditor.schemaContext.getSchemaItem<T>(schemaItemKey);
    schemaItemType = schemaItemType === null ? undefined : schemaItemType ?? this.schemaItemType;

    if (!schemaItem) {
      throw new SchemaEditingError(ECEditingStatus.SchemaItemNotFoundInContext, schemaItemIdentifier(schemaItemType ?? this.schemaItemType, schemaItemKey));
    }

    if (schemaItemType && schemaItemType !== schemaItem.schemaItemType) {
      throw new SchemaEditingError(ECEditingStatus.InvalidSchemaItemType,schemaItemIdentifier(schemaItemType ?? this.schemaItemType, schemaItemKey));
    }

    return schemaItem;
  }

  public async lookUpSchemaItem<T extends SchemaItem>(schemaOrKey: MutableSchema | SchemaKey, schemaItemKey: SchemaItemKey, schemaItemType?: SchemaItemType): Promise<T>{
    schemaItemType = schemaItemType ?? this.schemaItemType;

    let schema: Schema;
    if (schemaOrKey instanceof SchemaKey) {
      schema = await this.getSchema(schemaOrKey);
    } else {
      schema = schemaOrKey;
    }

    const schemaItem = await schema.lookupItem<T>(schemaItemKey);
    if (schemaItem === undefined)
      throw new SchemaEditingError(ECEditingStatus.SchemaItemNotFound, schemaItemIdentifier(schemaItemType ?? this.schemaItemType, schemaItemKey));

    if (schemaItemType !== schemaItem.schemaItemType) {
      throw new SchemaEditingError(ECEditingStatus.InvalidSchemaItemType,schemaItemIdentifier(schemaItemType ?? this.schemaItemType, schemaItemKey));
    }

    return schemaItem;
  }

  public async createSchemaItem<T extends SchemaItem>(schemaOrKey: Schema | SchemaKey, type: SchemaItemType, create: CreateSchemaItem<T>, name: string, ...args: any[]): Promise<T> {
    let schema: Schema;
    if (schemaOrKey instanceof SchemaKey) {
      schema = await this.getSchema(schemaOrKey);
    } else {
      schema = schemaOrKey;
    }

    try {
      return await create(name, ...args);
    } catch (e) {
      if (e instanceof ECObjectsError && e.errorNumber === ECObjectsStatus.DuplicateItem) {
        throw new SchemaEditingError(ECEditingStatus.SchemaItemNameAlreadyExists, schemaItemIdentifierFromName(schema.schemaKey, type, name));
      } else {
        throw new Error(`Failed to create class ${name} in schema ${schema.fullName}.`);
      }
    }
  }

  public async createSchemaItemFromProps<T extends SchemaItem>(schemaOrKey: Schema | SchemaKey, type: SchemaItemType, create: CreateSchemaItem<T>, props: SchemaItemProps): Promise<T> {
    if (props.name === undefined)
      throw new SchemaEditingError(ECEditingStatus.SchemaItemNameNotSpecified, {schemaKey: schemaOrKey instanceof Schema ? schemaOrKey.schemaKey : schemaOrKey, type});

    const newItem = await this.createSchemaItem<T>(schemaOrKey, type, create, props.name);
    await newItem.fromJSON(props);

    return newItem;
  }
}
