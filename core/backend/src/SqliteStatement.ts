/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module SQLite
 */

import { assert, BentleyError, DbResult, GuidString, Id64String, IDisposable, LRUMap } from "@itwin/core-bentley";
import { ECJsNames, IModelError } from "@itwin/core-common";
import { IModelJsNative } from "@bentley/imodeljs-native";
import { IModelNative } from "./internal/NativePlatform";

// spell:ignore julianday

/* eslint-disable @typescript-eslint/no-non-null-assertion */

/** Marks a string as either an [Id64String]($core-bentley) or [GuidString]($core-bentley), so
 * that it can be passed to the [bindValue]($backend.SqliteStatement) or [bindValues]($backend.SqliteStatement)
 * methods of [SqliteStatement]($backend).
 * @internal
 */
export interface StringParam {
  id?: Id64String;
  guid?: GuidString;
}

/** parameter Index (1-based), or name of the parameter (including the initial ':', '@' or '$')
 * @public
 */
export type BindParameter = number | string;

function checkBind(stat: DbResult) {
  if (stat !== DbResult.BE_SQLITE_OK)
    throw new IModelError(stat, "SQLite Bind error");
}

/** Executes SQLite SQL statements.
 *
 * A statement must be prepared before it can be executed, and it must be released when no longer needed.
 * See [IModelDb.withPreparedSqliteStatement]($backend) or
 * [ECDb.withPreparedSqliteStatement]($backend) for a convenient and
 * reliable way to prepare, execute, and then release a statement.
 *
 * A statement may contain parameters that must be filled in before use by calling [SqliteStatement.bindValue]($backend)
 * or [SqliteStatement.bindValues]($backend).
 *
 * Once prepared (and parameters are bound, if any), the statement is executed by calling [SqliteStatement.step]($backend).
 * In case of an **SQL SELECT** statement, the current row can be retrieved with [SqliteStatement.getRow]($backend) as
 * a whole, or with [SqliteStatement.getValue]($backend) when individual values are needed.
 * Alternatively, query results of an **SQL SELECT** statement can be stepped through by using
 * standard iteration syntax, such as `for of`.
 *
 * > Preparing a statement can be time-consuming. The best way to reduce the effect of this overhead is to cache and reuse prepared
 * > statements. A cached prepared statement may be used in different places in an app, as long as the statement is general enough.
 * > The key to making this strategy work is to phrase a statement in a general way and use placeholders to represent parameters that will vary on each use.
 * @public
 */
export class SqliteStatement implements IterableIterator<any>, IDisposable {
  private _stmt: IModelJsNative.SqliteStatement | undefined;
  private _db: IModelJsNative.AnyDb | undefined;

  public constructor(private _sql: string) { }
  public get stmt(): IModelJsNative.SqliteStatement { return this._stmt!; }
  public get sql() { return this._sql; }

  /** Check if this statement has been prepared successfully or not */
  public get isPrepared(): boolean { return undefined !== this._stmt; }

  /** Prepare this statement prior to first use.
   * @param db The DgnDb or ECDb to prepare the statement against
   * @param sql The SQL statement string to prepare
   * @param logErrors Determine if errors are logged or not
   * @throws if the SQL statement cannot be prepared. Normally, prepare fails due to SQL syntax errors or references to tables or properties that do not exist.
   * The error.message property will provide details.
   */
  public prepare(db: IModelJsNative.AnyDb, logErrors = true): void {
    if (this.isPrepared)
      throw new Error("SqliteStatement is already prepared");
    this._db = db;
    this._stmt = new IModelNative.platform.SqliteStatement();
    this._stmt.prepare(db, this._sql, logErrors);
  }

  /** Indicates whether the prepared statement makes no **direct* changes to the content of the file
   * or not. See [SQLite docs](https://www.sqlite.org/c3ref/stmt_readonly.html) for details.
   */
  public get isReadonly(): boolean {
    return this.stmt.isReadonly();
  }

  /** Reset this statement so that the next call to step will return the first row, if any.
   */
  public reset(): void {
    this.stmt.reset();
  }

  /** Call this function when finished with this statement. This releases the native resources held by the statement. */
  public dispose(): void {
    if (this._stmt) {
      this._stmt.dispose(); // free native statement
      this._stmt = undefined;
      this._db = undefined;
    }
  }

