/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { ECSqlQueryOptions, ECSqlSchemaLoader, ECSqlSchemaLoaderOptions, IncrementalSchemaLocater, SchemaKey, SchemaProps } from "@itwin/ecschema-metadata";
import { IModelDb } from "./IModelDb";
import { QueryRowFormat } from "@itwin/core-common";

/**
 * A [[IncrementalSchemaLocater]]($ecschema-metadata) implementation that uses the [[IModelDb]] to load schemas incrementally.
 * @beta
 */
export class IModelIncrementalSchemaLocater extends IncrementalSchemaLocater {
  /**
   * Initializes a new instance of the IModelIncrementalSchemaLocater class.
   */
  constructor(iModel: IModelDb, options?: ECSqlSchemaLoaderOptions) {
    super(new IModelSchemaLoader(iModel, { useMultipleQueries: true, ...options }));
  }
}

/**
 * An ECSqlSchemaLoader implementation that reads the schema using ECSql from an IModelDb.
 * This loader is supposed to be used in backend scenarios where the IModelDb is available.
 * @internal
 */
class IModelSchemaLoader extends ECSqlSchemaLoader {
  private readonly _iModel: IModelDb;

  /**
   * Constructs a new IModelSchemaLoader instance.
   * @param iModel The IModelDb to query.
   * @param options Optional ECSqlSchemaLoaderOptions.
   */
  constructor(iModel: IModelDb, options?: ECSqlSchemaLoaderOptions) {
    super(options ?? { useMultipleQueries: true });
    this._iModel = iModel;
  }

  /**
   * Gets the IModelDb targeted by this schema loader.
   */
  public get iModelDb(): IModelDb {
    return this._iModel;
  }

  /**
   * Gets SchemaProps for the given SchemaKey.
   * This is the full schema json with all elements that are defined in the schema.
   * @param schemaKey The key of the schema to be resolved.
   */
  public async getSchemaProps(schemaKey: SchemaKey): Promise<SchemaProps | undefined> {
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
   * @param options The ECSqlQueryOptions to use.
   * @returns A promise that resolves to read-only array of type TRow.
   */
  protected async executeQuery<TRow>(query: string, options?: ECSqlQueryOptions): Promise<ReadonlyArray<TRow>> {
    return this._iModel
      .createQueryReader(query, options?.args, {
        rowFormat: QueryRowFormat.UseECSqlPropertyNames,
        limit: { count: options?.limit },
      })
      .toArray();
  }
}
