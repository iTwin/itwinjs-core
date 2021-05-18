/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ISchemaLocater, Schema, SchemaContext, SchemaKey, SchemaMatchType, SchemaProps } from "@bentley/ecschema-metadata";
import { IModelRpcProps } from "@bentley/imodeljs-common";
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
  public async getSchema<T extends Schema>(schemaKey: SchemaKey, matchType: SchemaMatchType, context: SchemaContext): Promise<T | undefined> {
    const schemaJson = await ECSchemaRpcInterface.getClient().getSchemaJSON(this.token, schemaKey.name);
    const schema = await Schema.fromJson(schemaJson, context || new SchemaContext());
    if (schema !== undefined && schema.schemaKey.matches(schemaKey, matchType)) {
      return schema as T;
    }
    return undefined;
  }

  /**
   * Attempts to get a schema from the schema rpc locater. Yields undefined if no matching schema is found.
   * @param schemaKey Key to look up
   * @param matchType How to match key against candidate schemas
   * @param context The SchemaContext that will control the lifetime of the schema and holds the schema's references, if they exist.
  */
  public getSchemaSync<T extends Schema>(schemaKey: SchemaKey, matchType: SchemaMatchType, context: SchemaContext): T | undefined {
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
