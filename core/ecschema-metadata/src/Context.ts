/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { SchemaMatchType } from "./ECObjects";
import { ECObjectsError, ECObjectsStatus } from "./Exception";
import { SchemaInfo } from "./Interfaces";
import { MutableSchema, Schema } from "./Metadata/Schema";
import { SchemaItem } from "./Metadata/SchemaItem";
import { SchemaItemKey, SchemaKey } from "./SchemaKey";

/**
 * @internal
 */
class SchemaMap extends Array<SchemaEntry> { }

/**
 * @internal
 */
interface SchemaEntry {
  schemaInfo: SchemaInfo;
  schema: Schema;
  schemaPromise?: Promise<Schema>;
}

/**
 * The interface defines what is needed to be an `ISchemaLocater`.
 * A Schema Locater loads the requested schema if it can or returns undefined.
 * Schema Locaters should always load the schema on each request and should not hold a cache of schemas.
 * Schema locaters should never be used directly to load a schema, they should be added to a `SchemaContext`
 * and the context should be used to load schemas.  The `SchemaContext` caches schemas and manages schema life time.
 * @beta
 */
export interface ISchemaLocater {

  /**
   * Attempts to get a schema from the locater. Yields undefined if no matching schema is found.
   * For schemas that may have references, construct and call through a SchemaContext instead.
   * @param schemaKey key to look up
   * @param matchType how to match key against candidate schemas
   * @param context context for loading schema references
   */
  getSchema(schemaKey: SchemaKey, matchType: SchemaMatchType, context: SchemaContext): Promise<Schema | undefined>;

  /**
  * Gets the schema info which matches the provided SchemaKey.  The schema info may be returned before the schema is fully loaded.
  * May return the entire Schema so long as it is completely loaded as it satisfies the SchemaInfo interface.
  * @param schemaKey The SchemaKey describing the schema to get from the cache.
  * @param matchType The match type to use when locating the schema
  */
  getSchemaInfo(schemaKey: SchemaKey, matchType: SchemaMatchType, context: SchemaContext): Promise<SchemaInfo | undefined>;

  /**
   * Attempts to get a schema from the locater. Yields undefined if no matching schema is found.
   * For schemas that may have references, construct and call through a SchemaContext instead.
   * @param schemaKey key to look up
   * @param matchType how to match key against candidate schemas
   * @param context context for loading schema references
   */
  getSchemaSync(schemaKey: SchemaKey, matchType: SchemaMatchType, context: SchemaContext): Schema | undefined;
}

/**
 * Base interface for types that allow location of items inside a schema
 * @beta
 */
export interface ISchemaItemLocater {
  /**
   * Gets the schema item from the specified schema if it exists in this [[SchemaContext]].
   * Will await a partially loaded schema then look in it for the requested item.
   * @param schemaItemKey The SchemaItemKey identifying the item to return.  SchemaMatchType.Latest is used to match the schema.
   * @returns The requested schema item.
   */
  getSchemaItem(schemaItemKey: SchemaItemKey): Promise<SchemaItem | undefined>;
  getSchemaItem<T extends typeof SchemaItem>(schemaItemKey: SchemaItemKey, itemConstructor: T): Promise<InstanceType<T> | undefined>;

  /**
   * Gets the schema item from the specified schema if it exists in this [[SchemaContext]].
   * Will skip a partially loaded schema and return undefined if the item belongs to that schema. Use the async method to await partially loaded schemas.
   * @param schemaItemKey The SchemaItemKey identifying the item to return.  SchemaMatchType.Latest is used to match the schema.
   * @param itemConstructor The constructor of the item to return.
   * @returns The requested schema item.
   */
  getSchemaItemSync(schemaItemKey: SchemaItemKey): SchemaItem | undefined;
  getSchemaItemSync<T extends typeof SchemaItem>(schemaItemKey: SchemaItemKey, itemConstructor: T): InstanceType<T> | undefined;
}

/**
 * @internal
 */
export class SchemaCache implements ISchemaLocater {
  private _schema: SchemaMap;

  constructor() {
    this._schema = new SchemaMap();
  }

  public get count() { return this._schema.length; }

  private loadedSchemaExists(schemaKey: SchemaKey): boolean {
    return undefined !== this._schema.find((entry: SchemaEntry) => entry.schemaInfo.schemaKey.matches(schemaKey, SchemaMatchType.Latest) && !entry.schemaPromise);
  }

  private schemaPromiseExists(schemaKey: SchemaKey): boolean {
    return undefined !== this._schema.find((entry: SchemaEntry) => entry.schemaInfo.schemaKey.matches(schemaKey, SchemaMatchType.Latest) && undefined !== entry.schemaPromise);
  }

