/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ECDb
 */
import { assert, BeEvent, DbResult, Logger, OpenMode } from "@itwin/core-bentley";
import { IModelJsNative } from "@bentley/imodeljs-native";
import { DbQueryRequest, ECSchemaProps, ECSqlReader, IModelError, QueryBinder, QueryOptions } from "@itwin/core-common";
import { BackendLoggerCategory } from "./BackendLoggerCategory";
import { ConcurrentQuery } from "./ConcurrentQuery";
import { ECSqlStatement, ECSqlWriteStatement } from "./ECSqlStatement";
import { IModelNative } from "./internal/NativePlatform";
import { SqliteStatement, StatementCache } from "./SqliteStatement";
import { _nativeDb } from "./internal/Symbols";
import { ECSqlRowExecutor } from "./ECSqlRowExecutor";
import { ECSqlSyncReader, SynchronousQueryOptions } from "./ECSqlSyncReader";

const loggerCategory: string = BackendLoggerCategory.ECDb;

/** Modes for how to open [ECDb]($backend) files.
 * @public
 */
export enum ECDbOpenMode {
  Readonly,
  ReadWrite,
  /** Opens the file read-write and upgrades the file if necessary to the latest file format version. */
  FileUpgrade,
}

/** An ECDb file
 * @public
 */
export class ECDb implements Disposable {
  private _nativeDb?: IModelJsNative.ECDb;
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  private readonly _statementCache = new StatementCache<ECSqlStatement>();
  private _sqliteStatementCache = new StatementCache<SqliteStatement>();

  /** Event called when the ECDb is about to be closed. */
  public readonly onBeforeClose = new BeEvent<() => void>();

  /** only for tests
   * @internal
   */
  public resetSqliteCache(size: number) {
    this._sqliteStatementCache.clear();
    this._sqliteStatementCache = new StatementCache<SqliteStatement>(size);
  }

  constructor() {
    this._nativeDb = new IModelNative.platform.ECDb();
  }
  /** Call this function when finished with this ECDb object. This releases the native resources held by the
   *  ECDb object.
   */
  public [Symbol.dispose](): void {
    if (!this._nativeDb)
      return;

    this.closeDb();
    this._nativeDb.dispose();
    this._nativeDb = undefined;
  }
  /**
   * Attach an iModel file to this connection and load and register its schemas.
   * @note There are some reserve tablespace names that cannot be used. They are 'main', 'schema_sync_db', 'ecchange' & 'temp'
   * @param fileName IModel file name
   * @param alias identifier for the attached file. This identifer is used to access schema from the attached file. e.g. if alias is 'abc' then schema can be accessed using 'abc.MySchema.MyClass'
   */
  public attachDb(fileName: string, alias: string): void {
    if (alias.toLowerCase() === "main" || alias.toLowerCase() === "schema_sync_db" || alias.toLowerCase() === "ecchange" || alias.toLowerCase() === "temp") {
      throw new IModelError(DbResult.BE_SQLITE_ERROR, "Reserved tablespace name cannot be used");
    }
    this[_nativeDb].attachDb(fileName, alias);
  }
  /**
   * Detach the attached file from this connection. The attached file is closed and its schemas are unregistered.
   * @note There are some reserve tablespace names that cannot be used. They are 'main', 'schema_sync_db', 'ecchange' & 'temp'
   * @param alias identifer that was used in the call to [[attachDb]]
   */
  public detachDb(alias: string): void {
    if (alias.toLowerCase() === "main" || alias.toLowerCase() === "schema_sync_db" || alias.toLowerCase() === "ecchange" || alias.toLowerCase() === "temp") {
      throw new IModelError(DbResult.BE_SQLITE_ERROR, "Reserved tablespace name cannot be used");
    }
    this.clearCaches();
    this[_nativeDb].detachDb(alias);
  }

  /** @deprecated in 5.0 - will not be removed until after 2026-06-13. Use [Symbol.dispose] instead. */
  public dispose(): void {
    this[Symbol.dispose]();
  }

  /** Create an ECDb
   * @param pathName The path to the ECDb file to create.
   * @throws [IModelError]($common) if the operation failed.
   */
  public createDb(pathName: string): void {
    const status: DbResult = this[_nativeDb].createDb(pathName);
    if (status !== DbResult.BE_SQLITE_OK)
      throw new IModelError(status, "Failed to created ECDb");
  }

