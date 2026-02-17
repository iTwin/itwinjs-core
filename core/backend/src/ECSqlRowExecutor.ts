/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { DbQueryRequest, DbQueryResponse, DbRequestExecutor, DbResponseKind, DbResponseStatus, DbRuntimeStats, DbValueFormat, QueryPropertyMetaData } from "@itwin/core-common";
import { IModelDb } from "./IModelDb";
import { ECSqlStatement } from "./ECSqlStatement";
import { assert, DbResult } from "@itwin/core-bentley";
import { IModelJsNative } from "@bentley/imodeljs-native";
import { _nativeDb } from "./internal/Symbols";

/** Result of an internal operation that may fail with a message.
 * @internal
 */
interface OperationResult {
  isSuccessful: boolean;
  message?: string;
}

/** Result of an ECSql step operation, extending OperationResult with the native step return code.
 * @internal
 */
interface StepResult extends OperationResult {
  stepResult: DbResult;
}

/** Result of a metadata retrieval operation, extending OperationResult with the property metadata array.
 * @internal
 */
interface MetaDataResult extends OperationResult {
  metaData: QueryPropertyMetaData[];
}

/** Result of a row data extraction operation, extending OperationResult with the extracted row data.
 * @internal
 */
interface RowDataResult extends OperationResult {
  rowData: any[];
}

/**
 * Tracks execution timing and resource usage statistics for ECSql queries.
 * Provides methods to record prepare time, compute elapsed time, estimate memory usage,
 * and check whether quota limits (time or memory) have been exceeded.
 * @internal
 */
class ECSqlExecutionStats {
  private _executeStartTime: number = 0;
  private _prepareTime: number = 0;

  /** Resets all tracked statistics back to their initial state.
   * @internal
   */
  public reset(): void {
    this._executeStartTime = 0;
    this._prepareTime = 0;
  }

  /** Records the current timestamp as the start of an execute call.
   * @internal
   */
  public startExecution(): void {
    this._executeStartTime = Date.now();
  }

  /** Stores the time taken to prepare the ECSql statement.
   * @param prepareTimeMs - Preparation duration in milliseconds.
   * @internal
   */
  public recordPrepareTime(prepareTimeMs: number): void {
    this._prepareTime = prepareTimeMs;
  }

  /** Returns the elapsed wall-clock time in milliseconds since `startExecution` was called.
   * Returns 0 if execution has not been started.
   * @internal
   */
  private getElapsedTimeMs(): number {
    return this._executeStartTime > 0 ? Date.now() - this._executeStartTime : 0;
  }

  /** Computes the serialized byte size of the given response data array.
   * Returns 0 when the array is empty or undefined.
   * @param responseData - The row data to measure.
   * @internal
   */
  private computeMemUsed(responseData: any[]): number {
    if (responseData.length === 0)
      return 0;
    return Buffer.byteLength(JSON.stringify(responseData), "utf8");
  }

  /** Extracts the time limit from the request quota and converts it from seconds to milliseconds.
   * Returns 0 when no quota is specified.
   * @param request - The query request containing optional quota information.
   * @internal
   */
  private getTimeLimitMs(request: DbQueryRequest): number {
    return request.quota?.time ? request.quota.time * 1000 : 0;
  }

  /** Extracts the memory limit in bytes from the request quota.
   * Returns 0 when no quota is specified.
   * @param request - The query request containing optional quota information.
   * @internal
   */
  private getMemLimitBytes(request: DbQueryRequest): number {
    return request.quota?.memory ?? 0;
  }

  /** Builds a complete `DbRuntimeStats` snapshot from the current tracked state.
   * @param request - The query request (used to read quota limits).
   * @param responseData - The response row data (used to estimate memory consumption).
   * @returns A fully populated `DbRuntimeStats` object.
   * @internal
   */
  public calculateStats(request: DbQueryRequest, responseData: any[]): DbRuntimeStats {
    const totalTimeMs = this.getElapsedTimeMs();
    return {
      cpuTime: totalTimeMs * 1000, // milliseconds -> microseconds
      totalTime: totalTimeMs,
      timeLimit: this.getTimeLimitMs(request),
      memLimit: this.getMemLimitBytes(request),
      memUsed: this.computeMemUsed(responseData),
      prepareTime: this._prepareTime,
    };
  }

