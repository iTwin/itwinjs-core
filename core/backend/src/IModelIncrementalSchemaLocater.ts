/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module iModels
 */
import { ECSqlQueryOptions, ECSqlSchemaLocater, ECSqlSchemaLocaterOptions, SchemaKey, SchemaProps } from "@itwin/ecschema-metadata";
import { QueryBinder, QueryRowFormat } from "@itwin/core-common";
import { IModelDb } from "./IModelDb";

/**
 * A [[ECSqlSchemaLocater]]($ecschema-metadata) implementation that uses the [[IModelDb]] to load schemas incrementally.
 * @beta
 */
export class IModelIncrementalSchemaLocater extends ECSqlSchemaLocater {
  private readonly _iModel: IModelDb;

  /**
   * Constructs a new IModelIncrementalSchemaLocater instance.
   * @param iModel The [[IModelDb]] to query.
   * @param options Optional [[ECSqlSchemaLocaterOptions]]($ecschema-metadata).
   */
  constructor(iModel: IModelDb, options?: ECSqlSchemaLocaterOptions) {
    super(options ?? { useMultipleQueries: true });
    this._iModel = iModel;
  }

  /**
   * Gets [[SchemaProps]]($ecschema-metadata) for the given [[SchemaKey]]($ecschema-metadata).
   * This is the full schema json with all elements that are defined in the schema.
   * @param schemaKey The key of the schema to be resolved.
   */
  protected async getSchemaProps(schemaKey: SchemaKey): Promise<SchemaProps | undefined> {
    // To keep the main thread from being blocked in sync loading cases the resolving
    // is triggered through a timeout. Even if there is no delay, it improves loading
    // time by ~3x.
    return new Promise((resolve, reject) => setTimeout(() => {
      try {
        resolve(this._iModel.getSchemaProps(schemaKey.name) as SchemaProps);
      }
      catch (error: any) {
        reject(error as Error);
      }
    }, 0));
  }

  /**
   * Executes an ECSql query against the IModelDb.
   * @param query The query to execute
   * @param options The [[ECSqlQueryOptions]]($ecschema-metadata) to use.
   * @returns A promise that resolves to read-only array of type TRow.
   */
  protected async executeQuery<TRow>(query: string, options?: ECSqlQueryOptions): Promise<ReadonlyArray<TRow>> {
    const queryParameters = options && options.parameters ? QueryBinder.from(options.parameters) : undefined;

    return this._iModel
      .createQueryReader(query, queryParameters, {
        rowFormat: QueryRowFormat.UseECSqlPropertyNames,
        limit: { count: options?.limit },
      })
      .toArray();
  }
}