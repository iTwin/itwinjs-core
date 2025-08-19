/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ISchemaLocater, Schema, SchemaContext, SchemaInfo, SchemaKey, SchemaMatchType } from "@itwin/ecschema-metadata";
import { IModelRpcProps } from "@itwin/core-common";
import { ECSchemaRpcInterface } from "./ECSchemaRpcInterface";

/**
 * Defines a schema locater that retrieves schemas using an RPC interface.
 * @public @preview
 */
export class ECSchemaRpcLocater implements ISchemaLocater {
  /** @internal */
  public readonly token: IModelRpcProps;

  constructor(token: IModelRpcProps) { this.token = token; }

  /**
   * Attempts to get a schema from the schema rpc locater. Yields undefined if no matching schema is found.
   * @param schemaKey Key to look up
   * @param matchType How to match key against candidate schemas
   * @param context The SchemaContext that will control the lifetime of the schema and holds the schema's references, if they exist.
  */
  public async getSchema(schemaKey: SchemaKey, matchType: SchemaMatchType, context: SchemaContext): Promise<Schema | undefined> {
    await this.getSchemaInfo(schemaKey, matchType, context);

    const schema = await context.getCachedSchema(schemaKey, matchType);
    return schema;
  }

  /**
    * Gets the schema info which matches the provided SchemaKey.  The schema info may be returned before the schema is fully loaded.
    * The fully loaded schema can be accessed via the schema context using the getCachedSchema method.
    * @param schemaKey The SchemaKey describing the schema to get from the cache.
    * @param matchType The match type to use when locating the schema
    */
  public async getSchemaInfo(schemaKey: SchemaKey, matchType: SchemaMatchType, context: SchemaContext): Promise<SchemaInfo | undefined> {
    const schemaJson = await ECSchemaRpcInterface.getClient().getSchemaJSON(this.token, schemaKey.name);
    if (!schemaJson)
      return undefined;

    const schemaInfo = await Schema.startLoadingFromJson(schemaJson, context || new SchemaContext());
    if (schemaInfo !== undefined && schemaInfo.schemaKey.matches(schemaKey, matchType)) {
      return schemaInfo;
    }
    return undefined;
  }

  /**
   * This method is not supported for locating schemas over RPC/HTTP.
   * Use the asynchronous `getSchema` method instead.
   * @param _schemaKey Key to look up
   * @param _matchType How to match key against candidate schemas
   * @param _context The SchemaContext that will control the lifetime of the schema and holds the schema's references, if they exist.
   * @throws Error Always throws an error indicating this method is not supported.
   * @deprecated in 5.0 - will not be removed until after 2026-08-08. Use the asynchronous `getSchema` method for schema retrieval.
  */
  public getSchemaSync(_schemaKey: SchemaKey, _matchType: SchemaMatchType, _context: SchemaContext): Schema | undefined {
    throw new Error("getSchemaSync is not supported. Use the asynchronous getSchema method instead.");
  }
}
