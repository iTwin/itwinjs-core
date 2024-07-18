/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module iModels
 */
import { Base64EncodedString } from "./Base64EncodedString";
import {
  DbQueryError, DbQueryRequest, DbQueryResponse, DbRequestExecutor, DbRequestKind, DbResponseStatus, DbValueFormat, QueryBinder, QueryOptions, QueryOptionsBuilder,
  QueryPropertyMetaData, QueryRowFormat,
} from "./ConcurrentQuery";

/** @public */
export class PropertyMetaDataMap implements Iterable<QueryPropertyMetaData> {
  private _byPropName = new Map<string, number>();
  private _byJsonName = new Map<string, number>();
  private _byNoCase = new Map<string, number>();

  public constructor(public readonly properties: QueryPropertyMetaData[]) {
    for (const property of this.properties) {
      this._byPropName.set(property.name, property.index);
      this._byJsonName.set(property.jsonName, property.index);
      this._byNoCase.set(property.name.toLowerCase(), property.index);
      this._byNoCase.set(property.jsonName.toLowerCase(), property.index);
    }
  }

  public get length(): number {
    return this.properties.length;
  }

  public [Symbol.iterator](): Iterator<QueryPropertyMetaData, any, undefined> {
    return this.properties[Symbol.iterator]();
  }

  public findByName(name: string): QueryPropertyMetaData | undefined {
    const index = this._byPropName.get(name);
    if (typeof index === "number") {
      return this.properties[index];
    }
    return undefined;
  }

  public findByJsonName(name: string): QueryPropertyMetaData | undefined {
    const index = this._byJsonName.get(name);
    if (typeof index === "number") {
      return this.properties[index];
    }
    return undefined;
  }

  public findByNoCase(name: string): QueryPropertyMetaData | undefined {
    const index = this._byNoCase.get(name.toLowerCase());
    if (typeof index === "number") {
      return this.properties[index];
    }
    return undefined;
  }
}

/**
 * The format for rows returned by [[ECSqlReader]].
 * @public
 */
export type QueryValueType = any;

/**
 * Methods and ways of accessing values from rows returned by [[ECSqlReader]].
 * @public
 */
export interface QueryRowProxy {
  /**
   * Get the current row as a JavaScript `object`.
   *
   * @returns The current row as a JavaScript `object`.
   */
  toRow(): any;

  /**
   * Get all remaining rows from the query result.
   * If called on the current row ([[ECSqlReader.current]]), only that row is returned.
   *
   * @returns All remaining rows from the query result.
   */
  toArray(): QueryValueType[];

  /**
   * Get the metadata for each column in the query result.
   *
   * @returns The metadata for each column in the query result.
   */
  getMetaData(): QueryPropertyMetaData[];

  /**
   * Access a property using its name.
   *
   * @returns The value from the row whose key (ECSQL column name) is `propertyName`.
   *
   * @example
   * The following lines will all return the same result:
   * ```ts
   * reader.current.ECInstanceId;
   * reader.current.ecinstanceid;
   * reader.current.["ECInstanceId"];
   * ```
   */
  [propertyName: string]: QueryValueType;