  /**
   * Call `step` on this statement and determine whether a new row is available.
   * Use this method only when this statement has been prepared with a SELECT statement.
   * @return true if a new row is available, false otherwise.
   * @throws if `step` returns anything other than BE_SQLITE_ROW or BE_SQLITE_DONE.
   */
  public nextRow(): boolean {
    const rc = this.step();
    switch (rc) {
      case DbResult.BE_SQLITE_ROW:
        return true;
      case DbResult.BE_SQLITE_DONE:
        return false;
    }

    this.throwSqlError(rc);
    return false; // unreachable
  }

  public throwSqlError(rc: DbResult) {
    throw new SqliteStatement.DbError(
      rc === DbResult.BE_SQLITE_CONSTRAINT_FOREIGNKEY ? "ValueIsInUse" :
        rc === DbResult.BE_SQLITE_CONSTRAINT_UNIQUE ? "DuplicateValue" :
          "SqlLogicError", rc, `SQL error: ${this._db!.getLastError()}`);
  }

  public stepForWrite(): void {
    const rc = this.step();
    if (rc !== DbResult.BE_SQLITE_DONE)
      this.throwSqlError(rc);
  }

  /** Binds a value to the specified SQL parameter.
   *  The value must be of one of these types:
   *  JavaScript Type | SQLite Type
   *  --- | ---
   *  undefined | NULL
   *  boolean | INTEGER with true being bound as 1 and false as 0
   *  number | INTEGER if number is integral or REAL if number is not integral
   *  string | TEXT
   *  Uint8Array or ArrayBuffer | BLOB
   *  [StringParam]($backend) where member **id** is set | INTEGER
   *  [StringParam]($backend) where member **guid** is set | BLOB
   *
   *  @param parameter Index (1-based) or name of the parameter (including the initial ':', '@' or '$')
   *  @param value Value to bind.
   *  @throws [IModelError]($common) if the value is of an unsupported type or in
   *  case of other binding errors.
   */
  public bindValue(parameter: BindParameter, value: any): void {
    let stat: DbResult;
    if (value === undefined || value === null) {
      stat = this.stmt.bindNull(parameter);
    } else if (typeof (value) === "number") {
      if (Number.isInteger(value))
        stat = this.stmt.bindInteger(parameter, value);
      else
        stat = this.stmt.bindDouble(parameter, value);
    } else if (typeof (value) === "boolean") {
      stat = this.stmt.bindInteger(parameter, value ? 1 : 0);
    } else if (typeof (value) === "string") {
      stat = this.stmt.bindString(parameter, value);
    } else if (!!value.id) {
      stat = this.stmt.bindId(parameter, value.id);
    } else if (!!value.guid) {
      stat = this.stmt.bindGuid(parameter, value.guid);
    } else if (value instanceof Uint8Array) {
      stat = this.stmt.bindBlob(parameter, value);
    } else
      throw new IModelError(DbResult.BE_SQLITE_ERROR, `Parameter value ${value} is of an unsupported data type.`);

    if (stat !== DbResult.BE_SQLITE_OK)
      throw new IModelError(stat, "Error in bindValue");
  }

