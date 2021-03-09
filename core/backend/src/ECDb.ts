/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ECDb
 */

import { assert, ClientRequestContext, DbResult, IDisposable, IModelStatus, Logger, OpenMode } from "@bentley/bentleyjs-core";
import {
  Base64EncodedString, IModelError, QueryLimit, QueryPriority, QueryQuota, QueryResponse, QueryResponseStatus,
} from "@bentley/imodeljs-common";
import { IModelJsNative } from "@bentley/imodeljs-native";
import { BackendLoggerCategory } from "./BackendLoggerCategory";
import { ECSqlStatement, ECSqlStatementCache } from "./ECSqlStatement";
import { IModelHost } from "./IModelHost";
import { CachedSqliteStatement, SqliteStatement, SqliteStatementCache } from "./SqliteStatement";

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
  private _concurrentQueryInitialized: boolean = false;
  private readonly _statementCache: ECSqlStatementCache = new ECSqlStatementCache();
  private readonly _sqliteStatementCache: SqliteStatementCache = new SqliteStatementCache();
  private _concurrentQueryStats = { resetTimerHandle: (null as any), logTimerHandle: (null as any), lastActivityTime: Date.now(), dispose: () => { } };

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
    this._concurrentQueryStats.dispose();
  }

  /** @internal use to test statement caching */
  public clearStatementCache() {
    this._statementCache.clear();
  }

  /** @internal use to test statement caching */
  public getCachedStatementCount() {
    return this._statementCache.getCount();
  }

  /** Commit the outermost transaction, writing changes to the file. Then, restart the transaction.
   * @param changeSetName The name of the operation that generated these changes.
   * @throws [IModelError]($common) if the database is not open or if the operation failed.
   */
  public saveChanges(changeSetName?: string): void {
    const status: DbResult = this.nativeDb.saveChanges(changeSetName);
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

  /** Use a prepared ECSQL statement. This function takes care of preparing the statement and then releasing it.
   *
   * As preparing statements can be costly, they get cached. When calling this method again with the same ECSQL,
   * the already prepared statement from the cache will be reused.
   *
   * See also:
   * - [ECSQL Overview]($docs/learning/backend/ExecutingECSQL)
   * - [Code Examples]($docs/learning/backend/ECSQLCodeExamples)
   *
   * @param ecsql The ECSQL statement to execute
   * @param cb The callback to invoke on the prepared statement
   * @returns Returns the value returned by cb
   */
  public withPreparedStatement<T>(ecsql: string, cb: (stmt: ECSqlStatement) => T): T {
    const stmt = this.getPreparedStatement(ecsql);
    const release = () => {
      if (stmt.isShared)
        this._statementCache.release(stmt);
      else
        stmt.dispose();
    };

    try {
      const val: T = cb(stmt);
      if (val instanceof Promise) {
        val.then(release, release);
      } else {
        release();
      }
      return val;
    } catch (err) {
      release();
      Logger.logError(loggerCategory, err.toString());
      throw err;
    }
  }

  /** Get a prepared ECSQL statement - may require preparing the statement, if not found in the cache.
   * @param ecsql The ECSQL statement to prepare
   * @returns Returns the prepared statement
   * @throws [IModelError]($common) if the statement cannot be prepared. Normally, prepare fails due to ECSQL syntax errors or
   * references to tables or properties that do not exist. The error.message property will provide details.
   */
  private getPreparedStatement(ecsql: string): ECSqlStatement {
    const cachedStmt = this._statementCache.find(ecsql);
    if (!!cachedStmt && cachedStmt.useCount === 0) {  // we can only recycle a previously cached statement if nobody is currently using it.
      assert(cachedStmt.statement.isShared);
      assert(cachedStmt.statement.isPrepared);
      cachedStmt.useCount++;
      return cachedStmt.statement;
    }

    this._statementCache.removeUnusedStatementsIfNecessary();
    const stmt = this.prepareStatement(ecsql);
    if (cachedStmt)
      this._statementCache.replace(ecsql, stmt);
    else
      this._statementCache.add(ecsql, stmt);

    return stmt;
  }

  /** Prepare an ECSQL statement.
   * @param ecsql The ECSQL statement to prepare
   * @throws [IModelError]($common) if there is a problem preparing the statement.
   */
  public prepareStatement(ecsql: string): ECSqlStatement {
    const stmt = new ECSqlStatement();
    stmt.prepare(this.nativeDb, ecsql);
    return stmt;
  }

  /** Use a prepared SQLite SQL statement. This function takes care of preparing the statement and then releasing it.
   *
   * As preparing statements can be costly, they get cached. When calling this method again with the same SQL,
   * the already prepared statement from the cache will be reused.
   *
   * @param sql The SQLite SQL statement to execute
   * @param cb The callback to invoke on the prepared statement
   * @returns Returns the value returned by cb
   * @internal
   */
  public withPreparedSqliteStatement<T>(sql: string, cb: (stmt: SqliteStatement) => T): T {
    const stmt = this.getPreparedSqliteStatement(sql);
    const release = () => {
      if (stmt.isShared)
        this._sqliteStatementCache.release(stmt);
      else
        stmt.dispose();
    };
    try {
      const val: T = cb(stmt);
      if (val instanceof Promise) {
        val.then(release, release);
      } else {
        release();
      }
      return val;
    } catch (err) {
      release();
      Logger.logError(loggerCategory, err.toString());
      throw err;
    }
  }

  /** Get a prepared SQLite SQL statement - may require preparing the statement, if not found in the cache.
   * @param sql The SQLite SQL statement to prepare
   * @returns Returns the prepared statement
   * @throws [IModelError]($common) if the statement cannot be prepared. Normally, prepare fails due to SQL syntax errors or
   * references to tables or properties that do not exist. The error.message property will provide details.
   */
  private getPreparedSqliteStatement(sql: string): SqliteStatement {
    const cachedStmt: CachedSqliteStatement | undefined = this._sqliteStatementCache.find(sql);
    if (!!cachedStmt && cachedStmt.useCount === 0) {  // we can only recycle a previously cached statement if nobody is currently using it.
      assert(cachedStmt.statement.isShared);
      assert(cachedStmt.statement.isPrepared);
      cachedStmt.useCount++;
      return cachedStmt.statement;
    }
    this._sqliteStatementCache.removeUnusedStatementsIfNecessary();
    const stmt: SqliteStatement = this.prepareSqliteStatement(sql);
    if (cachedStmt)
      this._sqliteStatementCache.replace(sql, stmt);
    else
      this._sqliteStatementCache.add(sql, stmt);
    return stmt;
  }

  /** Prepare an SQLite SQL statement.
   * @param sql The SQLite SQL statement to prepare
   * @throws [IModelError]($common) if there is a problem preparing the statement.
   * @internal
   */
  public prepareSqliteStatement(sql: string): SqliteStatement {
    const stmt = new SqliteStatement();
    stmt.prepare(this.nativeDb, sql);
    return stmt;
  }

  /** @internal */
  public get nativeDb(): IModelJsNative.ECDb {
    if (!this._nativeDb)
      throw new IModelError(IModelStatus.BadRequest, "ECDb object has already been disposed.");

    return this._nativeDb;
  }
  /** Compute number of rows that would be returned by the ECSQL.
   *
   * See also:
   * - [ECSQL Overview]($docs/learning/backend/ExecutingECSQL)
   * - [Code Examples]($docs/learning/backend/ECSQLCodeExamples)
   *
   * @param ecsql The ECSQL statement to execute
   * @param bindings The values to bind to the parameters (if the ECSQL has any).
   * Pass an *array* of values if the parameters are *positional*.
   * Pass an *object of the values keyed on the parameter name* for *named parameters*.
   * The values in either the array or object must match the respective types of the parameters.
   * See "[iModel.js Types used in ECSQL Parameter Bindings]($docs/learning/ECSQLParameterTypes)" for details.
   * @returns Return row count.
   * @throws [IModelError]($common) If the statement is invalid
   */
  public async queryRowCount(ecsql: string, bindings?: any[] | object): Promise<number> {
    for await (const row of this.query(`select count(*) nRows from (${ecsql})`, bindings)) {
      return row.nRows;
    }
    throw new IModelError(DbResult.BE_SQLITE_ERROR, "Failed to get row count");
  }

  /** Execute a query against this ECDb but restricted by quota and limit settings. This is intended to be used internally
   * The result of the query is returned as an array of JavaScript objects where every array element represents an
   * [ECSQL row]($docs/learning/ECSQLRowFormat).
   *
   * See also:
   * - [ECSQL Overview]($docs/learning/backend/ExecutingECSQL)
   * - [Code Examples]($docs/learning/backend/ECSQLCodeExamples)
   *
   * @param ecsql The ECSQL statement to execute
   * @param bindings The values to bind to the parameters (if the ECSQL has any).
   * Pass an *array* of values if the parameters are *positional*.
   * Pass an *object of the values keyed on the parameter name* for *named parameters*.
   * The values in either the array or object must match the respective types of the parameters.
   * See "[iModel.js Types used in ECSQL Parameter Bindings]($docs/learning/ECSQLParameterTypes)" for details.
   * @param limitRows Specify upper limit for rows that can be returned by the query.
   * @param quota Specify non binding quota. These values are constrained by global setting
   * but never the less can be specified to narrow down the quota constraint for the query but staying under global settings.
   * @param priority Specify non binding priority for the query. It can help user to adjust
   * priority of query in queue so that small and quicker queries can be prioritized over others.
   * @param restartToken when provide cancel the previous query with same token in same session.
   * @returns Returns structure containing rows and status.
   * See [ECSQL row format]($docs/learning/ECSQLRowFormat) for details about the format of the returned rows.
   * @internal
   */
  public async queryRows(ecsql: string, bindings?: any[] | object, limit?: QueryLimit, quota?: QueryQuota, priority?: QueryPriority, restartToken?: string, abbreviateBlobs?: boolean): Promise<QueryResponse> {
    const stats = this._concurrentQueryStats;
    const config = IModelHost.configuration!.concurrentQuery;
    stats.lastActivityTime = Date.now();
    if (!this._concurrentQueryInitialized) {
      // Initialize concurrent query and setup statistics reset timer
      this._concurrentQueryInitialized = this.nativeDb.concurrentQueryInit(config);
      stats.dispose = () => {
        if (stats.logTimerHandle) {
          clearInterval(stats.logTimerHandle);
          stats.logTimerHandle = null;
        }
        if (stats.resetTimerHandle) {
          clearInterval(stats.resetTimerHandle);
          stats.resetTimerHandle = null;
        }
      };
      // Concurrent query will reset and log statistics every 'resetStatisticsInterval'
      const resetIntervalMs = 1000 * 60 * Math.max(config.resetStatisticsInterval ? config.resetStatisticsInterval : 60, 10);
      stats.resetTimerHandle = setInterval(() => {
        if (this.isOpen && this._concurrentQueryInitialized) {
          try {
            const timeElapsedSinceLastActivity = Date.now() - stats.lastActivityTime;
            if (timeElapsedSinceLastActivity < logIntervalMs) {
              const statistics = JSON.parse(this.nativeDb.captureConcurrentQueryStats(true));
              Logger.logInfo(loggerCategory, "Resetting concurrent query statistics", () => statistics);
            }
          } catch { }
        } else {
          clearInterval(stats.resetTimerHandle);
          stats.resetTimerHandle = null;
        }
      }, resetIntervalMs);

      // Concurrent query will log statistics every 'logStatisticsInterval'
      const logIntervalMs = 1000 * 60 * Math.max(config.logStatisticsInterval ? config.logStatisticsInterval : 5, 5);
      stats.logTimerHandle = setInterval(() => {
        if (this.isOpen && this._concurrentQueryInitialized) {
          try {
            const timeElapsedSinceLastActivity = Date.now() - stats.lastActivityTime;
            if (timeElapsedSinceLastActivity < logIntervalMs) {
              const statistics = JSON.parse(this.nativeDb.captureConcurrentQueryStats(false));
              Logger.logInfo(loggerCategory, "Concurrent query statistics", () => statistics);
            }
          } catch { }
        } else {
          clearInterval(stats.logTimerHandle);
          stats.logTimerHandle = null;
        }
      }, logIntervalMs);
    }

    if (!bindings) bindings = [];
    if (!limit) limit = {};
    if (!quota) quota = {};
    if (!priority) priority = QueryPriority.Normal;

    return new Promise<QueryResponse>((resolve) => {
      let sessionRestartToken = restartToken ? restartToken.trim() : "";
      if (sessionRestartToken !== "")
        sessionRestartToken = `${ClientRequestContext.current.sessionId}:${sessionRestartToken}`;

      const postResult = this.nativeDb.postConcurrentQuery(ecsql, JSON.stringify(bindings, Base64EncodedString.replacer), limit!, quota!, priority!, sessionRestartToken, abbreviateBlobs);
      if (postResult.status !== IModelJsNative.ConcurrentQuery.PostStatus.Done)
        resolve({ status: QueryResponseStatus.PostError, rows: [] });

      const poll = () => {
        if (!this.nativeDb || !this.nativeDb.isOpen()) {
          resolve({ status: QueryResponseStatus.Done, rows: [] });
        } else {
          const pollResult = this.nativeDb.pollConcurrentQuery(postResult.taskId);
          if (pollResult.status === IModelJsNative.ConcurrentQuery.PollStatus.Done) {
            resolve({ status: QueryResponseStatus.Done, rows: JSON.parse(pollResult.result, Base64EncodedString.reviver) });
          } else if (pollResult.status === IModelJsNative.ConcurrentQuery.PollStatus.Partial) {
            const returnBeforeStep = pollResult.result.length === 0;
            resolve({ status: QueryResponseStatus.Partial, rows: returnBeforeStep ? [] : JSON.parse(pollResult.result, Base64EncodedString.reviver) });
          } else if (pollResult.status === IModelJsNative.ConcurrentQuery.PollStatus.Timeout)
            resolve({ status: QueryResponseStatus.Timeout, rows: [] });
          else if (pollResult.status === IModelJsNative.ConcurrentQuery.PollStatus.Pending)
            setTimeout(() => { poll(); }, IModelHost.configuration!.concurrentQuery.pollInterval);
          else if (pollResult.status === IModelJsNative.ConcurrentQuery.PollStatus.Cancelled)
            resolve({ status: QueryResponseStatus.Cancelled, rows: [pollResult.result] });
          else
            resolve({ status: QueryResponseStatus.Error, rows: [pollResult.result] });
        }
      };
      setTimeout(() => { poll(); }, IModelHost.configuration!.concurrentQuery.pollInterval);
    });
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
   * @param bindings The values to bind to the parameters (if the ECSQL has any).
   * Pass an *array* of values if the parameters are *positional*.
   * Pass an *object of the values keyed on the parameter name* for *named parameters*.
   * The values in either the array or object must match the respective types of the parameters.
   * See "[iModel.js Types used in ECSQL Parameter Bindings]($docs/learning/ECSQLParameterTypes)" for details.
   * @param limitRows Specify upper limit for rows that can be returned by the query.
   * @param quota Specify non binding quota. These values are constrained by global setting
   * but never the less can be specified to narrow down the quota constraint for the query but staying under global settings.
   * @param priority Specify non binding priority for the query. It can help user to adjust
   * priority of query in queue so that small and quicker queries can be prioritized over others.
   * @returns Returns the query result as an *AsyncIterableIterator<any>*  which lazy load result as needed
   * See [ECSQL row format]($docs/learning/ECSQLRowFormat) for details about the format of the returned rows.
   * @throws [IModelError]($common) If there was any error while submitting, preparing or stepping into query
   */
  public async * query(ecsql: string, bindings?: any[] | object, limitRows?: number, quota?: QueryQuota, priority?: QueryPriority, abbreviateBlobs?: boolean): AsyncIterableIterator<any> {
    let result: QueryResponse;
    let offset: number = 0;
    let rowsToGet = limitRows ? limitRows : -1;
    do {
      result = await this.queryRows(ecsql, bindings, { maxRowAllowed: rowsToGet, startRowOffset: offset }, quota, priority, undefined, abbreviateBlobs);
      while (result.status === QueryResponseStatus.Timeout) {
        result = await this.queryRows(ecsql, bindings, { maxRowAllowed: rowsToGet, startRowOffset: offset }, quota, priority, undefined, abbreviateBlobs);
      }

      if (result.status === QueryResponseStatus.Error) {
        if (result.rows[0] === undefined) {
          throw new IModelError(DbResult.BE_SQLITE_ERROR, "Invalid ECSql");
        } else {
          throw new IModelError(DbResult.BE_SQLITE_ERROR, result.rows[0]);
        }
      }

      if (rowsToGet > 0) {
        rowsToGet -= result.rows.length;
      }
      offset += result.rows.length;

      for (const row of result.rows)
        yield row;

    } while (result.status !== QueryResponseStatus.Done);
  }
  /** Execute a query and stream its results
   * The result of the query is async iterator over the rows. The iterator will get next page automatically once rows in current page has been read.
   * [ECSQL row]($docs/learning/ECSQLRowFormat).
   *
   * See also:
   * - [ECSQL Overview]($docs/learning/backend/ExecutingECSQL)
   * - [Code Examples]($docs/learning/backend/ECSQLCodeExamples)
   *
   * @param token None empty restart token. The previous query with same token would be cancelled. This would cause
   * exception which user code must handle.
   * @param ecsql The ECSQL statement to execute
   * @param bindings The values to bind to the parameters (if the ECSQL has any).
   * Pass an *array* of values if the parameters are *positional*.
   * Pass an *object of the values keyed on the parameter name* for *named parameters*.
   * The values in either the array or object must match the respective types of the parameters.
   * See "[iModel.js Types used in ECSQL Parameter Bindings]($docs/learning/ECSQLParameterTypes)" for details.
   * @param limitRows Specify upper limit for rows that can be returned by the query.
   * @param quota Specify non binding quota. These values are constrained by global setting
   * but never the less can be specified to narrow down the quota constraint for the query but staying under global settings.
   * @param priority Specify non binding priority for the query. It can help user to adjust
   * priority of query in queue so that small and quicker queries can be prioritized over others.
   * @returns Returns the query result as an *AsyncIterableIterator<any>*  which lazy load result as needed
   * See [ECSQL row format]($docs/learning/ECSQLRowFormat) for details about the format of the returned rows.
   * @throws [IModelError]($common) If there was any error while submitting, preparing or stepping into query
   */
  public async * restartQuery(token: string, ecsql: string, bindings?: any[] | object, limitRows?: number, quota?: QueryQuota, priority?: QueryPriority): AsyncIterableIterator<any> {
    let result: QueryResponse;
    let offset: number = 0;
    let rowsToGet = limitRows ? limitRows : -1;
    do {
      result = await this.queryRows(ecsql, bindings, { maxRowAllowed: rowsToGet, startRowOffset: offset }, quota, priority, token);
      while (result.status === QueryResponseStatus.Timeout) {
        result = await this.queryRows(ecsql, bindings, { maxRowAllowed: rowsToGet, startRowOffset: offset }, quota, priority, token);
      }
      if (result.status === QueryResponseStatus.Cancelled) {
        throw new IModelError(DbResult.BE_SQLITE_INTERRUPT, `Query cancelled`);
      } else if (result.status === QueryResponseStatus.Error) {
        if (result.rows[0] === undefined) {
          throw new IModelError(DbResult.BE_SQLITE_ERROR, "Invalid ECSql");
        } else {
          throw new IModelError(DbResult.BE_SQLITE_ERROR, result.rows[0]);
        }
      }

      if (rowsToGet > 0) {
        rowsToGet -= result.rows.length;
      }
      offset += result.rows.length;

      for (const row of result.rows)
        yield row;

    } while (result.status !== QueryResponseStatus.Done);
  }
}
