/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ECDb
 */
import { assert, DbResult, IDisposable, Logger, OpenMode } from "@itwin/core-bentley";
import { IModelJsNative } from "@bentley/imodeljs-native";
import { DbQueryRequest, ECSqlReader, IModelError, QueryBinder, QueryOptions, QueryOptionsBuilder } from "@itwin/core-common";
import { BackendLoggerCategory } from "./BackendLoggerCategory";
import { ConcurrentQuery } from "./ConcurrentQuery";
import { ECSqlStatement } from "./ECSqlStatement";
import { IModelHost } from "./IModelHost";
import { SqliteStatement, StatementCache } from "./SqliteStatement";

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
export class ECDb implements IDisposable {
  private _nativeDb?: IModelJsNative.ECDb;
  private readonly _statementCache = new StatementCache<ECSqlStatement>();
  private _sqliteStatementCache = new StatementCache<SqliteStatement>();

  /** only for tests
   * @internal
   */
  public resetSqliteCache(size: number) {
    this._sqliteStatementCache.clear();
    this._sqliteStatementCache = new StatementCache<SqliteStatement>(size);
  }

  constructor() {
    this._nativeDb = new IModelHost.platform.ECDb();
  }
  /** Call this function when finished with this ECDb object. This releases the native resources held by the
   *  ECDb object.
   */
  public dispose(): void {
    if (!this._nativeDb)
      return;

    this.closeDb();
    this._nativeDb.dispose();
    this._nativeDb = undefined;
  }

  /** Create an ECDb
   * @param pathName The path to the ECDb file to create.
   * @throws [IModelError]($common) if the operation failed.
   */
  public createDb(pathName: string): void {
    const status: DbResult = this.nativeDb.createDb(pathName);
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
    const status: DbResult = this.nativeDb.openDb(pathName, nativeOpenMode, tryUpgrade);
    if (status !== DbResult.BE_SQLITE_OK)
      throw new IModelError(status, "Failed to open ECDb");
  }

  /** Returns true if the ECDb is open */
  public get isOpen(): boolean { return this.nativeDb.isOpen(); }

  /** Close the Db after saving any uncommitted changes.
   * @throws [IModelError]($common) if the database is not open.
   */
  public closeDb(): void {
    this._statementCache.clear();
    this._sqliteStatementCache.clear();
    this.nativeDb.closeDb();
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
    const status: DbResult = this.nativeDb.saveChanges(changesetName);
    if (status !== DbResult.BE_SQLITE_OK)
      throw new IModelError(status, "Failed to save changes");
  }

