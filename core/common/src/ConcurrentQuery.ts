/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module iModels
 */
import { BentleyError, CompressedId64Set, DbResult, Id64, Id64String, OrderedId64Iterable } from "@itwin/core-bentley";
import { Point2d, Point3d } from "@itwin/core-geometry";
import { Base64 } from "js-base64";

/**
 * Specifies the format of the rows returned by the `query` and `restartQuery` methods of
 * [IModelConnection]($frontend), [IModelDb]($backend), and [ECDb]($backend).
 *
 * @public
 * @extensions
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
 * @extensions
 * */
export interface QueryLimit {
  /** Number of rows to return */
  count?: number;
  /** Offset from which to return rows */
  offset?: number;
}

/** @public */
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
 * @extensions
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
 * @extensions
 */
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
  /**
   * @internal
   * Allow query to be be deferred by milliseconds specified. This parameter is ignore by default unless
   * concurrent query is configure to honour it.
   */
  delay?: number;
}

/**
 * ECSql query config
 * @public
 * @extensions
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
  /**
   * @internal
   * Allow to set priority of query. Query will be inserted int queue base on priority value. This value will be ignored if concurrent query is configured with ignored priority is true.
   * @param val integer value which can be negative as well. By default its zero.
   * @returns @type QueryOptionsBuilder for fluent interface.
   */
  public setPriority(val: number) {
    this._options.priority = val;
    return this;
  }
  /**
   * Allow to set restart token. If restart token is set then any other query(s) in queue with same token is cancelled if its not already executed.
   * @param val A string token identifying a use case in which previous query with same token is cancelled.
   * @returns @type QueryOptionsBuilder for fluent interface.
   */
  public setRestartToken(val: string) {
    this._options.restartToken = val;
    return this;
  }
  /**
   * Allow to set quota restriction for query. Its a hint and may be overriden or ignored by concurrent query manager.
   * @param val @type QueryQuota Specify time and memory that can be used by a query.
   * @returns @type QueryOptionsBuilder for fluent interface.
   */
  public setQuota(val: QueryQuota) {
    this._options.quota = val;
    return this;
  }
  /**
   * Force a query to be executed synchronously against primary connection. This option is ignored if provided by frontend.
   * @param val A boolean value to force use primary connection on main thread to execute query.
   * @returns @type QueryOptionsBuilder for fluent interface.
   */
  public setUsePrimaryConnection(val: boolean) {
    this._options.usePrimaryConn = val;
    return this;
  }
  /**
   * By default all blobs are abbreviated to save memory and network bandwidth. If set to false, all blob data will be returned by query as is.
   * Use @type BlobReader to access blob data more efficiently.
   * @param val A boolean value, if set to false will return complete blob type property data. This could cost time and network bandwidth.
   * @returns @type QueryOptionsBuilder for fluent interface.
   */
  public setAbbreviateBlobs(val: boolean) {
    this._options.abbreviateBlobs = val;
    return this;
  }
  /**
   * When query fail to prepare it will log error. This setting will suppress log errors in case where query come from user typing it and its expected to fail often.
   * @param val A boolean value, if set to true, any error logging will be suppressed.
   * @returns @type QueryOptionsBuilder for fluent interface.
   */
  public setSuppressLogErrors(val: boolean) {
    this._options.suppressLogErrors = val;
    return this;
  }
  /**
   * If set ECClassId, SourceECClassId and TargetECClassId system properties will return qualified name of class instead of a @typedef Id64String.
   * @param val A boolean value.
   * @returns @type QueryOptionsBuilder for fluent interface.
   */
  public setConvertClassIdsToNames(val: boolean) {
    this._options.convertClassIdsToClassNames = val;
    return this;
  }
  /**
   * Specify limit for query. Limit determine number of rows and offset in result-set.
   * @param val Specify count and offset from within the result-set of a ECSQL query.
   * @returns @type QueryOptionsBuilder for fluent interface.
   */
  public setLimit(val: QueryLimit) {
    this._options.limit = val;
    return this;
  }
  /**
   * Specify row format returned by concurrent query manager.
   * @param val @enum QueryRowFormat specifying format for result.
   * @returns @type QueryOptionsBuilder for fluent interface.
   */
  public setRowFormat(val: QueryRowFormat) {
    this._options.rowFormat = val;
    return this;
  }
  /**
   * @internal
   * Defers execution of query in queue by specified milliseconds. This parameter is ignored by default unless concurrent query is configure to not ignore it.
   * @param val Number of milliseconds.
   * @returns @type QueryOptionsBuilder for fluent interface.
   */
  public setDelay(val: number) {
    this._options.delay = val;
    return this;
  }
}
/** @beta */
export class BlobOptionsBuilder {
  public constructor(private _options: BlobOptions = {}) { }
  public getOptions(): BlobOptions { return this._options; }
  /**
   * @internal
   * Allow to set priority of blob request. Blob request will be inserted int queue base on priority value. This value will be ignored if concurrent query is configured with ignored priority is true.
   * @param val integer value which can be negative as well. By default its zero.
   * @returns @type BlobOptionsBuilder for fluent interface.
   */
  public setPriority(val: number) {
    this._options.priority = val;
    return this;
  }
  /**
   * Allow to set restart token. If restart token is set then any other blob request in queue with same token is cancelled if its not already executed.
   * @param val A string token identifying a use case in which previous blob request with same token is cancelled.
   * @returns @type BlobOptionsBuilder for fluent interface.
   */
  public setRestartToken(val: string) {
    this._options.restartToken = val;
    return this;
  }
  /**
   * Allow to set quota restriction for blob request. Its a hint and may be overriden or ignored by concurrent query manager.
   * @param val @type QueryQuota Specify time and memory that can be used by a query.
   * @returns @type BlobOptionsBuilder for fluent interface.
   */
  public setQuota(val: QueryQuota) {
    this._options.quota = val;
    return this;
  }
  /**
   * Force a blob request to be executed synchronously against primary connection. This option is ignored if provided by frontend.
   * @param val A boolean value to force use primary connection on main thread to execute blob request.
   * @returns @type BlobOptionsBuilder for fluent interface.
   */
  public setUsePrimaryConnection(val: boolean) {
    this._options.usePrimaryConn = val;
    return this;
  }
  /**
   * Specify range with in the blob that need to be returned.
   * @param val Specify offset and count of bytes that need to be returned.
   * @returns @type BlobOptionsBuilder for fluent interface.
   */
  public setRange(val: BlobRange) {
    this._options.range = val;
    return this;
  }
  /**
   * @internal
   * Defers execution of blob request in queue by specified milliseconds. This parameter is ignored by default unless concurrent query is configure to not ignore it.
   * @param val Number of milliseconds.
   * @returns @type BlobOptionsBuilder for fluent interface.
   */
  public setDelay(val: number) {
    this._options.delay = val;
    return this;
  }
}