  /** Bind an integer parameter
   * @param parameter Index (1-based) or name of the parameter (including the initial ':', '@' or '$')
   * @param val integer to bind.
   */
  public bindInteger(parameter: BindParameter, val: number) {
    checkBind(this.stmt.bindInteger(parameter, val));
  }
  /** Bind an integer parameter if it is defined. Otherwise do nothing.
   * @param parameter Index (1-based) or name of the parameter (including the initial ':', '@' or '$')
   * @param val integer to bind.
   */
  public maybeBindInteger(parameter: BindParameter, val?: number) {
    if (val !== undefined)
      this.bindInteger(parameter, val);
  }
  /** Bind a boolean parameter.
   * @param parameter Index (1-based) or name of the parameter (including the initial ':', '@' or '$')
   * @param val boolean to bind.
   */
  public bindBoolean(parameter: BindParameter, val: boolean) {
    this.bindInteger(parameter, val ? 1 : 0);
  }
  /** Bind a boolean parameter if it is defined. Otherwise do nothing.
   * @param parameter Index (1-based) or name of the parameter (including the initial ':', '@' or '$')
   * @param val boolean to bind.
   */
  public maybeBindBoolean(parameter: BindParameter, val?: boolean) {
    if (val !== undefined)
      this.bindBoolean(parameter, val);
  }
  /** JSON.stringify a property value and bind the JSON string.
   * @param parameter Index (1-based) or name of the parameter (including the initial ':', '@' or '$')
   * @param val object to bind.
   * @internal
   */
  public bindProps<T>(colIndex: number, val: T) {
    this.bindString(colIndex, JSON.stringify(val));
  }
  /** JSON.stringify a property value if it is defined, and bind the JSON string. Otherwise do nothing.
   * @param parameter Index (1-based) or name of the parameter (including the initial ':', '@' or '$')
   * @param val object to bind.
   * @internal
   */
  public maybeBindProps<T>(colIndex: number, val?: T) {
    if (val !== undefined)
      this.bindProps(colIndex, val);
  }
  /** Bind a double parameter
   *  @param parameter Index (1-based) or name of the parameter (including the initial ':', '@' or '$')
   *  @param val double to bind.
   */
  public bindDouble(parameter: BindParameter, val: number) {
    checkBind(this.stmt.bindDouble(parameter, val));
  }
  /** Bind a double parameter if it is defined. Otherwise do nothing.
   * @param parameter Index (1-based) or name of the parameter (including the initial ':', '@' or '$')
   * @param val double to bind.
   */
  public maybeBindDouble(parameter: BindParameter, val?: number) {
    if (val !== undefined)
      this.bindDouble(parameter, val);
  }
  /** Bind a string parameter
   *  @param parameter Index (1-based) or name of the parameter (including the initial ':', '@' or '$')
   *  @param val string to bind.
   */
  public bindString(parameter: BindParameter, val: string) {
    checkBind(this.stmt.bindString(parameter, val));
  }
  /** Bind a string parameter if it is defined. Otherwise do nothing.
   * @param parameter Index (1-based) or name of the parameter (including the initial ':', '@' or '$')
   * @param val string to bind.
   */
  public maybeBindString(parameter: BindParameter, val?: string) {
    if (val !== undefined)
      this.bindString(parameter, val);
  }
  /** Bind an Id64String parameter as a 64-bit integer
   *  @param parameter Index (1-based) or name of the parameter (including the initial ':', '@' or '$')
   *  @param val Id to bind.
   */
  public bindId(parameter: BindParameter, id: Id64String) {
    checkBind(this.stmt.bindId(parameter, id));
  }
  /** Bind a Guid parameter
   *  @param parameter Index (1-based) or name of the parameter (including the initial ':', '@' or '$')
   *  @param val Guid to bind.
   */
  public bindGuid(parameter: BindParameter, guid: GuidString) {
    checkBind(this.stmt.bindGuid(parameter, guid));
  }
  /** Bind a blob parameter
   *  @param parameter Index (1-based) or name of the parameter (including the initial ':', '@' or '$')
   *  @param val blob to bind.
   */
  public bindBlob(parameter: BindParameter, blob: Uint8Array) {
    checkBind(this.stmt.bindBlob(parameter, blob));
  }
  /** Bind a blob parameter if it is defined. Otherwise do nothing.
   * @param parameter Index (1-based) or name of the parameter (including the initial ':', '@' or '$')
   * @param val blob to bind.
   */
  public maybeBindBlob(parameter: BindParameter, val?: Uint8Array) {
    if (val !== undefined)
      this.bindBlob(parameter, val);
  }
  /** Bind null to a parameter
   *  @param parameter Index (1-based) or name of the parameter (including the initial ':', '@' or '$')
   */
  public bindNull(parameter: BindParameter) {
    checkBind(this.stmt.bindNull(parameter));
  }

  /** Bind values to all parameters in the statement.
   * @param values The values to bind to the parameters.
   * Pass an *array* of values if the parameters are *positional*.
   * Pass an *object of the values keyed on the parameter name* for *named parameters*.
   * The values in either the array or object must match the respective types of the parameter.
   * See [[SqliteStatement.bindValue]] for details on the supported types.
   */
  public bindValues(values: any[] | object): void {
    if (Array.isArray(values)) {
      for (let i = 0; i < values.length; i++) {
        const paramIndex: number = i + 1;
        const paramValue: any = values[i];
        if (paramValue === undefined || paramValue === null)
          continue;

        this.bindValue(paramIndex, paramValue);
      }
      return;
    }

    for (const entry of Object.entries(values)) {
      const paramName: string = entry[0];
      const paramValue: any = entry[1];
      if (paramValue === undefined || paramValue === null)
        continue;

      this.bindValue(paramName, paramValue);
    }
  }

