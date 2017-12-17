/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import { SchemaKeyInterface, SchemaInterface, SchemaChildInterface, SchemaChildKeyInterface } from "./Interfaces";
import { ECObjectsError, ECObjectsStatus } from "./Exception";
import { SchemaKey, SchemaMatchType } from "./ECObjects";
import SchemaChild from "./Metadata/SchemaChild";

export class SchemaMap extends Array<SchemaInterface> { }
class SchemaChildMap extends Array<SchemaChildInterface> { }

/**
 * The interface defines what is needed to be a ISchemaLocater, which are used in a SchemaContext.
 */
export interface ISchemaLocater {
  getSchemaSync<T extends SchemaInterface>(schemaKey: SchemaKeyInterface, matchType: SchemaMatchType): T | undefined;
  // getSchema<T extends SchemaInterface>(schemaKey: SchemaKeyInterface, matchType: SchemaMatchType): Promise<T | undefined>;
}

// TODO: Not sure if we want to keep this????
export class SchemaChildCache {
  private _schemaChildren: SchemaChildMap;

  constructor() {
    this._schemaChildren = new SchemaChildMap();
  }

  get count() { return this._schemaChildren.length; }

  // TODO: may need to add a match type...
  public getSchemaChild<T extends SchemaChildInterface>(schemaChildKey: SchemaChildKeyInterface): T | undefined {
    if (this._schemaChildren.length === 0)
      return undefined;

    const findFunc = (schemaChild: SchemaChildInterface) => {
      return schemaChild.key.matches(schemaChildKey);
    };

    const foundChild = this._schemaChildren.find(findFunc);

    if (!foundChild)
      return foundChild;

    return foundChild as T;
  }

  public addChild<T extends SchemaChildInterface>(child: T) {
    if (this.getSchemaChild(child.key))
      throw new ECObjectsError(ECObjectsStatus.DuplicateChild, `The schema child ${child.key.name} already exists within this cache.`);

    this._schemaChildren.push(child);
  }
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
  // public async addSchema<T extends SchemaInterface>(schema: T) {
  //   if (await this.getSchema<T>(schema.schemaKey))
  //     return Promise.reject(new ECObjectsError(ECObjectsStatus.DuplicateSchema, `The schema, ${schema.schemaKey.toString()}, already exists within this cache.`));

  //   this._schema.push(schema);
  //   return Promise.resolve();
  // }

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
  // public async getSchema<T extends SchemaInterface>(schemaKey: SchemaKeyInterface, matchType: SchemaMatchType = SchemaMatchType.Latest): Promise<T | undefined> {
  //   if (this.count === 0)
  //     return Promise.resolve(undefined);

  //   const findFunc = (schema: SchemaInterface) => {
  //     return schema.schemaKey.matches(schemaKey, matchType);
  //   };

  //   const foundSchema = this._schema.find(findFunc);

  //   if (!foundSchema)
  //     return Promise.resolve(undefined);

  //   return Promise.resolve(foundSchema as T);
  // }

  /**
   *
   * @param schemaKey
   * @param matchType
   */
  public getSchemaSync<T extends SchemaInterface>(schemaKey: SchemaKeyInterface, matchType: SchemaMatchType = SchemaMatchType.Latest): T | undefined {
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
   * TODO: Add the ability to specify a matchType.
   * @param schemaKey The schema key of the schema to remove.
   */
  // public async removeSchema(schemaKey: SchemaKey): Promise<void> {
  //   const findFunc = (schema: SchemaInterface) => {
  //     return schema.schemaKey.toString() === schemaKey.toString();
  //   };

  //   const indx = this._schema.findIndex(findFunc);
  //   if (indx < 0)
  //     return;

  //   this._schema.splice(indx, 1);
  //   return Promise.resolve();
  // }

  /**
   * Removes the schema which matches the provided SchemaKey.
   * @param schemaKey The schema key of the schema to remove.
   * @param matchType
   */
  public removeSchema(schemaKey: SchemaKey, matchType: SchemaMatchType = SchemaMatchType.Latest) {
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
 * The SchemaContext object is used to facilitate schema and schema children creation and deserialization.
 *
 * The context is made up of a group of Schema Locators. Each of the locators are used to identify references needed during creation
 * or deserialization.
 */
export class SchemaContext {
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
  public addSchemaSync(schema: SchemaInterface) {
    this.knownSchemas.addSchemaSync(schema);
  }

  /**
   *
   * @param schemaKey
   */
  // public locateSchema<T extends SchemaInterface>(schemaKey: SchemaKey, matchType: SchemaMatchType = SchemaMatchType.Latest): Promise<T | undefined> {
  // }

  /**
   *
   * @param schemaKey
   * @param matchType
   */
  public locateSchemaSync<T extends SchemaInterface>(schemaKey: SchemaKey, matchType: SchemaMatchType = SchemaMatchType.Latest): T | undefined {
    let foundSchema;

    this._locaters.forEach((locater) => {
      foundSchema = locater.getSchemaSync(schemaKey, matchType);
      if (foundSchema)
        return;
    });

    return foundSchema;
  }

  /**
   *
   * @param fullName
   */
  // public locateSchemaChild<T extends SchemaChildInterface>(fullName: string): Promise<T> {
  // }

  /**
   * 
   * @param fullName
   */
  public locateSchemaChildSync<T extends SchemaChildInterface>(fullName: string): T | undefined {
    const [schemaName, childName] = SchemaChild.parseFullName(fullName);

    let foundSchema: SchemaInterface | undefined;
    this._locaters.forEach((locater) => {
      foundSchema = locater.getSchemaSync<SchemaInterface>(new SchemaKey(schemaName), SchemaMatchType.Latest);
      if (foundSchema)
        return;
    });

    if (!foundSchema)
      return undefined;

    return foundSchema.getChild<T>(childName);
  }
}