  /**
   * Access a property using its index.
   * The index is relative to the order of the columns returned by the query that produced the row.
   *
   * @returns The value from the column at `propertyIndex`.
   *
   * @example reader.current[0]
   */
  [propertyIndex: number]: QueryValueType;
}

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
 * - Capture all of the results at once in an array using [[QueryRowProxy.toArray]].
 *
 * @see
 * - [ECSQL Overview]($docs/learning/backend/ExecutingECSQL)
 * - [ECSQL Row Formats]($docs/learning/ECSQLRowFormat) for more details on how rows are formatted.
 * - [ECSQL Code Examples]($docs/learning/ECSQLCodeExamples#iterating-over-query-results) for examples of each
 *      of the above ways of interacting with ECSqlReader.
 *
 * @note When iterating over the results, the current row will be a [[QueryRowProxy]] object. To get the row as a basic
 *       JavaScript object, call [[QueryRowProxy.toRow]] on it.
 * @public
 */
export class ECSqlReader implements AsyncIterableIterator<QueryRowProxy> {
  private static readonly _maxRetryCount = 10;

  private _localRows: any[] = [];
  private _localOffset: number = 0;
  private _globalOffset: number = -1;
  private _globalCount: number = -1;
  private _done: boolean = false;
  private _globalDone: boolean = false;
  private _props = new PropertyMetaDataMap([]);
  private _param = new QueryBinder().serialize();
  private _lockArgs: boolean = false;
  private _stats = { backendCpuTime: 0, backendTotalTime: 0, backendMemUsed: 0, backendRowsReturned: 0, totalTime: 0, retryCount: 0 };
  private _options: QueryOptions = new QueryOptionsBuilder().getOptions();

  private _rowProxy = new Proxy<ECSqlReader>(this, {
    get: (target: ECSqlReader, key: string | Symbol) => {
      if (typeof key === "string") {
        const idx = Number.parseInt(key, 10);
        if (!Number.isNaN(idx)) {
          return target.getRowInternal()[idx];
        }
        const prop = target._props.findByNoCase(key);
        if (prop) {
          return target.getRowInternal()[prop.index];
        }
        if (key === "getMetaData") {
          return () => target._props.properties;
        }
        if (key === "toRow") {
          return () => target.formatCurrentRow(true);
        }
        if (key === "toArray") {
          return () => this.getRowInternal();
        }
      }
      return undefined;
    },
    has: (target: ECSqlReader, p: string | symbol) => {
      return !target._props.findByNoCase(p as string);
    },
    ownKeys: (target: ECSqlReader) => {
      const keys = [];
      for (const prop of target._props) {
        keys.push(prop.name);
      }
      return keys;
    },
  });

  /**
   * @internal
   */
  public constructor(private _executor: DbRequestExecutor<DbQueryRequest, DbQueryResponse>, public readonly query: string, param?: QueryBinder, options?: QueryOptions) {
    if (query.trim().length === 0) {
      throw new Error("expecting non-empty ecsql statement");
    }
    if (param) {
      this._param = param.serialize();
    }
    this.reset(options);
  }

  private static replaceBase64WithUint8Array(row: any) {
    for (const key of Object.keys(row)) {
      const val = row[key];
      if (typeof val === "string") {
        if (Base64EncodedString.hasPrefix(val)) {
          row[key] = Base64EncodedString.toUint8Array(val);
        }
      } else if (typeof val === "object" && val !== null) {
        this.replaceBase64WithUint8Array(val);
      }
    }
  }

  public setParams(param: QueryBinder) {
    if (this._lockArgs) {
      throw new Error("call resetBindings() before setting or changing parameters");
    }
    this._param = param.serialize();
  }

  public reset(options?: QueryOptions) {
    if (options) {
      this._options = options;
    }
    this._props = new PropertyMetaDataMap([]);
    this._localRows = [];
    this._globalDone = false;
    this._globalOffset = 0;
    this._globalCount = -1;
    if (typeof this._options.rowFormat === "undefined")
      this._options.rowFormat = QueryRowFormat.UseECSqlPropertyIndexes;
    if (this._options.limit) {
      if (typeof this._options.limit.offset === "number" && this._options.limit.offset > 0)
        this._globalOffset = this._options.limit.offset;
      if (typeof this._options.limit.count === "number" && this._options.limit.count > 0)
        this._globalCount = this._options.limit.count;
    }
    this._done = false;
  }

  /**
   * Get the current row from the query result. The current row is the one most recently stepped-to
   * (by step() or during iteration).
   *
   * Each value from the row can be accessed by index or by name.
   *
   * The format of the row is dictated by the [[QueryOptions.rowFormat]] specified in the `options` parameter of the
   * constructed ECSqlReader object.
   *
   * @see
   * - [[QueryRowFormat]]
   * - [ECSQL Row Formats]($docs/learning/ECSQLRowFormat)
   *
   * @note The current row is be a [[QueryRowProxy]] object. To get the row as a basic JavaScript object, call
   *       [[QueryRowProxy.toRow]] on it.
   *
   * @example
   * ```ts
   * const reader = iModel.createQueryReader("SELECT ECInstanceId FROM bis.Element");
   * while (await reader.step()) {
   *   // Both lines below print the same value
   *   console.log(reader.current[0]);
   *   console.log(reader.current.ecinstanceid);
   * }
   * ```
   *
   * @return The current row as a [[QueryRowProxy]].
   */
  public get current(): QueryRowProxy {
    return this._rowProxy as any;
  }

  /**
   * Clear all bindings.
   */
  public resetBindings() {
    this._param = new QueryBinder().serialize();
    this._lockArgs = false;
  }

  /**
   * Returns if there are more rows available.
   *
   * @returns `true` if all rows have been stepped through already.<br/>
   *          `false` if there are any yet unaccessed rows.
   */
  public get done(): boolean {
    return this._done;
  }

  /**
   * @internal
   */
  public getRowInternal(): any[] {
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
    const valueFormat = this._options.rowFormat === QueryRowFormat.UseJsPropertyNames ? DbValueFormat.JsNames : DbValueFormat.ECSqlNames;
    const request: DbQueryRequest = {
      ... this._options,
      kind: DbRequestKind.ECSql,
      valueFormat,
      query: this.query,
      args: this._param,
    };
    request.includeMetaData = this._props.length > 0 ? false : true;
    request.limit = { offset: this._globalOffset, count: this._globalCount < 1 ? -1 : this._globalCount };
    const resp = await this.runWithRetry(request);
    this._globalDone = resp.status === DbResponseStatus.Done;
    if (this._props.length === 0 && resp.meta.length > 0) {
      this._props = new PropertyMetaDataMap(resp.meta);
    }
    for (const row of resp.data) {
      ECSqlReader.replaceBase64WithUint8Array(row);
    }
    return resp.data;
  }

  /**
   * @internal
   */
  protected async runWithRetry(request: DbQueryRequest) {
    const needRetry = (rs: DbQueryResponse) => (rs.status === DbResponseStatus.Partial || rs.status === DbResponseStatus.QueueFull || rs.status === DbResponseStatus.Timeout) && (rs.data === undefined || rs.data.length === 0);
    const updateStats = (rs: DbQueryResponse) => {
      this._stats.backendCpuTime += rs.stats.cpuTime;
      this._stats.backendTotalTime += rs.stats.totalTime;
      this._stats.backendMemUsed += rs.stats.memUsed;
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
   * @internal
   */
  public formatCurrentRow(onlyReturnObject: boolean = false): any[] | object {
    if (!onlyReturnObject && this._options.rowFormat === QueryRowFormat.UseECSqlPropertyIndexes) {
      return this.getRowInternal();
    }
    const formattedRow = {};
    const uniqueNames = new Map<string, number>();
    for (const prop of this._props) {
      const propName = this._options.rowFormat === QueryRowFormat.UseJsPropertyNames ? prop.jsonName : prop.name;
      const val = this.getRowInternal()[prop.index];
      if (typeof val !== "undefined" && val !== null) {
        let uniquePropName = propName;
        if (uniqueNames.has(propName)) {
          uniqueNames.set(propName, uniqueNames.get(propName)! + 1);
          uniquePropName = `${propName}_${uniqueNames.get(propName)!}`;
        } else {
          uniqueNames.set(propName,0);
        }

        Object.defineProperty(formattedRow, uniquePropName, {
          value: val,
          enumerable: true,
        });
      }
    }
    return formattedRow;
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
    this._localRows = await this.readRows();
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
}

