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

/** Result of an ECSql step operation, extending `OperationResult` with the native step return code.
 * @internal
 */
interface StepResult extends OperationResult {
  stepResult: DbResult;
}

/** Result of a metadata retrieval operation, extending `OperationResult` with the property metadata array.
 * @internal
 */
interface MetaDataResult extends OperationResult {
  metaData: QueryPropertyMetaData[];
}

/** Result of a row data extraction operation, extending `OperationResult` with the extracted row data.
 * @internal
 */
interface RowDataResult extends OperationResult {
  rowData: any[];
}

/** Outcome of ensuring the statement is prepared and its parameters are bound.
 * @internal
 */
interface StatementReadyResult {
  /** If present, an error occurred and this response should be returned immediately by the caller. */
  error?: DbQueryResponse;
  /** Whether the statement was freshly prepared or its parameters were rebound during this call. */
  freshlyPrepared: boolean;
}

// --------------------------------------------------------------------------------------------
// ECSqlExecutionStats
// --------------------------------------------------------------------------------------------

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
   * Returns 0 when the array is empty.
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

// --------------------------------------------------------------------------------------------
// ECSqlRowExecutor
// --------------------------------------------------------------------------------------------

/**
 * Executes ECSql queries one row at a time against an IModelDb, maintaining statement state between
 * successive calls so the caller can page through results via offset-based requests.
 * @internal
 */
export class ECSqlRowExecutor implements DbRequestExecutor<DbQueryRequest, DbQueryResponse> {
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  private _stmt: ECSqlStatement;
  private _toBind: boolean = true;
  private _rowCnt: number;
  private _stats: ECSqlExecutionStats;

  public constructor(private readonly _db: IModelDb | ECDb) {
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    this._stmt = new ECSqlStatement();
    this._toBind = true;
    this._rowCnt = 0;
    this._stats = new ECSqlExecutionStats();
    this._db.notifyECSQlRowExecutorToBeReset.addListener(() => this.cleanup());
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
    this._toBind = true;
    this._rowCnt = 0;
    this._stats.reset();
  }