  /** Open the ECDb.
   * @param pathName The path to the ECDb file to open
   * @param openMode Open mode
   * @throws [IModelError]($common) if the operation failed.
   */
  public openDb(pathName: string, openMode: ECDbOpenMode = ECDbOpenMode.Readonly): void {
    const nativeOpenMode: OpenMode = openMode === ECDbOpenMode.Readonly ? OpenMode.Readonly : OpenMode.ReadWrite;
    const tryUpgrade: boolean = openMode === ECDbOpenMode.FileUpgrade;
    const status: DbResult = this[_nativeDb].openDb(pathName, nativeOpenMode, tryUpgrade);
    if (status !== DbResult.BE_SQLITE_OK)
      throw new IModelError(status, "Failed to open ECDb");
  }

  /** Returns true if the ECDb is open */
  public get isOpen(): boolean { return this[_nativeDb].isOpen(); }

  /** Close the Db after saving any uncommitted changes.
   * @throws [IModelError]($common) if the database is not open.
   */
  public closeDb(): void {
    this.onBeforeClose.raiseEvent();
    this.clearCaches();
    this[_nativeDb].closeDb();
  }

  /** Clear all in-memory caches held in this ECDb.
   * @beta
  */
  public clearCaches(): void {
    this._statementCache.clear();
    this._sqliteStatementCache.clear();
    this[_nativeDb].clearECDbCache();
  }

  /** @internal use to test statement caching */
  public clearStatementCache() {
    this._statementCache.clear();
  }

  /** @internal use to test statement caching */
  public getCachedStatementCount() {
    return this._statementCache.size;
  }

  /** Commit the outermost transaction, writing changes to the file. Then, restart the transaction.
   * @param changesetName The name of the operation that generated these changes.
   * @throws [IModelError]($common) if the database is not open or if the operation failed.
   */
  public saveChanges(changesetName?: string): void {
    const status: DbResult = this[_nativeDb].saveChanges(changesetName);
    if (status !== DbResult.BE_SQLITE_OK)
      throw new IModelError(status, "Failed to save changes");
  }

  /** Abandon (cancel) the outermost transaction, discarding all changes since last save. Then, restart the transaction.
   * @throws [IModelError]($common) if the database is not open or if the operation failed.
   */
  public abandonChanges(): void {
    const status: DbResult = this[_nativeDb].abandonChanges();
    if (status !== DbResult.BE_SQLITE_OK)
      throw new IModelError(status, "Failed to abandon changes");
  }

  /** Import a schema.
   *
   * If the import was successful, the database is automatically saved to disk.
   * @param pathName Path to ECSchema XML file to import.
   * @throws [IModelError]($common) if the database is not open or if the operation failed.
   */
  public importSchema(pathName: string): void {
    const status: DbResult = this[_nativeDb].importSchema(pathName);
    if (status !== DbResult.BE_SQLITE_OK) {
      Logger.logError(loggerCategory, `Failed to import schema from '${pathName}'.`);
      throw new IModelError(status, `Failed to import schema from '${pathName}'.`);
    }
    this.clearCaches();
  }

  /** Removes unused schemas from the database.
   *
   * If the removal was successful, the database is automatically saved to disk.
   * @param schemaNames Array of schema names to drop
   * @throws [IModelError]($common) if the database if the operation failed.
   * @alpha
   */
  public dropSchemas(schemaNames: string[]): void {
    if (schemaNames.length === 0)
      return;
    if (this[_nativeDb].schemaSyncEnabled())
      throw new IModelError(DbResult.BE_SQLITE_ERROR, "Cannot drop schemas when schema sync is enabled");

    try {
      this[_nativeDb].dropSchemas(schemaNames);
      this.saveChanges('dropped unused schemas');
    } catch (error: any) {
      Logger.logError(loggerCategory, `Failed to drop schemas: ${error}`);
      this.abandonChanges();
      throw new IModelError(DbResult.BE_SQLITE_ERROR, `Failed to drop schemas: ${error}`);
    } finally {
      this.clearCaches();
    }
  }

  /**
   * Returns the full schema for the input name.
   * @param name The name of the schema e.g. 'ECDbMeta'
   * @returns The SchemaProps for the requested schema
   * @throws if the schema can not be found or loaded.
   */
  public getSchemaProps(name: string): ECSchemaProps {
    return this[_nativeDb].getSchemaProps(name);
  }

