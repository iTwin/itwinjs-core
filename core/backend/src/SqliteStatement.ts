/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module SQLite
 */

import { Config, DbResult, GuidString, Id64String, IDisposable, StatusCodeWithMessage } from "@bentley/bentleyjs-core";
import { ECJsNames, IModelError } from "@bentley/imodeljs-common";
import { IModelJsNative } from "@bentley/imodeljs-native";
import { IModelHost } from "./IModelHost";

/** Marks a string as either an [Id64String]($bentleyjs-core) or [GuidString]($bentleyjs-core), so
 * that it can be passed to the [bindValue]($backend.SqliteStatement) or [bindValues]($backend.SqliteStatement)
 * methods of [SqliteStatement]($backend).
 * @internal
 */
export interface StringParam {
  id?: Id64String;
  guid?: GuidString;
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
 * @internal
 */
export class SqliteStatement implements IterableIterator<any>, IDisposable {
  private _stmt: IModelJsNative.SqliteStatement | undefined;
  private _isShared: boolean = false;

  public get stmt() { return this._stmt; }

  /** used by statement cache */
  public setIsShared(b: boolean) { this._isShared = b; }

  /**  used by statement cache */
  public get isShared(): boolean { return this._isShared; }

  /** Check if this statement has been prepared successfully or not */
  public get isPrepared(): boolean { return undefined !== this._stmt; }

  /** Prepare this statement prior to first use.
   * @param db The DgnDb or ECDb to prepare the statement against
   * @param sql The SQL statement string to prepare
   * @throws [IModelError]($common) if the SQL statement cannot be prepared. Normally, prepare fails due to SQL syntax errors or references to tables or properties that do not exist.
   * The error.message property will provide details.
   */
  public prepare(db: IModelJsNative.DgnDb | IModelJsNative.ECDb, sql: string): void {
    if (this.isPrepared)
      throw new Error("SqliteStatement is already prepared");
    this._stmt = new IModelHost.platform.SqliteStatement();
    const stat: StatusCodeWithMessage<DbResult> = this._stmt.prepare(db, sql);
    if (stat.status !== DbResult.BE_SQLITE_OK)
      throw new IModelError(stat.status, stat.message);
  }

  /** Indicates whether the prepared statement makes no **direct* changes to the content of the file
   * or not. See [SQLite docs](https://www.sqlite.org/c3ref/stmt_readonly.html) for details.
   */
  public get isReadonly(): boolean {
    if (!this.isPrepared)
      throw new Error("SqliteStatement is not prepared.");

    return this._stmt!.isReadonly();
  }

  /** Reset this statement so that the next call to step will return the first row, if any.
   */
  public reset(): void {
    if (!this._stmt)
      throw new Error("SqliteStatement is not prepared");

    this._stmt.reset();
  }

  /** Call this function when finished with this statement. This releases the native resources held by the statement.
   *
   * > Do not call this method directly on a statement that is being managed by a statement cache.
   */
  public dispose(): void {
    if (this.isShared)
      throw new Error("Can't dispose a shared SqliteStatement");
    if (!this.isPrepared)
      return;
    this._stmt!.dispose(); // Tell the peer JS object to free its native resources immediately
    this._stmt = undefined; // discard the peer JS object as garbage
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
  public bindValue(parameter: number | string, value: any): void {
    let stat: DbResult;
    if (value === undefined || value === null) {
      stat = this._stmt!.bindNull(parameter);
    } else if (typeof (value) === "number") {
      if (Number.isInteger(value))
        stat = this._stmt!.bindInteger(parameter, value);
      else
        stat = this._stmt!.bindDouble(parameter, value);
    } else if (typeof (value) === "boolean") {
      stat = this._stmt!.bindInteger(parameter, value ? 1 : 0);
    } else if (typeof (value) === "string") {
      stat = this._stmt!.bindString(parameter, value);
    } else if (!!value.id) {
      stat = this._stmt!.bindId(parameter, value.id);
    } else if (!!value.guid) {
      stat = this._stmt!.bindGuid(parameter, value.guid);
    } else if (value instanceof Uint8Array) {
      stat = this._stmt!.bindBlob(parameter, value);
    } else
      throw new IModelError(DbResult.BE_SQLITE_ERROR, `Parameter value ${value} is of an unsupported data type.`);

    if (stat !== DbResult.BE_SQLITE_OK)
      throw new IModelError(stat, "Error in bindValue");
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
    const stat: DbResult = this._stmt!.clearBindings();
    if (stat !== DbResult.BE_SQLITE_OK)
      throw new IModelError(stat, "Error in clearBindings");
  }

  /** Step this statement to the next row.
   *
   *  For **SQL SELECT** statements the method returns
   *  - [DbResult.BE_SQLITE_ROW]($bentleyjs-core) if the statement now points successfully to the next row.
   *  - [DbResult.BE_SQLITE_DONE]($bentleyjs-core) if the statement has no more rows.
   *  - Error status in case of errors.
   *
   *  For **SQL INSERT, UPDATE, DELETE** statements the method returns
   *  - [DbResult.BE_SQLITE_DONE]($bentleyjs-core) if the statement has been executed successfully.
   *  - Error status in case of errors.
   */
  public step(): DbResult { return this._stmt!.step(); }

  /** Get the query result's column count (only for SQL SELECT statements). */
  public getColumnCount(): number { return this._stmt!.getColumnCount(); }

  /** Get the value for the column at the given index in the query result.
   * @param columnIx Index of SQL column in query result (0-based)
   */
  public getValue(columnIx: number): SqliteValue { return new SqliteValue(this._stmt!, columnIx); }

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
    const colCount: number = this.getColumnCount();
    const row: object = {};
    const duplicatePropNames = new Map<string, number>();
    for (let i = 0; i < colCount; i++) {
      const sqliteValue: SqliteValue = this.getValue(i);
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
    let jsName: string = ECJsNames.toJsName(sqliteValue.columnName);

    // now check duplicates. If there are, append a numeric suffix to the duplicates
    let suffix: number | undefined = duplicatePropNames.get(jsName);
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
    if (DbResult.BE_SQLITE_ROW === this.step()) {
      return {
        done: false,
        value: this.getRow(),
      };
    } else {
      return {
        done: true,
        value: undefined,
      };
    }
  }

  /** The iterator that will step through the results of this statement. */
  public [Symbol.iterator](): IterableIterator<any> { return this; }
}

/** Data type of a value in in an SQLite SQL query result.
 * See also:
 * - [SqliteValue]($backend)
 * - [SqliteStatement]($backend)
 * - [SqliteStatement.getValue]($backend)
 * @internal
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
 * @internal
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

  /** Get the value as BLOB */
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

/** A cached SqliteStatement. See [SqliteStatementCache]($backend) for details.
 * @internal
 */
export class CachedSqliteStatement {
  public statement: SqliteStatement;
  public useCount: number;

