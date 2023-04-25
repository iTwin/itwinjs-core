/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { SchemaMatchType } from "./ECObjects";
import { ECObjectsError, ECObjectsStatus } from "./Exception";
import { LazyLoadedSchema } from "./Interfaces";
import { MutableSchema, Schema } from "./Metadata/Schema";
import { SchemaItem } from "./Metadata/SchemaItem";
import { SchemaItemKey, SchemaKey } from "./SchemaKey";

/**
 * @beta
 */
export class SchemaMap extends Array<Schema> { }

/**
 * The interface defines what is needed to be a ISchemaLocater, which are used in a SchemaContext.
 * @beta
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

/**
 * @beta
 */
export interface ISchemaItemLocater {
  getSchemaItem<T extends SchemaItem>(schemaItemKey: SchemaItemKey): Promise<T | undefined>;
}

/**
 * @internal
 */
export class SchemaCache implements ISchemaLocater {
  private _schema: SchemaMap;
  private _schemaPromises: Array<LazyLoadedSchema>;

  constructor() {
    this._schema = new SchemaMap();
    this._schemaPromises = new Array<LazyLoadedSchema>();
  }

  public get count() { return this._schema.length + this._schemaPromises.length; }

  private loadedSchemaExists(schemaKey: Readonly<SchemaKey>): boolean {
    return undefined !== this._schema.find((schema: Schema) => schema.schemaKey.matches(schemaKey, SchemaMatchType.Latest));
  }

  private schemaPromiseExists(schemaKey: Readonly<SchemaKey>): boolean {
    return undefined !== this._schemaPromises.find((schema: LazyLoadedSchema) => schema.matches(schemaKey, SchemaMatchType.Latest));
  }

  private removeSchemaPromise(schemaKey: Readonly<SchemaKey>) {
    this._schemaPromises = this._schemaPromises.filter((value: LazyLoadedSchema) => !value.matches(schemaKey, SchemaMatchType.Latest));
  }

  /**
   * Returns true if the schema exists in either the schema cache or the promise cache.  SchemaMatchType.Latest used.
   * @param schemaKey The key to search for.
   */
  public schemaExits(schemaKey: Readonly<SchemaKey>): boolean {
    return this.loadedSchemaExists(schemaKey) || this.schemaPromiseExists(schemaKey);
  }

  /**
   * Adds a promise to load the schema to the cache. Does not allow for duplicate schemas in the cache of schemas or cache of promises, checks using SchemaMatchType.Latest.
   * When the promise completes the schema will be added to the schema cache and the promise will be removed from the promise cache
   * @param schemaPromise The schema promise to add to the cache.
   */
  public async addSchemaPromise(schemaPromise: LazyLoadedSchema) {
    if (this.schemaExits(schemaPromise))
      throw new ECObjectsError(ECObjectsStatus.DuplicateSchema, `The schema, ${schemaPromise.toString()}, already exists within this cache.`);

    schemaPromise.then((schema: Schema) => {
      if (!this.loadedSchemaExists(schema.schemaKey))
        this._schema.push(schema);
    }, (reason: any) => {
      throw new ECObjectsError(ECObjectsStatus.UnableToLoadSchema, `Schema load promise for ${schemaPromise.toString()} failed. Reason: ${reason.toString()}`);
    }).finally(
      () => this.removeSchemaPromise(schemaPromise)
    );

    this._schemaPromises.push(schemaPromise);
  }

  /**
   * Adds a schema to the cache. Does not allow for duplicate schemas, checks using SchemaMatchType.Latest.
   * @param schema The schema to add to the cache.
   */
  public async addSchema<T extends Schema>(schema: T) {
    if (this.schemaExits(schema.schemaKey))
      throw new ECObjectsError(ECObjectsStatus.DuplicateSchema, `The schema, ${schema.schemaKey.toString()}, already exists within this cache.`);

    this._schema.push(schema);
  }

  /**
   * Adds a schema to the cache. Does not allow for duplicate schemas, checks using SchemaMatchType.Latest.
   * @param schema The schema to add to the cache.
   */
  public addSchemaSync<T extends Schema>(schema: T) {
    if (this.schemaExits(schema.schemaKey))
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

    let foundSchema = this._schema.find(findFunc);

    if (!foundSchema) {
      const schemaPromise = this._schemaPromises.find((value: LazyLoadedSchema) => value.matches(schemaKey, matchType));
      if (!schemaPromise)
        return undefined;
      foundSchema = await schemaPromise;
    }

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
    return foundSchema as T;
  }

  /**
   * Generator function that can iterate through each schema in _schema SchemaMap and items for each Schema.
   * Does not include schema items from schemas that are not completely loaded yet.
   */
  public * getSchemaItems(): IterableIterator<SchemaItem> {
    for (const schema of this._schema) {
      for (const schemaItem of schema.getItems()) {
        yield schemaItem;
      }
    }
  }

  /**
   * Gets all the schemas from the schema cache.
   * Does not include schemas from schemas that are not completely loaded yet.
   * @returns An array of Schema objects.
   */
  public getAllSchemas(): Schema[] {
    return this._schema;
  }
}

