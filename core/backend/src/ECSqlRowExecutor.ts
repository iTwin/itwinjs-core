/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { IModelError, QueryPropertyMetaData } from "@itwin/core-common";
import type { IModelDb } from "./IModelDb";
import { ECSqlStatement } from "./ECSqlStatement";
import { BentleyError, DbResult, Logger } from "@itwin/core-bentley";
import { IModelJsNative } from "@bentley/imodeljs-native";
import { _nativeDb } from "./internal/Symbols";
import type { ECDb } from "./ECDb";
import type { StatementCache } from "./SqliteStatement";

const statementNotPreparedMessage = "Statement is not prepared. Likely cause: the db was closed before step is called or the ECSqlSyncReader is used outside the context of the callback passed to withQueryReader.";

function logStatementCleanupError(loggerCategory: string, message: string, error: unknown): void {
  try {
    Logger.logTrace(loggerCategory, message, () => ({ error: BentleyError.getErrorMessage(error) }));
  } catch {
    // Cleanup diagnostics must not replace the original query error.
  }
}

/** Returns a statement to its cache, falling back to direct disposal without throwing.
 * @internal
 */
// eslint-disable-next-line @typescript-eslint/no-deprecated
export function releaseECSqlStatement(stmt: ECSqlStatement, cache: StatementCache<ECSqlStatement>, loggerCategory: string, canCache: boolean): void {
  if (!canCache || !stmt.isPrepared) {
    try {
      stmt[Symbol.dispose]();
    } catch (error) {
      logStatementCleanupError(loggerCategory, "Failed to dispose an ECSQL statement that could not be cached.", error);
    }
    return;
  }

  try {
    cache.addOrDispose(stmt);
  } catch (error) {
    try {
      stmt[Symbol.dispose]();
    } catch (disposeError) {
      logStatementCleanupError(loggerCategory, "Failed to dispose an ECSQL statement after it could not be returned to the statement cache.", disposeError);
    }
    logStatementCleanupError(loggerCategory, "Failed to return an ECSQL statement to the statement cache; attempted direct disposal instead.", error);
  }
}

// --------------------------------------------------------------------------------------------
// Internal result types
// --------------------------------------------------------------------------------------------

/** Result of an internal operation that may fail with a message.
 * @internal
 */
interface OperationResult {
  isSuccessful: boolean;
  message?: string;
}

// --------------------------------------------------------------------------------------------
// ECSqlRowExecutor
// --------------------------------------------------------------------------------------------

/**
 * Executes ECSql queries one row at a time against an IModelDb, maintaining statement state between
 * successive calls so the caller can page through results via offset-based requests.
 * @internal
 */
export class ECSqlRowExecutor implements Disposable {
  private _removeListener: () => void;
  private _isDisposed = false;
  private _canCacheStatement = true;

  /** Whether the statement completed preparation and can be returned to its cache.
   * @internal
   */
  public get canCacheStatement(): boolean { return this._canCacheStatement; }

  // eslint-disable-next-line @typescript-eslint/no-deprecated
  public constructor(private readonly _db: IModelDb | ECDb, private readonly _stmt: ECSqlStatement, private readonly _loggerCategory: string) {
    this._removeListener = this._db.onBeforeClose.addListener(() => this.cleanup());
  }

  // --------------------------------------------------------------------------------------------
  // Lifecycle
  // --------------------------------------------------------------------------------------------

  /** Disposes the currently held statement without returning it to the cache.
   * Invoked when the db signals it is closing (the statement cache is cleared on close, so the
   * checked-out statement must be disposed directly to avoid a use-after-free or double dispose).
   * @internal
   */
  private cleanup(): void {
    this._isDisposed = true;
    try {
      this._stmt[Symbol.dispose]();
    } catch (error) {
      logStatementCleanupError(this._loggerCategory, "Failed to dispose an ECSQL statement while closing its database.", error);
    }
  }

  /** Removes the database-close listener owned by this row executor.
   * @internal
   */
  public [Symbol.dispose](): void {
    this._isDisposed = true;
    this._removeListener();
  }

