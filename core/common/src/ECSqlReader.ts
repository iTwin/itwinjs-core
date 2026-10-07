/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module iModels
 */
import {
  DbQueryError, DbQueryRequest, DbQueryResponse, DbRequestExecutor, DbRequestKind, DbResponseStatus, DbValueFormat, QueryBinder, QueryOptions, QueryOptionsBuilder,
  QueryPropertyMetaData, QueryRowFormat,
} from "./ConcurrentQuery";
import { ECSqlReaderBase, PropertyMetaDataMap, QueryRowProxy } from "./ECSqlReaderBase";
import { Base64EncodedString } from "./Base64EncodedString";

/**
 * Performance-related statistics for [[ECSqlReader]].
 * @public
 */
export interface QueryStats {
  /** Time spent running the query; not including time spent queued. Time is in microseconds */
  backendCpuTime: number;
  /** Total time it took the backend to run the query. Time is in milliseconds. */
  backendTotalTime: number;
  /** Estimated memory used for the query. */
  backendMemUsed: number;
  /** Total number of rows returned by the backend. */
  backendRowsReturned: number;
  /** The total round trip time from the client's perspective. Time is in milliseconds. */
  totalTime: number;
  /** The number of retries attempted to execute the query. */
  retryCount: number;
  /** Total time in millisecond to prepare ECSQL or grabing it from cache and binding parameters */
  prepareTime: number;
}

/**
 * Execute ECSQL statements and read the results.
 *
 * The query results are returned one row at a time. The format of the row is dictated by the
 * [[QueryOptions.rowFormat]] specified in the `options` parameter of the constructed ECSqlReader object. Defaults to
 * [[QueryRowFormat.UseECSqlPropertyIndexes]] when no `rowFormat` is defined.
 *
 * There are three primary ways to interact with and read the results:
 * - Stream them using ECSqlReader as an asynchronous iterator.
 * - Iterator over them manually using [[ECSqlReader.step]].
 * - Capture all of the results at once in an array using [[ECSqlReader.toArray]].
 *
 * @see
 * - [ECSQL Overview]($docs/learning/backend/ExecutingECSQL)
 * - [ECSQL Row Formats]($docs/learning/ECSQLRowFormat) for more details on how rows are formatted.
 * - [ECSQL Code Examples]($docs/learning/ECSQLCodeExamples#iterating-over-query-results) for examples of each
 *      of the above ways of interacting with ECSqlReader.
 *
 * @note When iterating over the results, the current row will be a [[QueryRowProxy]] object. To get the row as a basic
 *       JavaScript object, call [[QueryRowProxy.toRow]] on it.
 * @note With [[QueryOptions.useCursor]], partial pages may be resumed from a retained backend cursor. Stop early with
 *       `return()` (or `break` from `for await`) to release it.
 * @public
 */
export class ECSqlReader extends ECSqlReaderBase implements AsyncIterableIterator<QueryRowProxy> {
  private static readonly _maxRetryCount = 10;

  private _localRows: any[] = [];
  private _localOffset: number = 0;
  private _globalOffset: number = -1;
  private _globalCount: number = -1;
  private _globalDone: boolean = false;
  private _cursorId?: string;
  private _staleCursorIds: string[] = [];
  private _pendingRead?: Promise<any[]>;
  private _param = new QueryBinder().serialize();
  private _lockArgs: boolean = false;
  private _stats = { backendCpuTime: 0, backendTotalTime: 0, backendMemUsed: 0, backendRowsReturned: 0, totalTime: 0, retryCount: 0, prepareTime: 0 };
  private _options: QueryOptions = new QueryOptionsBuilder().getOptions();

  /**
   * @internal
   */
  public constructor(private _executor: DbRequestExecutor<DbQueryRequest, DbQueryResponse>, public readonly query: string, param?: QueryBinder, options?: QueryOptions) {
    super(options?.rowFormat);
    if (query.trim().length === 0) {
      throw new Error("expecting non-empty ecsql statement");
    }
    if (param) {
      this._param = param.serialize();
    }
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    this.reset(options);
  }