  /** Checks whether the execution has exceeded the time or memory limits specified in the request quota.
   * A limit of 0 (i.e. unset) is never considered exceeded.
   * @param request - The query request containing optional quota information.
   * @param responseData - The response row data (used to estimate memory consumption for the memory-limit check).
   * @returns `true` if either the time limit or memory limit has been exceeded, `false` otherwise.
   * @internal
   */
  public isLimitExceeded(request: DbQueryRequest, responseData: any[]): boolean {
    const timeLimit = this.getTimeLimitMs(request);
    if (timeLimit > 0 && this.getElapsedTimeMs() > timeLimit)
      return true;

    const memLimit = this.getMemLimitBytes(request);
    if (memLimit > 0 && this.computeMemUsed(responseData) > memLimit)
      return true;

    return false;
  }
}

/**
 * Executes ECSql queries one row at a time against an IModelDb, maintaining statement state between
 * successive calls so the caller can page through results via offset-based requests.
 * @internal
 */
export class ECSqlRowExecutor implements DbRequestExecutor<DbQueryRequest, DbQueryResponse> {
  private _stmt: ECSqlStatement;
  private _stmtArgs: object | undefined;
  private _rowCnt: number;
  private _stats: ECSqlExecutionStats;

  public constructor(private readonly iModelDb: IModelDb) {
    this._stmt = new ECSqlStatement();
    this._stmtArgs = undefined;
    this._rowCnt = 0;
    this._stats = new ECSqlExecutionStats();
    this.iModelDb.notifyECSQlRowExecutorToBeReset.addListener(() => this.reset());
  }

  /** Disposes the current statement and resets all internal state.
   * Invoked when the IModelDb signals that the executor must be recycled.
   * @internal
   */
  private reset(): void {
    this._stmt[Symbol.dispose]();
    this._stmtArgs = undefined;
    this._rowCnt = 0;
    this._stats.reset();
  }

  /** Returns whether the underlying ECSql statement has already been prepared.
   * @internal
   */
  private isStatementPrepared(): boolean {
    return this._stmt.isPrepared;
  }

  /** Performs a deep-equality check (via JSON serialization) between the cached bind parameters and the given args.
   * @param args - The new set of bind parameters to compare against the cached ones.
   * @returns `true` if both are structurally identical, `false` otherwise.
   * @internal
   */
  private isStmtParamsSame(args: object | undefined): boolean {
    if (this._stmtArgs === undefined && args !== undefined) return false;
    if (this._stmtArgs !== undefined && args === undefined) return false;
    if (this._stmtArgs === undefined && args === undefined) return true;

    return JSON.stringify(this._stmtArgs) === JSON.stringify(args);
  }

  // --------------------------------------------------------------------------------------------
  // Response builders
  // --------------------------------------------------------------------------------------------

  /** Constructs a `DbQueryResponse` representing an error condition.
   * @param errorStatus - The specific error status code (must be >= `DbResponseStatus.Error`).
   * @param message - Human-readable error description.
   * @param request - The originating query request (used for stats computation).
   * @internal
   */
  private createErrorResponse(errorStatus: DbResponseStatus, message: string, request: DbQueryRequest): DbQueryResponse {
    assert(errorStatus >= DbResponseStatus.Error, "createErrorResponse should only be called with error status");
    return {
      status: errorStatus,
      stats: this._stats.calculateStats(request, []),
      kind: DbResponseKind.NoResult,
      error: message,
      rowCount: 0,
      data: [],
      meta: [],
    };
  }

  /** Constructs a `DbQueryResponse` indicating that more rows remain to be fetched.
   * @param responseData - The row data produced in this batch.
   * @param responseMetaData - Column metadata for the result set.
   * @param request - The originating query request (used for stats computation).
   * @internal
   */
  private createPartialResponse(responseData: any[], responseMetaData: QueryPropertyMetaData[], request: DbQueryRequest): DbQueryResponse {
    return {
      status: DbResponseStatus.Partial,
      stats: this._stats.calculateStats(request, responseData),
      kind: DbResponseKind.ECSql,
      rowCount: responseData.length,
      data: responseData,
      meta: responseMetaData,
    };
  }

  /** Constructs a `DbQueryResponse` indicating that the result set has been fully consumed.
   * @param responseMetaData - Column metadata for the result set.
   * @param request - The originating query request (used for stats computation).
   * @internal
   */
  private createDoneResponse(responseMetaData: QueryPropertyMetaData[], request: DbQueryRequest): DbQueryResponse {
    return {
      status: DbResponseStatus.Done,
      stats: this._stats.calculateStats(request, []),
      kind: DbResponseKind.ECSql,
      rowCount: 0,
      data: [],
      meta: responseMetaData,
    };
  }

