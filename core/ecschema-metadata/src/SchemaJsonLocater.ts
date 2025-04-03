/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { ISchemaLocater, SchemaContext } from "./Context.js";
import { SchemaProps } from "./Deserialization/JsonProps.js";
import { SchemaMatchType } from "./ECObjects.js";
import { SchemaInfo } from "./Interfaces.js";
import { Schema } from "./Metadata/Schema.js";
import { SchemaKey } from "./SchemaKey.js";

/**
 * Gets the full schema Json for the input schema name or undefined if not found
 * @throws [Error] if the schema is found but json cannot be returned
 * @beta
 */
export type SchemaPropsGetter = (schemaName: string) => SchemaProps | undefined;

/**
 * A  ISchemaLocater implementation for locating and retrieving EC Schema objects using a function
 * that returns the Schema Json for a given schema name
 * @beta
 */
export class SchemaJsonLocater implements ISchemaLocater {
  public constructor(private _getSchema: SchemaPropsGetter) { }

  /** Get a schema by [SchemaKey]
   * @param schemaKey The [SchemaKey] that identifies the schema.
   * @param matchType The [SchemaMatchType] to used for comparing schema versions.
   * @param context The [SchemaContext] used to facilitate schema location.
   * @throws [ECObjectsError]($ecschema-metadata) if the schema exists, but cannot be loaded.
   */
  public async getSchema(schemaKey: SchemaKey, matchType: SchemaMatchType, context: SchemaContext): Promise<Schema | undefined> {
    await this.getSchemaInfo(schemaKey, matchType, context);
    return context.getCachedSchema(schemaKey, matchType);
  }

  /**
   * Gets the schema info which matches the provided SchemaKey.  The schema info may be returned before the schema is fully loaded.
   * @param schemaKey The SchemaKey describing the schema to get from the cache.
   * @param matchType The match type to use when locating the schema
   */
  public async getSchemaInfo(schemaKey: SchemaKey, matchType: SchemaMatchType, context: SchemaContext): Promise<SchemaInfo | undefined> {
    const schemaProps = this._getSchema(schemaKey.name);
    if (!schemaProps)
      return undefined;

    const schemaInfo = await Schema.startLoadingFromJson(schemaProps, context);
    if (schemaInfo !== undefined && schemaInfo.schemaKey.matches(schemaKey, matchType))
      return schemaInfo;

    return undefined;
  }

  /** Get a schema by [SchemaKey] synchronously.
   * @param schemaKey The [SchemaKey] that identifies the schema.
   * * @param matchType The [SchemaMatchType] to used for comparing schema versions.
   * @param context The [SchemaContext] used to facilitate schema location.
   * @throws [Error]($ecschema-metadata) if the schema exists, but cannot be loaded.
   */
  public getSchemaSync(schemaKey: SchemaKey, _matchType: SchemaMatchType, context: SchemaContext): Schema | undefined {
    const schemaProps = this._getSchema(schemaKey.name);
    if (!schemaProps)
      return undefined;

    return Schema.fromJsonSync(schemaProps, context || new SchemaContext());
  }
}
