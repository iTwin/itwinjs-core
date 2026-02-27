/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { IModelError, QueryPropertyMetaData } from "@itwin/core-common";
import { IModelDb } from "./IModelDb";
import { ECSqlStatement } from "./ECSqlStatement";
import { DbResult } from "@itwin/core-bentley";
import { IModelJsNative } from "@bentley/imodeljs-native";
import { _nativeDb } from "./internal/Symbols";
import { ECDb } from "./ECDb";

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
  private _stmt: ECSqlStatement;
  private _removeListener: () => void;

  public constructor(private readonly _db: IModelDb | ECDb) {
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    this._stmt = new ECSqlStatement();
    this._removeListener = this._db.onBeforeClose.addListener(() => this.cleanup());
  }

  // --------------------------------------------------------------------------------------------
  // Lifecycle
  // --------------------------------------------------------------------------------------------

  /** Disposes the current statement and resets all internal state.
   * Invoked when the db signals that the executor must be recycled.
   * @internal
   */
  private cleanup(): void {
    this._stmt[Symbol.dispose]();
  }

  /** Call this function to dispose the row executor off.
   * @internal
   */
  public [Symbol.dispose](): void {
    this._removeListener();
    this.cleanup();
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
    if (!this._stmt.isPrepared)
      throw new IModelError(DbResult.BE_SQLITE_ERROR, "Statement is not prepared. Likely cause: the db was closed before step is called or the ECSqlSyncReader is used outside the context of the callback passed to withQueryReader.");
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
    return this._stmt.getMetadata(options).properties;
  }

  // --------------------------------------------------------------------------------------------
  // Execution phases
  // --------------------------------------------------------------------------------------------

  /** Prepares the ECSql statement against the native database and records the elapsed preparation time.
   * @param ecsql - The ECSql text to prepare.
   * @returns An `OperationResult` indicating success or failure.
   * @internal
   */
  private prepareStmt(ecsql: string): OperationResult {
    try {
      this._stmt.prepare(this._db[_nativeDb], ecsql);
      return { isSuccessful: true };
    } catch (error: any) {
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

      this._stmt.bindParams(args);
      return { isSuccessful: true };
    } catch (error: any) {
      return { isSuccessful: false, message: error.message };
    }
  }
}