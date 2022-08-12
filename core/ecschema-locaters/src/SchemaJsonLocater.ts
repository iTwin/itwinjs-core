/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { ISchemaLocater, Schema, SchemaContext, SchemaKey, SchemaMatchType } from "@itwin/ecschema-metadata";

/**
 * Gets schema Json for the input schema name or undefined if not found
 * @throws [Error] if the schema is found but json cannot be returned
 * @alpha
 */
export type GetSchemaJson = (schemaName: string) => string | undefined;

/**
 * A  ISchemaLocater implementation for locating and retrieving EC Schema objects using a function
 * that returns the Schema Json for a given schema name
 * @alpha
 */
export class SchemaJsonLocater implements ISchemaLocater {
  public constructor(private _getSchema: GetSchemaJson) { }

  /** Get a schema by [SchemaKey]
   * @param schemaKey The [SchemaKey] that identifies the schema.
   * @param matchType The [SchemaMatchType] to used for comparing schema versions.
   * @param context The [SchemaContext] used to facilitate schema location.
   * @throws [ECObjectsError]($ecschema-metadata) if the schema exists, but cannot be loaded.
   */
  public async getSchema<T extends Schema>(schemaKey: SchemaKey, matchType: SchemaMatchType, context?: SchemaContext | undefined): Promise<T | undefined> {
    return this.getSchemaSync(schemaKey, matchType, context) as T;
  }

  /** Get a schema by [SchemaKey] synchronously.
   * @param schemaKey The [SchemaKey] that identifies the schema.
   * * @param matchType The [SchemaMatchType] to used for comparing schema versions.
   * @param context The [SchemaContext] used to facilitate schema location.
   * @throws [Error]($ecschema-metadata) if the schema exists, but cannot be loaded.
   */
  public getSchemaSync<T extends Schema>(schemaKey: SchemaKey, _matchType: SchemaMatchType, context?: SchemaContext | undefined): T | undefined {
    const schemaProps = this._getSchema(schemaKey.name);
    if (!schemaProps)
      return undefined;

    context = context ? context : new SchemaContext();
    return Schema.fromJsonSync(schemaProps, context) as T;
  }

}
