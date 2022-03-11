/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module iModels
 */
import { BentleyError, CompressedId64Set, DbResult, Id64, Id64String, OrderedId64Iterable } from "@itwin/core-bentley";
import { Point2d, Point3d } from "@itwin/core-geometry";

/**
 * Specifies the format of the rows returned by the `query` and `restartQuery` methods of
 * [IModelConnection]($frontend), [IModelDb]($backend), and [ECDb]($backend).
 *
 * @public
 */
export enum QueryRowFormat {
  /** Each row is an object in which each non-null column value can be accessed by its name as defined in the ECSql.
   * Null values are omitted.
   */
  UseECSqlPropertyNames,
  /** Each row is an array of values accessed by an index corresponding to the property's position in the ECSql SELECT statement.
   * Null values are included if they are followed by a non-null column, but trailing null values at the end of the array are omitted.
   */
  UseECSqlPropertyIndexes,
  /** Each row is an object in which each non-null column value can be accessed by a [remapped property name]($docs/learning/ECSqlRowFormat.md).
   * This format is backwards-compatible with the format produced by iTwin.js 2.x. Null values are omitted.
   */
  UseJsPropertyNames,
}
/**
 * Specify limit or range of rows to return
 * @public
 * */
export interface QueryLimit {
  /** Number of rows to return */
  count?: number;
  /** Offset from which to return rows */
  offset?: number;
}
/** @beta */
export interface QueryPropertyMetaData {
  className: string;
  generated: boolean;
  index: number;
  jsonName: string;
  name: string;
  extendType: string;
  typeName: string;
}
/** @beta */
export interface DbRuntimeStats {
  cpuTime: number;
  totalTime: number;
  timeLimit: number;
  memLimit: number;
  memUsed: number;
}
/**
 * Quota hint for the query.
 * @public
 * */
export interface QueryQuota {
  /** Max time allowed in seconds. This is hint and may not be honoured but help in prioritize request */
  time?: number;
  /** Max memory allowed in bytes. This is hint and may not be honoured but help in prioritize request */
  memory?: number;
}
/**
 * Config for all request made to concurrent query engine.
 * @public
 * */
export interface BaseReaderOptions {
  /** Determine priority of this query default to 0, used as hint and can be overriden by backend. */
  priority?: number;
  /** If specified cancel last query (if any) with same restart token and queue the new query */
  restartToken?: string;
  /** For editing apps this can be set to true and all query will run on primary connection
  *  his may cause slow queries execution but the most recent data changes will be visitable via query
  */
  usePrimaryConn?: boolean;
  /** Restrict time or memory for query but use as hint and may be changed base on backend settings */
  quota?: QueryQuota;
}
/**
 * ECSql query config
 * @public
 * */
export interface QueryOptions extends BaseReaderOptions {
  /**
   * default to false. It abbreviate blobs to single bytes. This help cases where wildcard is
   * used in select clause. Use BlobReader api to read individual blob specially if its of large size.
   * */
  abbreviateBlobs?: boolean;
  /**
   * default to false. It will suppress error and will not log it. Useful in cases where we expect query
   * can fail.
   */
  suppressLogErrors?: boolean;
  /** This is used internally. If true it query will return meta data about query. */
  includeMetaData?: boolean;
  /** Limit range of rows returned by query*/
  limit?: QueryLimit;
  /**
   * Convert ECClassId, SourceECClassId, TargetECClassId and RelClassId to respective name.
   * When true, XXXXClassId property will be returned as className.
   * */
  convertClassIdsToClassNames?: boolean;
  /**
   * Determine row format.
   */
  rowFormat?: QueryRowFormat;
}
/** @beta */
export type BlobRange = QueryLimit;

/** @beta */
export interface BlobOptions extends BaseReaderOptions {
  range?: BlobRange;
}

