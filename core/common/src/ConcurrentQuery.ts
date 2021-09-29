/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { BentleyError, CompressedId64Set, DbResult, Id64Set, Id64String } from "@itwin/core-bentley";
import { Point2d, Point3d } from "@itwin/core-geometry";

export enum QueryRowFormat {
  UseECSqlPropertyNames,
  UseJsPropertyNames,
  Array, // Any trailing null will be ignored.
  Default = Array,

}
/** @beta */
export interface Limit {
  count?: number;
  offset?: number;
}
/** @beta */
export interface PropertyInfo {
  className: string;
  generated: boolean;
  index: number;
  jsonName: string;
  name: string;
  system: boolean;
  typeName: string;
}
/** @beta */
export interface Stats {
  cpuTime: number;
  totalTime: number;
  timeLimit: number;
  memLimit: number;
  memUsed: number;
}
/** @beta */
export interface Quota {
  time?: number;
  memory?: number;
}
/** @beta */
export interface BaseConfig {
  priority?: number;
  restartToken?: string;
  usePrimaryConn?: boolean;
  quota?: Quota;
}
/** @beta */
export interface QueryConfig extends BaseConfig {
  abbreviateBlobs?: boolean;
  suppressLogErrors?: boolean;
  includeMetaData?: boolean;
  limit?: Limit;
}
/** @beta */
export type Range = Limit;
/** @beta */

export interface BlobConfig extends BaseConfig {
  range?: Range;
}

/** @beta */
export class QueryConfigBuilder {
  private _config: QueryConfig = {};
  public get config(): QueryConfig { return this._config; }
  public setPriority(val: number) { this._config.priority = val; return this; }
  public setRestartToken(val: string) { this._config.restartToken = val; return this; }
  public setQuota(val: Quota) { this._config.quota = val; return this; }
  public setUsePrimaryConnection(val: boolean) { this._config.usePrimaryConn = val; return this; }
  public setAbbreviateBlobs(val: boolean) { this._config.abbreviateBlobs = val; return this; }
  public setSuppressLogErrors(val: boolean) { this._config.suppressLogErrors = val; return this; }
  public setLimit(val: Limit) { this._config.limit = val; return this; }
}
/** @beta */
export class BlobConfigBuilder {
  private _config: BlobConfig = {};
  public get config(): BlobConfig { return this._config; }
  public setPriority(val: number) { this._config.priority = val; return this; }
  public setRestartToken(val: string) { this._config.restartToken = val; return this; }
  public setQuota(val: Quota) { this._config.quota = val; return this; }
  public setUsePrimaryConnection(val: boolean) { this._config.usePrimaryConn = val; return this; }
  public setRange(val: Range) { this._config.range = val; return this; }
}
/** @internal */
enum QueryParamType {
  Boolean = 0,
  Double = 1,
  Id = 2,
  IdSet = 3,
  Integer = 4,
  Long = 5,
  Null = 6,
  // eslint-disable-next-line @typescript-eslint/no-shadow
  Point2d = 7,
  // eslint-disable-next-line @typescript-eslint/no-shadow
  Point3d = 8,
  String = 9,
  Blob = 10,
  Struct = 11,
}
/** @beta */
export class QueryParams {
  private _args = {};
  private verify(indexOrName: string | number) {
    if (typeof indexOrName === "number") {
      if (indexOrName < 1)
        throw new Error("expect index to be >= 1");
    }
    if (typeof indexOrName === "string") {
      if (!/^[a-zA-Z_]+\w*$/i.test(indexOrName)) {
        throw new Error("expect named parameter to meet identifier specification");
      }
    }
  }
  public bindBoolean(indexOrName: string | number, val: boolean) {
    this.verify(indexOrName);
    const name = String(indexOrName);
    Object.defineProperty(this._args, name, {
      enumerable: true,
      value: {
        type: QueryParamType.Boolean,
        value: val,
      },
    });
    return this;
  }
  public bindBlob(indexOrName: string | number, val: Uint8Array) {
    this.verify(indexOrName);
    const name = String(indexOrName);
    const base64 = Buffer.from(val).toString("base64");
    Object.defineProperty(this._args, name, {
      enumerable: true, value: {
        type: QueryParamType.Blob,
        value: base64,
      },
    });
    return this;
  }
  public bindDouble(indexOrName: string | number, val: number) {
    this.verify(indexOrName);
    const name = String(indexOrName);
    Object.defineProperty(this._args, name, {
      enumerable: true, value: {
        type: QueryParamType.Double,
        value: val,
      },
    });
    return this;
  }
  public bindId(indexOrName: string | number, val: Id64String) {
    this.verify(indexOrName);
    const name = String(indexOrName);
    Object.defineProperty(this._args, name, {
      enumerable: true, value: {
        type: QueryParamType.Id,
        value: val,
      },
    });
    return this;
  }
  public bindIdSet(indexOrName: string | number, val: Id64Set) {
    this.verify(indexOrName);
    const name = String(indexOrName);
    Object.defineProperty(this._args, name, {
      enumerable: true, value: {
        type: QueryParamType.IdSet,
        value: CompressedId64Set.compressSet(val),
      },
    });
    return this;
  }
  public bindInt(indexOrName: string | number, val: number) {
    this.verify(indexOrName);
    const name = String(indexOrName);
    Object.defineProperty(this._args, name, {
      enumerable: true, value: {
        type: QueryParamType.Integer,
        value: val,
      },
    });
    return this;
  }
  public bindStruct(indexOrName: string | number, val: object) {
    this.verify(indexOrName);
    const name = String(indexOrName);
    Object.defineProperty(this._args, name, {
      enumerable: true, value: {
        type: QueryParamType.Struct,
        value: val,
      },
    });
    return this;
  }
  public bindLong(indexOrName: string | number, val: number) {
    this.verify(indexOrName);
    const name = String(indexOrName);
    Object.defineProperty(this._args, name, {
      enumerable: true, value: {
        type: QueryParamType.Long,
        value: val,
      },
    });
    return this;
  }
  public bindString(indexOrName: string | number, val: string) {
    this.verify(indexOrName);
    const name = String(indexOrName);
    Object.defineProperty(this._args, name, {
      enumerable: true, value: {
        type: QueryParamType.String,
        value: val,
      },
    });
    return this;
  }
  public bindNull(indexOrName: string | number) {
    this.verify(indexOrName);
    const name = String(indexOrName);
    Object.defineProperty(this._args, name, {
      enumerable: true, value: {
        type: QueryParamType.Null,
        value: null,
      },
    });
    return this;
  }
  public bindPoint2d(indexOrName: string | number, val: Point2d) {
    this.verify(indexOrName);
    const name = String(indexOrName);
    Object.defineProperty(this._args, name, {
      enumerable: true, value: {
        type: QueryParamType.Point2d,
        value: val,
      },
    });
    return this;
  }
  public bindPoint3d(indexOrName: string | number, val: Point3d) {
    this.verify(indexOrName);
    const name = String(indexOrName);
    Object.defineProperty(this._args, name, {
      enumerable: true, value: {
        type: QueryParamType.Point3d,
        value: val,
      },
    });
    return this;
  }
  private static bind(params: QueryParams, nameOrId: string | number, val: any) {
    if (typeof val === "boolean") {
      params.bindBoolean(nameOrId, val);
    } else if (typeof val === "number") {
      params.bindDouble(nameOrId, val);
    } else if (typeof val === "string") {
      params.bindString(nameOrId, val);
    } else if (val instanceof Uint8Array) {
      params.bindBlob(nameOrId, val);
    } else if (val instanceof Point2d) {
      params.bindPoint2d(nameOrId, val);
    } else if (val instanceof Point3d) {
      params.bindPoint3d(nameOrId, val);
    } else if (val instanceof Set) {
      params.bindIdSet(nameOrId, val);
    } else if (typeof val === "object" && !Array.isArray(val)) {
      params.bindStruct(nameOrId, val);
    } else if (typeof val === "undefined" || val === null) {
      params.bindNull(nameOrId);
    } else {
      throw new Error("unsupported type");
    }
  }
  public static from(args: any[] | object | undefined): QueryParams {
    const params = new QueryParams();
    if (typeof args === "undefined")
      return params;

    if (Array.isArray(args)) {
      let i = 1;
      for (const val of args) {
        this.bind(params, i++, val);
      }
    } else {
      for (const prop of Object.getOwnPropertyNames(args)) {
        this.bind(params, prop, (args as any)[prop]);
      }
    }
    return params;
  }
  public serialize(): object { return this._args; }
}