  private findEntry(schemaKey: SchemaKey, matchType: SchemaMatchType): SchemaEntry | undefined {
    return this._schema.find((entry: SchemaEntry) => entry.schemaInfo.schemaKey.matches(schemaKey, matchType));
  }

  private removeSchemaPromise(schemaKey: SchemaKey) {
    const entry = this.findEntry(schemaKey, SchemaMatchType.Latest);
    if (entry)
      entry.schemaPromise = undefined;
  }

  private removeEntry(schemaKey: SchemaKey) {
    this._schema = this._schema.filter((entry: SchemaEntry) => !entry.schemaInfo.schemaKey.matches(schemaKey));
  }

  /**
   * Returns true if the schema exists in either the schema cache or the promise cache.  SchemaMatchType.Latest used.
   * @param schemaKey The key to search for.
   */
  public schemaExists(schemaKey: SchemaKey): boolean {
    return this.loadedSchemaExists(schemaKey) || this.schemaPromiseExists(schemaKey);
  }

  /**
   * Adds a promise to load the schema to the cache. Does not allow for duplicate schemas in the cache of schemas or cache of promises, checks using SchemaMatchType.Latest.
   * When the promise completes the schema will be added to the schema cache and the promise will be removed from the promise cache
   * @param schemaInfo An object with the schema key for the schema being loaded and it's references
   * @param schema The partially loaded schema that the promise will fulfill
   * @param schemaPromise The schema promise to add to the cache.
   */
  public async addSchemaPromise(schemaInfo: SchemaInfo, schema: Schema, schemaPromise: Promise<Schema>) {
    if (this.schemaExists(schemaInfo.schemaKey))
      throw new ECObjectsError(ECObjectsStatus.DuplicateSchema, `The schema, ${schemaInfo.schemaKey.toString()}, already exists within this cache.`);

    this._schema.push({ schemaInfo, schema, schemaPromise });

    // This promise is cached and will be awaited when the user requests the full schema.
    // If the promise competes successfully before the user requests the schema it will be removed from the cache
    // If it fails it will remain in the cache until the user awaits it and handles the error
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    schemaPromise.then(() => {
      this.removeSchemaPromise(schemaInfo.schemaKey);
    });
  }

  /**
   * Adds a schema to the cache. Does not allow for duplicate schemas, checks using SchemaMatchType.Latest.
   * @param schema The schema to add to the cache.
   */
  public async addSchema(schema: Schema) {
    if (this.schemaExists(schema.schemaKey))
      throw new ECObjectsError(ECObjectsStatus.DuplicateSchema, `The schema, ${schema.schemaKey.toString()}, already exists within this cache.`);

    this._schema.push({ schemaInfo: schema, schema });
  }

  /**
   * Adds a schema to the cache. Does not allow for duplicate schemas, checks using SchemaMatchType.Latest.
   * @param schema The schema to add to the cache.
   */
  public addSchemaSync(schema: Schema) {
    if (this.schemaExists(schema.schemaKey))
      throw new ECObjectsError(ECObjectsStatus.DuplicateSchema, `The schema, ${schema.schemaKey.toString()}, already exists within this cache.`);

    this._schema.push({ schemaInfo: schema, schema });
  }

  /**
   * Gets the schema which matches the provided SchemaKey.
   * @param schemaKey The SchemaKey describing the schema to get from the cache.
   * @param matchType The match type to use when locating the schema
   */
  public async getSchema(schemaKey: SchemaKey, matchType: SchemaMatchType = SchemaMatchType.Latest): Promise<Schema | undefined> {
    if (this.count === 0)
      return undefined;

    const entry = this.findEntry(schemaKey, matchType);
    if (!entry)
      return undefined;

    if (entry.schemaPromise) {
      try {
        const schema = await entry.schemaPromise;
        return schema;
      } catch (e) {
        this.removeEntry(schemaKey);
        throw e;
      }
    }

    return entry.schema;
  }

  /**
    * Gets the schema info which matches the provided SchemaKey.  The schema info may be returned before the schema is fully loaded.
    * @param schemaKey The SchemaKey describing the schema to get from the cache.
    * @param matchType The match type to use when locating the schema
    */
  public async getSchemaInfo(schemaKey: SchemaKey, matchType: SchemaMatchType = SchemaMatchType.Latest): Promise<SchemaInfo | undefined> {
    if (this.count === 0)
      return undefined;

    const entry = this.findEntry(schemaKey, matchType);
    if (entry)
      return entry.schemaInfo;

    return undefined;
  }

