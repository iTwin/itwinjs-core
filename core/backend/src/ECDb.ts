/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module ECDb */

import { IModelError, IModelStatus, PageOptions, kPagingDefaultOptions, PageableECSql } from "@bentley/imodeljs-common";
import { IModelJsNative } from "./IModelJsNative";
import { ECSqlStatement, ECSqlStatementCache } from "./ECSqlStatement";
import { SqliteStatement, SqliteStatementCache, CachedSqliteStatement } from "./SqliteStatement";
import { DbResult, OpenMode, IDisposable, Logger, assert } from "@bentley/bentleyjs-core";
import { IModelHost } from "./IModelHost";
const loggingCategory = "imodeljs-backend.ECDb";
/** Modes for how to open [ECDb]($backend) files. */
export enum ECDbOpenMode {
  Readonly,
  Readwrite,
  /** Opens the file read-write and upgrades the file if necessary to the latest file format version. */
  FileUpgrade,
}

/** An ECDb file */
export class ECDb implements IDisposable, PageableECSql {
  private _nativeDb?: IModelJsNative.ECDb;
  private readonly _statementCache: ECSqlStatementCache = new ECSqlStatementCache();
  private readonly _sqliteStatementCache: SqliteStatementCache = new SqliteStatementCache();

  constructor() {
    this._nativeDb = new IModelHost.platform.ECDb();
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
    return this.withPreparedStatement(`select count(*) from (${ecsql})`, async (stmt: ECSqlStatement) => {
      if (bindings)
        stmt.bindValues(bindings);
      const ret = stmt.step();
      if (ret === DbResult.BE_SQLITE_ROW) {
        return stmt.getValue(0).getInteger();
      }
      throw new IModelError(ret, "Fail to compute row count");
    });
  }

  /** Execute a query agaisnt this ECDb
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
   * @param options Provide paging option. This allow set page size and page number from which to grab rows from.
   * @returns Returns the query result as an array of the resulting rows or an empty array if the query has returned no rows.
   * See [ECSQL row format]($docs/learning/ECSQLRowFormat) for details about the format of the returned rows.
   * @throws [IModelError]($common) If the statement is invalid
   */
  public async queryPage(ecsql: string, bindings?: any[] | object, options?: PageOptions): Promise<any[]> {
    if (!options) {
      options = kPagingDefaultOptions;
    }

    const pageNo = options.start || kPagingDefaultOptions.start;
    const pageSize = options.size || kPagingDefaultOptions.size;
    const stepsPerTick = options.stepsPerTick || kPagingDefaultOptions.stepsPerTick;
    // verify if correct options was provided.
    if (pageNo! < 0)
      throw new IModelError(DbResult.BE_SQLITE_ERROR, "options.start must be positive integer");

    if (pageSize! < 1)
      throw new IModelError(DbResult.BE_SQLITE_ERROR, "options.size must be positive integer starting from 1");

    if (stepsPerTick! < 1)
      throw new IModelError(DbResult.BE_SQLITE_ERROR, "options.stepsPerTick must be positive integer starting from 1");

    const pageParams = { sys_page_size: pageSize!, sys_page_offset: pageNo! * pageSize! };
    return this.withPreparedStatement(`select * from (${ecsql}) limit :sys_page_size offset :sys_page_offset`, async (stmt: ECSqlStatement) => {
      if (bindings)
        stmt.bindValues(bindings);

      stmt.bindValues(pageParams);
      const rows: any[] = [];
      const result = await new Promise<DbResult>((resolve: any) => {
        const nextStep = () => {
          setTimeout(() => {
            let status = DbResult.BE_SQLITE_DONE;
            for (let i = 0; i < stepsPerTick!; ++i) {
              status = stmt.step();
              if (DbResult.BE_SQLITE_ROW === status) {
                rows.push(stmt.getRow());
                if (pageSize === rows.length) {
                  return resolve(DbResult.BE_SQLITE_DONE);
                }
              } else {
                return resolve(status);
              }
            }
            if (status === DbResult.BE_SQLITE_ROW) {
              nextStep();
            }
          }, 1);
        };
        nextStep();
      });
      if (result !== DbResult.BE_SQLITE_DONE)
        throw new IModelError(result, "Sqlite error");

      return rows;
    });
  }
  /** Execute a pageable query.
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
   * @param options Provide paging option. Which allow page to start iterating from and also size of the page to use.
   * @returns Returns the query result as an array of the resulting rows or an empty array if the query has returned no rows.
   * See [ECSQL row format]($docs/learning/ECSQLRowFormat) for details about the format of the returned rows.
   * @throws [IModelError]($common) If the statement is invalid
   */
  public async * query(ecsql: string, bindings?: any[] | object, options?: PageOptions): AsyncIterableIterator<any> {
    if (!options) {
      options = kPagingDefaultOptions;
    }

    let pageNo = options.start || kPagingDefaultOptions.start!;
    const pageSize = options.size || kPagingDefaultOptions.size!;

    // verify if correct options was provided.
    if (pageNo < 0)
      throw new IModelError(DbResult.BE_SQLITE_ERROR, "options.start must be positive integer");

    if (pageSize < 0)
      throw new IModelError(DbResult.BE_SQLITE_ERROR, "options.size must be positive integer starting from 1");

    do {
      const page = await this.queryPage(ecsql, bindings, { start: pageNo, size: pageSize });
      if (page.length > 0) {
        for (const row of page) {
          yield row;
        }
        pageNo = pageNo + 1;
      } else {
        pageNo = -1;
      }
    } while (pageNo >= 0);
  }

  /** Call this function when finished with this ECDb object. This releases the native resources held by the
   *  ECDb object.
   */
  public dispose(): void {
    if (!this._nativeDb)
      return;

    this.closeDb();
    this._nativeDb!.dispose();
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

  /** @private use to test statement caching */
  public clearStatementCache() {
    this._statementCache.clear();
  }

  /** @private use to test statement caching */
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
      Logger.logError(loggingCategory, "Failed to import schema from '" + pathName + "'.");
      throw new IModelError(status, "Failed to import schema from '" + pathName + "'.");
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
      Logger.logError(loggingCategory, err.toString());
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
      Logger.logError(loggingCategory, err.toString());
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
   */
  public prepareSqliteStatement(sql: string): SqliteStatement {
    const stmt = new SqliteStatement();
    stmt.prepare(this.nativeDb, sql);
    return stmt;
  }

  public get nativeDb(): IModelJsNative.ECDb {
    if (!this._nativeDb)
      throw new IModelError(IModelStatus.BadRequest, "ECDb object has already been disposed.");

    return this._nativeDb!;
  }
}
