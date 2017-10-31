/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import { SchemaKeyInterface, SchemaInterface } from "./Interfaces";
import { ECObjectsError, ECObjectsStatus } from "./Exception";
import { SchemaKey } from "./ECObjects";

export class SchemaMap extends Array<SchemaInterface> { }

/**
 *
 */
export class SchemaCache {
  private _schema: SchemaMap;

  constructor() {
    this._schema = new SchemaMap();
  }

  get count() { return this._schema.length; }

  /**
   * Adds a schema to the cache. Does not allow for duplicate schemas.
   * @param schema The schema to add to the cache.
   */
  public addSchema<T extends SchemaInterface>(schema: T) {
    if (this.getSchema(schema.schemaKey))
      throw new ECObjectsError(ECObjectsStatus.DuplicateSchema, `The schema, ${schema.schemaKey.toString()}, already exists within this cache.`);

    this._schema.push(schema);
  }

  /**
   *
   * @param schemaKey The SchemaKey describing the schema to get from the cache.
   */
  public getSchema<T extends SchemaInterface>(schemaKey: SchemaKeyInterface): T | undefined {
    if (this.count === 0)
      return undefined;

    const findFunc = (schema: SchemaInterface) => {
      return schema.schemaKey.toString() === schemaKey.toString();
    };

    const foundSchema = this._schema.find(findFunc);

    if (!foundSchema)
      return foundSchema;

    return foundSchema as T;
  }

  /**
   * Removes the
   * @param schemaKey The schema key of the schema to remove.
   */
  public removeSchema(schemaKey: SchemaKey) {
    const findFunc = (schema: SchemaInterface) => {
      return schema.schemaKey.toString() === schemaKey.toString();
    };

    const indx = this._schema.findIndex(findFunc);
    if (indx < 0)
      return;

    this._schema.splice(indx, 1);
  }
}

export class SchemaContext {
  private knownSchemas: SchemaCache;

  constructor() {
    this.knownSchemas = new SchemaCache();
  }

  public addSchema(schema: SchemaInterface) {
    this.knownSchemas.addSchema(schema);
  }

  public locateSchema<T extends SchemaInterface>(schemaKey: SchemaKey): T | undefined {
    // TODO: Right now just going to look in the cache, but should attempt to locate other places
    return this.knownSchemas.getSchema(schemaKey);
  }
}