/** @internal */
export enum QueryParamType {
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

/**
 * Bind values to an ECSQL query.
 *
 * All binding class methods accept an `indexOrName` parameter as a `string | number` type and a value to bind to it.
 * A binding must be mapped either by a positional index or a string/name. See the examples below.
 *
 * @example
 * Parameter By Index:
 * ```sql
 * SELECT a, v FROM test.Foo WHERE a=? AND b=?
 * ```
 * The first `?` is index 1 and the second `?` is index 2. The parameter index starts with 1 and not 0.
 *
 * @example
 * Parameter By Name:
 * ```sql
 * SELECT a, v FROM test.Foo WHERE a=:name_a AND b=:name_b
 * ```
 * Using "name_a" as the `indexOrName` will bind the provided value to `name_a` in the query. And the same goes for
 * using "name_b" and the `name_b` binding respectively.
 *
 * @see
 * - [ECSQL Parameters]($docs/learning/ECSQL.md#ecsql-parameters)
 * - [ECSQL Parameter Types]($docs/learning/ECSQLParameterTypes)
 * - [ECSQL Code Examples]($docs/learning/backend/ECSQLCodeExamples#parameter-bindings)
 *
 * @public
 */
export class QueryBinder {
  private _args = {};
  private verify(indexOrName: string | number) {
    if (typeof indexOrName === "number") {
      if (indexOrName < 1)
        throw new Error("expect index to be >= 1");
      return;
    }
    if (!/^[a-zA-Z_]+\w*$/i.test(indexOrName)) {
      throw new Error("expect named parameter to meet identifier specification");
    }
  }

