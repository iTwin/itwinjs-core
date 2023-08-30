/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module SQLiteDb
 */

import * as fs from "fs";
import { dirname } from "path";
import * as semver from "semver";
import { IModelJsNative } from "@bentley/imodeljs-native";
import { DbResult, OpenMode } from "@itwin/core-bentley";
import { LocalFileName } from "@itwin/core-common";
import { CloudSqlite } from "./CloudSqlite";
import { IModelHost } from "./IModelHost";
import { IModelJsFs } from "./IModelJsFs";
import { SqliteStatement, StatementCache } from "./SqliteStatement";

// cspell:ignore savepoint julianday rowid

/* eslint-disable @typescript-eslint/unified-signatures */

/**
 * A "generic" SQLiteDb. This class may be used to access local files or databases in a cloud container.
 * @public
 */
export class SQLiteDb {
  /** @internal */
  public readonly nativeDb = new IModelHost.platform.SQLiteDb();
  private _sqliteStatementCache = new StatementCache<SqliteStatement>();

  /** @internal */
  public static createBlobIO(): SQLiteDb.BlobIO {
    return new IModelHost.platform.BlobIO();
  }

  /** alias for closeDb.
   * @deprecated in 4.0, use [[closeDb]]
   */
  public dispose(): void {
    this.closeDb();
  }

  /** Create a SQLiteDb
   * @param dbName The path to the SQLiteDb file to create.
   */
  public createDb(dbName: string): void;
  /** @beta */
  public createDb(dbName: string, container?: CloudSqlite.CloudContainer, params?: SQLiteDb.CreateParams): void;
  public createDb(dbName: string, container?: CloudSqlite.CloudContainer, params?: SQLiteDb.CreateParams): void {
    this.nativeDb.createDb(dbName, container, params);
  }