  /**
   * Use a prepared ECSQL statement, potentially from the statement cache. If the requested statement doesn't exist
   * in the statement cache, a new statement is prepared. After the callback completes, the statement is reset and saved
   * in the statement cache so it can be reused in the future. Use this method for ECSQL statements that will be
   * reused often and are expensive to prepare. The statement cache holds the most recently used statements, discarding
   * the oldest statements as it fills. For statements you don't intend to reuse, instead use [[withStatement]].
   * @param sql The SQLite SQL statement to execute
   * @param callback the callback to invoke on the prepared statement
   * @param logErrors Determines if error will be logged if statement fail to prepare
   * @returns the value returned by `callback`.
   * @see [[withWriteStatement]]
   * @beta
   */
  public withCachedWriteStatement<T>(ecsql: string, callback: (stmt: ECSqlWriteStatement) => T, logErrors = true): T {
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    const stmt = this._statementCache.findAndRemove(ecsql) ?? this.prepareStatement(ecsql, logErrors);
    const release = () => this._statementCache.addOrDispose(stmt);
    try {
      const val = callback(new ECSqlWriteStatement(stmt));
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
   * Prepared and execute a callback on an ECSQL statement. After the callback completes the statement is disposed.
   * Use this method for ECSQL statements are either not expected to be reused, or are not expensive to prepare.
   * For statements that will be reused often, instead use [[withPreparedStatement]].
   * @param sql The SQLite SQL statement to execute
   * @param callback the callback to invoke on the prepared statement
   * @param logErrors Determines if error will be logged if statement fail to prepare
   * @returns the value returned by `callback`.
   * @see [[withCachedWriteStatement]]
   * @beta
   */
  public withWriteStatement<T>(ecsql: string, callback: (stmt: ECSqlWriteStatement) => T, logErrors = true): T {
    const stmt = this.prepareWriteStatement(ecsql, logErrors);
    const release = () => stmt[Symbol.dispose]();
    try {
      const val = callback(stmt);
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

  /** Prepare an ECSQL statement.
  * @param ecsql The ECSQL statement to prepare
  * @param logErrors Determines if error will be logged if statement fail to prepare
  * @throws [IModelError]($common) if there is a problem preparing the statement.
  * @beta
  */
  public prepareWriteStatement(ecsql: string, logErrors = true): ECSqlWriteStatement {
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    return new ECSqlWriteStatement(this.prepareStatement(ecsql, logErrors));
  }

  /**
   * Use a prepared ECSQL statement, potentially from the statement cache. If the requested statement doesn't exist
   * in the statement cache, a new statement is prepared. After the callback completes, the statement is reset and saved
   * in the statement cache so it can be reused in the future. Use this method for ECSQL statements that will be
   * reused often and are expensive to prepare. The statement cache holds the most recently used statements, discarding
   * the oldest statements as it fills. For statements you don't intend to reuse, instead use [[withStatement]].
   * @param sql The SQLite SQL statement to execute
   * @param callback the callback to invoke on the prepared statement
   * @param logErrors Determines if error will be logged if statement fail to prepare
   * @returns the value returned by `callback`.
   * @see [[withStatement]]
   * @public
   * @deprecated in 4.11 - will not be removed until after 2026-06-13.  Use [[createQueryReader]] for SELECT statements and [[withCachedWriteStatement]] for INSERT/UPDATE/DELETE instead.
   */
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  public withPreparedStatement<T>(ecsql: string, callback: (stmt: ECSqlStatement) => T, logErrors = true): T {
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    const stmt = this._statementCache.findAndRemove(ecsql) ?? this.prepareStatement(ecsql, logErrors);
    const release = () => this._statementCache.addOrDispose(stmt);
    try {
      const val = callback(stmt);
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
   * Prepared and execute a callback on an ECSQL statement. After the callback completes the statement is disposed.
   * Use this method for ECSQL statements are either not expected to be reused, or are not expensive to prepare.
   * For statements that will be reused often, instead use [[withPreparedStatement]].
   * @param sql The SQLite SQL statement to execute
   * @param callback the callback to invoke on the prepared statement
   * @param logErrors Determines if error will be logged if statement fail to prepare
   * @returns the value returned by `callback`.
   * @see [[withPreparedStatement]]
   * @public
   * @deprecated in 4.11 - will not be removed until after 2026-06-13.  Use [[createQueryReader]] for SELECT statements and [[withWriteStatement]] for INSERT/UPDATE/DELETE instead.
   */
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  public withStatement<T>(ecsql: string, callback: (stmt: ECSqlStatement) => T, logErrors = true): T {
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    const stmt = this.prepareStatement(ecsql, logErrors);
    const release = () => stmt[Symbol.dispose]();
    try {
      const val = callback(stmt);
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

  /** Prepare an ECSQL statement.
   * @param ecsql The ECSQL statement to prepare
   * @param logErrors Determines if error will be logged if statement fail to prepare
   * @throws [IModelError]($common) if there is a problem preparing the statement.
   * @deprecated in 4.11 - will not be removed until after 2026-06-13.  Use [[prepareWriteStatement]] when preparing an INSERT/UPDATE/DELETE statement or [[createQueryReader]] to execute a SELECT statement.
   */
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  public prepareStatement(ecsql: string, logErrors = true): ECSqlStatement {
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    const stmt = new ECSqlStatement();
    stmt.prepare(this[_nativeDb], ecsql, logErrors);
    return stmt;
  }

  /**
   * Use a prepared SQL statement, potentially from the statement cache. If the requested statement doesn't exist
   * in the statement cache, a new statement is prepared. After the callback completes, the statement is reset and saved
   * in the statement cache so it can be reused in the future. Use this method for SQL statements that will be
   * reused often and are expensive to prepare. The statement cache holds the most recently used statements, discarding
   * the oldest statements as it fills. For statements you don't intend to reuse, instead use [[withSqliteStatement]].
   * @param sql The SQLite SQL statement to execute
   * @param callback the callback to invoke on the prepared statement
   * @param logErrors Determines if error will be logged if statement fail to prepare
   * @returns the value returned by `callback`.
   * @see [[withPreparedStatement]]
   * @public
   */
  public withPreparedSqliteStatement<T>(sql: string, callback: (stmt: SqliteStatement) => T, logErrors = true): T {
    const stmt = this._sqliteStatementCache.findAndRemove(sql) ?? this.prepareSqliteStatement(sql, logErrors);
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
   * @param logErrors Determines if error will be logged if statement fail to prepare
   * @returns the value returned by `callback`.
   * @public
   */
  public withSqliteStatement<T>(sql: string, callback: (stmt: SqliteStatement) => T, logErrors = true): T {
    const stmt = this.prepareSqliteStatement(sql, logErrors);
    const release = () => stmt[Symbol.dispose]();
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
   * @param logErrors Determines if error will be logged if statement fail to prepare
   * @throws [IModelError]($common) if there is a problem preparing the statement.
   * @internal
   */
  public prepareSqliteStatement(sql: string, logErrors = true): SqliteStatement {
    const stmt = new SqliteStatement(sql);
    stmt.prepare(this[_nativeDb], logErrors);
    return stmt;
  }

  /** @internal */
  public get [_nativeDb](): IModelJsNative.ECDb {
    assert(undefined !== this._nativeDb);
    return this._nativeDb;
  }

  /** Allow to execute query and read results along with meta data. The result are streamed.
   *
   * See also:
   * - [ECSQL Overview]($docs/learning/backend/ExecutingECSQL)
   * - [Code Examples]($docs/learning/backend/ECSQLCodeExamples)
   * - [ECSQL Row Format]($docs/learning/ECSQLRowFormat)
   *
   * @param params The values to bind to the parameters (if the ECSQL has any).
   * @param config Allow to specify certain flags which control how query is executed.
   * @returns Returns an [ECSqlReader]($common) which helps iterate over the result set and also give access to metadata.
   * @public
   * */
  public createQueryReader(ecsql: string, params?: QueryBinder, config?: QueryOptions): ECSqlReader {
    if (!this._nativeDb || !this._nativeDb.isOpen()) {
      throw new IModelError(DbResult.BE_SQLITE_ERROR, "db not open");
    }
    const executor = {
      execute: async (request: DbQueryRequest) => {
        return ConcurrentQuery.executeQueryRequest(this[_nativeDb], request);
      },
    };
    return new ECSqlReader(executor, ecsql, params, config);
  }

  /** Allow to execute query and read results along with meta data. The result are stepped one by one.
   *
   * See also:
   * - [ECSQL Overview]($docs/learning/backend/ExecutingECSQL)
   * - [Code Examples]($docs/learning/backend/ECSQLCodeExamples)
   * - [ECSQL Row Format]($docs/learning/ECSQLRowFormat)
   * @param ecsql The ECSQL query to execute.
   * @param callback the callback to invoke on the prepared ECSqlSyncReader
   * @param params The values to bind to the parameters (if the ECSQL has any).
   * @param config Allow to specify certain flags which control how query is executed.
   * @returns the value returned by `callback`.
   * @beta
   * */
  public withQueryReader<T>(ecsql: string, callback: (reader: ECSqlSyncReader) => T, params?: QueryBinder, config?: SynchronousQueryOptions): T {
    if (!this[_nativeDb].isOpen())
      throw new IModelError(DbResult.BE_SQLITE_ERROR, "db not open");

    const executor = new ECSqlRowExecutor(this);
    const reader = new ECSqlSyncReader(executor, ecsql, params, config);
    const release = () => reader[Symbol.dispose]();
    try {
      const val = callback(reader);
      if (val instanceof Promise) {
        val.then(release, release);
      } else {
        release();
      }
      return val;
    } catch (err: any) {
      release();
      throw err;
    }
  }
}