/** @internal */
export enum RequestKind {
  BlobIO = 0,
  ECSql = 1
}
/** @internal */
export enum ResponseKind {
  BlobIO = RequestKind.BlobIO,
  ECSql = RequestKind.ECSql,
  NoResult = 2
}
/** @internal */
export enum ResponseStatus {
  Error = 0,
  Done = 1,
  Cancel = 2,
  Partial = 3,
  TimeOut = 4,
  QueueFull = 5
}
/** @internal */
export interface Request extends BaseConfig {
  kind: RequestKind;
}
/** @internal */
export interface QueryRequest extends Request, QueryConfig {
  query: string;
  args?: object;
}
/** @internal */
export interface BlobRequest extends Request, BlobConfig {
  className: string;
  accessString: string;
  instanceId: Id64String;
}
/** @internal */
export interface Response {
  stats: Stats;
  status: ResponseStatus;
  kind: ResponseKind;
  error?: string;
}
/** @internal */
export interface QueryResponse extends Response {
  meta: PropertyInfo[];
  data: any[];
  rowCount: number;
}
/** @internal */
export interface BlobResponse extends Response {
  data?: Uint8Array;
  rawBlobSize: number;
}
/** @beta */
export class ResponseError extends BentleyError {
  public constructor(public readonly response: Response, public readonly request?: Request, rc?: DbResult) {
    super(rc ?? DbResult.BE_SQLITE_ERROR, response.error, () => {
      return {
        resp: response, req: request,
      };
    });
  }
  public static throwIfError(response: Response, request?: Request) {
    if (response.status === ResponseStatus.Error) {
      throw new ResponseError(response, request);
    }
    if (response.status === ResponseStatus.Cancel) {
      throw new ResponseError(response, request, DbResult.BE_SQLITE_INTERRUPT);
    }
  }
}
/** @internal */
export interface RequestExecutor<TRequest extends Request, TResponse extends Response> {
  execute(request: TRequest): Promise<TResponse>;
}