  /**
   * Bind boolean value to ECSQL statement.
   * @param indexOrName Specify parameter index or its name used in ECSQL statement.
   * @param val Boolean value to bind to ECSQL statement.
   * @returns @type QueryBinder to allow fluent interface.
   */
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

  /**
   * Bind blob value to ECSQL statement.
   * @param indexOrName Specify parameter index or its name used in ECSQL statement.
   * @param val Blob value to bind to ECSQL statement.
   * @returns @type QueryBinder to allow fluent interface.
   */
  public bindBlob(indexOrName: string | number, val: Uint8Array) {
    this.verify(indexOrName);
    const name = String(indexOrName);
    const base64 = Base64.fromUint8Array(val);
    Object.defineProperty(this._args, name, {
      enumerable: true, value: {
        type: QueryParamType.Blob,
        value: base64,
      },
    });
    return this;
  }

  /**
   * Bind double value to ECSQL statement.
   * @param indexOrName Specify parameter index or its name used in ECSQL statement.
   * @param val Double value to bind to ECSQL statement.
   * @returns @type QueryBinder to allow fluent interface.
   */
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

  /**
   * Bind @typedef Id64String value to ECSQL statement.
   * @param indexOrName Specify parameter index or its name used in ECSQL statement.
   * @param val @typedef Id64String value to bind to ECSQL statement.
   * @returns @type QueryBinder to allow fluent interface.
   */
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

  /**
   * Bind @type OrderedId64Iterable to ECSQL statement.
   * @param indexOrName Specify parameter index or its name used in ECSQL statement.
   * @param val @type OrderedId64Iterable value to bind to ECSQL statement.
   * @returns @type QueryBinder to allow fluent interface.
   */
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

  /**
   * Bind integer to ECSQL statement.
   * @param indexOrName Specify parameter index or its name used in ECSQL statement.
   * @param val Integer value to bind to ECSQL statement.
   * @returns @type QueryBinder to allow fluent interface.
   */
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

  /**
   * Bind struct to ECSQL statement. Struct specified as object.
   * @param indexOrName Specify parameter index or its name used in ECSQL statement.
   * @param val struct value to bind to ECSQL statement.
   * @returns @type QueryBinder to allow fluent interface.
   */
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

  /**
   * Bind long to ECSQL statement.
   * @param indexOrName Specify parameter index or its name used in ECSQL statement.
   * @param val Long value to bind to ECSQL statement.
   * @returns @type QueryBinder to allow fluent interface.
   */
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

  /**
   * Bind string to ECSQL statement.
   * @param indexOrName Specify parameter index or its name used in ECSQL statement.
   * @param val String value to bind to ECSQL statement.
   * @returns @type QueryBinder to allow fluent interface.
   */
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

  /**
   * Bind null to ECSQL statement.
   * @param indexOrName Specify parameter index or its name used in ECSQL statement.
   * @returns @type QueryBinder to allow fluent interface.
   */
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

  /**
   * Bind @type Point2d to ECSQL statement.
   * @param indexOrName Specify parameter index or its name used in ECSQL statement.
   * @param val @type Point2d  value to bind to ECSQL statement.
   * @returns @type QueryBinder to allow fluent interface.
   */
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

  /**
   * Bind @type Point3d to ECSQL statement.
   * @param indexOrName Specify parameter index or its name used in ECSQL statement.
   * @param val @type Point3d  value to bind to ECSQL statement.
   * @returns @type QueryBinder to allow fluent interface.
   */
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
    } else if (typeof val === "undefined" || val === null) {
      params.bindNull(nameOrId);
    } else if (typeof val === "object" && !Array.isArray(val)) {
      params.bindStruct(nameOrId, val);
    } else {
      throw new Error("unsupported type");
    }
  }

  /**
   * Allow bulk bind either parameters by index as value array or by parameter names as object.
   * @param args if array of values is provided then array index is used as index. If object is provided then object property name is used as parameter name of reach value.
   * @returns @type QueryBinder to allow fluent interface.
   */
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

  public serialize(): object {
    return this._args;
  }
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

/** @internal */
export interface DbQueryConfig {
  globalQuota?: QueryQuota;
  ignoreDelay?: boolean;
  ignorePriority?: boolean;
  requestQueueSize?: number;
  workerThreads?: number;
}
