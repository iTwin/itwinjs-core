/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Logger } from "@itwin/core-bentley";
import { ISchemaLocater, SchemaContext } from "./Context";
import { SchemaProps } from "./Deserialization/JsonProps";
import { SchemaMatchType } from "./ECObjects";
import { SchemaInfo } from "./Interfaces";
import { Schema } from "./Metadata/Schema";
import { SchemaKey } from "./SchemaKey";

/**
 * Gets the full schema Json for the input schema name or undefined if not found
 * @throws [Error] if the schema is found but json cannot be returned
 * @public @preview
 */
export type SchemaPropsGetter = (schemaName: string) => SchemaProps | undefined;

/**
 * An ISchemaLocater implementation for locating and retrieving EC Schema objects using a function
 * that returns the Schema Json for a given schema name
 * @public @preview
 */
export class SchemaJsonLocater implements ISchemaLocater {
  private _getSchema: SchemaPropsGetter;

  public constructor(schemaPropschemaGetter: SchemaPropsGetter) {
    // Since the schemaPropschemaGetter may throw an error, but the locater contract defines that
    // getSchema should return undefined if the schema could not be located, we wrap the provided
    // lookup function in a safe block and log any errors that occured.
    this._getSchema = (schemaName) => {
      try {
        return schemaPropschemaGetter(schemaName);
      } catch (error: any) {
        Logger.logError("SchemaJsonLocater", `Failed to get schema JSON for schema ${schemaName}: ${error.message}`);
        return undefined;
      }
    };
  }

  /** Get a schema by [SchemaKey]
   * @param schemaKey The [SchemaKey] that identifies the schema.
   * @param matchType The [SchemaMatchType] to used for comparing schema versions.
   * @param context The [SchemaContext] used to facilitate schema location.
   * @throws [ECSchemaError]($ecschema-metadata) if the schema exists, but cannot be loaded.
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
   * @param matchType The [SchemaMatchType] to used for comparing schema versions.
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
