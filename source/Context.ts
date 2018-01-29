/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import { SchemaInterface, SchemaChildInterface } from "Interfaces";
import { ECObjectsError, ECObjectsStatus } from "Exception";
import { SchemaKey, SchemaMatchType, SchemaChildKey } from "ECObjects";

export class SchemaMap extends Array<SchemaInterface> { }

/**
 * The interface defines what is needed to be a ISchemaLocater, which are used in a SchemaContext.
 */
export interface ISchemaLocater {
  getSchema<T extends SchemaInterface>(schemaKey: SchemaKey, matchType: SchemaMatchType): Promise<T | undefined>;
}

export interface ISchemaChildLocater {
  getSchemaChild<T extends SchemaChildInterface>(schemaChildKey: SchemaChildKey): Promise<T | undefined>;
}

// export class SchemaChildReturn<T extends SchemaChildInterface> {
//   private readonly _parent: SchemaChildInterface;
//   private _thisChild: T | undefined;
//   public key: SchemaChildKey;

//   constructor(key: SchemaChildKey, parentChild: SchemaChildInterface) {
//     this._parent = parentChild;
//     this.key = key;
//   }

//   public async get<S extends SchemaChildInterface>(): Promise<S> {
//     if (this._thisChild)
//       Promise.resolve(this._thisChild);

//     const schema = await this._parent.schema;
//     if (!schema)
//       return Promise.reject("");

//     if (schema.schemaKey.matches(this.key.schemaKey, SchemaMatchType.Latest)) {
//       const tempClass = schema.getChild<S>(this.key.name, false);
//       return tempClass === undefined ? Promise.reject("") : Promise.resolve(tempClass);
//     }

//     if (!schema.references || schema.references.length === 0)
//       return Promise.reject("");

//     const foundSchema = schema.references.find((tempSchema: SchemaInterface) => {
//       return tempSchema.schemaKey.matches(this.key.schemaKey, SchemaMatchType.Latest);
//     });

//     if (!foundSchema)
//       return Promise.reject("");

//     const foundChild = foundSchema.getChild<S>(this.key.name, false);
//     if (!foundChild)
//       return Promise.reject("");

//     return Promise.resolve(foundChild);
//   }
// }

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
  public async addSchema<T extends SchemaInterface>(schema: T) {
    if (await this.getSchema<T>(schema.schemaKey))
      return Promise.reject(new ECObjectsError(ECObjectsStatus.DuplicateSchema, `The schema, ${schema.schemaKey.toString()}, already exists within this cache.`));

    this._schema.push(schema);
    return Promise.resolve();
  }

  /**
   * Adds a schema to the cache. Does not allow for duplicate schemas, checks using SchemaMatchType.Latest.
   * @param schema The schema to add to the cache.
   */
  public addSchemaSync<T extends SchemaInterface>(schema: T) {
    if (this.getSchemaSync<T>(schema.schemaKey))
      throw new ECObjectsError(ECObjectsStatus.DuplicateSchema, `The schema, ${schema.schemaKey.toString()}, already exists within this cache.`);

    this._schema.push(schema);
  }

  /**
   * Gets the schema which matches the provided SchemaKey.
   * @param schemaKey The SchemaKey describing the schema to get from the cache.
   * @param matchType The match type to use when locating the schema
   */
  public async getSchema<T extends SchemaInterface>(schemaKey: SchemaKey, matchType: SchemaMatchType = SchemaMatchType.Latest): Promise<T | undefined> {
    if (this.count === 0)
      return Promise.resolve(undefined);

    const findFunc = (schema: SchemaInterface) => {
      return schema.schemaKey.matches(schemaKey, matchType);
    };

    const foundSchema = this._schema.find(findFunc);

    if (!foundSchema)
      return Promise.resolve(undefined);

    return Promise.resolve(foundSchema as T);
  }

  /**
   *
   * @param schemaKey
   * @param matchType
   */
  public getSchemaSync<T extends SchemaInterface>(schemaKey: SchemaKey, matchType: SchemaMatchType = SchemaMatchType.Latest): T | undefined {
    if (this.count === 0)
      return undefined;

    const findFunc = (schema: SchemaInterface) => {
      return schema.schemaKey.matches(schemaKey, matchType);
    };

    const foundSchema = this._schema.find(findFunc);

    if (!foundSchema)
      return foundSchema;

    return foundSchema as T;
  }

  /**
   * Removes the schema which matches the provided SchemaKey.
   * @param schemaKey The schema key of the schema to remove.
   */
  public async removeSchema(schemaKey: SchemaKey, matchType: SchemaMatchType = SchemaMatchType.Latest): Promise<void> {
    const findFunc = (schema: SchemaInterface) => {
      return schema.schemaKey.matches(schemaKey, matchType);
    };

    const indx = this._schema.findIndex(findFunc);
    if (indx < 0)
      return Promise.reject("");

    this._schema.splice(indx, 1);
    return Promise.resolve();
    }

  /**
   * Removes the schema which matches the provided SchemaKey.
   * @param schemaKey The schema key of the schema to remove.
   * @param matchType
   */
  public removeSchemaSync(schemaKey: SchemaKey, matchType: SchemaMatchType = SchemaMatchType.Latest) {
    const findFunc = (schema: SchemaInterface) => {
      return schema.schemaKey.matches(schemaKey, matchType);
    };

    const indx = this._schema.findIndex(findFunc);
    if (indx < 0)
      return;

    this._schema.splice(indx, 1);
  }
}

