/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { DelayedPromise } from "./DelayedPromise";
import { SchemaMatchType } from "./ECObjects";
import { ECObjectsError, ECObjectsStatus } from "./Exception";
import { MutableSchema, Schema } from "./Metadata/Schema";
import { SchemaItem } from "./Metadata/SchemaItem";
import { SchemaItemKey, SchemaKey } from "./SchemaKey";

/**
 * Holds partially-loaded schema and corresponding promise to fully load the schema
 * @alpha
 */
interface LoadingSchema {
  schema: Schema;
  loadSchemaPromise: DelayedPromise<Schema>;
}
/**
 * @alpha
 */
export class LoadedSchemas extends Array<Schema> { }
/**
 * @alpha
 */
export class LoadingSchemas extends Array<LoadingSchema> { }

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

  /**
   * Attempts to get a partial/loading schema from the locater (schema could be loaded or loading if locater is schema cache). Yields undefined if no matching schema is found.
   * For schemas that may have references, construct and call through a SchemaContext instead.
   * @param schemaKey key to look up
   * @param matchType how to match key against candidate schemas
   * @param context optional context for loading schema references
   * @internal
   */
  getLoadingSchema?<T extends Schema>(schemaKey: SchemaKey, matchType: SchemaMatchType, context?: SchemaContext): Promise<T | undefined>;
}

/**
 * @beta
 */
export interface ISchemaItemLocater {
  getSchemaItem<T extends SchemaItem>(schemaItemKey: SchemaItemKey): Promise<T | undefined>;
}

/**
 * @alpha
 */
export class SchemaCache implements ISchemaLocater {
  private _loadedSchemas: LoadedSchemas;
  private _loadingSchemas: LoadingSchemas;

  constructor() {
    this._loadedSchemas = new LoadedSchemas();
    this._loadingSchemas = new LoadingSchemas(); /* Partially loaded schemas */
  }

  public get count() { return this._loadedSchemas.length + this._loadingSchemas.length; }
  public get loadedSchemasCount() { return this._loadedSchemas.length; }
  public get loadingSchemasCount() { return this._loadingSchemas.length; }

  /**
   * Adds a schema to the cache. Does not allow for duplicate schemas, checks using SchemaMatchType.Latest.
   * Schema should be fully loaded if loadSchema argument is not passed in.
   * @param schema The schema to add to the cache. Schema should be fully loaded if loadSchema argument is not passed in.
   * @param loadSchemaPromise Promise to fully load the schema
   */
  public async addSchema<T extends Schema>(schema: T, loadSchemaPromise?: DelayedPromise<T>) {
    if (await this.getLoadedSchema<T>(schema.schemaKey) || await this.getLoadingSchema<T>(schema.schemaKey))
      throw new ECObjectsError(ECObjectsStatus.DuplicateSchema, `The schema, ${schema.schemaKey.toString()}, already exists within this cache.`);

    if (loadSchemaPromise)
      this._loadingSchemas.push({ schema, loadSchemaPromise });
    else
      this._loadedSchemas.push(schema);
  }

  /**
   * Adds a schema to the cache. Does not allow for duplicate schemas, checks using SchemaMatchType.Latest.
   * Schema should be fully loaded.
   * @param schema The schema to add to the cache. Schema should be fully loaded if loadSchema argument is not passed in.
   */
  public addSchemaSync<T extends Schema>(schema: T) {
    if (this.getLoadedSchemaSync<T>(schema.schemaKey) || this.getLoadingSchemaSync<T>(schema.schemaKey))
      throw new ECObjectsError(ECObjectsStatus.DuplicateSchema, `The schema, ${schema.schemaKey.toString()}, already exists within this cache.`);

    this._loadedSchemas.push(schema);
  }

