/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ECSQL
 */
import {
  DbValueFormat,
  ECSqlReaderBase,
  IModelError,
  PropertyMetaDataMap, QueryBinder, QueryOptions, QueryOptionsBuilder, QueryPropertyMetaData, QueryRowFormat, QueryRowProxy,
} from "@itwin/core-common";
import { ECSqlRowExecutor } from "./ECSqlRowExecutor";
import { DbResult } from "@itwin/core-bentley";

/** @beta */
export type SynchronousQueryOptions = Omit<QueryOptions, "suppressLogErrors" | "includeMetaData" | "limit" | "priority" | "restartToken" | "delay" | "usePrimaryConn" | "quota">;

/**
 * Execute ECSQL statements synchronously and read the results one row at a time.
 *
 * This is the synchronous counterpart of [[ECSqlReader]] from `@itwin/core-common`.
 * It uses [[ECSqlRowExecutor]] directly — each call to [[step]] fetches exactly one row
 * with no internal caching, paging, or offset tracking.
 *
 * The query results are returned one row at a time. The format of the row is dictated by the
 * `rowFormat` specified in the `options` parameter of the constructed ECSqlSyncReader object.
 * Defaults to [[QueryRowFormat.UseECSqlPropertyIndexes]] when no `rowFormat` is defined.
 *
 * There are three primary ways to interact with and read the results:
 * - Iterate using ECSqlSyncReader as a synchronous iterator.
 * - Step manually using [[ECSqlSyncReader.step]].
 * - Capture all results at once using [[ECSqlSyncReader.toArray]].
 *
 * @note When iterating over the results, the current row is a [[QueryRowProxy]] object.
 *       To get the row as a basic JavaScript object, call [[QueryRowProxy.toRow]] on it.
 * @beta
 */
export class ECSqlSyncReader extends ECSqlReaderBase implements IterableIterator<QueryRowProxy> {
  private _currentRow: any;
  private _options: SynchronousQueryOptions;
  /** Cached native row-adaptor options — built once and reused for every row. */
  private _cachedRowOptions: any;

  /**
   * @internal
   */
  public constructor(private _executor: ECSqlRowExecutor, public readonly query: string, param?: QueryBinder, options?: SynchronousQueryOptions) {
    const resolvedOptions = options ?? new QueryOptionsBuilder().getOptions();
    if (typeof resolvedOptions.rowFormat === "undefined")
      resolvedOptions.rowFormat = QueryRowFormat.UseECSqlPropertyIndexes;

    super(resolvedOptions.rowFormat);

    if (query.trim().length === 0) {
      throw new IModelError(DbResult.BE_SQLITE_ERROR, "expecting non-empty ecsql statement");
    }

    this._options = resolvedOptions;
    const serializedParam = param ? param.serialize() : new QueryBinder().serialize();

    // Prepare the statement and bind parameters once — avoids per-row ensureStatementReady overhead.
    const args = Object.keys(serializedParam).length > 0 ? serializedParam : undefined;
    this._executor.prepareAndBind(this.query, args);

    // Build and cache the native row-adaptor options — reused for every step call.
    const valueFormat = this._options.rowFormat === QueryRowFormat.UseJsPropertyNames ? DbValueFormat.JsNames : DbValueFormat.ECSqlNames;
    this._cachedRowOptions = {
      abbreviateBlobs: this._options.abbreviateBlobs ?? false,
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      classIdsToClassNames: this._options.convertClassIdsToClassNames ?? false,
      useJsName: valueFormat === DbValueFormat.JsNames,
      doNotConvertClassIdsToClassNamesWhenAliased: true,
    };
    this._currentRow = undefined;
  }

  /**
   * @internal
   */
  protected override getRowInternal(): any[] {
    if (!this._currentRow)
      throw new IModelError(DbResult.BE_SQLITE_ERROR, "no current row");
    return this._currentRow as any[];
  }

  /**
   * Reads a single row from the executor. Returns the row data or `undefined` when the
   * result set is exhausted.
   *
   * Uses the fast-path `stepNextRow` method on the executor, which calls `stmt.step()`
   * and `stmt.toRow()` directly — no intermediate request/response objects are allocated per row.
   * @internal
   */
  private readRow(): any {
    if (this._done) {
      return undefined;
    }

    // Fetch metadata once on the first call.
    if (this._props.length === 0) {
      this._props = new PropertyMetaDataMap(this._executor.fetchMetadata(this._cachedRowOptions));
    }

    return this.stepWithRetry();
  }

  /**
   * Steps the cursor with retry logic for transient busy/interrupt conditions.
   * Returns the row data array, or `undefined` when the result set is exhausted.
   * @internal
   */
  private stepWithRetry(): any {
    const result = this._executor.stepNextRow(this._cachedRowOptions);
    if (result) {
      ECSqlSyncReader.replaceBase64WithUint8Array(result);
      return result;
    }
    return undefined; // undefined (done) → undefined
  }

  /**
   * Get the metadata for each column in the query result.
   *
   * If metadata has not been retrieved yet, fetches it directly from the prepared
   * statement. If a step has not yet occurred, executes a single step to ensure
   * the statement cursor is positioned, preserving the row for the next [[step]] call.
   *
   * @returns An array of [[QueryPropertyMetaData]].
   * @beta
   */
  public getMetaData(): QueryPropertyMetaData[] {
    if (this._props.length === 0) {
      this._props = new PropertyMetaDataMap(this._executor.fetchMetadata(this._cachedRowOptions));
    }
    return this._props.properties;
  }

  /**
   * Step to the next row of the query result.
   *
   * Each call executes exactly one step on the underlying statement — there is no
   * internal row caching or offset tracking.
   *
   * @returns `true` if a row can be read from `current`.<br/>
   *          `false` if there are no more rows; i.e., all rows have been stepped through already.
   * @beta
   */
  public step(): boolean {
    if (this._done) {
      return false;
    }
    this._currentRow = this.readRow();
    if (!this._currentRow) {
      this._done = true;
      return false;
    }
    return true;
  }

  /**
   * Get all remaining rows from the query result.
   *
   * @returns An array of all remaining rows from the query result.
   * @beta
   */
  public toArray(): any[] {
    const rows = [];
    while (this.step()) {
      rows.push(this.formatCurrentRow());
    }
    return rows;
  }

  /**
   * Accessor for using ECSqlSyncReader as a synchronous iterator.
   *
   * @returns A synchronous iterator over the rows returned by the executed ECSQL query.
   * @beta
   */
  public [Symbol.iterator](): IterableIterator<QueryRowProxy> {
    return this;
  }

  /**
   * Calls step when called as an iterator.
   *
   * Returns the row alongside a `done` boolean to indicate if there are any more rows for an iterator to step to.
   *
   * @returns An object with the keys: `value` which contains the row and `done` which contains a boolean.
   * @beta
   */
  public next(): IteratorResult<QueryRowProxy, any> {
    if (this.step()) {
      return {
        done: false,
        value: this.current,
      };
    } else {
      return {
        done: true,
        value: this.current,
      };
    }
  }
}