  // --------------------------------------------------------------------------------------------
  // Core execution
  // --------------------------------------------------------------------------------------------

  /** Prepare the statement and bind parameters in one step.
   * Call once during reader initialization — avoids the per-row `ensureStatementReady` check.
   * @param query - The ECSql text to prepare.
   * @param args - Optional bind parameters.
   * @throws IModelError on preparation or binding failure.
   * @internal
   */
  public prepareAndBind(query: string, args?: object): void {

    const prepResult = this.prepareStmt(query);
    if (!prepResult.isSuccessful)
      throw new IModelError(DbResult.BE_SQLITE_ERROR, prepResult.message ?? `Failed to prepare statement: ${query}`);

    if (args) {
      const bindResult = this.bindValues(args);
      if (!bindResult.isSuccessful)
        throw new IModelError(DbResult.BE_SQLITE_ERROR, bindResult.message ?? `Failed to bind values: ${query}`);
    }
  }

  /** Fast-path: step the cursor once and return row data directly.
   *
   * Returns the row data array if a row is available.
   * Returns `undefined` if the result set is exhausted (DONE).
   *
   * This avoids all intermediate object allocations (StepResult, RowDataResult,
   * DbRuntimeStats, DbQueryResponse) that the general `execute()` path creates per row.
   *
   * @param options - Native row-adaptor options (should be cached and reused across rows).
   * @throws IModelError on step failure or row extraction failure.
   * @internal
   */
  public stepNextRow(options: IModelJsNative.ECSqlRowAdaptorOptions): any {
    if (this._isDisposed || !this._stmt.isPrepared)
      throw new IModelError(DbResult.BE_SQLITE_ERROR, statementNotPreparedMessage);
    const stepResult = this._stmt.step();
    if (stepResult === DbResult.BE_SQLITE_ROW)
      return this._stmt.toRow(options).data;
    if (stepResult === DbResult.BE_SQLITE_DONE)
      return undefined;
    throw new IModelError(stepResult, `Step failed with code ${stepResult}`);
  }

  /** Get column metadata directly from the prepared statement.
   * Call once after `prepareAndBind` — the metadata does not change between rows.
   * @param options - Native row-adaptor options that influence property naming.
   * @returns Array of column metadata.
   * @internal
   */
  public fetchMetadata(options: IModelJsNative.ECSqlRowAdaptorOptions): QueryPropertyMetaData[] {
    if (this._isDisposed || !this._stmt.isPrepared)
      throw new IModelError(DbResult.BE_SQLITE_ERROR, statementNotPreparedMessage);
    return this._stmt.getMetadata(options).properties;
  }

  // --------------------------------------------------------------------------------------------
  // Execution phases
  // --------------------------------------------------------------------------------------------

  /** Prepares the ECSql statement when the caller did not supply one from its cache.
   * @param ecsql - The ECSql text to prepare.
   * @returns An `OperationResult` indicating success or failure.
   * @internal
   */
  private prepareStmt(ecsql: string): OperationResult {
    if (this._stmt.isPrepared)
      return { isSuccessful: true };

    try {
      this._stmt.prepare(this._db[_nativeDb], ecsql);
      return { isSuccessful: true };
    } catch (error: any) {
      this._canCacheStatement = false;
      try {
        this._stmt[Symbol.dispose]();
      } catch (disposeError) {
        logStatementCleanupError(this._loggerCategory, "Failed to dispose an ECSQL statement after preparation failed.", disposeError);
      }
      return { isSuccessful: false, message: error.message };
    }
  }

  /** Binds the supplied parameter values to the prepared statement.
   * @param args - The parameter object to bind, or `undefined` when no parameters are needed.
   * @returns An `OperationResult` indicating success or failure.
   * @internal
   */
  private bindValues(args: object | undefined): OperationResult {
    try {
      if (args === undefined)
        return { isSuccessful: true };

      if (!this._stmt.isPrepared)
        return { isSuccessful: false, message: statementNotPreparedMessage };

      this._stmt.bindParams(args);
      return { isSuccessful: true };
    } catch (error: any) {
      return { isSuccessful: false, message: error.message };
    }
  }
}