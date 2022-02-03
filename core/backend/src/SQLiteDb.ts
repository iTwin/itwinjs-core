/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module SQLiteDb
 */

import type { DbResult, IDisposable, OpenMode } from "@itwin/core-bentley";
import type { IModelJsNative } from "@bentley/imodeljs-native";
import { IModelHost } from "./IModelHost";
import { SqliteStatement, StatementCache } from "./SqliteStatement";

/** A SQLiteDb file
 * @public
 */
export class SQLiteDb implements IDisposable {
  private _nativeDb?: IModelJsNative.SQLiteDb;
  private _sqliteStatementCache = new StatementCache<SqliteStatement>();

  /** @internal */
  public get nativeDb(): IModelJsNative.SQLiteDb {
    return this._nativeDb!; // eslint-disable-line @typescript-eslint/no-non-null-assertion
  }

  constructor() {
    this._nativeDb = new IModelHost.platform.SQLiteDb();
  }
  /** Call this function when finished with this SQLiteDb. This releases the native resources */
  public dispose(): void {
    if (!this._nativeDb)
      return;

    this.closeDb();
    this._nativeDb.dispose();
    this._nativeDb = undefined;
  }

  /** Create a SQLiteDb
   * @param pathName The path to the SQLiteDb file to create.
   */
  public createDb(pathName: string): void {
    this.nativeDb.createDb(pathName);
  }

  /** Open a SQLiteDb.
   * @param pathName The path to the SQLiteDb file to open
   */
  public openDb(pathName: string, openMode: OpenMode): void {
    this.nativeDb.openDb(pathName, openMode);
  }

  /** Returns true if the SQLiteDb is open */
  public get isOpen(): boolean { return this.nativeDb.isOpen(); }

  /** Close SQLiteDb. */
  public closeDb(): void {
    this._sqliteStatementCache.clear();
    this.nativeDb.closeDb();
  }

  /** Commit the outermost transaction, writing changes to the file. Then, restart the transaction. */
  public saveChanges(): void {
    this.nativeDb.saveChanges();
  }

  /** Abandon (cancel) the outermost transaction, discarding all changes since last save. Then, restart the transaction. */
  public abandonChanges(): void {
    this.nativeDb.abandonChanges();
  }

  /**
     * Use a prepared SQL statement, potentially from the statement cache. If the requested statement doesn't exist
     * in the statement cache, a new statement is prepared. After the callback completes, the statement is reset and saved
     * in the statement cache so it can be reused in the future. Use this method for SQL statements that will be
     * reused often and are expensive to prepare. The statement cache holds the most recently used statements, discarding
     * the oldest statements as it fills. For statements you don't intend to reuse, instead use [[withSqliteStatement]].
     * @param sql The SQLite SQL statement to execute
     * @param callback the callback to invoke on the prepared statement
     * @returns the value returned by `callback`.
     * @see [[withPreparedStatement]]
     * @public
     */
  public withPreparedSqliteStatement<T>(sql: string, callback: (stmt: SqliteStatement) => T): T {
    const stmt = this._sqliteStatementCache.findAndRemove(sql) ?? this.prepareSqliteStatement(sql);
    const release = () => this._sqliteStatementCache.addOrDispose(stmt);
    try {
      const val: T = callback(stmt);
      if (val instanceof Promise) {
        val.then(release, release);
      } else {
        release();
      }
      return val;
    } catch (err) {
      release();
      throw err;
    }
  }

  /**
     * Prepared and execute a callback on a SQL statement. After the callback completes the statement is disposed.
     * Use this method for SQL statements are either not expected to be reused, or are not expensive to prepare.
     * For statements that will be reused often, instead use [[withPreparedSqliteStatement]].
     * @param sql The SQLite SQL statement to execute
     * @param callback the callback to invoke on the prepared statement
     * @returns the value returned by `callback`.
     * @public
     */
  public withSqliteStatement<T>(sql: string, callback: (stmt: SqliteStatement) => T): T {
    const stmt = this.prepareSqliteStatement(sql);
    const release = () => stmt.dispose();
    try {
      const val: T = callback(stmt);
      if (val instanceof Promise) {
        val.then(release, release);
      } else {
        release();
      }
      return val;
    } catch (err) {
      release();
      throw err;
    }
  }

  /** Prepare an SQL statement.
     * @param sql The SQLite SQL statement to prepare
     * @param logErrors Determine if errors are logged or not
     * @internal
     */
  public prepareSqliteStatement(sql: string, logErrors = true): SqliteStatement {
    const stmt = new SqliteStatement(sql);
    stmt.prepare(this.nativeDb, logErrors);
    return stmt;
  }

  /** execute an SQL statement */
  public executeSQL(sql: string): DbResult {
    const stmt = this.prepareSqliteStatement(sql);
    try {
      return stmt.step();
    } finally {
      stmt.dispose();
    }
  }
}
