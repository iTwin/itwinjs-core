/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { MetadataRpcInterface } from "@bentley/schema-rpcinterface-common";
import { IModelRpcProps, RpcManager } from "@bentley/imodeljs-common";
import * as backend from "@bentley/imodeljs-backend";
import { SchemaProps } from "@bentley/ecschema-metadata";
import { ClientRequestContext } from "@bentley/bentleyjs-core";

/**
 * Defines the interface how the rows of the iModel query look like.
 */
interface SchemaNameRow {
  schemaName: string;
}

/**
 * Extends the iModelDb class with an overload of query that takes the row structure as
 * generic parameter. This allows typed rows instead of any.
 */
type IModelDb = backend.IModelDb & {
  query<T extends any>(ecsql: string): AsyncIterableIterator<T>;
};

/**
 * Implementation of the SchemaRpcInterface.
 * @Internal
 */
export class MetadataRpcImpl extends MetadataRpcInterface {
  /**
   * Registers the RPC interface with its corresponding implementation class.
   */
  public static register() {
    RpcManager.registerImpl(MetadataRpcInterface, MetadataRpcImpl);
  }

  /**
   * Gets an iModelDb instance. It is important that the database has been opened before
   * otherwise it can't be found.
   * @param tokenProps        The iModelToken props that hold the information which iModel is used.
   * @returns                 Instance of IModelDb.
   */
  private async getIModelDatabase(tokenProps: IModelRpcProps): Promise<IModelDb> {
    return new Promise<IModelDb>((resolve) => {
      resolve(backend.IModelDb.findByKey(tokenProps.key));
    });
  }

  /**
   * Returns an array of schema names that exists in the current iModel context.
   * @param tokenProps        The iModelToken props that hold the information which iModel is used.
   * @returns                 An array of schema names.
   */
  public async getSchemaNames(tokenProps: IModelRpcProps): Promise<string[]> {
    ClientRequestContext.current.enter();

    const schemaNames: string[] = [];
    const iModelDb = await this.getIModelDatabase(tokenProps);

    // Iterate over the rows returned from AsyncIterableIterator. The custom Query overload returns
    // a typed row instance instead of any.
    const schemaNameQuery = `SELECT Name as schemaName FROM main.meta.ECSchemaDef`;
    for await (const schemaDefinitionRow of iModelDb.query<SchemaNameRow>(schemaNameQuery)) {
      const schemaFullName = schemaDefinitionRow.schemaName;
      schemaNames.push(schemaFullName);
    }
    return schemaNames;
  }

  /**
   * Gets the schema JSON for the current iModel context and returns the schema as props.
   * @param tokenProps        The iModelToken props that hold the information which iModel is used.
   * @param schemaName        The name of the schema that shall be returned.
   * @returns                 The SchemaProps as JSON objects.
   */
  public async getSchemaJSON(tokenProps: IModelRpcProps, schemaName: string): Promise<SchemaProps> {
    ClientRequestContext.current.enter();

    if (schemaName === undefined || schemaName.length < 1) {
      throw new Error(`Schema name must not be undefined or empty.`);
    }

    const iModelDb = await this.getIModelDatabase(tokenProps);
    const schemaResult = iModelDb.nativeDb.getSchema(schemaName);

    if (schemaResult.error !== undefined) {
      throw new Error(schemaResult.error.message);
    }

    if (schemaResult.result === undefined) {
      throw new Error("Schema does not exists");
    }

    return JSON.parse(schemaResult.result);
  }

  /**
   * Gets the schema XML document for the current iModel context.
   * @param tokenProps        The iModelToken props that hold the information which iModel is used.
   * @param schemaName        The name of the schema that shall be returned.
   * @returns                 The Schema as XML document string.
   */
  public async getSchemaXml(_tokenProps: IModelRpcProps, _schemaName: string): Promise<string> {
    throw new Error("Not Implemented");
  }

  /**
   * Gets the ECSQL column header values for the ECSQL query.
   * @param IModelToken       The iModelToken holds information which iModel is used.
   * @param ecsql             The ecsql to retrieve column headers from.
   * @returns                 An array with only ECSQL header values.
   */
  public async getQueryColumnHeaders(_tokenProps: IModelRpcProps, ecsql: string): Promise<any[]> {
    const iModelDb: backend.IModelDb = backend.IModelDb.findByKey(_tokenProps.key);

    // We're only interested in the first row.
    const limitRegex = /limit (.*)/;
    const match = limitRegex.exec(ecsql.toLowerCase());
    const query = match ? `${ecsql}` : `${ecsql} limit 1 offset 0`;

    return iModelDb.withPreparedStatement(`${query}`, (stmt: backend.ECSqlStatement) => {
      const colCount: number = stmt.getColumnCount();
      const header: string[] = [];

      for (let i = 0; i < colCount; i++) {
        header.push(stmt.getValue(i).columnInfo.getAccessString());
      }

      const rows = [header];

      return rows;
    });
  }
}