/** @public */
export class QueryOptionsBuilder {
  public constructor(private _options: QueryOptions = {}) { }
  public getOptions(): QueryOptions { return this._options; }
  public setPriority(val: number) { this._options.priority = val; return this; }
  public setRestartToken(val: string) { this._options.restartToken = val; return this; }
  public setQuota(val: QueryQuota) { this._options.quota = val; return this; }
  public setUsePrimaryConnection(val: boolean) { this._options.usePrimaryConn = val; return this; }
  public setAbbreviateBlobs(val: boolean) { this._options.abbreviateBlobs = val; return this; }
  public setSuppressLogErrors(val: boolean) { this._options.suppressLogErrors = val; return this; }
  public setConvertClassIdsToNames(val: boolean) { this._options.convertClassIdsToClassNames = val; return this; }
  public setLimit(val: QueryLimit) { this._options.limit = val; return this; }
  public setRowFormat(val: QueryRowFormat){ this._options.rowFormat = val; return this; }
}
/** @beta */
export class BlobOptionsBuilder {
  public constructor(private _options: BlobOptions = {}) { }
  public getOptions(): BlobOptions { return this._options; }
  public setPriority(val: number) { this._options.priority = val; return this; }
  public setRestartToken(val: string) { this._options.restartToken = val; return this; }
  public setQuota(val: QueryQuota) { this._options.quota = val; return this; }
  public setUsePrimaryConnection(val: boolean) { this._options.usePrimaryConn = val; return this; }
  public setRange(val: BlobRange) { this._options.range = val; return this; }
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
/** @public */
export class QueryBinder {
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
  public bindIdSet(indexOrName: string | number, val: OrderedId64Iterable) {
    this.verify(indexOrName);
    const name = String(indexOrName);
    OrderedId64Iterable.uniqueIterator(val);
    Object.defineProperty(this._args, name, {
      enumerable: true, value: {
        type: QueryParamType.IdSet,
        value: CompressedId64Set.sortAndCompress(OrderedId64Iterable.uniqueIterator(val)),
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
  private static bind(params: QueryBinder, nameOrId: string | number, val: any) {
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
    } else if (val instanceof Array && val.length > 0 && typeof val[0] === "string" && Id64.isValidId64(val[0])) {
      params.bindIdSet(nameOrId, val);
    } else if (typeof val === "object" && !Array.isArray(val)) {
      params.bindStruct(nameOrId, val);
    } else if (typeof val === "undefined" || val === null) {
      params.bindNull(nameOrId);
    } else {
      throw new Error("unsupported type");
    }
  }
  public static from(args: any[] | object | undefined): QueryBinder {
    const params = new QueryBinder();
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
export enum DbRequestKind {
  BlobIO = 0,
  ECSql = 1
}
/** @internal */
export enum DbResponseKind {
  BlobIO = DbRequestKind.BlobIO,
  ECSql = DbRequestKind.ECSql,
  NoResult = 2
}
/** @internal */
export enum DbResponseStatus {
  Done = 1,  /* query ran to completion. */
  Cancel = 2, /*  Requested by user.*/
  Partial = 3, /*  query was running but ran out of quota.*/
  Timeout = 4, /*  query time quota expired while it was in queue.*/
  QueueFull = 5, /*  could not submit the query as queue was full.*/
  Error = 100, /*  generic error*/
  Error_ECSql_PreparedFailed = Error + 1, /*  ecsql prepared failed*/
  Error_ECSql_StepFailed = Error + 2, /*  ecsql step failed*/
  Error_ECSql_RowToJsonFailed = Error + 3, /*  ecsql failed to serialized row to json.*/
  Error_ECSql_BindingFailed = Error + 4, /*  ecsql binding failed.*/
  Error_BlobIO_OpenFailed = Error + 5, /*  class or property or instance specified was not found or property as not of type blob.*/
  Error_BlobIO_OutOfRange = Error + 6, /*  range specified is invalid based on size of blob.*/
}
/** @internal */
export enum DbValueFormat {
  ECSqlNames = 0,
  JsNames = 1
}
/** @internal */
export interface DbRequest extends BaseReaderOptions {
  kind?: DbRequestKind;
}
/** @internal */
export interface DbQueryRequest extends DbRequest, QueryOptions {
  valueFormat?: DbValueFormat;
  query: string;
  args?: object;
}
/** @internal */
export interface DbBlobRequest extends DbRequest, BlobOptions {
  className: string;
  accessString: string;
  instanceId: Id64String;
}
/** @internal */
export interface DbResponse {
  stats: DbRuntimeStats;
  status: DbResponseStatus;
  kind: DbResponseKind;
  error?: string;
}
/** @internal */
export interface DbQueryResponse extends DbResponse {
  meta: QueryPropertyMetaData[];
  data: any[];
  rowCount: number;
}
/** @internal */
export interface DbBlobResponse extends DbResponse {
  data?: Uint8Array;
  rawBlobSize: number;
}
/** @public */
export class DbQueryError extends BentleyError {
  public constructor(public readonly response: any, public readonly request?: any, rc?: DbResult) {
    super(rc ?? DbResult.BE_SQLITE_ERROR, response.error, { response, request });
  }
  public static throwIfError(response: any, request?: any) {
    if ((response.status as number) >= (DbResponseStatus.Error as number)) {
      throw new DbQueryError(response, request);
    }
    if (response.status === DbResponseStatus.Cancel) {
      throw new DbQueryError(response, request, DbResult.BE_SQLITE_INTERRUPT);
    }
  }
}
/** @internal */
export interface DbRequestExecutor<TRequest extends DbRequest, TResponse extends DbResponse> {
  execute(request: TRequest): Promise<TResponse>;
}