  /** Open a SQLiteDb.
   * @param dbName The path to the SQLiteDb file to open
   */
  public openDb(dbName: string, openMode: OpenMode | SQLiteDb.OpenParams): void;
  /**
   * @param container optional CloudContainer holding database
   * @beta
   */
  public openDb(dbName: string, openMode: OpenMode | SQLiteDb.OpenParams, container?: CloudSqlite.CloudContainer): void;
  public openDb(dbName: string, openMode: OpenMode | SQLiteDb.OpenParams, container?: CloudSqlite.CloudContainer): void {
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

  /** Create a new table in this database. */
  protected createTable(args: {
    /** The name of the table to create. */
    tableName: string;
    /** all of the columns in the table. */
    columns: string;
    /** any unique or foreign key constraints */
    constraints?: string;
    /** if true, add a "lastMod" timestamp column and triggers to automatically update it. */
    addTimestamp?: boolean;
  }) {
    const timestampCol = args.addTimestamp ? ",lastMod TIMESTAMP NOT NULL DEFAULT(julianday('now'))" : "";
    const constraints = args.constraints ? `,${args.constraints}` : "";
    this.executeSQL(`CREATE TABLE ${args.tableName}(${args.columns}${timestampCol}${constraints})`);
    if (args.addTimestamp)
      this.executeSQL(`CREATE TRIGGER ${args.tableName}_timestamp AFTER UPDATE ON ${args.tableName} WHEN old.lastMod=new.lastMod AND old.lastMod != julianday('now') BEGIN UPDATE ${args.tableName} SET lastMod=julianday('now') WHERE rowid=new.rowid; END`);
  }

  /**
   * Get the last modified date for a row in a table of this database.
   * @note the table must have been created with `addTimestamp: true`
  */
  public readLastModTime(tableName: string, rowId: number): Date {
    return this.withSqliteStatement(`SELECT lastMod from ${tableName} WHERE rowid=?`, (stmt) => {
      stmt.bindInteger(1, rowId);
      return stmt.getValueDate(0);
    });
  }

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
  public async withLockedContainer<T>(args: CloudSqlite.LockAndOpenArgs, operation: () => Promise<T>) {
    return CloudSqlite.withWriteLock(args, async () => this.withOpenDb({ ...args, openMode: args.openMode ?? OpenMode.ReadWrite }, operation));
  }

  /** vacuum this database
   * @see https://www.sqlite.org/lang_vacuum.html
   */
  public vacuum(args?: SQLiteDb.VacuumDbArgs) {
    this.nativeDb.vacuum(args);
  }

  /** Commit the outermost transaction, writing changes to the file. Then, restart the default transaction. */
  public saveChanges(): void {
    this.nativeDb.saveChanges();
  }

  /** Abandon (cancel) the outermost transaction, discarding all changes since last save. Then, restart the default transaction. */
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
   * Prepare and execute a callback on a SQL statement. After the callback completes the statement is disposed.
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

/**
 * Abstract base class for a SQLite database that has [[SQLiteDb.RequiredVersionRanges]] stored in it.
 * This class provides version checking when the database is opened, to guarantee that a valid version of software is
 * always used for access.
 *
 * Notes:
 *  - This class may be used either to access a local file, or one stored in a cloud container.
 *  - Subclasses must provide a `myVersion` member indicating the version of its software, and implement the `createDDL` member to create its
 * tables.
 * @beta
 */
export abstract class VersionedSqliteDb extends SQLiteDb {
  protected static _versionProps = { namespace: "SQLiteDb", name: "versions" } as const;

  /** The current semver "persistence version" of this class.
   * @note This value should only be changed when logic in its code is modified in a way that affects the operation of extant copies.
   * If this value is outside of the range of accepted versions of a to-be-opened VersionedSqliteDb, the operation will fail. In this manner, if
   * changes are made to the format of a VersionedSqliteDb, or if bug fixes are necessary, the `requiredVersions` property in a VersionedSqliteDb may be updated
   * and immediately old versions of the package will refuse to open the VersionedSqliteDb, with a message to the user that they need to upgrade their
   * software. Likewise, if a new version of the package is asked to open an older VersionedSqliteDb that has not been upgraded to the lowest version
   * supported by it, the user will be informed that they need to upgrade their software.
   * @note this identifier is independent of versions in `package.json` files.
  */
  public abstract myVersion: string;

  /**
   * Change the "versions required to open this database" property stored in this database. After this call,
   * versions of software that don't meet the supplied ranges will fail.
   * @param versions the new versions required for reading and writing this database.
   * @note the database must be opened for write access.
   */
  public setRequiredVersions(versions: SQLiteDb.RequiredVersionRanges) {
    // NOTE: It might look tempting to just stringify the supplied `versions` object, but we only include required members - there may be others.
    this.nativeDb.saveFileProperty(VersionedSqliteDb._versionProps, JSON.stringify({ readVersion: versions.readVersion, writeVersion: versions.writeVersion }));
  }

  /** Get the required version ranges necessary to open this VersionedSqliteDb. */
  public getRequiredVersions() {
    const checkIsString = (value: any) => {
      if (typeof value !== "string")
        throw new Error(`CloudDb ${this.nativeDb.getFilePath()} has invalid "versions" property`);
      return value;
    };
    const versionJson = checkIsString(this.nativeDb.queryFileProperty(VersionedSqliteDb._versionProps, true));
    const versionRanges = JSON.parse(versionJson) as SQLiteDb.RequiredVersionRanges;
    checkIsString(versionRanges.readVersion);
    checkIsString(versionRanges.writeVersion);
    return versionRanges;
  }

  /**
   * Implement this method to create all tables for this subclass of `VersionedSqliteDb` when a new database file is created. Called from [[createNewDb]].
   */
  protected abstract createDDL(): void;

  /**
   * Create a new database file for the subclass of VersionedSqliteDb.
   * @param fileName the name of a local
   * @note The required versions are saved as [[myVersion]] or newer for both read and write.
   */
  public static createNewDb(fileName: LocalFileName) {
    const db = new (this as any)() as VersionedSqliteDb; // "as any" necessary because VersionedSqliteDb is abstract
    IModelJsFs.recursiveMkDirSync(dirname(fileName));
    if (fs.existsSync(fileName))
      fs.unlinkSync(fileName);

    db.createDb(fileName);
    db.createDDL();
    const minVer = `^${db.myVersion}`;
    db.setRequiredVersions({ readVersion: minVer, writeVersion: minVer });
    db.closeDb(true);
  }

  /**
   * Verify that this version of the software meets the required version range (as appropriate, read or write) stored in the database.
   * Throws otherwise.
   */
  protected verifyVersions() {
    const versions = this.getRequiredVersions();
    const isReadonly = this.isReadonly; // so we can tell read/write after the file is closed.
    const range = isReadonly ? versions.readVersion : versions.writeVersion;
    if (semver.satisfies(this.myVersion, range))
      return;

    this.closeDb();
    const tooNew = semver.gtr(this.myVersion, range);
    throw new Error(`${this.nativeDb.getFilePath()} requires ${tooNew ? "older" : "newer"} version of ${this.constructor.name} for ${isReadonly ? "read" : "write"}`);

  }

  /**
   * Open this database and verify that this version of the software meets the required version range (as appropriate, read or write) stored in the database.
   * Throws otherwise.
   * @see [[SqliteDb.openDb]] for argument types
   */
  public override openDb(dbName: string, openMode: OpenMode | SQLiteDb.OpenParams, container?: CloudSqlite.CloudContainer) {
    super.openDb(dbName, openMode, container);
    this.verifyVersions();
  }

  public async upgradeSchema(arg: { dbName: string, lockContainer?: { container: CloudSqlite.CloudContainer, user: string }, upgradeFn: () => void }) {
    // can't use "this" because it checks for version, which we don't want here
    return (arg.lockContainer) ?
      super.withLockedContainer({ dbName: arg.dbName, ...arg.lockContainer }, async () => arg.upgradeFn) :
      super.withOpenDb({ ...arg, openMode: OpenMode.ReadWrite }, arg.upgradeFn);
  }
}

/** @public */
export namespace SQLiteDb {
  /** A semver version range.
   * @see https://docs.npmjs.com/cli/v6/using-npm/semver
   */
  export type VersionRange = string;

  /**
   * A pair of semver [[SQLiteDb.VersionRange]]s, one for read and one for write, required to access a [[VersionedSqliteDb]].
   * If the version of the software attempting to read or write the database does not satisfy the range, access is denied.
   */
  export interface RequiredVersionRanges {
    /** a range of acceptable persistence versions for reading from a VersionedSqliteDb. */
    readonly readVersion: VersionRange;
    /** a range of acceptable persistence versions for writing to a VersionedSqliteDb. */
    readonly writeVersion: VersionRange;
  }

  /** interface for reading and writing to a blob in a SQLiteDb
   * @internal
   */
  export interface BlobIO {
    /** Close this BlobIO if it is opened.
       * @note this BlobIO *may* be reused after this call by calling `open` again.
      */
    close(): void;
    /** get the total number of bytes in the blob */
    getNumBytes(): number;
    /** @return true if this BlobIO was successfully opened and may be use to read or write the blob */
    isValid(): boolean;
    /** Open this BlobIO against a table/row/column in a Db */
    open(
      /** The database for the blob */
      db: IModelJsNative.AnyDb,
      args: {
        /** the name of the table for the blob*/
        tableName: string;
        /** the name of the column for the blob */
        columnName: string;
        /** The rowId of the blob */
        row: number;
        /** If true, open this BlobIO for write access */
        writeable?: boolean;
      }): void;
    /** Read from a blob
       * @returns the contents of the requested byte range
       */
    read(args: {
      /** The number of bytes to read */
      numBytes: number;
      /** starting offset within the blob to read */
      offset: number;
      /** If present and of sufficient size, use this ArrayBuffer for the value. */
      blob?: ArrayBuffer;
    }): Uint8Array;
    /** Reposition this BlobIO to a new rowId
       * @note this BlobIO must be valid when this methods is called.
       */
    changeRow(row: number): void;
    /** Write to a blob */
    write(args: {
      /** The number of bytes to write  */
      numBytes: number;
      /** starting offset within the blob to write */
      offset: number;
      /** the value to write */
      blob: ArrayBuffer;
    }): void;
  }

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

  /** Arguments for `SqliteDb.withOpenDb` */
  export interface WithOpenDbArgs {
    /** The name of the database to open */
    dbName: string;
    /** either an object with the open parameters or just OpenMode value. */
    openMode?: OpenMode | SQLiteDb.OpenParams;
    /** @internal */
    container?: CloudSqlite.CloudContainer;
  }

  /** Arguments for `SQLiteDb.vacuum` */
  export interface VacuumDbArgs extends PageSize {
    /** if present, name of new file to [vacuum into](https://www.sqlite.org/lang_vacuum.html) */
    into?: LocalFileName;
  }
}