/**
 * The SchemaContext, context object is used to facilitate schema and schema item location.
 *
 * The context controls the lifetime of each schema that it knows about. It has to be explicitly removed from the context to delete a schema object.
 *
 * The context is made up of a group of Schema Locators.
 * @beta
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
   * @deprecated use ecschema-editing package
   */
  public async addSchemaItem(schemaItem: SchemaItem) {
    const schema = await this.getSchema(schemaItem.key.schemaKey, SchemaMatchType.Exact);
    if (!schema)
      throw new ECObjectsError(ECObjectsStatus.UnableToLocateSchema, `Unable to add the schema item ${schemaItem.name} to the schema ${schemaItem.key.schemaKey.toString()} because the schema could not be located.`);

    (schema as MutableSchema).addItem(schemaItem);
  }

  /**
   * Returns true if the schema is already in the context.  SchemaMatchType.Latest is used to find a match.
   * @param schemaKey
   */
  public schemaExists(schemaKey: Readonly<SchemaKey>): boolean {
    return this._knownSchemas.schemaExits(schemaKey);
  }

  public async addSchemaPromise(schemaPromise: LazyLoadedSchema) {
    return this._knownSchemas.addSchemaPromise(schemaPromise);
  }

  /**
   *
   * @param schemaKey
   */
  public async getSchema<T extends Schema>(schemaKey: SchemaKey, matchType: SchemaMatchType = SchemaMatchType.Latest): Promise<T | undefined> {
    // the first locater is _knownSchemas, so we don't have to check the cache explicitly here
    for (const locater of this._locaters) {
      const schema = await locater.getSchema<T>(schemaKey, matchType, this);
      if (undefined !== schema)
        return schema;
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
      if (undefined !== schema)
        return schema;
    }

    return undefined;
  }

  /**
   * Attempts to get a Schema from the context's cache.
   * Will await a partially loaded schema then return when it is completely loaded.
   * @param schemaKey The SchemaKey to identify the Schema.
   * @param matchType The SchemaMatch type to use. Default is SchemaMatchType.Latest.
   * @internal
   */
  public async getCachedSchema<T extends Schema>(schemaKey: SchemaKey, matchType: SchemaMatchType = SchemaMatchType.Latest): Promise<T | undefined> {
    return this._knownSchemas.getSchema<T>(schemaKey, matchType);
  }

  /**
   * Attempts to get a Schema from the context's cache.
   * Will return undefined if the cached schema is partially loaded.  Use the async method to await partially loaded schemas.
   * @param schemaKey The SchemaKey to identify the Schema.
   * @param matchType The SchemaMatch type to use. Default is SchemaMatchType.Latest.
   * @internal
   */
  public getCachedSchemaSync<T extends Schema>(schemaKey: SchemaKey, matchType: SchemaMatchType = SchemaMatchType.Latest): T | undefined {
    return this._knownSchemas.getSchemaSync<T>(schemaKey, matchType);
  }

  /**
   * Gets the schema item from the specified schema if it exists in this [[SchemaContext]].
   * Will await a partially loaded schema then look in it for the requested item
   * @param schemaItemKey The SchemaItemKey identifying the item to return.  SchemaMatchType.Latest is used to match the schema.
   * @returns The requested schema item
   */
  public async getSchemaItem<T extends SchemaItem>(schemaItemKey: SchemaItemKey): Promise<T | undefined> {
    const schema = await this.getSchema(schemaItemKey.schemaKey, SchemaMatchType.Latest);
    if (undefined === schema)
      return undefined;
    return schema.getItem<T>(schemaItemKey.name);
  }

  /**
   * Gets the schema item from the specified schema if it exists in this [[SchemaContext]].
   * Will skip a partially loaded schema and return undefined if the item belongs to that schema.  Use the async method to await partially loaded schemas.
   * @param schemaItemKey The SchemaItemKey identifying the item to return.  SchemaMatchType.Latest is used to match the schema.
   * @returns The requested schema item
   */
  public getSchemaItemSync<T extends SchemaItem>(schemaItemKey: SchemaItemKey): T | undefined {
    const schema = this.getSchemaSync(schemaItemKey.schemaKey, SchemaMatchType.Latest);
    if (undefined === schema)
      return undefined;
    return schema.getItemSync<T>(schemaItemKey.name);
  }

  /**
   * Iterates through the items of each schema known to the context.  This includes schemas added to the
   * context using [[SchemaContext.addSchema]]. This does not include schemas that
   * can be located by an ISchemaLocater instance added to the context.
   * Does not include schema items from schemas that are not completely loaded yet.
   */
  public getSchemaItems(): IterableIterator<SchemaItem> {
    return this._knownSchemas.getSchemaItems();
  }

  /**
   * Gets all the Schemas known by the context. This includes schemas added to the
   * context using [[SchemaContext.addSchema]]. This does not include schemas that
   * can be located by an ISchemaLocater instance added to the context.  Does not
   * include schemas that are partially loaded.
   * @returns An array of Schema objects.
   */
  public getKnownSchemas(): Schema[] {
    return this._knownSchemas.getAllSchemas();
  }
}
