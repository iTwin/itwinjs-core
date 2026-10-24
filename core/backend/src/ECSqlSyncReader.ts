/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ECSQL
 */
import {
  Base64EncodedString,
  ECSqlReaderBase,
  IModelError,
  PropertyMetaDataMap,
  QueryBinder, QueryOptions, QueryOptionsBuilder, QueryPropertyMetaData, QueryRowFormat, QueryRowProxy,
} from "@itwin/core-common";
import { ECSqlRowExecutor, SyncReaderRowFlags } from "./ECSqlRowExecutor";
import { DbResult } from "@itwin/core-bentley";

/** @beta */
export type SynchronousQueryOptions = Omit<QueryOptions, "suppressLogErrors" | "includeMetaData" | "limit" | "priority" | "restartToken" | "delay" | "usePrimaryConn" | "quota">;

/**
 * Execute ECSQL statements synchronously and read the results one row at a time.
 *
 * This is the synchronous counterpart of [[ECSqlReader]] from `@itwin/core-common`.
 * It uses [[ECSqlRowExecutor]] directly, with read-ahead batches on read-only dbs and live stepping on writable dbs.
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
  private _ownsMetadata = false;

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

    // Row options are passed to native code once, as flags, and used for every row.
    let rowFlags = SyncReaderRowFlags.DoNotConvertClassIdsToClassNamesWhenAliased;
    if (this._options.abbreviateBlobs)
      rowFlags |= SyncReaderRowFlags.AbbreviateBlobs;
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    if (this._options.convertClassIdsToClassNames)
      rowFlags |= SyncReaderRowFlags.ClassIdsToClassNames;
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    if (this._options.rowFormat === QueryRowFormat.UseJsPropertyNames)
      rowFlags |= SyncReaderRowFlags.UseJsName;

    this._executor.prepareAndBind(this.query, param ? ECSqlSyncReader.flattenArgs(param) : undefined, rowFlags);
    this._currentRow = undefined;
  }

  /** Flatten the bindings of `param` into `[key, type, value, ...]` triples, the form read by native code without
   * per-property lookups. Entries lacking a type or value are skipped, as the object form skipped them.
   * @internal
   */
  private static flattenArgs(param: QueryBinder): any[] | undefined {
    const serialized = param.serialize() as Record<string, { type?: number, value?: any } | undefined>;
    let args: any[] | undefined;
    for (const key of Object.keys(serialized)) {
      const arg = serialized[key];
      if (typeof arg === "object" && arg !== null && "type" in arg && "value" in arg)
        (args ??= []).push(key, arg.type, arg.value);
    }
    return args;
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
   * Uses the fast-path `stepNextRow` method on the executor, which serves rows from a read-ahead buffer filled by
   * native code in batches — no intermediate request/response objects are allocated per row.
   * @internal
   */
  private readRow(): any {
    if (this._done) {
      return undefined;
    }

    // Fetch metadata once on the first call.
    if (this._props.length === 0) {
      this._props = this._executor.fetchMetadata();
      this._ownsMetadata = false;
    }

    return this.stepWithRetry();
  }

  /**
   * Native rows parsed from JSON hold `null` for null cells and base64 strings for blobs. Convert them in place to
   * `undefined` and `Uint8Array`, matching rows whose cells were created directly.
   * @internal
   */
  private static normalizeRow(row: any[]): void {
    for (let i = 0; i < row.length; ++i) {
      const val = row[i];
      if (val === null) {
        row[i] = undefined;
      } else if (typeof val === "string") {
        if (Base64EncodedString.hasPrefix(val))
          row[i] = Base64EncodedString.toUint8Array(val);
      } else if (typeof val === "object" && !(val instanceof Uint8Array)) {
        ECSqlSyncReader.replaceBase64WithUint8Array(val);
      }
    }
  }

  /**
   * Steps the cursor with retry logic for transient busy/interrupt conditions.
   * Returns the row data array, or `undefined` when the result set is exhausted.
   * @internal
   */
  private stepWithRetry(): any {
    const result = this._executor.stepNextRow();
    if (result) {
      ECSqlSyncReader.normalizeRow(result);
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
      this._props = this._executor.fetchMetadata();
      this._ownsMetadata = false;
    }
    return this.getMetaDataInternal();
  }

  /** Copy shared metadata only when it leaves the reader, including through the row proxy.
   * @internal
   */
  protected override getMetaDataInternal(): QueryPropertyMetaData[] {
    if (!this._ownsMetadata) {
      this._props = new PropertyMetaDataMap(this._props.properties.map((property) => ({ ...property })));
      this._ownsMetadata = true;
    }
    return this._props.properties;
  }

  /**
   * Step to the next row of the query result.
   *
   * On a writable db each step reads the next row from the underlying statement, so changes made inside the callback
   * are visible to later steps. On a read-only db rows are read ahead in small, growing batches.
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