/**
 * The SchemaContext, context object is used to facilitate schema and schema children location.
 *
 * The context controls the lifetime of each schema that it knows about. It has to be explicitly removed from the context in order to delete a schema object.
 *
 * The context is made up of a group of Schema Locators.
 */
export class SchemaContext implements ISchemaLocater, ISchemaChildLocater {
  private _locaters: ISchemaLocater[];

  private knownSchemas: SchemaCache;

  constructor() {
    this._locaters = [];

    this.knownSchemas = new SchemaCache();
    this._locaters.push(this.knownSchemas);
  }

  public addLocater(locater: ISchemaLocater) {
    this._locaters.push(locater);
  }

  /**
   * Adds the schema to this context
   * @param schema The schema to add to this context
   */
  public async addSchema(schema: SchemaInterface) {
    this.knownSchemas.addSchemaSync(schema);
  }


  /**
   * Adds the given SchemaChild to the the SchemaContext by locating the schema, with the best match of SchemaMatchType.Exact, and
   * @param schemaChild The SchemaChild to add
   */
  public async addSchemaChild(schemaChild: SchemaChildInterface) {
    const schema = await this.getSchema(schemaChild.key.schemaKey, SchemaMatchType.Exact);
    if (!schema)
      throw new ECObjectsError(ECObjectsStatus.UnableToLocateSchema, `Unable to add the schema child ${schemaChild.name} to the schema ${schemaChild.key.schemaKey.toString()} because the schema could not be located.`);

    await schema.addChild(schemaChild);
    return;
  }

  /**
   *
   * @param schemaKey
   */
  public async getSchema<T extends SchemaInterface>(schemaKey: SchemaKey, matchType: SchemaMatchType = SchemaMatchType.Latest): Promise<T | undefined> {
    const listOfPromises: Array<Promise<T | undefined>> = [];

    this._locaters.forEach((locater) => {
      listOfPromises.push(locater.getSchema(schemaKey, matchType));
    });

    const potentialSchemas = (await Promise.all(listOfPromises)).filter((schema) => schema !== undefined ) as T[];
    if (potentialSchemas.length === 0)
      return undefined;

    // TODO figure out the best result based on match type... For now just returning the first found
    return potentialSchemas[0];
  }

  public async getSchemaChild<T extends SchemaChildInterface>(schemaChildKey: SchemaChildKey): Promise<T | undefined> {
    const schema = await this.getSchema(schemaChildKey.schemaKey, SchemaMatchType.Latest);
    if (!schema)
      return undefined;

    return schema.getChild<T>(schemaChildKey.name, false);
  }
}