  // --------------------------------------------------------------------------------------------
  // Core execution
  // --------------------------------------------------------------------------------------------

  /** Executes a single page of an ECSql query. The executor maintains the prepared statement
   * across calls, advancing the cursor to the requested offset and returning one row per invocation.
   * @param request - The query request describing the ECSql, parameters, offset, and options.
   * @returns A `DbQueryResponse` with status, row data, metadata, and runtime statistics.
   * @internal
   */
  public async execute(request: DbQueryRequest): Promise<DbQueryResponse> {
    this._stats.startExecution();
    let isStmtJustPreparedOrRebinded = false;

    // Prepare the statement if it hasn't been prepared yet.
    if (!this.isStatementPrepared()) {
      let result = this.prepareStmt(request.query);
      if (!result.isSuccessful)
        return this.createErrorResponse(DbResponseStatus.Error_ECSql_PreparedFailed, result.message ?? `Failed to prepare statement.${request.query}`, request);

      result = this.bindValues(request.args);
      if (!result.isSuccessful)
        return this.createErrorResponse(DbResponseStatus.Error_ECSql_BindingFailed, result.message ?? `Failed to bind values.${request.query}`, request);

      isStmtJustPreparedOrRebinded = true;
    }

    // Rebind if parameters have changed since last call.
    if (!this.isStmtParamsSame(request.args)) {
      const result = this.bindValues(request.args);
      if (!result.isSuccessful)
        return this.createErrorResponse(DbResponseStatus.Error_ECSql_BindingFailed, result.message ?? `Failed to bind values.${request.query}`, request);

      isStmtJustPreparedOrRebinded = true;
    }

    if (request.limit?.offset === undefined)
      return this.createErrorResponse(DbResponseStatus.Error, "Offset must be provided in the limit.", request);

    if (request.limit.offset < this._rowCnt)
      return this.createErrorResponse(DbResponseStatus.Error, "Offset less than already fetched rows. Something went wrong", request);

    const rowAdaptorOptions = this.constructRowAdaptorOptions(request);

    // Fetch metadata when explicitly requested or when the statement was just prepared/rebound.
    let metaDataResult: QueryPropertyMetaData[] = [];
    if (request.includeMetaData || isStmtJustPreparedOrRebinded) {
      const metaDataResp = this.getMetaData(rowAdaptorOptions);
      if (!metaDataResp.isSuccessful)
        return this.createErrorResponse(DbResponseStatus.Error, metaDataResp.message ?? `Failed to get metadata.${request.query}`, request);

      metaDataResult = metaDataResp.metaData;
    }

    // Advance the cursor to the requested offset, checking limits and interrupts along the way.
    while (this._rowCnt !== request.limit.offset) {
      if (this._stats.isLimitExceeded(request, []))
        return this.createPartialResponse([], metaDataResult, request);

      const stepResult = this.step();
      if (!stepResult.isSuccessful)
        return this.createErrorResponse(DbResponseStatus.Error_ECSql_StepFailed, stepResult.message ?? `Step failed.${request.query}`, request);

      if (stepResult.stepResult === DbResult.BE_SQLITE_DONE)
        return this.createDoneResponse(metaDataResult, request);

      if (stepResult.stepResult === DbResult.BE_SQLITE_BUSY || stepResult.stepResult === DbResult.BE_SQLITE_INTERRUPT)
        return this.createPartialResponse([], metaDataResult, request);
    }

    // Step once more to fetch the actual row at the current offset.
    const stepResult = this.step();
    if (!stepResult.isSuccessful)
      return this.createErrorResponse(DbResponseStatus.Error_ECSql_StepFailed, stepResult.message ?? `Step failed.${request.query}`, request);

    if (stepResult.stepResult === DbResult.BE_SQLITE_DONE)
      return this.createDoneResponse(metaDataResult, request);

    if (stepResult.stepResult === DbResult.BE_SQLITE_BUSY || stepResult.stepResult === DbResult.BE_SQLITE_INTERRUPT)
      return this.createPartialResponse([], metaDataResult, request);

    // Extract the row data and verify limits haven't been breached.
    const rowDataResult = this.toRowData(rowAdaptorOptions);
    if (!rowDataResult.isSuccessful)
      return this.createErrorResponse(DbResponseStatus.Error_ECSql_RowToJsonFailed, rowDataResult.message ?? `Failed to get row data.${request.query}`, request);

    if (this._stats.isLimitExceeded(request, rowDataResult.rowData))
      return this.createPartialResponse([], metaDataResult, request);

    return this.createPartialResponse(rowDataResult.rowData, metaDataResult, request);
  }

