/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module SQLiteDb
 */

import { CloudSqlite, IModelJsNative } from "@bentley/imodeljs-native";
import { DbResult, IDisposable, OpenMode } from "@itwin/core-bentley";
import { LocalFileName } from "@itwin/core-common";
import { IModelHost } from "./IModelHost";
import { SqliteStatement, StatementCache } from "./SqliteStatement";

// cspell:ignore savepoint
/* eslint-disable @typescript-eslint/unified-signatures */

/** A SQLiteDb file
 * @public
 */
export class SQLiteDb implements IDisposable {
  /** @internal */
  public readonly nativeDb = new IModelHost.platform.SQLiteDb();
  private _sqliteStatementCache = new StatementCache<SqliteStatement>();

  /** @internal */
  public static createCloudContainer(args: CloudSqlite.ContainerAccessProps): SQLiteDb.CloudContainer {
    return new IModelHost.platform.CloudContainer(args);
  }
  /** @internal */
  public static createCloudCache(args: CloudSqlite.CacheProps): SQLiteDb.CloudCache {
    return new IModelHost.platform.CloudCache(args);
  }
  /** @internal */
  public static startCloudPrefetch(container: SQLiteDb.CloudContainer, dbName: string, args?: CloudSqlite.PrefetchProps): SQLiteDb.CloudPrefetch {
    return new IModelHost.platform.CloudPrefetch(container, dbName, args);
  }
  /** @internal */
  public static createBlobIO(): SQLiteDb.BlobIO {
    return new IModelHost.platform.BlobIO();
  }

  /** alias for closeDb. */
  public dispose(): void {
    this.closeDb();
  }

  /** Create a SQLiteDb
   * @param dbName The path to the SQLiteDb file to create.
   */
  public createDb(dbName: string, container?: SQLiteDb.CloudContainer, params?: SQLiteDb.CreateParams): void {
    this.nativeDb.createDb(dbName, container, params);
  }

  /** Open a SQLiteDb.
   * @param dbName The path to the SQLiteDb file to open
   */
  public openDb(dbName: string, openMode: OpenMode | SQLiteDb.OpenParams): void;
  /**
   * @param container optional CloudContainer holding database
   * @internal
   */
  public openDb(dbName: string, openMode: OpenMode | SQLiteDb.OpenParams, container?: SQLiteDb.CloudContainer): void;

  /** @internal */
  public openDb(dbName: string, openMode: OpenMode | SQLiteDb.OpenParams, container?: SQLiteDb.CloudContainer): void {
    this.nativeDb.openDb(dbName, openMode, container);
  }

  /** Close SQLiteDb.
   * @param saveChanges if true, call `saveChanges` before closing db. Otherwise unsaved changes are abandoned.
   */
  public closeDb(saveChanges?: boolean): void {
    if (saveChanges && this.isOpen)
      this.saveChanges();
    this._sqliteStatementCache.clear();
    this.nativeDb.closeDb();
  }

  /** Returns true if this SQLiteDb is open */
  public get isOpen(): boolean { return this.nativeDb.isOpen(); }

  /** Returns true if this SQLiteDb is open readonly */
  public get isReadonly(): boolean { return this.nativeDb.isReadonly(); }

  /**
   * Open a database, perform an operation, then close the database.
   *
   * Details:
   * - if database is open, throw an error
   * - open a database
   * - call a function with the database opened. If it is async, await its return.
   * - if function throws, abandon all changes, close database, and rethrow
   * - save all changes
   * - close the database
   * @return value from operation
   */
  public withOpenDb<T>(args: SQLiteDb.WithOpenDbArgs, operation: () => T): T {
    if (this.isOpen)
      throw new Error("database is already open");

    const save = () => this.closeDb(true), abandon = () => this.closeDb(false);
    this.openDb(args.dbName, args.openMode ?? OpenMode.Readonly, args.container);
    try {
      const result = operation();
      result instanceof Promise ? result.then(save, abandon) : save();
      return result;
    } catch (e) {
      abandon();
      throw e;
    }
  }

  /**
   * Perform an operation on a database in a CloudContainer with the write lock held.
   *
   * Details:
   * - acquire the write lock on a CloudContainer
   * - call `withOpenDb` with openMode `ReadWrite`
   * - upload changes
   * - release the write lock
   * @param args arguments to lock the container and open the database
   * @param operation an operation performed on the database with the write lock held.
   * @return value from operation
   * @internal
   */
  public async withLockedContainer<T>(args: SQLiteDb.LockAndOpenArgs, operation: () => T) {
    return CloudSqlite.withWriteLock(args.user, args.container, () => this.withOpenDb({ ...args, openMode: OpenMode.ReadWrite }, operation), args.busyHandler);
  }

