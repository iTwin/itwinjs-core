/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module iModels
 */
import { Base64EncodedString } from "./Base64EncodedString";
import {
  DbQueryError, DbQueryRequest, DbQueryResponse, DbRequestExecutor, DbRequestKind, DbResponseStatus, QueryBinder, QueryOptions, QueryOptionsBuilder,
  QueryPropertyMetaData, QueryRowFormat,
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
  toJsRow(): any;
  toRow(): any;
  toArray(): QueryValueType[];
  getMetaData(): QueryPropertyMetaData[];
  [propertyName: string]: QueryValueType;
  [propertyIndex: number]: QueryValueType;
}
/** @beta */
export class ECSqlReader {
  private _localRows: any[] = [];
  private _localOffset: number = 0;
  private _globalOffset: number = -1;
  private _globalCount: number = -1;
  private _done: boolean = false;
  private _globalDone: boolean = false;
  private _props = new PropertyMetaDataMap([]);
  private _param = new QueryBinder().serialize();
  private _lockArgs: boolean = false;
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
          return () => target.formatCurrentRow(QueryRowFormat.UseECSqlPropertyNames);
        }
        if (key === "toJsRow") {
          return () => target.formatCurrentRow(QueryRowFormat.UseJsPropertyNames);
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
    if (this._options.limit) {
      if (typeof this._options.limit.offset === "number" && this._options.limit.offset > 0)
        this._globalOffset = this._options.limit.offset;
      if (typeof this._options.limit.count === "number" && this._options.limit.count > 0)
        this._globalCount = this._options.limit.count;
    }
    this._done = false;
  }
  public get current(): QueryRowProxy { return (this._rowProxy as any); }
  public resetBindings() {
    this._param = new QueryBinder().serialize();
    this._lockArgs = false;
  }
  public get done(): boolean { return this._done; }
  public getRowInternal(): any[] {
    if (this._localRows.length <= this._localOffset)
      throw new Error("no current row");
    return this._localRows[this._localOffset] as any[];
  }
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
    const request: DbQueryRequest = {
      kind: DbRequestKind.ECSql,
      query: this.query,
      args: this._param,
      ... this._options,
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
    let resp = await this._executor.execute(request);
    let retry = 10;
    DbQueryError.throwIfError(resp, request);
    while (--retry > 0 && resp.data.length === 0 && (resp.status === DbResponseStatus.Partial || resp.status === DbResponseStatus.QueueFull || resp.status === DbResponseStatus.TimeOut)) {
      // add timeout
      resp = await this._executor.execute(request);
    }
    if (retry === 0 && resp.data.length === 0 && (resp.status === DbResponseStatus.Partial || resp.status === DbResponseStatus.QueueFull || resp.status === DbResponseStatus.TimeOut)) {
      throw new Error("query too long to execute or server is too busy");
    }
    return resp;
  }
  public formatCurrentRow(format: QueryRowFormat): any[] | object {
    if (format === QueryRowFormat.UseArrayIndexes) {
      return this.getRowInternal();
    }
    const formattedRow = {};
    for (const prop of this._props) {
      const propName = format === QueryRowFormat.UseJsPropertyNames ? prop.jsonName : prop.name;
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
  public getMetaData(): QueryPropertyMetaData[] { return this._props.properties; }
  public async step(): Promise<boolean> {
    if (this._done) {
      return false;
    }
    const cachedRows = this._localRows.length;
    if (this._localOffset < cachedRows - 1) {
      ++this._localOffset;
    } else {
      this._localRows = await this.readRows();
      this._localOffset = 0;
      if (this._localRows.length === 0) {
        this._done = true;
        return false;
      }
    }
    return true;
  }
  public async toArray(format: QueryRowFormat): Promise<any[]> {
    const rows = [];
    while (await this.step()) {
      rows.push(this.formatCurrentRow(format));
    }
    return rows;
  }
}