  /**
   * Gets the schema which matches the provided SchemaKey. If the matched schema is loading, finish loading the schema and return it.
   * @param schemaKey The SchemaKey describing the schema to get from the cache.
   * @param matchType The match type to use when locating the schema
   */
  public async getSchema<T extends Schema>(schemaKey: SchemaKey, matchType: SchemaMatchType = SchemaMatchType.Latest): Promise<T | undefined> {
    if (this.count === 0)
      return undefined;

    const findLoadedSchema = (schema: Schema) => {
      return schema.schemaKey.matches(schemaKey, matchType);
    };

    const loadedSchema = this._loadedSchemas.find(findLoadedSchema);
    if (loadedSchema)
      return loadedSchema as T;

    const findLoadingSchema = (currSchema: LoadingSchema) => {
      return currSchema.schema.schemaKey.matches(schemaKey, matchType);
    };

    const loadingSchema = this._loadingSchemas.find(findLoadingSchema);
    if (loadingSchema) {
      const schema = await loadingSchema.loadSchemaPromise;
      // Have to check that schema is not already in _loadedSchemas here bc of await above
      if (undefined === this._loadedSchemas.find(findLoadedSchema)) {
        // Add the schema to _loadedSchemas and remove it from _loadingSchemas
        this._loadedSchemas.push(schema);
        const loadingSchemaIndex = this._loadingSchemas.findIndex(findLoadingSchema);
        if (loadingSchemaIndex !== -1)
          this._loadingSchemas.splice(loadingSchemaIndex, 1);
      }

      return schema as T;
    }

    return undefined;
  }

  /**
   * Gets the loaded schema which matches the provided SchemaKey.
   * @param schemaKey The SchemaKey describing the schema to get from the cache.
   * @param matchType The match type to use when locating the schema
   */
  public getSchemaSync<T extends Schema>(schemaKey: SchemaKey, matchType: SchemaMatchType = SchemaMatchType.Latest): T | undefined {
    if (this.loadedSchemasCount === 0)
      return undefined;

    const findLoadedSchema = (schema: Schema) => {
      return schema.schemaKey.matches(schemaKey, matchType);
    };

    const loadedSchema = this._loadedSchemas.find(findLoadedSchema);

    if (loadedSchema)
      return loadedSchema as T;

    return undefined;
  }

  /**
   * Gets the loaded schema which matches the provided SchemaKey.
   * @param schemaKey The SchemaKey describing the schema to get from the cache.
   * @param matchType The match type to use when locating the schema
   */
  public async getLoadedSchema<T extends Schema>(schemaKey: SchemaKey, matchType: SchemaMatchType = SchemaMatchType.Latest): Promise<T | undefined> {
    return this.getLoadedSchemaSync(schemaKey, matchType) as T;
  }

  /**
   * Gets the loaded schema which matches the provided SchemaKey.
   * @param schemaKey The SchemaKey describing the schema to get from the cache.
   * @param matchType The match type to use when locating the schema
   */
  public getLoadedSchemaSync<T extends Schema>(schemaKey: SchemaKey, matchType: SchemaMatchType = SchemaMatchType.Latest): T | undefined {
    return this.getSchemaSync(schemaKey, matchType);
  }

  /**
   * Gets the loading schema which matches the provided SchemaKey.
   * @param schemaKey The SchemaKey describing the schema to get from the cache.
   * @param matchType The match type to use when locating the schema
   */
  public async getLoadingSchema<T extends Schema>(schemaKey: SchemaKey, matchType: SchemaMatchType = SchemaMatchType.Latest): Promise<T | undefined> {
    return this.getLoadingSchemaSync(schemaKey, matchType) as T;
  }

  /**
   * Gets the loading schema which matches the provided SchemaKey.
   * @param schemaKey The SchemaKey describing the schema to get from the cache.
   * @param matchType The match type to use when locating the schema
   */
  public getLoadingSchemaSync<T extends Schema>(schemaKey: SchemaKey, matchType: SchemaMatchType = SchemaMatchType.Latest): T | undefined {
    if (this.loadingSchemasCount === 0)
      return undefined;

    const findLoadingSchema = (schema: LoadingSchema) => {
      return schema.schema.schemaKey.matches(schemaKey, matchType);
    };

    const loadingSchema = this._loadingSchemas.find(findLoadingSchema);
    if (loadingSchema)
      return loadingSchema.schema as T;

    return undefined;
  }