  /** vacuum this database
   * @see https://www.sqlite.org/lang_vacuum.html
   */
  public vacuum(args?: SQLiteDb.VacuumDbArgs) {
    this.nativeDb.vacuum(args);
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
   */
  public withPreparedSqliteStatement<T>(sql: string, callback: (stmt: SqliteStatement) => T): T {
    const stmt = this._sqliteStatementCache.findAndRemove(sql) ?? this.prepareSqliteStatement(sql);
    const release = () => this._sqliteStatementCache.addOrDispose(stmt);
    try {
      const val = callback(stmt);
      val instanceof Promise ? val.then(release, release) : release();
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
   */
  public withSqliteStatement<T>(sql: string, callback: (stmt: SqliteStatement) => T): T {
    const stmt = this.prepareSqliteStatement(sql);
    const release = () => stmt.dispose();
    try {
      const val = callback(stmt);
      val instanceof Promise ? val.then(release, release) : release();
      return val;
    } catch (err) {
      release();
      throw err;
    }
  }

  /**
   * Perform an operation on this database within a [savepoint](https://www.sqlite.org/lang_savepoint.html). If the operation completes successfully, the
   * changes remain in the current transaction. If the operation throws an exception, the savepoint is rolled back
   * and all changes to the database from this method are reversed, leaving the transaction exactly as it was before this method.
   */
  public withSavePoint(savePointName: string, operation: () => void) {
    if (this.isReadonly)
      throw new Error("database is readonly");

    this.executeSQL(`SAVEPOINT ${savePointName}`);
    try {
      operation();
      this.executeSQL(`RELEASE ${savePointName}`);
    } catch (e) {
      this.executeSQL(`ROLLBACK TO ${savePointName}`);
      throw e;
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

/** @public */
export namespace SQLiteDb {
  /** A CloudSqlite container that may be connected to a CloudCache.
   * @internal
   */
  export type CloudContainer = IModelJsNative.CloudContainer;
  /** @internal */
  export type CloudCache = IModelJsNative.CloudCache;
  /** @internal */
  export type CloudPrefetch = IModelJsNative.CloudPrefetch;
  /** Incremental IO for blobs
   * @internal
   */
  export type BlobIO = IModelJsNative.BlobIO;

  /** Default transaction mode for SQLiteDbs.
     * @see https://www.sqlite.org/lang_transaction.html
    */
  export enum DefaultTxnMode {
    /** no default transaction is started. You must use BEGIN/COMMIT or SQLite will use implicit transactions */
    None = 0,
    /** A deferred transaction is started when the file is first opened. This is the default. */
    Deferred = 1,
    /** An immediate transaction is started when the file is first opened. */
    Immediate = 2,
    /** An exclusive transaction is started when the file is first opened. */
    Exclusive = 3
  }

  /** parameters common to opening or creating a new SQLiteDb */
  export interface OpenOrCreateParams {
    /** If true, do not require that the `be_Prop` table exist */
    rawSQLite?: boolean;
    /** @see immutable option at https://www.sqlite.org/c3ref/open.html */
    immutable?: boolean;
    /** Do not attempt to verify that the file is a valid sQLite file before opening. */
    skipFileCheck?: boolean;
    /** the default transaction mode
     * @see [[SQLiteDb.DefaultTxnMode]]
    */
    defaultTxn?: 0 | 1 | 2 | 3;
    /** see query parameters from 'URI Filenames' in  https://www.sqlite.org/c3ref/open.html */
    queryParam?: string;
  }

  /** Parameters for opening an existing SQLiteDb */
  export interface OpenParams extends OpenOrCreateParams {
    /** use OpenMode.ReadWrite to open the file with write access */
    openMode: OpenMode;
  }

  /** Size of a SQLiteDb page in bytes */
  export interface PageSize {
    /** see https://www.sqlite.org/pragma.html#pragma_page_size */
    pageSize?: number;
  }

  /** Parameters for creating a new SQLiteDb */
  export type CreateParams = OpenOrCreateParams & PageSize;

  /** Parameters used to obtain the write lock on a cloud container
   * @internal
   */
  export interface ObtainLockParams {
    /** The name of the user attempting to acquire the write lock. This name will be shown to other users while the lock is held. */
    user?: string;
    /** number of times to retry in the event the lock currently held by someone else.
   * After this number of attempts, `onFailure` is called. Default is 20.
   */
    nRetries: number;
    /** Delay between retries, in milliseconds. Default is 100. */
    retryDelayMs: number;
    /** function called if lock cannot be obtained after all retries. It is called with the name of the user currently holding the lock and
   * generally is expected that the user will be consulted whether to wait further.
   * If this function returns "stop", an exception will be thrown. Otherwise the retry cycle is restarted. */
    onFailure?: CloudSqlite.WriteLockBusyHandler;
  }

  /** @internal */
  export interface LockAndOpenArgs {
    /** the name to be displayed in the event of lock collisions */
    user: string;
    /** the name of the database within the container */
    dbName: string;
    /** the CloudContainer on which the operation will be performed */
    container: SQLiteDb.CloudContainer;
    /** if present, function called when the write lock is currently held by another user. */
    busyHandler?: CloudSqlite.WriteLockBusyHandler;
  }

  /** Arguments for `SqliteDb.withOpenDb` */
  export interface WithOpenDbArgs {
    /** The name of the database to open */
    dbName: string;
    /** either an object with the open parameters or just OpenMode value. */
    openMode?: OpenMode | SQLiteDb.OpenParams;
    /** @internal */
    container?: SQLiteDb.CloudContainer;
  }

  /** Arguments for `SQLiteDb.vacuum` */
  export interface VacuumDbArgs extends PageSize {
    /** if present, name of new file to [vacuum into](https://www.sqlite.org/lang_vacuum.html) */
    into?: LocalFileName;
  }
}