  /** @internal - used by statement cache */
  public constructor(stmt: SqliteStatement) {
    this.statement = stmt;
    this.useCount = 1;
  }
}

/** A cache for SqliteStatements. Preparing [SqliteStatement]($backend)s can be costly.
 * This class provides a way to save previously prepared SqliteStatements for reuse.
 * @internal
 */
export class SqliteStatementCache {
  private readonly _statements: Map<string, CachedSqliteStatement> = new Map<string, CachedSqliteStatement>();
  public readonly maxCount: number;

  public constructor(maxCount = Config.App.getNumber("imjs_sqlite_cache_size", 40)) { this.maxCount = maxCount; }

  public add(str: string, stmt: SqliteStatement): void {
    const existing = this._statements.get(str);
    if (existing !== undefined) {
      throw new Error("you should only add a statement if all existing copies of it are in use.");
    }
    const cs = new CachedSqliteStatement(stmt);
    cs.statement.setIsShared(true);
    this._statements.set(str, cs);
  }

  public getCount(): number { return this._statements.size; }

  public find(str: string): CachedSqliteStatement | undefined {
    return this._statements.get(str);
  }

  public release(stmt: SqliteStatement): void {
    for (const cs of this._statements) {
      const css = cs[1];
      if (css.statement === stmt) {
        if (css.useCount > 0) {
          css.useCount--;
          if (css.useCount === 0) {
            css.statement.reset();
            css.statement.clearBindings();
          }
        } else {
          throw new Error("double-release of cached SqliteStatement");
        }
        // leave the statement in the cache, even if its use count goes to zero. See removeUnusedStatements and clearOnClose.
        // *** TODO: we should remove it if it is a duplicate of another unused statement in the cache. The trouble is that we don't have the sql for the statement,
        //           so we can't check for other equivalent statements.
        break;
      }
    }
  }
  public replace(str: string, stmt: SqliteStatement) {
    if (stmt.isShared) {
      throw new Error("expecting a unshared statement");
    }
    const existingCS = this.find(str);
    if (existingCS) {
      existingCS.statement.setIsShared(false);
      this._statements.delete(str);
    }
    const newCS = new CachedSqliteStatement(stmt);
    newCS.statement.setIsShared(true);
    this._statements.set(str, newCS);
  }

  public removeUnusedStatementsIfNecessary(): void {
    if (this.getCount() <= this.maxCount)
      return;

    const keysToRemove = [];
    for (const cs of this._statements) {
      const css = cs[1];
      if (css.useCount === 0) {
        css.statement.setIsShared(false);
        css.statement.dispose();
        keysToRemove.push(cs[0]);
        if (keysToRemove.length >= this.maxCount)
          break;
      }
    }
    for (const k of keysToRemove) {
      this._statements.delete(k);
    }
  }

  public clear() {
    for (const cs of this._statements) {
      const stmt = cs[1].statement;
      if (stmt !== undefined) {
        stmt.setIsShared(false);
        stmt.dispose();
      }
    }
    this._statements.clear();
  }
}