  /**
   * @deprecated in 5.6 - will not be removed until after 2027-04-02. Should not be used. Will be made private in a future release.
   */
  public setParams(param: QueryBinder) {
    if (this._lockArgs) {
      throw new Error("call resetBindings() before setting or changing parameters");
    }
    this._param = param.serialize();
  }
  /**
   * @deprecated in 5.6 - will not be removed until after 2027-04-02. Should not be used. Will be made private in a future release.
   */
  public reset(options?: QueryOptions) {
    if (options) {
      this._options = options;
    }
    this._props = new PropertyMetaDataMap([]);
    this._localRows = [];
    this.retireCursor();
    this._globalDone = false;
    this._globalOffset = 0;
    this._globalCount = -1;
    if (typeof this._options.rowFormat === "undefined")
      this._options.rowFormat = QueryRowFormat.UseECSqlPropertyIndexes;
    this._rowFormat = this._options.rowFormat;
    if (this._options.limit) {
      if (typeof this._options.limit.offset === "number" && this._options.limit.offset > 0)
        this._globalOffset = this._options.limit.offset;
      if (typeof this._options.limit.count === "number" && this._options.limit.count > 0)
        this._globalCount = this._options.limit.count;
    }
    this._done = false;
  }

  /**
   * Clear all bindings.
   * @deprecated in 5.6 - will not be removed until after 2027-04-02. Should not be used. Will be made private in a future release.
   */
  public resetBindings() {
    this.retireCursor();
    this._param = new QueryBinder().serialize();
    this._lockArgs = false;
  }

  /**
   * @internal
   */
  public override getRowInternal(): any[] {
    if (this._localRows.length <= this._localOffset)
      throw new Error("no current row");
    return this._localRows[this._localOffset] as any[];
  }

  /**
   * Get performance-related statistics for the current query.
   */
  public get stats(): QueryStats {
    return this._stats;
  }

  /**
   *
   */
  private async readRows(): Promise<any[]> {
    if (this._globalDone) {
      return [];
    }
    this._lockArgs = true;
    this._globalOffset += this._localRows.length;
    this._globalCount -= this._localRows.length;
    if (this._globalCount === 0) {
      return [];
    }
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    const valueFormat = this._options.rowFormat === QueryRowFormat.UseJsPropertyNames ? DbValueFormat.JsNames : DbValueFormat.ECSqlNames;
    const request: DbQueryRequest = {
      ... this._options,
      kind: DbRequestKind.ECSql,
      valueFormat,
      query: this.query,
      args: this._param,
      cursorId: this._cursorId,
    };
    request.includeMetaData = this._props.length > 0 ? false : true;
    request.limit = { offset: this._globalOffset, count: this._globalCount < 1 ? -1 : this._globalCount };
    if (this._staleCursorIds.length > 0)
      await this.closeStaleCursors().catch(() => undefined); // best effort; the backend expires cursors anyway
    const resp = await this.runWithRetry(request);
    this._cursorId = resp.cursorId;
    if (this._globalDone)
      return []; // return() is waiting to release the cursor without exposing these rows.
    this._globalDone = resp.status === DbResponseStatus.Done || resp.status === DbResponseStatus.NotOpen;
    if (this._props.length === 0 && resp.meta.length > 0) {
      this._props = new PropertyMetaDataMap(resp.meta);
    }
    for (const row of resp.data) {
      ECSqlReader.decodeResultRow(row);
    }
    return resp.data;
  }

  private static decodeResultRow(row: unknown[]): void {
    // Only the outer backend result row is known to have ordinary indexed properties.
    for (let index = 0; index < row.length; ++index) {
      const val = row[index];
      if (typeof val === "string") {
        if (Base64EncodedString.hasPrefix(val))
          row[index] = Base64EncodedString.toUint8Array(val);
      } else if (typeof val === "object" && val !== null) {
        this.replaceBase64WithUint8Array(val);
      }
    }
  }

  /**
   * @internal
   */
  protected async runWithRetry(request: DbQueryRequest) {
    const needRetry = (rs: DbQueryResponse) => (rs.status === DbResponseStatus.Partial || rs.status === DbResponseStatus.QueueFull || rs.status === DbResponseStatus.Timeout || rs.status === DbResponseStatus.ShuttingDown) && (rs.data === undefined || rs.data.length === 0);
    const updateStats = (rs: DbQueryResponse) => {
      this._stats.backendCpuTime += rs.stats.cpuTime;
      this._stats.backendTotalTime += rs.stats.totalTime;
      this._stats.backendMemUsed += rs.stats.memUsed;
      this._stats.prepareTime += rs.stats.prepareTime;
      this._stats.backendRowsReturned += (rs.data === undefined) ? 0 : rs.data.length;
    };
    const execQuery = async (req: DbQueryRequest) => {
      const startTime = Date.now();
      const rs = await this._executor.execute(req);
      this.stats.totalTime += (Date.now() - startTime);
      return rs;
    };
    let retry = ECSqlReader._maxRetryCount;
    let resp = await execQuery(request);
    DbQueryError.throwIfError(resp, request);
    while (--retry > 0 && needRetry(resp)) {
      resp = await execQuery(request);
      this._stats.retryCount += 1;
      if (needRetry(resp)) {
        updateStats(resp);
      }
    }
    if (retry === 0 && needRetry(resp)) {
      throw new Error("query too long to execute or server is too busy");
    }
    updateStats(resp);
    return resp;
  }

