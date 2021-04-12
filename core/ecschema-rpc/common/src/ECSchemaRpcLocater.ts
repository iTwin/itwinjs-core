/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ISchemaLocater, Schema, SchemaContext, SchemaKey, SchemaMatchType, SchemaProps } from "@bentley/ecschema-metadata";
import { IModelRpcProps } from "@bentley/imodeljs-common";
import { ECSchemaRpcInterface } from "./ECSchemaRpcInterface";

/**
 * Defines a schema locater that retrieves schemas using an RPC interface.
 * @internal
 */
export class ECSchemaRpcLocater implements ISchemaLocater {
    public token: IModelRpcProps;
    
    constructor(token: IModelRpcProps) { this.token = token; }

    public async getSchema<T extends Schema>(schemaKey: SchemaKey, matchType: SchemaMatchType, context: SchemaContext): Promise<T | undefined> {
        const schemaJson = JSON.parse(await ECSchemaRpcInterface.getClient().getSchemaJSON(this.token, schemaKey.name)) as SchemaProps;
        const schema = await Schema.fromJson(schemaJson, context || new SchemaContext());
        if (schema !== undefined && schema.schemaKey.matches(schemaKey, matchType)) {
          return schema as T;
        }
        return undefined;
    }

    public getSchemaSync<T extends Schema>(schemaKey: SchemaKey, matchType: SchemaMatchType, context: SchemaContext): T | undefined {
      const schemaJson = ECSchemaRpcInterface.getClient().getSchemaJSON(this.token, schemaKey.name).then((jsonString: string) => {
        return JSON.parse(jsonString) as SchemaProps;
      });
      const schema = Schema.fromJsonSync(schemaJson, context || new SchemaContext());
      if (schema !== undefined && schema.schemaKey.matches(schemaKey, matchType)) {
        return schema as T;
      }
      return undefined;
    }
}