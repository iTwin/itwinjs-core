/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ISchemaLocater, Schema, SchemaContext, SchemaInfo, SchemaKey, SchemaMatchType, SchemaProps } from "@itwin/ecschema-metadata";
import { IModelRpcProps } from "@itwin/core-common";
import { ECSchemaRpcInterface } from "./ECSchemaRpcInterface";

/**
 * Defines a schema locater that retrieves schemas using an RPC interface.
 * @alpha
 */
export class ECSchemaRpcLocater implements ISchemaLocater {
  public readonly token: IModelRpcProps;

  constructor(token: IModelRpcProps) { this.token = token; }

  /**
   * Attempts to get a schema from the schema rpc locater. Yields undefined if no matching schema is found.
   * @param schemaKey Key to look up
   * @param matchType How to match key against candidate schemas
   * @param context The SchemaContext that will control the lifetime of the schema and holds the schema's references, if they exist.
  */
  public async getSchema<T extends Schema>(schemaKey: Readonly<SchemaKey>, matchType: SchemaMatchType, context: SchemaContext): Promise<T | undefined> {
    await this.getSchemaInfo(schemaKey, matchType, context);

    const schema = await context.getCachedSchema(schemaKey, matchType);
    return schema as T;
  }

  /**
    * Gets the schema info which matches the provided SchemaKey.  The schema info may be returned before the schema is fully loaded.
    * The fully loaded schema can be accessed via the schema context using the getCachedSchema method.
    * @param schemaKey The SchemaKey describing the schema to get from the cache.
    * @param matchType The match type to use when locating the schema
    */
  public async getSchemaInfo(schemaKey: Readonly<SchemaKey>, matchType: SchemaMatchType, context: SchemaContext): Promise<SchemaInfo | undefined> {
    const schemaJson = await ECSchemaRpcInterface.getClient().getSchemaJSON(this.token, schemaKey.name);
    const schemaInfo = await Schema.startLoadingFromJson(schemaJson, context || new SchemaContext());
    if (schemaInfo !== undefined && schemaInfo.schemaKey.matches(schemaKey, matchType)) {
      return schemaInfo;
    }
    return undefined;
  }

  /**
   * Attempts to get a schema from the schema rpc locater. Yields undefined if no matching schema is found.
   * @param schemaKey Key to look up
   * @param matchType How to match key against candidate schemas
   * @param context The SchemaContext that will control the lifetime of the schema and holds the schema's references, if they exist.
  */
  public getSchemaSync<T extends Schema>(schemaKey: Readonly<SchemaKey>, matchType: SchemaMatchType, context: SchemaContext): T | undefined {
    const schemaJson = ECSchemaRpcInterface.getClient().getSchemaJSON(this.token, schemaKey.name).then((props: SchemaProps) => {
      return props;
    });
    const schema = Schema.fromJsonSync(schemaJson, context || new SchemaContext());
    if (schema !== undefined && schema.schemaKey.matches(schemaKey, matchType)) {
      return schema as T;
    }
    return undefined;
  }
}