  // --------------------------------------------------------------------------------------------
  // Statement helpers
  // --------------------------------------------------------------------------------------------

  /** Builds the native row-adaptor options from the request parameters.
   * These must stay in sync with the options used by the concurrent query path so that
   * `ECSqlReader` produces consistent results regardless of execution mode.
   * @param request - The query request describing format and conversion preferences.
   * @returns Native row-adaptor options.
   * @internal
   */
  private constructRowAdaptorOptions(request: DbQueryRequest): IModelJsNative.ECSqlRowAdaptorOptions {
    return {
      abbreviateBlobs: request.abbreviateBlobs ?? false,
      classIdsToClassNames: request.convertClassIdsToClassNames ?? false,
      useJsName: request.valueFormat === DbValueFormat.JsNames,
      // In 4.x, people are currently dependent on the behavior of aliased classIds `select classId as aliasedClassId` not being
      // converted into classNames which is a bug that we must now support. This option preserves this special behavior until
      // it can be removed in a future version.
      doNotConvertClassIdsToClassNamesWhenAliased: true,
    };
  }

  /** Retrieves column metadata from the prepared statement.
   * @param args - Native row-adaptor options that influence property naming.
   * @returns A `MetaDataResult` with the metadata array on success, or an error message on failure.
   * @internal
   */
  private getMetaData(args: IModelJsNative.ECSqlRowAdaptorOptions): MetaDataResult {
    try {
      const metaData = this._stmt.getMetadata(args).properties;
      return { isSuccessful: true, metaData };
    } catch (error: any) {
      return { isSuccessful: false, message: error.message, metaData: [] };
    }
  }

  /** Extracts the current row's data from the prepared statement into a serializable array.
   * @param args - Native row-adaptor options that influence value formatting.
   * @returns A `RowDataResult` wrapping the row data on success, or an error message on failure.
   * @internal
   */
  private toRowData(args: IModelJsNative.ECSqlRowAdaptorOptions): RowDataResult {
    try {
      const rowData = this._stmt.toRow(args);
      return { isSuccessful: true, rowData: [rowData.data] };
    } catch (error: any) {
      return { isSuccessful: false, message: error.message, rowData: [] };
    }
  }

  /** Advances the prepared statement cursor by one row, incrementing the internal row counter on `BE_SQLITE_ROW`.
   * Treats `BE_SQLITE_BUSY` and `BE_SQLITE_INTERRUPT` as non-fatal so the caller can return a partial response.
   * @returns A `StepResult` indicating the native step code and whether the step succeeded.
   * @internal
   */
  private step(): StepResult {
    try {
      const stepResult = this._stmt.step();
      if (stepResult === DbResult.BE_SQLITE_ROW || stepResult === DbResult.BE_SQLITE_DONE
        || stepResult === DbResult.BE_SQLITE_INTERRUPT || stepResult === DbResult.BE_SQLITE_BUSY) {
        this._rowCnt += stepResult === DbResult.BE_SQLITE_ROW ? 1 : 0;
        return { stepResult, isSuccessful: true };
      }
      return { stepResult, isSuccessful: false, message: `Step failed with code ${stepResult}` };
    } catch (error: any) {
      return { stepResult: DbResult.BE_SQLITE_ERROR, isSuccessful: false, message: error.message };
    }
  }

  /** Prepares the ECSql statement against the native database and records the elapsed preparation time.
   * @param ecsql - The ECSql text to prepare.
   * @returns An `OperationResult` indicating success or failure.
   * @internal
   */
  private prepareStmt(ecsql: string): OperationResult {
    const prepareStart = Date.now();
    try {
      this._stmt.prepare(this.iModelDb[_nativeDb], ecsql);
      return { isSuccessful: true };
    } catch (error: any) {
      return { isSuccessful: false, message: error.message };
    } finally {
      this._stats.recordPrepareTime(Date.now() - prepareStart);
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

      this._stmt.reset();
      this._stmt.bindParams(args);
      this._stmtArgs = args;
      return { isSuccessful: true };
    } catch (error: any) {
      return { isSuccessful: false, message: error.message };
    }
  }
}