  /** Clear any bindings that were previously set on this statement.
   * @throws [IModelError]($common) in case of errors
   */
  public clearBindings(): void {
    const stat = this.stmt.clearBindings();
    if (stat !== DbResult.BE_SQLITE_OK)
      throw new IModelError(stat, "Error in clearBindings");
  }

  /** Step this statement to the next row.
   *
   *  For **SQL SELECT** statements the method returns
   *  - [DbResult.BE_SQLITE_ROW]($core-bentley) if the statement now points successfully to the next row.
   *  - [DbResult.BE_SQLITE_DONE]($core-bentley) if the statement has no more rows.
   *  - Error status in case of errors.
   *
   *  For **SQL INSERT, UPDATE, DELETE** statements the method returns
   *  - [DbResult.BE_SQLITE_DONE]($core-bentley) if the statement has been executed successfully.
   *  - Error status in case of errors.
   */
  public step(): DbResult {
    return this.stmt.step();
  }
  /** Get the query result's column count (only for SQL SELECT statements). */
  public getColumnCount(): number {
    return this.stmt.getColumnCount();
  }
  /** Get the value for the column at the given index in the query result.
   * @param columnIx Index of SQL column in query result (0-based)
   */
  public getValue(columnIx: number): SqliteValue {
    return new SqliteValue(this.stmt, columnIx);
  }
  /** Determine whether the value of the specified column is null
   * @param colIndex Index of SQL column in query result (0-based)
   */
  public isValueNull(colIndex: number): boolean {
    return this.stmt.isValueNull(colIndex);
  }
  /** Get a size in bytes of a blob or text column
   * @param colIndex Index of SQL column in query result (0-based)
   */
  public getColumnBytes(colIndex: number): number {
    return this.stmt.getColumnBytes(colIndex);
  }
  /** Get a value as a blob
   * @param colIndex Index of SQL column in query result (0-based)
   */
  public getValueBlob(colIndex: number): Uint8Array {
    return this.stmt.getValueBlob(colIndex);
  }
  /** Get the value as a blob, or undefined if it is null.
   * @param colIndex Index of SQL column in query result (0-based)
   */
  public getValueBlobMaybe(colIndex: number): Uint8Array | undefined {
    return this.isValueNull(colIndex) ? undefined : this.getValueBlob(colIndex);
  }
  /** Get a value as a double
  * @param colIndex Index of SQL column in query result (0-based)
  */
  public getValueDouble(colIndex: number): number {
    return this.stmt.getValueDouble(colIndex);
  }
  /** Get the value as an double, or undefined if it is null.
   * @param colIndex Index of SQL column in query result (0-based)
   */
  public getValueDoubleMaybe(colIndex: number): number | undefined {
    return this.isValueNull(colIndex) ? undefined : this.getValueDouble(colIndex);
  }
  /** Get a value as a integer
  * @param colIndex Index of SQL column in query result (0-based)
  */
  public getValueInteger(colIndex: number): number {
    return this.stmt.getValueInteger(colIndex);
  }
  /** Get the value as an integer, or undefined if it is null.
   * @param colIndex Index of SQL column in query result (0-based)
   */
  public getValueIntegerMaybe(colIndex: number): number | undefined {
    return this.isValueNull(colIndex) ? undefined : this.getValueInteger(colIndex);
  }
  /** Get a value as a string
  * @param colIndex Index of SQL column in query result (0-based)
  */
  public getValueString(colIndex: number): string {
    return this.stmt.getValueString(colIndex);
  }
  /** Get the value as a string, or undefined if it is null.
   * @param colIndex Index of SQL column in query result (0-based)
   */
  public getValueStringMaybe(colIndex: number): string | undefined {
    return this.isValueNull(colIndex) ? undefined : this.getValueString(colIndex);
  }
  /** Get a value as an Id
  * @param colIndex Index of SQL column in query result (0-based)
  */
  public getValueId(colIndex: number): Id64String {
    return this.stmt.getValueId(colIndex);
  }
  /** Get a value as a Guid
  * @param colIndex Index of SQL column in query result (0-based)
  */
  public getValueGuid(colIndex: number): GuidString {
    return this.stmt.getValueGuid(colIndex);
  }
  /** Get the value as a boolean. Returns `false` if the column is null.
   * @param colIndex Index of SQL column in query result (0-based)
   */
  public getValueBoolean(colIndex: number) {
    return this.isValueNull(colIndex) ? false : 0 !== this.getValueInteger(colIndex);
  }
  /** Get the value of a [julianday](https://www.sqlite.org/lang_datefunc.html) column as a JavaScript `Date`.
   * @param colIndex Index of SQL column in query result (0-based)
   * @beta
   */
  public getValueDate(colIndex: number) {
    return new Date((this.stmt.getValueDouble(colIndex) - 2440587.5) * 86400000); // conversion from julian day ms to unix epoch ms
  }
  /** Get the value as a "props" JSON string, then parse it and return the object
   * @param colIndex Index of SQL column in query result (0-based)
   * @internal
  */
  public getProps<T>(colIndex: number): T {
    return JSON.parse(this.getValueString(colIndex));
  }
  /** Get the value as a "props" JSON string, then parse it and return the object.
   * If the column is null, return undefined.
   * @param colIndex Index of SQL column in query result (0-based)
   * @internal
  */
  public getPropsMaybe<T>(colIndex: number): T | undefined {
    return this.isValueNull(colIndex) ? undefined : this.getProps(colIndex);
  }

