/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { ECObjectsError, ECObjectsStatus } from "./Exception";
import { SchemaKey, SchemaMatchType, SchemaItemKey } from "./ECObjects";
import Schema, { MutableSchema } from "./Metadata/Schema";
import SchemaItem from "./Metadata/SchemaItem";

export class SchemaMap extends Array<Schema> { }

/**
 * The interface defines what is needed to be a ISchemaLocater, which are used in a SchemaContext.
 */
export interface ISchemaLocater {

  /**
   * Attempts to get a schema from the locater. Yields undefined if no matching schema is found.
   * For schemas that may have references, construct and call through a SchemaContext instead.
   * @param schemaKey key to look up
   * @param matchType how to match key against candidate schemas
   * @param context optional context for loading schema references
   */
  getSchema<T extends Schema>(schemaKey: SchemaKey, matchType: SchemaMatchType, context?: SchemaContext): Promise<T | undefined>;

  /**
   * Attempts to get a schema from the locater. Yields undefined if no matching schema is found.
   * For schemas that may have references, construct and call through a SchemaContext instead.
   * @param schemaKey key to look up
   * @param matchType how to match key against candidate schemas
   * @param context optional context for loading schema references
   */
  getSchemaSync<T extends Schema>(schemaKey: SchemaKey, matchType: SchemaMatchType, context?: SchemaContext): T | undefined;
}

export interface ISchemaItemLocater {
  getSchemaItem<T extends SchemaItem>(schemaItemKey: SchemaItemKey): Promise<T | undefined>;
}

/**
 *
 */
export class SchemaCache implements ISchemaLocater {
  private _schema: SchemaMap;

  constructor() {
    this._schema = new SchemaMap();
  }

  get count() { return this._schema.length; }

  /**
   * Adds a schema to the cache. Does not allow for duplicate schemas, checks using SchemaMatchType.Latest.
   * @param schema The schema to add to the cache.
   */
  public async addSchema<T extends Schema>(schema: T) {
    if (await this.getSchema<T>(schema.schemaKey))
      return Promise.reject(new ECObjectsError(ECObjectsStatus.DuplicateSchema, `The schema, ${schema.schemaKey.toString()}, already exists within this cache.`));

    this._schema.push(schema);
    return Promise.resolve();
  }

  /**
   * Adds a schema to the cache. Does not allow for duplicate schemas, checks using SchemaMatchType.Latest.
   * @param schema The schema to add to the cache.
   */
  public addSchemaSync<T extends Schema>(schema: T) {
    if (this.getSchemaSync<T>(schema.schemaKey))
      throw new ECObjectsError(ECObjectsStatus.DuplicateSchema, `The schema, ${schema.schemaKey.toString()}, already exists within this cache.`);

    this._schema.push(schema);
  }

  /**
   * Gets the schema which matches the provided SchemaKey.
   * @param schemaKey The SchemaKey describing the schema to get from the cache.
   * @param matchType The match type to use when locating the schema
   */
  public async getSchema<T extends Schema>(schemaKey: SchemaKey, matchType: SchemaMatchType = SchemaMatchType.Latest): Promise<T | undefined> {
    if (this.count === 0)
      return undefined;

    const findFunc = (schema: Schema) => {
      return schema.schemaKey.matches(schemaKey, matchType);
    };

    const foundSchema = this._schema.find(findFunc);

    if (!foundSchema)
      return undefined;

    return foundSchema as T;
  }

  /**
   *
   * @param schemaKey
   * @param matchType
   */
  public getSchemaSync<T extends Schema>(schemaKey: SchemaKey, matchType: SchemaMatchType = SchemaMatchType.Latest): T | undefined {
    if (this.count === 0)
      return undefined;

    const findFunc = (schema: Schema) => {
      return schema.schemaKey.matches(schemaKey, matchType);
    };

    const foundSchema = this._schema.find(findFunc);

    if (!foundSchema)
      return foundSchema;

    return foundSchema as T;
  }
}

/**
 * The SchemaContext, context object is used to facilitate schema and schema item location.
 *
 * The context controls the lifetime of each schema that it knows about. It has to be explicitly removed from the context in order to delete a schema object.
 *
 * The context is made up of a group of Schema Locators.
 */
export class SchemaContext implements ISchemaLocater, ISchemaItemLocater {
  private _locaters: ISchemaLocater[];

  private _knownSchemas: SchemaCache;

  constructor() {
    this._locaters = [];

    this._knownSchemas = new SchemaCache();
    this._locaters.push(this._knownSchemas);
  }

  public addLocater(locater: ISchemaLocater) {
    this._locaters.push(locater);
  }

  /**
   * Adds the schema to this context
   * @param schema The schema to add to this context
   */
  public async addSchema(schema: Schema) {
    this.addSchemaSync(schema);
  }

  /**
   * Adds the schema to this context
   * @param schema The schema to add to this context
   */
  public addSchemaSync(schema: Schema) {
    this._knownSchemas.addSchemaSync(schema);
  }

  /**
   * Adds the given SchemaItem to the the SchemaContext by locating the schema, with the best match of SchemaMatchType.Exact, and
   * @param schemaItem The SchemaItem to add
   */
  public async addSchemaItem(schemaItem: SchemaItem) {
    const schema = await this.getSchema(schemaItem.key.schemaKey, SchemaMatchType.Exact);
    if (!schema)
      throw new ECObjectsError(ECObjectsStatus.UnableToLocateSchema, `Unable to add the schema item ${schemaItem.name} to the schema ${schemaItem.key.schemaKey.toString()} because the schema could not be located.`);

    await (schema as MutableSchema).addItem(schemaItem);
    return;
  }

  /**
   *
   * @param schemaKey
   */
  public async getSchema<T extends Schema>(schemaKey: SchemaKey, matchType: SchemaMatchType = SchemaMatchType.Latest): Promise<T | undefined> {
    // the first locater is _knownSchemas, so we don't have to check the cache explicitly here
    for (const locater of this._locaters) {
      const schema = await locater.getSchema<T>(schemaKey, matchType, this);
      if (schema) {
        return schema;
      }
    }

    return undefined;
  }

  /**
   *
   * @param schemaKey
   */
  public getSchemaSync<T extends Schema>(schemaKey: SchemaKey, matchType: SchemaMatchType = SchemaMatchType.Latest): T | undefined {
    // the first locater is _knownSchemas, so we don't have to check the cache explicitly here
    for (const locater of this._locaters) {
      const schema = locater.getSchemaSync<T>(schemaKey, matchType, this);
      if (schema) {
        return schema;
      }
    }

    return undefined;
  }

  public async getSchemaItem<T extends SchemaItem>(schemaItemKey: SchemaItemKey): Promise<T | undefined> {
    const schema = await this.getSchema(schemaItemKey.schemaKey, SchemaMatchType.Latest);
    if (!schema)
      return undefined;

    return await schema.getItem<T>(schemaItemKey.name);
  }

  public getSchemaItemSync<T extends SchemaItem>(schemaItemKey: SchemaItemKey): T | undefined {
    const schema = this.getSchemaSync(schemaItemKey.schemaKey, SchemaMatchType.Latest);
    if (!schema)
      return undefined;

    return schema.getItemSync<T>(schemaItemKey.name);
  }
}
