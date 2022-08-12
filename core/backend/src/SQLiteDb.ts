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
   * @param saveChanges if true, call `saveChanges` before closing db.
   */
  public closeDb(saveChanges?: boolean): void {
    if (saveChanges && this.isOpen)
      this.saveChanges();
    this._sqliteStatementCache.clear();
    this.nativeDb.closeDb();
  }

  /** Returns true if the SQLiteDb is open */
  public get isOpen(): boolean { return this.nativeDb.isOpen(); }

  /**
   * 1. open a database
   * 2. call a function supplying the open SQliteDb as argument. If it is async, await its return.
   * 3. close the database (even if exceptions are thrown)
   * @internal - will be made public in 3.4.0.
   */
  public static withOpenDb<T>(args: {
    /** The name of the database to open */
    dbName: string;
    /** either an object with the open parameters or just OpenMode value. */
    openMode?: OpenMode | SQLiteDb.OpenParams;
    /** @internal */
    container?: SQLiteDb.CloudContainer;
  }, operation: (db: SQLiteDb) => T): T {
    const db = new SQLiteDb();
    db.openDb(args.dbName, args.openMode ?? OpenMode.Readonly, args.container);
    let fromPromise = false;

    try {
      const result = operation(db);
      if (result instanceof Promise) {
        fromPromise = true;
        const doClose = () => db.closeDb();
        result.then(doClose, doClose);
      }
      return result;
    } finally {
      if (!fromPromise)
        db.closeDb();
    }
  }

  /**
   * 1. acquire the write lock on a CloudContainer
   * 2. open a ReadWrite database in the container
   * 3. call a function with the opened database as an argument
   * 4. close the database
   * 5. release the write lock and upload changes.
   * @internal
   */
  public static async withLockedContainer(
    args: {
      /** the name to be displayed in the event of lock collisions */
      user: string;
      /** the name of the database within the container */
      dbName: string;
      /** the CloudContainer on which the operation will be performed */
      container: SQLiteDb.CloudContainer;
      /** if present, function called when the write lock is currently held by another user. */
      busyHandler?: CloudSqlite.WriteLockBusyHandler;
    },
    /** an asynchronous operation performed on the database with the write lock held. */
    operation: (db: SQLiteDb) => Promise<void>) {
    const fn = async () => SQLiteDb.withOpenDb({ ...args, openMode: OpenMode.ReadWrite }, operation);
    await CloudSqlite.withWriteLock(args.user, args.container, fn, args.busyHandler);
  }

  /** vacuum this database
   * @see https://www.sqlite.org/lang_vacuum.html
   */
  public vacuum(args?: {
    /** new page size
     * @see https://www.sqlite.org/pragma.html#pragma_page_size
     */
    pageSize?: number;
    /** if present, name of new file to vacuum into */
    into?: LocalFileName;
  }) {
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

  /** Parameters for creating a new SQLiteDb */
  export interface CreateParams extends OpenOrCreateParams {
    /** see https://www.sqlite.org/pragma.html#pragma_page_size */
    pageSize?: number;
  }

}
