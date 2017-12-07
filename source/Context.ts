/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
*--------------------------------------------------------------------------------------------*/

import { SchemaKeyInterface, SchemaInterface, SchemaChildInterface, SchemaChildKeyInterface } from "./Interfaces";
import { ECObjectsError, ECObjectsStatus } from "./Exception";
import { SchemaKey, SchemaMatchType } from "./ECObjects";
import SchemaChild from "./Metadata/SchemaChild";

export class SchemaMap extends Array<SchemaInterface> { }
class SchemaChildMap extends Array<SchemaChildInterface> { }

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
   * Gets the schema which matches the provided SchemaKey.
   * @param schemaKey The SchemaKey describing the schema to get from the cache.
   * @param matchType The match type to use when locating the schema
   */
  public getSchema<T extends SchemaInterface>(schemaKey: SchemaKeyInterface, matchType: SchemaMatchType = SchemaMatchType.Latest): T | undefined {
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

/**
 * The SchemaContext object is used to facilitate schema and schema children creation and deserialization.
 *
 * The context is made up of a group of Schema Locators. Each of the locators are used to identify references needed during creation
 * or deserialization.
 */
export class SchemaContext {
  private knownSchemas: SchemaCache;
  // TODO: Possibly need a cache of SchemaChildren
  // TODO: Add locators, possibly have a separate SchemaChild and Schema locator? That way the implementations can either be separate or together for the implementer.

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

  public locateSchemaChild<T extends SchemaChildInterface>(fullName: string): T | undefined {
    const [schemaName, childName] = SchemaChild.parseFullName(fullName);

    // TODO: Right now just going to look in the cache, but should attempt to locate other places
    const foundSchema = this.knownSchemas.getSchema(new SchemaKey(schemaName));
    if (!foundSchema)
      return undefined;

    return foundSchema.getChild<T>(childName);
  }
}
