/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module iModels
 */
import { Base64EncodedString } from "./Base64EncodedString";
import type { DbQueryRequest, DbQueryResponse, DbRequestExecutor, QueryOptions,
  QueryPropertyMetaData} from "./ConcurrentQuery";
import {
  DbQueryError, DbRequestKind, DbResponseStatus, DbValueFormat, QueryBinder, QueryOptionsBuilder, QueryRowFormat,
} from "./ConcurrentQuery";

/** @beta */
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
  public get length(): number { return this.properties.length; }

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
 * @beta
*/
export type QueryValueType = any;

/** @beta */
export interface QueryRowProxy {
  toRow(): any;
  toArray(): QueryValueType[];
  getMetaData(): QueryPropertyMetaData[];
  [propertyName: string]: QueryValueType;
  [propertyIndex: number]: QueryValueType;
}

/** @beta */
export interface QueryStats {
  backendCpuTime: number; // Time spent running the query. It exclude query time in queue. Time is in microseconds.
  backendTotalTime: number; // backend total time spent running the query. Time is in milliseconds.
  backendMemUsed: number; // Estimated m emory used for query. Time is in milliseconds.
  backendRowsReturned: number; // Total rows returned by backend.
  totalTime: number; // Round trip time from client perspective.Time is in milliseconds.
  retryCount: number;
}

/** @beta */
export class ECSqlReader {
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
        if (key === "getArray" || key === "toJSON") {
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
  private _options: QueryOptions = new QueryOptionsBuilder().getOptions();
  /** @internal */
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
  public get current(): QueryRowProxy { return (this._rowProxy as any); }
  // clear all bindings
  public resetBindings() {
    this._param = new QueryBinder().serialize();
    this._lockArgs = false;
  }
  // return if there is any more rows available
  public get done(): boolean { return this._done; }
  public getRowInternal(): any[] {
    if (this._localRows.length <= this._localOffset)
      throw new Error("no current row");
    return this._localRows[this._localOffset] as any[];
  }
  // return performance related statistics for current query.
  public get stats(): QueryStats { return this._stats; }
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
    const valueFormat = this._options.rowFormat === QueryRowFormat.UseJsPropertyNames? DbValueFormat.JsNames :DbValueFormat.ECSqlNames;
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
  private async runWithRetry(request: DbQueryRequest) {
    const needRetry = (rs: DbQueryResponse) => (rs.status === DbResponseStatus.Partial || rs.status === DbResponseStatus.QueueFull || rs.status === DbResponseStatus.Timeout) && (rs.data.length === 0);
    const updateStats = (rs: DbQueryResponse) => {
      this._stats.backendCpuTime += rs.stats.cpuTime;
      this._stats.backendTotalTime += rs.stats.totalTime;
      this._stats.backendMemUsed += rs.stats.memUsed;
      this._stats.backendRowsReturned += rs.data.length;
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
  public formatCurrentRow(onlyReturnObject: boolean = false): any[] | object {
    if (!onlyReturnObject && this._options.rowFormat === QueryRowFormat.UseECSqlPropertyIndexes) {
      return this.getRowInternal();
    }
    const formattedRow = {};
    for (const prop of this._props) {
      const propName = this._options.rowFormat === QueryRowFormat.UseJsPropertyNames ? prop.jsonName : prop.name;
      const val = this.getRowInternal()[prop.index];
      if (typeof val !== "undefined" && val !== null) {
        Object.defineProperty(formattedRow, propName, {
          value: val,
          enumerable: true,
        });
      }
    }
    return formattedRow;
  }
  public async getMetaData(): Promise<QueryPropertyMetaData[]> {
    if (this._props.length === 0) {
      await this.fetchRows();
    }
    return this._props.properties;
  }
  private async fetchRows() {
    this._localOffset = -1;
    this._localRows = await this.readRows();
    if (this._localRows.length === 0) {
      this._done = true;
    }
  }
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
  public async toArray(): Promise<any[]> {
    const rows = [];
    while (await this.step()) {
      rows.push(this.formatCurrentRow());
    }
    return rows;
  }
}