  /**
   * Get the metadata for each column in the query result.
   *
   * @returns An array of [[QueryPropertyMetaData]].
   */
  public async getMetaData(): Promise<QueryPropertyMetaData[]> {
    if (this._props.length === 0) {
      await this.fetchRows();
    }
    return this._props.properties;
  }

  /**
   *
   */
  private async fetchRows() {
    this._localOffset = -1;
    const pendingRead = this._pendingRead = this.readRows();
    try {
      const rows = await pendingRead;
      this._localRows = this._done ? [] : rows;
    } finally {
      if (this._pendingRead === pendingRead)
        this._pendingRead = undefined;
    }
    if (this._localRows.length === 0) {
      this._done = true;
    }
  }

  /**
   * Step to the next row of the query result.
   *
   * @returns `true` if a row can be read from `current`.<br/>
   *          `false` if there are no more rows; i.e., all rows have been stepped through already.
   */
  public async step(): Promise<boolean> {
    if (this._done) {
      return false;
    }
    const cachedRows = this._localRows.length;
    if (this._localOffset < cachedRows - 1) {
      ++this._localOffset;
    } else {
      await this.fetchRows();
      this._localOffset = 0;
      return !this._done;
    }
    return true;
  }

  /**
   * Get all remaining rows from the query result.
   *
   * @returns An array of all remaining rows from the query result.
   */
  public async toArray(): Promise<any[]> {
    const rows = [];
    while (await this.step()) {
      rows.push(this.formatCurrentRow());
    }
    return rows;
  }

  /**
   * Accessor for using ECSqlReader as an asynchronous iterator.
   *
   * @returns An asynchronous iterator over the rows returned by the executed ECSQL query.
   */
  public [Symbol.asyncIterator](): AsyncIterableIterator<QueryRowProxy> {
    return this;
  }

  /**
   * Calls step when called as an iterator.
   *
   * Returns the row alongside a `done` boolean to indicate if there are any more rows for an iterator to step to.
   *
   * @returns An object with the keys: `value` which contains the row and `done` which contains a boolean.
   */
  public async next(): Promise<IteratorResult<QueryRowProxy, any>> {
    if (await this.step()) {
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
  /** Queue the current cursor to be released by the next request. */
  private retireCursor() {
    if (this._cursorId)
      this._staleCursorIds.push(this._cursorId);
    this._cursorId = undefined;
  }

  /** A cursor id is forgotten only after the backend confirms the close, so a failed close can be retried. */
  private async closeStaleCursors(): Promise<void> {
    while (this._staleCursorIds.length > 0) {
      const request: DbQueryRequest = {
        ...this._options,
        kind: DbRequestKind.ECSql,
        query: this.query,
        args: this._param,
        cursorId: this._staleCursorIds[0],
        closeCursor: true,
        usePrimaryConn: false, // retained cursors belong to worker connections, even after reset()
        restartToken: undefined, // a close must not cancel other queries sharing the token
      };
      const response = await this._executor.execute(request);
      DbQueryError.throwIfError(response, request);
      if (response.status !== DbResponseStatus.Done)
        throw new DbQueryError(response, request);
      this._staleCursorIds.shift();
    }
  }

  /**
   * Stop iteration and release any backend cursor retained for this reader. Called automatically when a
   * `for await` loop exits early. If releasing fails the error is thrown and calling `return()` again retries.
   * Waits for an in-flight page request before releasing its cursor; rows received after closure are discarded.
   * @beta
   */
  public async return(): Promise<IteratorResult<QueryRowProxy>> {
    this._done = this._globalDone = true;
    this._localRows = [];
    try {
      await this._pendingRead;
    } finally {
      this.retireCursor();
      await this.closeStaleCursors();
    }
    return { done: true, value: undefined };
  }
}