  /** Abandon (cancel) the outermost transaction, discarding all changes since last save. Then, restart the transaction.
   * @throws [IModelError]($common) if the database is not open or if the operation failed.
   */
  public abandonChanges(): void {
    const status: DbResult = this.nativeDb.abandonChanges();
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
    const status: DbResult = this.nativeDb.importSchema(pathName);
    if (status !== DbResult.BE_SQLITE_OK) {
      Logger.logError(loggerCategory, `Failed to import schema from '${pathName}'.`);
      throw new IModelError(status, `Failed to import schema from '${pathName}'.`);
    }
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
   */
  public withPreparedStatement<T>(ecsql: string, callback: (stmt: ECSqlStatement) => T, logErrors = true): T {
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
   */
  public withStatement<T>(ecsql: string, callback: (stmt: ECSqlStatement) => T, logErrors = true): T {
    const stmt = this.prepareStatement(ecsql, logErrors);
    const release = () => stmt.dispose();
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
   */
  public prepareStatement(ecsql: string, logErrors = true): ECSqlStatement {
    const stmt = new ECSqlStatement();
    stmt.prepare(this.nativeDb, ecsql, logErrors);
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
   * @param logErrors Determines if error will be logged if statement fail to prepare
   * @throws [IModelError]($common) if there is a problem preparing the statement.
   * @internal
   */
  public prepareSqliteStatement(sql: string, logErrors = true): SqliteStatement {
    const stmt = new SqliteStatement(sql);
    stmt.prepare(this.nativeDb, logErrors);
    return stmt;
  }

  /** @internal */
  public get nativeDb(): IModelJsNative.ECDb {
    assert(undefined !== this._nativeDb);
    return this._nativeDb;
  }

  /** Allow to execute query and read results along with meta data. The result are streamed.
   * @param params The values to bind to the parameters (if the ECSQL has any).
   * @param config Allow to specify certain flags which control how query is executed.
   * @returns Returns *ECSqlQueryReader* which help iterate over result set and also give access to meta data.
   * @beta
   * */
  public createQueryReader(ecsql: string, params?: QueryBinder, config?: QueryOptions): ECSqlReader {
    if (!this._nativeDb || !this._nativeDb.isOpen()) {
      throw new IModelError(DbResult.BE_SQLITE_ERROR, "db not open");
    }
    const executor = {
      execute: async (request: DbQueryRequest) => {
        return ConcurrentQuery.executeQueryRequest(this.nativeDb, request);
      },
    };
    return new ECSqlReader(executor, ecsql, params, config);
  }

  /** Execute a query and stream its results
   * The result of the query is async iterator over the rows. The iterator will get next page automatically once rows in current page has been read.
   * [ECSQL row]($docs/learning/ECSQLRowFormat).
   *
   * See also:
   * - [ECSQL Overview]($docs/learning/backend/ExecutingECSQL)
   * - [Code Examples]($docs/learning/backend/ECSQLCodeExamples)
   *
   * @param ecsql The ECSQL statement to execute
   * @param params The values to bind to the parameters (if the ECSQL has any).
   * @param options Allow to specify certain flags which control how query is executed.
   * @returns Returns the query result as an *AsyncIterableIterator<any>*  which lazy load result as needed. The row format is determined by *rowFormat* parameter.
   * See [ECSQL row format]($docs/learning/ECSQLRowFormat) for details about the format of the returned rows.
   * @throws [IModelError]($common) If there was any error while submitting, preparing or stepping into query
   */
  public async * query(ecsql: string, params?: QueryBinder, options?: QueryOptions): AsyncIterableIterator<any> {
    const builder = new QueryOptionsBuilder(options);
    const reader = this.createQueryReader(ecsql, params, builder.getOptions());
    while (await reader.step())
      yield reader.formatCurrentRow();
  }
  /** Compute number of rows that would be returned by the ECSQL.
   *
   * See also:
   * - [ECSQL Overview]($docs/learning/backend/ExecutingECSQL)
   * - [Code Examples]($docs/learning/backend/ECSQLCodeExamples)
   *
   * @param ecsql The ECSQL statement to execute
   * @param params The values to bind to the parameters (if the ECSQL has any).
   * See "[iTwin.js Types used in ECSQL Parameter Bindings]($docs/learning/ECSQLParameterTypes)" for details.
   * @returns Return row count.
   * @throws [IModelError]($common) If the statement is invalid
   */
  public async queryRowCount(ecsql: string, params?: QueryBinder): Promise<number> {
    for await (const row of this.query(`select count(*) from (${ecsql})`, params)) {
      return row[0] as number;
    }
    throw new IModelError(DbResult.BE_SQLITE_ERROR, "Failed to get row count");
  }

  /** Cancel any previous query with same token and run execute the current specified query.
   * The result of the query is async iterator over the rows. The iterator will get next page automatically once rows in current page has been read.
   * [ECSQL row]($docs/learning/ECSQLRowFormat).
   *
   * See also:
   * - [ECSQL Overview]($docs/learning/backend/ExecutingECSQL)
   * - [Code Examples]($docs/learning/backend/ECSQLCodeExamples)
   *
   * @param ecsql The ECSQL statement to execute
   * @param token None empty restart token. The previous query with same token would be cancelled. This would cause
   * exception which user code must handle.
   * @param params The values to bind to the parameters (if the ECSQL has any).
   * @param options Allow to specify certain flags which control how query is executed.
   * @returns Returns the query result as an *AsyncIterableIterator<any>*  which lazy load result as needed. The row format is determined by *rowFormat* parameter.
   * See [ECSQL row format]($docs/learning/ECSQLRowFormat) for details about the format of the returned rows.
   * @throws [IModelError]($common) If there was any error while submitting, preparing or stepping into query
   */
  public async * restartQuery(token: string, ecsql: string, params?: QueryBinder, options?: QueryOptions): AsyncIterableIterator<any> {
    for await (const row of this.query(ecsql, params, new QueryOptionsBuilder(options).setRestartToken(token).getOptions())) {
      yield row;
    }
  }
}