  /** Get the current row.
   * The returned row is formatted as JavaScript object where every SELECT clause item becomes a property in the JavaScript object.
   *
   * The SQL select clause item's name becomes the member name of the JavaScript object, **with the first character lowered**.
   *
   * SQLite Type | JavaScript Type
   * --- | ---
   * [SqliteValueType.Null]($backend) | undefined
   * [SqliteValueType.Integer]($backend) | number
   * [SqliteValueType.Double]($backend) | number
   * [SqliteValueType.String]($backend) | string
   * [SqliteValueType.Blob]($backend) | Uint8Array
   */
  public getRow(): any {
    const colCount = this.getColumnCount();
    const row: object = {};
    const duplicatePropNames = new Map<string, number>();
    for (let i = 0; i < colCount; i++) {
      const sqliteValue = this.getValue(i);
      if (!sqliteValue.isNull) {
        const propName: string = SqliteStatement.determineResultRowPropertyName(duplicatePropNames, sqliteValue);
        let val: any;
        switch (sqliteValue.type) {
          case SqliteValueType.Blob:
            val = sqliteValue.getBlob();
            break;
          case SqliteValueType.Double:
            val = sqliteValue.getDouble();
            break;
          case SqliteValueType.Integer:
            val = sqliteValue.getInteger();
            break;
          case SqliteValueType.String:
            val = sqliteValue.getString();
            break;

          default:
            throw new Error("Unsupported SqliteValueType");
        }

        Object.defineProperty(row, propName, { enumerable: true, configurable: true, writable: true, value: val });
      }
    }
    return row;
  }

  private static determineResultRowPropertyName(duplicatePropNames: Map<string, number>, sqliteValue: SqliteValue): string {
    let jsName = ECJsNames.toJsName(sqliteValue.columnName);

    // now check duplicates. If there are, append a numeric suffix to the duplicates
    let suffix = duplicatePropNames.get(jsName);
    if (suffix === undefined)
      duplicatePropNames.set(jsName, 0);
    else {
      suffix++;
      duplicatePropNames.set(jsName, suffix);
      jsName += `_${suffix}`;
    }

    return jsName;
  }

  /** Calls step when called as an iterator.
   */
  public next(): IteratorResult<any> {
    return DbResult.BE_SQLITE_ROW === this.step() ? { done: false, value: this.getRow() } : { done: true, value: undefined };
  }

  /** The iterator that will step through the results of this statement. */
  public [Symbol.iterator](): IterableIterator<any> { return this; }
}

/** Data type of a value in in an SQLite SQL query result.
 * See also:
 * - [SqliteValue]($backend)
 * - [SqliteStatement]($backend)
 * - [SqliteStatement.getValue]($backend)
 * @public
 */
export enum SqliteValueType {
  // do not change the values of that enum. It must correspond to the respective
  // enum DbValueType in the native BeSQLite API.
  Integer = 1,
  Double = 2,
  String = 3,
  Blob = 4,
  Null = 5,
}

