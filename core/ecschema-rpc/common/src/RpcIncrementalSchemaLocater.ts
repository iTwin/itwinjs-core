/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { DbQueryRequest, DbQueryResponse, DbRequestExecutor, ECSqlReader, IModelReadRpcInterface, type IModelRpcProps, QueryBinder, QueryOptions, QueryRowFormat } from "@itwin/core-common";
import { ECSqlQueryOptions, ECSqlSchemaLocater, ECSqlSchemaLocaterOptions, SchemaKey, SchemaProps } from "@itwin/ecschema-metadata";
import { ECSchemaRpcInterface } from "./ECSchemaRpcInterface";

/**
 * A [[ECSqlSchemaLocater]]($ecschema-metadata) implementation that uses the ECSchema RPC interfaces to load schemas incrementally.
 * @beta
 */
export class RpcIncrementalSchemaLocater extends ECSqlSchemaLocater {
  private readonly _iModelProps: IModelRpcProps;

  /**
   * Initializes a new instance of the RpcIncrementalSchemaLocater class.
   */
  constructor(iModelProps: IModelRpcProps, options?: ECSqlSchemaLocaterOptions) {
    super(options);
    this._iModelProps = iModelProps;
  }

  /**
   * Executes the given ECSql query and returns the resulting rows.
   * @param query The ECSql query to execute.
   * @param options Optional arguments to control the query result.
   * @returns A promise that resolves to the resulting rows.
   */
  protected override async executeQuery<TRow>(query: string, options?: ECSqlQueryOptions): Promise<ReadonlyArray<TRow>> {
    const ecSqlQueryClient = IModelReadRpcInterface.getClient();
    const queryExecutor: DbRequestExecutor<DbQueryRequest, DbQueryResponse> = {
      execute: async (request) => ecSqlQueryClient.queryRows(this._iModelProps, request),
    };

    const queryOptions: QueryOptions = {
      limit: { count: options?.limit },
      rowFormat: QueryRowFormat.UseECSqlPropertyNames,
    };

    const queryParameters = options && options.parameters ? QueryBinder.from(options.parameters) : undefined;
    const queryReader = new ECSqlReader(queryExecutor, query, queryParameters, queryOptions);

    return queryReader.toArray();
  }

  /**
   * Gets the [[SchemaProps]]($ecschema-metadata) for the given [[SchemaKey]]($ecschema-metadata).
   * This is the full schema json with all elements that are defined in the schema.
   * @param schemaKey The schema key of the schema to be resolved.
   */
  protected async getSchemaProps(schemaKey: SchemaKey): Promise<SchemaProps | undefined> {
    const rpcSchemaClient = ECSchemaRpcInterface.getClient();
    return rpcSchemaClient.getSchemaJSON(this._iModelProps, schemaKey.name);
  };
}