  /**
   * Generator function that can iterate through each schema in _schema SchemaMap and items for each Schema
   */
  public* getSchemaItems(): IterableIterator<SchemaItem> {
    for (const schema of this._loadedSchemas) {
      for (const schemaItem of schema.getItems()) {
        yield schemaItem;
      }
    }
  }

  /**
   * Gets all the schemas from the schema cache.
   * @returns An array of Schema objects.
   */
  public getAllSchemas(): Schema [] {
    const schemas: Schema [] = [];
    schemas.push.apply(schemas, this._loadedSchemas);
    for (const loadingSchemas of this._loadingSchemas) {
      schemas.push(loadingSchemas.schema);
    }
    return schemas;
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

  /**
   * Adds a schema locater to this context that will be used when getting schemas
   * @param locater The Schema Locater to add to this context
   */
  public addLocater(locater: ISchemaLocater) {
    this._locaters.push(locater);
  }

  /**
   * Adds the schema to this context
   * @param schema The schema to add to the cache. Schema should be fully loaded if loadSchema argument is not passed in.
   * @param loadSchemaPromise Promise to fully load the schema
   * @alpha
   */
  public async addSchema(schema: Schema, loadSchemaPromise?: DelayedPromise<Schema>) {
    await this._knownSchemas.addSchema(schema, loadSchemaPromise);
  }

  /**
   * Adds the schema to this context
   * @param schema The schema to add to the cache. Schema should be fully loaded if loadSchema argument is not passed in.
   * @alpha
   */
  public addSchemaSync(schema: Schema) {
    this._knownSchemas.addSchemaSync(schema);
  }

  /**
   * Adds the given SchemaItem to the the SchemaContext by locating the schema, with the best match of SchemaMatchType.Exact
   * @param schemaItem The SchemaItem to add
   * @deprecated in 3.8 Use the Schema Editor API to modify a schema
   */
  public async addSchemaItem(schemaItem: SchemaItem) {
    const schema = await this.getSchema(schemaItem.key.schemaKey, SchemaMatchType.Exact);
    if (!schema)
      throw new ECObjectsError(ECObjectsStatus.UnableToLocateSchema, `Unable to add the schema item ${schemaItem.name} to the schema ${schemaItem.key.schemaKey.toString()} because the schema could not be located.`);

    (schema as MutableSchema).addItem(schemaItem);
  }

  /**
   * Locate a schema that has already been loaded or that can be found via one of the registered schema locaters.
   * @param schemaKey The SchemaKey which describes the schema to be located
   * @param matchType Controls how the schema versions in the schemaKey and the schemas being located are compared.  Defaults to [[SchemaMatchType.Latest]].
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
   * Locate a schema that has already been loaded or that can be found via one of the registered schema locaters.
   * @param schemaKey The SchemaKey which describes the schema to be located
   * @param matchType Controls how the schema versions in the schemaKey and the schemas being located are compared.  Defaults to [[SchemaMatchType.Latest]].
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
   * Locate a loading schema (schema could be loaded or loading if it's in schema cache) that can be found via one of the registered schema locaters.
   * @param schemaKey The SchemaKey which describes the schema to be located
   * @param matchType Controls how the schema versions in the schemaKey and the schemas being located are compared. Defaults to [[SchemaMatchType.Latest]].
   * @internal
   */
  public async getLoadingSchema<T extends Schema>(schemaKey: SchemaKey, matchType: SchemaMatchType = SchemaMatchType.Latest): Promise<T | undefined> {
    // Check if schema is already loaded or loading in _knownSchemas/cache first
    const schema = await this.getCachedLoadedOrLoadingSchema<T>(schemaKey, matchType);
    if (undefined !== schema)
      return schema;

    for (let i = 1; i < this._locaters.length; i++) {
      if (this._locaters[i].getLoadingSchema) {
        const loadingSchema = await this._locaters[i].getLoadingSchema!<T>(schemaKey, matchType, this);
        if (undefined !== loadingSchema)
          return loadingSchema;
      }
    }

    return undefined;
  }

  /**
   * Attempts to get a loaded Schema from the context's cache. Will load the Schema if it is loading.
   * @param schemaKey The SchemaKey to identify the Schema.
   * @param matchType The SchemaMatch type to use. Default is SchemaMatchType.Latest.
   * @internal
   */
  public async getCachedSchema<T extends Schema>(schemaKey: SchemaKey, matchType: SchemaMatchType = SchemaMatchType.Latest): Promise<T | undefined> {
    return this._knownSchemas.getSchema(schemaKey, matchType);
  }

  /**
   * Attempts to get a loaded Schema from the context's cache.
   * @param schemaKey The SchemaKey to identify the Schema.
   * @param matchType The SchemaMatch type to use. Default is SchemaMatchType.Latest.
   * @internal
   */
  public getCachedSchemaSync<T extends Schema>(schemaKey: SchemaKey, matchType: SchemaMatchType = SchemaMatchType.Latest): T | undefined {
    return this._knownSchemas.getSchemaSync(schemaKey, matchType);
  }

  /**
   * Attempts to get a Schema from the context's cache. Will not load the Schema if it is loading.
   * @param schemaKey The SchemaKey to identify the Schema.
   * @param matchType The SchemaMatch type to use. Default is SchemaMatchType.Latest.
   * @internal
   */
  public async getCachedLoadedOrLoadingSchema<T extends Schema>(schemaKey: SchemaKey, matchType: SchemaMatchType = SchemaMatchType.Latest): Promise<T | undefined> {
    const schema = await this._knownSchemas.getLoadedSchema<T>(schemaKey, matchType) || await this._knownSchemas.getLoadingSchema<T>(schemaKey, matchType);
    return schema;
  }

  /**
   * Attempts to get a Schema from the context's cache. Will not load the Schema if it is loading.
   * @param schemaKey The SchemaKey to identify the Schema.
   * @param matchType The SchemaMatch type to use. Default is SchemaMatchType.Latest.
   * @internal
   */
  public getCachedLoadedOrLoadingSchemaSync<T extends Schema>(schemaKey: SchemaKey, matchType: SchemaMatchType = SchemaMatchType.Latest): T | undefined {
    const schema = this._knownSchemas.getLoadedSchemaSync<T>(schemaKey, matchType) || this._knownSchemas.getLoadingSchemaSync<T>(schemaKey, matchType);
    return schema;
  }

  /**
   * Returns the schema item (class, enumeration etc) referenced by the key or undefined if not found.
   * @param schemaItemKey The [[SchemaItemKey]] that identifies the item to find.  [[SchemaMatchType.Latest]] is used to find the schema of the item.
   * @returns The schema item or undefined
   */
  public async getSchemaItem<T extends SchemaItem>(schemaItemKey: SchemaItemKey): Promise<T | undefined> {
    const schema = await this.getSchema(schemaItemKey.schemaKey, SchemaMatchType.Latest);
    if (undefined === schema)
      return undefined;
    return schema.getItem<T>(schemaItemKey.name);
  }

  /**
   * Returns the schema item (class, enumeration etc) referenced by the key or undefined if not found.
   * @param schemaItemKey The [[SchemaItemKey]] that identifies the item to find.  [[SchemaMatchType.Latest]] is used to find the schema of the item.
   * @returns The schema item or undefined
   */
  public getSchemaItemSync<T extends SchemaItem>(schemaItemKey: SchemaItemKey): T | undefined {
    const schema = this.getSchemaSync(schemaItemKey.schemaKey, SchemaMatchType.Latest);
    if (undefined === schema)
      return undefined;
    return schema.getItemSync<T>(schemaItemKey.name);
  }

  public getSchemaItems(): IterableIterator<SchemaItem> {
    return this._knownSchemas.getSchemaItems();
  }

  /**
   * Gets all the Schemas known by the context. This includes schemas added to the
   * context using [[SchemaContext.addSchema]]. This does not include schemas that
   * can be located by an ISchemaLocater instance added to the context.
   * @returns An array of Schema objects.
   */
  public getKnownSchemas(): Schema [] {
    return this._knownSchemas.getAllSchemas();
  }
}
