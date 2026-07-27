/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { IModelError, QueryPropertyMetaData } from "@itwin/core-common";
import { IModelDb } from "./IModelDb";
import { ECSqlStatement } from "./ECSqlStatement";
import { BentleyError, DbResult, Logger } from "@itwin/core-bentley";
import { IModelJsNative } from "@bentley/imodeljs-native";
import { _getStatementCache, _nativeDb } from "./internal/Symbols";
import { ECDb } from "./ECDb";
import { BackendLoggerCategory } from "./BackendLoggerCategory";

const statementNotPreparedMessage = "Statement is not prepared. Likely cause: the db was closed before step is called or the ECSqlSyncReader is used outside the context of the callback passed to withQueryReader.";

function logStatementCleanupError(message: string, error: unknown): void {
  Logger.logTrace(BackendLoggerCategory.ECDb, message, () => ({ error: BentleyError.getErrorMessage(error) }));
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
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  private _stmt?: ECSqlStatement;
  private _removeListener: () => void;

  public constructor(private readonly _db: IModelDb | ECDb) {
    // The statement is obtained lazily in `prepareAndBind` - either reused from the owning db's
    // statement cache or freshly prepared - so repeated queries avoid re-compiling the ECSQL.
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
    const stmt = this._stmt;
    this._stmt = undefined;
    try {
      stmt?.[Symbol.dispose]();
    } catch (error) {
      logStatementCleanupError("Failed to dispose an ECSQL statement while closing its database.", error);
    }
  }

  /** Call this function to dispose the row executor off.
   * The prepared statement is returned to the owning db's statement cache for reuse (or disposed
   * if it cannot be cached, e.g. preparation failed).
   * @internal
   */
  public [Symbol.dispose](): void {
    this._removeListener();
    const stmt = this._stmt;
    this._stmt = undefined;
    if (!stmt)
      return;
    try {
      if (stmt.isPrepared)
        this._db[_getStatementCache]().addOrDispose(stmt);
      else
        stmt[Symbol.dispose]();
    } catch (error) {
      logStatementCleanupError("Failed to return an ECSQL statement to the statement cache; disposing it instead.", error);
      // If returning the statement to the cache fails (e.g. the native ECDb cache was cleared while
      // the reader was active), dispose it directly and never mask the caller's original error.
      try {
        stmt[Symbol.dispose]();
      } catch (disposeError) {
        logStatementCleanupError("Failed to dispose an ECSQL statement after it could not be returned to the statement cache.", disposeError);
      }
    }
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
    if (!this._stmt?.isPrepared)
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
    if (!this._stmt?.isPrepared)
      throw new IModelError(DbResult.BE_SQLITE_ERROR, statementNotPreparedMessage);
    return this._stmt.getMetadata(options).properties;
  }

  // --------------------------------------------------------------------------------------------
  // Execution phases
  // --------------------------------------------------------------------------------------------

  /** Obtains a prepared ECSql statement for `ecsql`, reusing one from the owning db's statement
   * cache when available (avoiding a native ECSQL re-compile) and otherwise preparing a fresh one.
   * A statement returned by the cache is already reset with its bindings cleared.
   * @param ecsql - The ECSql text to prepare.
   * @returns An `OperationResult` indicating success or failure.
   * @internal
   */
  private prepareStmt(ecsql: string): OperationResult {
    const cached = this._db[_getStatementCache]().findAndRemove(ecsql);
    if (cached) {
      this._stmt = cached;
      return { isSuccessful: true };
    }
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    const stmt = new ECSqlStatement();
    try {
      stmt.prepare(this._db[_nativeDb], ecsql);
      this._stmt = stmt;
      return { isSuccessful: true };
    } catch (error: any) {
      // Do not assign `_stmt` to an unprepared statement so disposal never tries to cache it.
      try {
        stmt[Symbol.dispose]();
      } catch (disposeError) {
        logStatementCleanupError("Failed to dispose an ECSQL statement after preparation failed.", disposeError);
      }
      return { isSuccessful: false, message: error.message };
    }
  }

  /** Resets the statement and binds the given parameter values. Caches the arguments for later
   * comparison so that redundant rebinds can be skipped.
   * @param args - The parameter object to bind, or `undefined` when no parameters are needed.
   * @returns An `OperationResult` indicating success or failure.
   * @internal
   */
  private bindValues(args: object | undefined): OperationResult {
    try {
      if (args === undefined)
        return { isSuccessful: true };

      const stmt = this._stmt;
      if (!stmt?.isPrepared)
        return { isSuccessful: false, message: statementNotPreparedMessage };

      stmt.bindParams(args);
      return { isSuccessful: true };
    } catch (error: any) {
      return { isSuccessful: false, message: error.message };
    }
  }
}