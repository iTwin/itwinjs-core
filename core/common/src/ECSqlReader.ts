/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Base64EncodedString } from "./Base64EncodedString";
import {
  ConcurrentQueryError, PropertyInfo, QueryConfig, QueryConfigBuilder, QueryParams, QueryRequest, QueryResponse, QueryRowFormat, RequestExecutor,
  RequestKind, ResponseStatus,
} from "./ConcurrentQuery";

/** @beta */
export class PropertyList implements Iterable<PropertyInfo> {
  private _byPropName = new Map<string, number>();
  private _byJsonName = new Map<string, number>();
  private _byNoCase = new Map<string, number>();
  public constructor(private readonly _properties: PropertyInfo[]) {
    for (const property of this._properties) {
      this._byPropName.set(property.name, property.index);
      this._byJsonName.set(property.jsonName, property.index);
      this._byNoCase.set(property.name.toLowerCase(), property.index);
      this._byNoCase.set(property.jsonName.toLowerCase(), property.index);
    }
  }
  public get length(): number { return this._properties.length; }

  public [Symbol.iterator](): Iterator<PropertyInfo, any, undefined> {
    return this._properties[Symbol.iterator]();
  }
  public findByName(name: string): PropertyInfo | undefined {
    const index = this._byPropName.get(name);
    if (typeof index === "number") {
      return this._properties[index];
    }
    return undefined;
  }
  public findByJsonName(name: string): PropertyInfo | undefined {
    const index = this._byJsonName.get(name);
    if (typeof index === "number") {
      return this._properties[index];
    }
    return undefined;
  }
  public findByNoCase(name: string): PropertyInfo | undefined {
    const index = this._byNoCase.get(name.toLowerCase());
    if (typeof index === "number") {
      return this._properties[index];
    }
    return undefined;
  }
}
/**
 * @beta
*/
export type PropertyValueType = any;

/** @beta */
export interface IRowProxy {
  toJsRow(): any;
  toRow(): any;
  asArray(): PropertyValueType[];
  getPropertyDefs(): PropertyList;
  [propertyName: string]: PropertyValueType;
  [propertyIndex: number]: PropertyValueType;
}
/** @beta */
export class ECSqlReader {
  private _localRows: any[] = [];
  private _localOffset: number = 0;
  private _globalOffset: number = -1;
  private _globalCount: number = -1;
  private _done: boolean = false;
  private _globalDone: boolean = false;
  private _props = new PropertyList([]);
  private _param = new QueryParams().serialize();
  private _lockArgs: boolean = false;
  private _rowProxy = new Proxy<ECSqlReader>(this, {
    get: (target: ECSqlReader, key: string | Symbol) => {
      if (typeof key === "string") {
        const idx = Number.parseInt(key, 10);
        if (!Number.isNaN(idx)) {
          return target.getRowInternal()[idx];
        }
        const prop = target.properties.findByNoCase(key);
        if (prop) {
          return target.getRowInternal()[prop.index];
        }
        if (key === "getPropertyDefs") {
          return () => target.properties;
        }
        if (key === "toRow") {
          return () => target.formatCurrentRow(QueryRowFormat.UseECSqlPropertyNames);
        }
        if (key === "toJsRow") {
          return () => target.formatCurrentRow(QueryRowFormat.UseJsPropertyNames);
        }
        if (key === "asArray" || key === "toJSON") {
          return () => this.getRowInternal();
        }
      }
      return undefined;
    },
    has: (target: ECSqlReader, p: string | symbol) => {
      return !target.properties.findByNoCase(p as string);
    },
    ownKeys: (target: ECSqlReader) => {
      const keys = [];
      for (const prop of target.properties) {
        keys.push(prop.name);
      }
      return keys;
    },
  });
  private _config: QueryConfig = new QueryConfigBuilder().config;
  /** @internal */
  public constructor(private _executor: RequestExecutor<QueryRequest, QueryResponse>, public readonly query: string, param?: QueryParams, config?: QueryConfig) {
    if (query.trim().length === 0) {
      throw new Error("expecting non-empty ecsql statement");
    }
    if (param) {
      this._param = param.serialize();
    }
    this.reset(config);
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
  public setParams(param: QueryParams) {
    if (this._lockArgs) {
      throw new Error("call resetBindings() before setting or changing parameters");
    }
    this._param = param.serialize();
  }
  public reset(config?: QueryConfig) {
    if (config) {
      this._config = config;
    }
    this._props = new PropertyList([]);
    this._localRows = [];
    this._globalDone = false;
    this._globalOffset = 0;
    this._globalCount = -1;
    if (this._config.limit) {
      if (typeof this._config.limit.offset === "number" && this._config.limit.offset > 0)
        this._globalOffset = this._config.limit.offset;
      if (typeof this._config.limit.count === "number" && this._config.limit.count > 0)
        this._globalCount = this._config.limit.count;
    }
    this._done = false;
  }
  public get current(): IRowProxy { return (this._rowProxy as any); }
  public resetBindings() {
    this._param = new QueryParams().serialize();
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
    const request: QueryRequest = {
      kind: RequestKind.ECSql,
      query: this.query,
      args: this._param,
      ... this._config,
    };
    request.includeMetaData = this.properties.length > 0 ? false : true;
    request.limit = { offset: this._globalOffset, count: this._globalCount < 1 ? -1 : this._globalCount };
    const resp = await this.runWithRetry(request);
    this._globalDone = resp.status === ResponseStatus.Done;
    if (this._props.length === 0 && resp.meta.length > 0) {
      this._props = new PropertyList(resp.meta);
    }
    for (const row of resp.data) {
      ECSqlReader.replaceBase64WithUint8Array(row);
    }
    return resp.data;
  }
  private async runWithRetry(request: QueryRequest) {
    let resp = await this._executor.execute(request);
    let retry = 10;
    ConcurrentQueryError.throwIfError(resp, request);
    while (--retry > 0 && resp.data.length === 0 && (resp.status === ResponseStatus.Partial || resp.status === ResponseStatus.QueueFull || resp.status === ResponseStatus.TimeOut)) {
      // add timeout
      resp = await this._executor.execute(request);
    }
    if (retry === 0 && resp.data.length === 0 && (resp.status === ResponseStatus.Partial || resp.status === ResponseStatus.QueueFull || resp.status === ResponseStatus.TimeOut)) {
      throw new Error("query too long to execute or server is too busy");
    }
    return resp;
  }
  public formatCurrentRow(format: QueryRowFormat): any[] | object {
    if (format === QueryRowFormat.Array) {
      return this.getRowInternal();
    }
    const formattedRow = {};
    for (const prop of this.properties) {
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

  public get properties(): PropertyList { return this._props; }
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