/** Value of a column in a row of an SQLite SQL query result.
 * See also:
 * - [SqliteStatement]($backend)
 * - [SqliteStatement.getValue]($backend)
 * @public
 */
export class SqliteValue {
  private readonly _stmt: IModelJsNative.SqliteStatement;
  private readonly _colIndex: number;

  public constructor(stmt: IModelJsNative.SqliteStatement, colIndex: number) {
    this._stmt = stmt;
    this._colIndex = colIndex;
  }

  /** Indicates whether the value is NULL or not. */
  public get isNull(): boolean { return this._stmt.isValueNull(this._colIndex); }

  /** Gets the data type of the value. */
  public get type(): SqliteValueType { return this._stmt.getColumnType(this._colIndex); }

  /** Gets the name of the column of the value. */
  public get columnName(): string { return this._stmt.getColumnName(this._colIndex); }

  /** Gets the SqlValue as JavaScript value.
   *
   * SQLite Type | JavaScript Type
   * --- | ---
   * [SqliteValueType.Null]($backend) | undefined
   * [SqliteValueType.Integer]($backend) | number
   * [SqliteValueType.Double]($backend) | number
   * [SqliteValueType.String]($backend) | string
   * [SqliteValueType.Blob]($backend) | Uint8Array
   */
  public get value(): any {
    switch (this.type) {
      case SqliteValueType.Null:
        return undefined;
      case SqliteValueType.Blob:
        return this.getBlob();
      case SqliteValueType.Double:
        return this.getDouble();
      case SqliteValueType.Integer:
        return this.getInteger();
      case SqliteValueType.String:
        return this.getString();
      default:
        throw new Error("Unhandled SqliteValueType");
    }
  }

  /** Get the value as Blob */
  public getBlob(): Uint8Array { return this._stmt.getValueBlob(this._colIndex); }
  /** Get the value as a double value */
  public getDouble(): number { return this._stmt.getValueDouble(this._colIndex); }
  /** Get the value as a integer value */
  public getInteger(): number { return this._stmt.getValueInteger(this._colIndex); }
  /** Get the value as a string value */
  public getString(): string { return this._stmt.getValueString(this._colIndex); }
  /** Get the value as an Id value */
  public getId(): Id64String { return this._stmt.getValueId(this._colIndex); }
  /** Get the value as a Guid value */
  public getGuid(): GuidString { return this._stmt.getValueGuid(this._colIndex); }
}

interface Statement {
  isPrepared: boolean;
  sql: string;
  dispose(): void;
  reset(): void;
  clearBindings(): void;
}

/** A cache for previously prepared SqliteStatements.
 * It only holds Statements after they are no longer in use, resetting and clearing their bindings before saving them.
 * When a request to use a statement from the cache is made, it is first removed from the cache.
 * @internal
 */
export class StatementCache<Stmt extends Statement> {
  private _cache: LRUMap<string, Stmt>;

  public constructor(maxCount = 40) {
    this._cache = new LRUMap<string, Stmt>(maxCount);
  }

  public get size() { return this._cache.size; }
  public addOrDispose(stmt: Stmt): void {
    assert(stmt.isPrepared);

    const existing = this._cache.get(stmt.sql);
    if (existing !== undefined) {
      stmt.dispose(); // we already have a statement with this sql cached, we can't save another one so just dispose it
      return;
    }
    if (this._cache.size >= this._cache.limit) {
      const oldest = this._cache.shift()!;
      oldest[1].dispose();
    }
    stmt.reset();
    stmt.clearBindings();
    this._cache.set(stmt.sql, stmt);
  }

  public findAndRemove(sql: string): Stmt | undefined {
    return this._cache.delete(sql);
  }

  public clear() {
    this._cache.forEach((stmt) => stmt.dispose());
    this._cache.clear();
  }
}

/** @public */
export namespace SqliteStatement {
  export class DbError extends BentleyError {
    /** A string that indicates the type of problem that caused the exception. */
    public readonly errorId: ErrorId;

    /** @internal */
    constructor(errorId: ErrorId, errNum: number, message: string) {
      super(errNum, message);
      this.errorId = errorId;
    }
  }

  export type ErrorId =
    "DuplicateValue" |
    "SqlLogicError" |
    "ValueIsInUse";
}
