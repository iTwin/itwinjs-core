/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { DbQueryRequest, DbQueryResponse, DbRequestExecutor, DbResponseKind, DbResponseStatus, DbRuntimeStats, DbValueFormat, IModelError, QueryPropertyMetaData } from "@itwin/core-common";
import { IModelDb } from "./IModelDb";
import { ECSqlStatement } from "./ECSqlStatement";
import { assert, DbResult, IModelStatus } from "@itwin/core-bentley";
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
}

// --------------------------------------------------------------------------------------------
// ECSqlRowExecutor
// --------------------------------------------------------------------------------------------

/**
 * Executes ECSql queries one row at a time against an IModelDb, maintaining statement state between
 * successive calls so the caller can page through results via offset-based requests.
 * @internal
 */
export class ECSqlRowExecutor implements DbRequestExecutor<DbQueryRequest, DbQueryResponse>, Disposable {
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  private _stmt: ECSqlStatement;
  private _isDisposed: boolean = false;
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
    if (this._isDisposed) return;
    this._removeListener();
    this.cleanup();
    this._isDisposed = true;
  }

  // --------------------------------------------------------------------------------------------
  // Response builders
  // --------------------------------------------------------------------------------------------
  /**
   * Constructs a `DbRuntimeStats` object with placeholder values. This is because ECSqlSyncReader and ECSqlRowExecutor do not compute actual runtime statistics.
   * @returns A `DbRuntimeStats` object with all fields set to zero.
   */
  private getPlaceholderStats(): DbRuntimeStats {
    return {
      cpuTime: 0,
      totalTime: 0,
      timeLimit: 0,
      memLimit: 0,
      memUsed: 0,
      prepareTime: 0
    }
  }

  /** Constructs a `DbQueryResponse` representing an error condition.
   * @param errorStatus - The specific error status code (must be >= `DbResponseStatus.Error`).
   * @param message - Human-readable error description.
   * @param request - The originating query request (used for stats computation).
   * @internal
   */
  private createErrorResponse(errorStatus: DbResponseStatus, message: string): DbQueryResponse {
    assert(errorStatus >= DbResponseStatus.Error, "createErrorResponse should only be called with error status");
    return {
      status: errorStatus,
      stats: this.getPlaceholderStats(),
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
  private createPartialResponse(responseData: any[], metaData: QueryPropertyMetaData[]): DbQueryResponse {
    return {
      status: DbResponseStatus.Partial,
      stats: this.getPlaceholderStats(),
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
  private createDoneResponse(metaData: QueryPropertyMetaData[]): DbQueryResponse {
    return {
      status: DbResponseStatus.Done,
      stats: this.getPlaceholderStats(),
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
    if (this._isDisposed)
      throw new IModelError(IModelStatus.BadRequest, "Cannot use a disposed executor to execute request for ECSqlReader. The most probable reason for this is that ECSqlReader was being used in the callback of withSynchronousQueryReader but somehow left the callback context");

    const readyResult = this.ensureStatementReady(request);
    if (readyResult.error)
      return readyResult.error;

    const rowAdaptorOptions = this.constructRowAdaptorOptions(request);

    let metadataResult: MetaDataResult = { isSuccessful: true, metaData: [] };
    if (request.includeMetaData)
      metadataResult = this.resolveMetaData(rowAdaptorOptions);
    if (!metadataResult.isSuccessful)
      return this.createErrorResponse(DbResponseStatus.Error, metadataResult.message ?? `Failed to get metadata.${request.query}`);

    return this.fetchCurrentRow(request, rowAdaptorOptions, metadataResult.metaData);
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

    if (!this._stmt.isPrepared) {
      let result = this.prepareStmt(request.query);
      if (!result.isSuccessful)
        return { error: this.createErrorResponse(DbResponseStatus.Error_ECSql_PreparedFailed, result.message ?? `Failed to prepare statement.${request.query}`) };

      result = this.bindValues(request.args);
      if (!result.isSuccessful)
        return { error: this.createErrorResponse(DbResponseStatus.Error_ECSql_BindingFailed, result.message ?? `Failed to bind values.${request.query}`) };
    }

    return { error: undefined }; // everything worked correctly
  }

  /** Retrieves column metadata if explicitly requested or if the statement was freshly prepared/rebound.
   * When metadata is not needed, returns a successful result with an empty array.
   * @param request - The query request (checked for `includeMetaData`).
   * @param options - Native row-adaptor options that influence property naming.
   * @param freshlyPrepared - Whether the statement was just prepared or rebound.
   * @returns A `MetaDataResult` with the metadata array on success, or an error message on failure.
   * @internal
   */
  private resolveMetaData(options: IModelJsNative.ECSqlRowAdaptorOptions): MetaDataResult {
    return this.getMetaData(options);
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
      return this.createErrorResponse(DbResponseStatus.Error_ECSql_RowToJsonFailed, rowDataResult.message ?? `Failed to get row data.${request.query}`);

    return this.createPartialResponse(rowDataResult.rowData, metaData);
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
      return this.createErrorResponse(DbResponseStatus.Error_ECSql_StepFailed, result.message ?? `Step failed.${request.query}`);

    if (result.stepResult === DbResult.BE_SQLITE_DONE)
      return this.createDoneResponse(metaData);

    if (result.stepResult === DbResult.BE_SQLITE_BUSY || result.stepResult === DbResult.BE_SQLITE_INTERRUPT)
      return this.createPartialResponse([], metaData);

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