  /**
   * Resets the executor, optionally clearing all parameter bindings.
   * @param clearBindings - If `true`, all parameter bindings are cleared.
   * @internal
   */
  public reset(clearBindings?: boolean): void {
    if (this._stmt.isPrepared) {
      this._stmt.reset();
      this._rowCnt = 0;
      if (clearBindings) {
        this._stmt.clearBindings();
        this._toBind = true;
      }
    }
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
   * @param metaData - Column metadata for the result set.
   * @param request - The originating query request (used for stats computation).
   * @internal
   */
  private createPartialResponse(responseData: any[], metaData: QueryPropertyMetaData[], request: DbQueryRequest): DbQueryResponse {
    return {
      status: DbResponseStatus.Partial,
      stats: this._stats.calculateStats(request, responseData),
      kind: DbResponseKind.ECSql,
      rowCount: responseData.length,
      data: responseData,
      meta: metaData,
    };
  }

  /** Constructs a `DbQueryResponse` indicating that the result set has been fully consumed.
   * @param metaData - Column metadata for the result set.
   * @param request - The originating query request (used for stats computation).
   * @internal
   */
  private createDoneResponse(metaData: QueryPropertyMetaData[], request: DbQueryRequest): DbQueryResponse {
    return {
      status: DbResponseStatus.Done,
      stats: this._stats.calculateStats(request, []),
      kind: DbResponseKind.ECSql,
      rowCount: 0,
      data: [],
      meta: metaData,
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

    const readyResult = this.ensureStatementReady(request);
    if (readyResult.error)
      return readyResult.error;

    if (request.limit?.offset === undefined)
      return this.createErrorResponse(DbResponseStatus.Error, "Offset must be provided in the limit.", request);

    if (request.limit.offset < this._rowCnt)
      return this.createErrorResponse(DbResponseStatus.Error, "Offset less than already fetched rows. Something went wrong", request);

    const rowAdaptorOptions = this.constructRowAdaptorOptions(request);

    const metaDataResult = this.resolveMetaData(request, rowAdaptorOptions, readyResult.freshlyPrepared);
    if (!metaDataResult.isSuccessful)
      return this.createErrorResponse(DbResponseStatus.Error, metaDataResult.message ?? `Failed to get metadata.${request.query}`, request);

    const advanceResponse = this.advanceCursorToOffset(request, request.limit.offset, metaDataResult.metaData);
    if (advanceResponse !== undefined)
      return advanceResponse;

    return this.fetchCurrentRow(request, rowAdaptorOptions, metaDataResult.metaData);
  }

  // --------------------------------------------------------------------------------------------
  // Execution phases
  // --------------------------------------------------------------------------------------------

  /** Ensures the statement is prepared and its parameters are bound.
   * If the statement hasn't been prepared yet, it prepares and binds in one go.
   * If the statement is already prepared but the parameters have changed, it rebinds.
   * @param request - The query request containing the ECSql and bind parameters.
   * @returns A `StatementReadyResult` indicating success (with `freshlyPrepared`) or failure (with `error`).
   * @internal
   */
  private ensureStatementReady(request: DbQueryRequest): StatementReadyResult {
    let freshlyPrepared = false;

    if (!this._stmt.isPrepared) {
      let result = this.prepareStmt(request.query);
      if (!result.isSuccessful)
        return { error: this.createErrorResponse(DbResponseStatus.Error_ECSql_PreparedFailed, result.message ?? `Failed to prepare statement.${request.query}`, request), freshlyPrepared: false };

      result = this.bindValues(request.args);
      if (!result.isSuccessful)
        return { error: this.createErrorResponse(DbResponseStatus.Error_ECSql_BindingFailed, result.message ?? `Failed to bind values.${request.query}`, request), freshlyPrepared: false };

      freshlyPrepared = true;
    }

    if (this._toBind) {
      const result = this.bindValues(request.args);
      if (!result.isSuccessful)
        return { error: this.createErrorResponse(DbResponseStatus.Error_ECSql_BindingFailed, result.message ?? `Failed to bind values.${request.query}`, request), freshlyPrepared: false };

      freshlyPrepared = true;
    }

    return { freshlyPrepared };
  }

  /** Retrieves column metadata if explicitly requested or if the statement was freshly prepared/rebound.
   * When metadata is not needed, returns a successful result with an empty array.
   * @param request - The query request (checked for `includeMetaData`).
   * @param options - Native row-adaptor options that influence property naming.
   * @param freshlyPrepared - Whether the statement was just prepared or rebound.
   * @returns A `MetaDataResult` with the metadata array on success, or an error message on failure.
   * @internal
   */
  private resolveMetaData(request: DbQueryRequest, options: IModelJsNative.ECSqlRowAdaptorOptions, freshlyPrepared: boolean): MetaDataResult {
    if (!request.includeMetaData && !freshlyPrepared)
      return { isSuccessful: true, metaData: [] };

    return this.getMetaData(options);
  }

  /** Advances the cursor forward until it reaches the requested offset, checking quota limits
   * and handling interrupts at each step.
   * @param request - The query request (used for error/response construction and limit checks).
   * @param targetOffset - The row offset to advance to.
   * @param metaData - Column metadata to include in any early response.
   * @returns A `DbQueryResponse` if the cursor cannot reach the target offset (done, interrupted,
   *          limit exceeded, or step failure), or `undefined` if the offset was reached successfully.
   * @internal
   */
  private advanceCursorToOffset(request: DbQueryRequest, targetOffset: number, metaData: QueryPropertyMetaData[]): DbQueryResponse | undefined {
    while (this._rowCnt !== targetOffset) {
      if (this._stats.isLimitExceeded(request, []))
        return this.createPartialResponse([], metaData, request);

      const earlyResponse = this.stepAndCheck(request, metaData);
      if (earlyResponse !== undefined)
        return earlyResponse;
    }
    return undefined;
  }

  /** Steps the cursor once, extracts the row data, and returns a partial response.
   * If the step yields DONE, BUSY, or INTERRUPT, or if quota limits are exceeded after
   * row extraction, an appropriate response is returned without row data.
   * @param request - The query request (used for error/response construction and limit checks).
   * @param options - Native row-adaptor options for value formatting.
   * @param metaData - Column metadata to include in the response.
   * @returns The final `DbQueryResponse` for this execution cycle.
   * @internal
   */
  private fetchCurrentRow(request: DbQueryRequest, options: IModelJsNative.ECSqlRowAdaptorOptions, metaData: QueryPropertyMetaData[]): DbQueryResponse {
    const earlyResponse = this.stepAndCheck(request, metaData);
    if (earlyResponse !== undefined)
      return earlyResponse;

    const rowDataResult = this.toRowData(options);
    if (!rowDataResult.isSuccessful)
      return this.createErrorResponse(DbResponseStatus.Error_ECSql_RowToJsonFailed, rowDataResult.message ?? `Failed to get row data.${request.query}`, request);

    if (this._stats.isLimitExceeded(request, rowDataResult.rowData))
      return this.createPartialResponse([], metaData, request);

    return this.createPartialResponse(rowDataResult.rowData, metaData, request);
  }

  /** Steps the cursor once and maps non-`BE_SQLITE_ROW` outcomes to a response.
   * Returns `undefined` when the step produced `BE_SQLITE_ROW`, meaning the caller
   * should proceed to extract the row data.
   * @param request - The query request (used for error/response construction).
   * @param metaData - Column metadata to include in any early response.
   * @returns A `DbQueryResponse` if the step did not produce a row, or `undefined` if a row is available.
   * @internal
   */
  private stepAndCheck(request: DbQueryRequest, metaData: QueryPropertyMetaData[]): DbQueryResponse | undefined {
    const result = this.step();

    if (!result.isSuccessful)
      return this.createErrorResponse(DbResponseStatus.Error_ECSql_StepFailed, result.message ?? `Step failed.${request.query}`, request);

    if (result.stepResult === DbResult.BE_SQLITE_DONE)
      return this.createDoneResponse(metaData, request);

    if (result.stepResult === DbResult.BE_SQLITE_BUSY || result.stepResult === DbResult.BE_SQLITE_INTERRUPT)
      return this.createPartialResponse([], metaData, request);

    return undefined; // BE_SQLITE_ROW — a row is ready for extraction
  }

  // --------------------------------------------------------------------------------------------
  // Statement helpers
  // --------------------------------------------------------------------------------------------
  /** Builds the native row-adaptor options from the request parameters.
   * These must stay in sync with how the options are set by the concurrent query path so that
   * `ECSqlReader` produces consistent results regardless of execution mode.
   * @param request - The query request describing format and conversion preferences.
   * @returns Native row-adaptor options.
   * @internal
   */
  private constructRowAdaptorOptions(request: DbQueryRequest): IModelJsNative.ECSqlRowAdaptorOptions {
    return {
      abbreviateBlobs: request.abbreviateBlobs ?? false,
      // eslint-disable-next-line @typescript-eslint/no-deprecated
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
   * Treats `BE_SQLITE_BUSY` and `BE_SQLITE_INTERRUPT` as non-fatal so the caller can return a partial response with no data which will trigger retry.
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
      this._stmt.prepare(this._db[_nativeDb], ecsql);
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
      if (args === undefined) {
        this._toBind = false;
        return { isSuccessful: true };
      }

      this._stmt.reset();
      this._stmt.bindParams(args);
      this._toBind = false;
      return { isSuccessful: true };
    } catch (error: any) {
      this._toBind = true; // Ensure we attempt to bind again on the next call since the current bind failed
      return { isSuccessful: false, message: error.message };
    }
  }
}