  /**
   * Gets the schema which matches the provided SchemaKey.  If the schema is partially loaded an exception will be thrown.
   * @param schemaKey The SchemaKey describing the schema to get from the cache.
   * @param matchType The match type to use when locating the schema
   */
  public getSchemaSync(schemaKey: SchemaKey, matchType: SchemaMatchType = SchemaMatchType.Latest): Schema | undefined {
    if (this.count === 0)
      return undefined;

    const entry = this.findEntry(schemaKey, matchType);
    if (entry) {
      if (entry.schemaPromise) {
        throw new ECObjectsError(ECObjectsStatus.UnableToLoadSchema, `The Schema ${schemaKey.toString()} is partially loaded so cannot be loaded synchronously.`);
      }
      return entry.schema;
    }

    return undefined;
  }

  /**
   * Generator function that can iterate through each schema in _schema SchemaMap and items for each Schema.
   * Does not include schema items from schemas that are not completely loaded yet.
   */
  public * getSchemaItems(): IterableIterator<SchemaItem> {
    for (const entry of this._schema) {
      for (const schemaItem of entry.schema.getItems()) {
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
    return this._schema.map((entry: SchemaEntry) => entry.schema);
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
export class SchemaContext implements ISchemaItemLocater {
  private _locaters: ISchemaLocater[];

  private _knownSchemas: SchemaCache;
  private _fallbackLocaterDefined: boolean;

  constructor() {
    this._locaters = [];

    this._knownSchemas = new SchemaCache();
    this._locaters.push(this._knownSchemas);
    this._fallbackLocaterDefined = false;
  }

  public get locaters(): ISchemaLocater[] { return this._locaters; }

  /**
   * Adds a locater to the context.
   *
   * If no locaters are defined or a fallback locater is not defined, the new locater is added at the end of the locaters array.
   * If a fallback locater is already defined, the new locater is inserted before the fallback locater.
   *
   * @param locater - The locater to be added.
   */
  public addLocater(locater: ISchemaLocater) {
    const insertIndex = (this._locaters.length === 0 || !this._fallbackLocaterDefined) ? this._locaters.length : this._locaters.length - 1;
    this._locaters.splice(insertIndex, 0, locater);
  }

  /**
   * Adds a fallback locater to the context.
   *
   * If a fallback locater is already defined, it replaces the existing one.
   * Otherwise, it adds the new locater to the end of the locaters array and marks the fallback locater as defined.
   *
   * @param locater - The locater to be added as a fallback.
   */
  public addFallbackLocater(locater: ISchemaLocater) {
    if (this._fallbackLocaterDefined) {
      this._locaters[this._locaters.length - 1] = locater;
    } else {
      this._locaters.push(locater);
      this._fallbackLocaterDefined = true;
    }
  }

  /**
   * Adds the schema to this context.  Use addSchemaPromise instead when asynchronously loading schemas.
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
   * @deprecated in 4.0 use ecschema-editing package
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
  public schemaExists(schemaKey: SchemaKey): boolean {
    return this._knownSchemas.schemaExists(schemaKey);
  }

  /**
   * Adds a promise to load the schema to the cache. Does not allow for duplicate schemas in the cache of schemas or cache of promises, checks using SchemaMatchType.Latest.
   * When the promise completes the schema will be added to the schema cache and the promise will be removed from the promise cache.
   * Use this method over addSchema when asynchronously loading schemas
   * @param schemaInfo An object with the schema key for the schema being loaded and it's references
   * @param schema The partially loaded schema that the promise will fulfill
   * @param schemaPromise The schema promise to add to the cache.
   */
  public async addSchemaPromise(schemaInfo: SchemaInfo, schema: Schema, schemaPromise: Promise<Schema>) {
    return this._knownSchemas.addSchemaPromise(schemaInfo, schema, schemaPromise);
  }

  /** Attempts to obtain a schema from this context that matches the specified criteria.
   * @param schemaKey Identifies the schema to obtain.
   * @param matchType Criteria by which to identify potentially matching schemas.
   * @returns the schema matching the input criteria, or `undefined` if no such schema could be located.
   */
  public async getSchema(schemaKey: SchemaKey, matchType: SchemaMatchType = SchemaMatchType.Latest): Promise<Schema | undefined> {
    // the first locater is _knownSchemas, so we don't have to check the cache explicitly here
    for (const locater of this._locaters) {
      const schema = await locater.getSchema(schemaKey, matchType, this);
      if (undefined !== schema)
        return schema;
    }

    return undefined;
  }

  /**
   * Gets the schema info which matches the provided SchemaKey.  The schema info may be returned before the schema is fully loaded.
   * The fully loaded schema can be gotten later from the context using [[getSchema]].
   * @param schemaKey The SchemaKey describing the schema to get from the cache.
   * @param matchType The match type to use when locating the schema
   */
  public async getSchemaInfo(schemaKey: SchemaKey, matchType: SchemaMatchType): Promise<SchemaInfo | undefined> {
    for (const locater of this._locaters) {
      const schemaInfo = await locater.getSchemaInfo(schemaKey, matchType, this);
      if (undefined !== schemaInfo)
        return schemaInfo;
    }

    return undefined;
  }

  /** Attempts to obtain a schema from this context that matches the specified criteria.
   * Will return undefined if the schema is partially loaded.  Use [[getSchema]] to await until the schema is completely loaded.
   * @param schemaKey Identifies the schema to obtain.
   * @param matchType Criteria by which to identify potentially matching schemas.
   * @returns the schema matching the input criteria, or `undefined` if no such schema could be located.
   */
  public getSchemaSync(schemaKey: SchemaKey, matchType: SchemaMatchType = SchemaMatchType.Latest): Schema | undefined {
    // the first locater is _knownSchemas, so we don't have to check the cache explicitly here
    for (const locater of this._locaters) {
      const schema = locater.getSchemaSync(schemaKey, matchType, this);
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
  public async getCachedSchema(schemaKey: SchemaKey, matchType: SchemaMatchType = SchemaMatchType.Latest): Promise<Schema | undefined> {
    return this._knownSchemas.getSchema(schemaKey, matchType);
  }

  /**
   * Attempts to get a Schema from the context's cache.
   * Will return undefined if the cached schema is partially loaded.  Use [[getCachedSchema]] to await until the schema is completely loaded.
   * @param schemaKey The SchemaKey to identify the Schema.
   * @param matchType The SchemaMatch type to use. Default is SchemaMatchType.Latest.
   * @internal
   */
  public getCachedSchemaSync(schemaKey: SchemaKey, matchType: SchemaMatchType = SchemaMatchType.Latest): Schema | undefined {
    return this._knownSchemas.getSchemaSync(schemaKey, matchType);
  }

  /**
   * Gets the schema item from the specified schema if it exists in this [[SchemaContext]].
   * Will await a partially loaded schema then look in it for the requested item
   * @param schemaItemKey The SchemaItemKey identifying the item to return.  SchemaMatchType.Latest is used to match the schema.
   * @param itemConstructor The constructor of the item to return.
   * @returns The requested schema item
   */
  public async getSchemaItem(schemaItemKey: SchemaItemKey): Promise<SchemaItem | undefined>
  public async getSchemaItem<T extends typeof SchemaItem>(schemaItemKey: SchemaItemKey, itemConstructor: T): Promise<InstanceType<T> | undefined>
  public async getSchemaItem<T extends typeof SchemaItem>(schemaItemKey: SchemaItemKey, itemConstructor?: T): Promise<SchemaItem | InstanceType<T> | undefined> {
    const schema = await this.getSchema(schemaItemKey.schemaKey, SchemaMatchType.Latest);
    if (undefined === schema)
      return undefined;

    if(undefined === itemConstructor)
      return schema.getItem(schemaItemKey.name);

    return schema.getItem(schemaItemKey.name, itemConstructor);
  }

  /**
   * Gets the schema item from the specified schema if it exists in this [[SchemaContext]].
   * Will return undefined if the cached schema is partially loaded. Use [[getSchemaItem]] to await until the schema is completely loaded.
   * @param schemaItemKey The SchemaItemKey identifying the item to return. SchemaMatchType.Latest is used to match the schema.
   * @param itemConstructor The constructor of the item to return.
   * @returns The requested schema item
   */
  public getSchemaItemSync(schemaItemKey: SchemaItemKey): SchemaItem | undefined
  public getSchemaItemSync<T extends typeof SchemaItem>(schemaItemKey: SchemaItemKey, itemConstructor: T): InstanceType<T> | undefined
  public getSchemaItemSync<T extends typeof SchemaItem>(schemaItemKey: SchemaItemKey, itemConstructor?: T): SchemaItem | InstanceType<T> | undefined {
    const schema = this.getSchemaSync(schemaItemKey.schemaKey, SchemaMatchType.Latest);
    if (undefined === schema)
      return undefined;

    if(undefined === itemConstructor)
      return schema.getItemSync(schemaItemKey.name);

    return schema.getItemSync(schemaItemKey.name, itemConstructor);
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
