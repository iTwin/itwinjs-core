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

type customResult = {
  isSuccessful: boolean;
  message?: string;
}
type customStepResult = customResult & {
  stepResult: DbResult;
}

type custommMetaDataResult = customResult & {
  metaData: QueryPropertyMetaData[];
}

type customRowResult = customResult & {
  rowData: any[];
}

/** Tracks execution statistics for ECSql queries
 * @internal
*/
class ECSqlExecutionStats {
  private _executeStartTime: number = 0;
  private _prepareTime: number = 0;

  public reset(): void {
    this._executeStartTime = 0;
    this._prepareTime = 0;
  }

  public startExecution(): void {
    this._executeStartTime = Date.now();
  }

  public recordPrepareTime(prepareTimeMs: number): void {
    this._prepareTime = prepareTimeMs;
  }

  public calculateStats(request: DbQueryRequest, responseData: any[]): DbRuntimeStats {
    const now = Date.now();
    const totalTimeMs = this._executeStartTime > 0 ? now - this._executeStartTime : 0;

    // Calculate memory used if responseData is provided
    let memUsed = 0;
    if (responseData && responseData.length > 0) {
      const jsonStr = JSON.stringify(responseData);
      memUsed = Buffer.byteLength(jsonStr, "utf8");
    }

    return {
      cpuTime: totalTimeMs * 1000, // Convert ms to microseconds
      totalTime: totalTimeMs,
      timeLimit: request.quota?.time ? request.quota.time * 1000 : 0, // Convert seconds to milliseconds
      memLimit: request.quota?.memory ?? 0,
      memUsed,
      prepareTime: this._prepareTime,
    };
  }

  public isLimitExceeded(request: DbQueryRequest, responseData: any[]): boolean {
    const now = Date.now();
    const totalTimeMs = this._executeStartTime > 0 ? now - this._executeStartTime : 0;
    const timeLimit = request.quota?.time ? request.quota.time * 1000 : 0; // Convert seconds to milliseconds

    let timeLimitExceeded = false;
    if (timeLimit > 0) {
      timeLimitExceeded = totalTimeMs > timeLimit;
    }

    let memLimitExceeded = false;
    const memLimit = request.quota?.memory ?? 0;
    if (memLimit > 0) {
      let memUsed = 0;
      if (responseData && responseData.length > 0) {
        const jsonStr = JSON.stringify(responseData);
        memUsed = Buffer.byteLength(jsonStr, "utf8");
      }
      memLimitExceeded = memUsed > memLimit;
    }

    return timeLimitExceeded || memLimitExceeded;
  }
}

export class ECSqlRowExecutor implements DbRequestExecutor<DbQueryRequest, DbQueryResponse> {
  private _stmt: ECSqlStatement
  private _stmtArgs: object | undefined;
  private _rowCnt: number;
  private _stats: ECSqlExecutionStats;
  public constructor(private readonly iModelDb: IModelDb) {
    this._stmt = new ECSqlStatement(); this._stmtArgs = undefined; this._rowCnt = 0;
    this._stats = new ECSqlExecutionStats();
    this.iModelDb.notifyECSQlRowExecutorToBeReset.addListener(() => this.reset());
  }

  private reset() {
    this._stmt[Symbol.dispose]();
    this._stmtArgs = undefined;
    this._rowCnt = 0;
    this._stats.reset();
  }

  private isStatementPrepared(): boolean {
    return this._stmt.isPrepared;
  }

  private isStmtParamsSame(args: object | undefined): boolean {
    if (this._stmtArgs === undefined && args !== undefined) return false;
    if (this._stmtArgs !== undefined && args === undefined) return false;
    if (this._stmtArgs === undefined && args === undefined) return true;

    return JSON.stringify(this._stmtArgs) === JSON.stringify(args);
  }

  private async createErrorResponse(error_status: DbResponseStatus, message: string, request: DbQueryRequest): Promise<DbQueryResponse> {
    assert(error_status >= DbResponseStatus.Error, "createErrorResponse should only be called with error status");
    const errResponse = {
      status: error_status,
      stats: this._stats.calculateStats(request, []),
      kind: DbResponseKind.NoResult,
      error: message,
      rowCount: 0,
      data: [],
      meta: [],
    };
    return new Promise((resolve) => {
      resolve(errResponse);
    });
  }

  private createPartialResponse(responseData: any[], responseMetaData: QueryPropertyMetaData[], request: DbQueryRequest): Promise<DbQueryResponse> {
    const errResponse = {
      status: DbResponseStatus.Partial,
      stats: this._stats.calculateStats(request, responseData),
      kind: DbResponseKind.ECSql,
      rowCount: responseData.length,
      data: responseData,
      meta: responseMetaData,
    };
    return new Promise((resolve) => {
      resolve(errResponse);
    });
  }

  private createDoneResponse(responseMetaData: QueryPropertyMetaData[], request: DbQueryRequest): Promise<DbQueryResponse> {
    const errResponse = {
      status: DbResponseStatus.Done,
      stats: this._stats.calculateStats(request, []),
      kind: DbResponseKind.ECSql,
      rowCount: 0,
      data: [],
      meta: responseMetaData,
    };
    return new Promise((resolve) => {
      resolve(errResponse);
    });
  }

  public async execute(request: DbQueryRequest): Promise<DbQueryResponse> {
    this._stats.startExecution();
    let isStmtJustPreparedOrRebinded = false;
    if (!this.isStatementPrepared()) {
      let errorIfAny = this.prepareStmt(request.query); // prepare
      if (!errorIfAny.isSuccessful) {
        return await this.createErrorResponse(DbResponseStatus.Error_ECSql_PreparedFailed, errorIfAny.message ?? `Failed to prepare statement.${request.query}`, request);
      }
      errorIfAny = this.bindValues(request.args); // And bind values if any
      if (!errorIfAny.isSuccessful) {
        return await this.createErrorResponse(DbResponseStatus.Error_ECSql_BindingFailed, errorIfAny.message ?? `Failed to bind values.${request.query}`, request);
      }
      isStmtJustPreparedOrRebinded = true;
    }

    if (!this.isStmtParamsSame(request.args)) {
      const errorIfAny = this.bindValues(request.args); // rebind
      if (!errorIfAny.isSuccessful) {
        return await this.createErrorResponse(DbResponseStatus.Error_ECSql_BindingFailed, errorIfAny.message ?? `Failed to bind values.${request.query}`, request);
      }
      isStmtJustPreparedOrRebinded = true;
    }

    if (request.limit?.offset === undefined) return await this.createErrorResponse(DbResponseStatus.Error, "Offset must be provided in the limit.", request);

    if (request.limit.offset < this._rowCnt) return await this.createErrorResponse(DbResponseStatus.Error, "Offset less than already fetched rows. Something went wrong", request);

    const rowAdaptorOptions = this.constructRowAdaptorOptions(request);

    let metaDataResult: QueryPropertyMetaData[] = [];
    if (request.includeMetaData || isStmtJustPreparedOrRebinded) {
      const metaDataResp = this.getMetaData(rowAdaptorOptions);
      if (!metaDataResp.isSuccessful) {
        return await this.createErrorResponse(DbResponseStatus.Error, metaDataResp.message ?? `Failed to get metadata.${request.query}`, request);
      }
      metaDataResult = metaDataResp.metaData;
    }

    while (this._rowCnt !== request.limit.offset) { // if statement is reprepared we should take steps to bring it back to its orginal state according to offset provided in request.
      if (this._stats.isLimitExceeded(request, [])) {
        return await this.createPartialResponse([], metaDataResult, request);
      }
      const stepResult = this.step();
      if (!stepResult.isSuccessful) {
        return await this.createErrorResponse(DbResponseStatus.Error_ECSql_StepFailed, stepResult.message ?? `Step failed.${request.query}`, request);
      }
      if (stepResult.stepResult === DbResult.BE_SQLITE_DONE) return await this.createDoneResponse(metaDataResult, request);
      else if (stepResult.stepResult === DbResult.BE_SQLITE_BUSY || stepResult.stepResult === DbResult.BE_SQLITE_INTERRUPT) {
        return await this.createPartialResponse([], metaDataResult, request);
      }
    }

    const stepResult = this.step();
    if (!stepResult.isSuccessful) {
      return await this.createErrorResponse(DbResponseStatus.Error_ECSql_StepFailed, stepResult.message ?? `Step failed.${request.query}`, request);
    }

    if (stepResult.stepResult === DbResult.BE_SQLITE_DONE) return await this.createDoneResponse(metaDataResult, request);
    else if (stepResult.stepResult === DbResult.BE_SQLITE_BUSY || stepResult.stepResult === DbResult.BE_SQLITE_INTERRUPT) {
      return await this.createPartialResponse([], metaDataResult, request);
    }

    const rowDataResult = this.toRowData(rowAdaptorOptions);
    if (!rowDataResult.isSuccessful) {
      return await this.createErrorResponse(DbResponseStatus.Error_ECSql_RowToJsonFailed, rowDataResult.message ?? `Failed to get row data.${request.query}`, request);
    }

    if (this._stats.isLimitExceeded(request, rowDataResult.rowData)) {
      return await this.createPartialResponse([], metaDataResult, request);
    }

    return this.createPartialResponse(rowDataResult.rowData, metaDataResult, request);
  }

  /**
   * This constructs row adaptor options based on the request parameters.
   * These are in accordance with how row adaptor options are set in case of concurrent query and should always be kept matched with that behavior, to avoid unexpected behavior of ECSqlReader.
   * @param request
   * @returns {IModelJsNative.ECSqlRowAdaptorOptions}
   * @internal
   */
  private constructRowAdaptorOptions(request: DbQueryRequest): IModelJsNative.ECSqlRowAdaptorOptions {
    return {
      abbreviateBlobs: request.abbreviateBlobs ?? false,
      classIdsToClassNames: request.convertClassIdsToClassNames ?? false,
      useJsName: request.valueFormat === DbValueFormat.JsNames,
      // In 4.x, people are currently dependent on the behavior of aliased classIds `select classId as aliasedClassId` not being
      // converted into classNames which is a bug that we must now support.This option preserves this special behavior until
      // it can be removed in a future version.
      doNotConvertClassIdsToClassNamesWhenAliased: true
    };
  }

  private getMetaData(args: IModelJsNative.ECSqlRowAdaptorOptions): custommMetaDataResult {
    try {
      const metaData = this._stmt.getMetadata(args).properties;
      return { isSuccessful: true, metaData };
    } catch (error: any) {
      return { isSuccessful: false, message: error.message, metaData: [] };
    }
  }

  private toRowData(args: IModelJsNative.ECSqlRowAdaptorOptions): customRowResult {
    try {
      const rowData = this._stmt.toRow(args);
      return { isSuccessful: true, rowData: [rowData.data] };
    } catch (error: any) {
      return { isSuccessful: false, message: error.message, rowData: [] };
    }
  }

  private step(): customStepResult {
    try {
      const stepResult = this._stmt.step();
      if (stepResult === DbResult.BE_SQLITE_ROW || stepResult === DbResult.BE_SQLITE_DONE || stepResult === DbResult.BE_SQLITE_INTERRUPT || stepResult === DbResult.BE_SQLITE_BUSY) {
        this._rowCnt += stepResult === DbResult.BE_SQLITE_ROW ? 1 : 0;
        return { stepResult, isSuccessful: true };
      }
      return { stepResult, isSuccessful: false, message: `Step failed with code ${stepResult}` };
    } catch (error: any) {
      return { stepResult: DbResult.BE_SQLITE_ERROR, isSuccessful: false, message: error.message };
    }
  }

  private prepareStmt(ecsql: string): customResult {
    let prepareStart;
    try {
      prepareStart = Date.now();
      this._stmt.prepare(this.iModelDb[_nativeDb], ecsql);
      this._stats.recordPrepareTime(Date.now() - prepareStart);
      return { isSuccessful: true };
    }
    catch (error: any) {
      return { isSuccessful: false, message: error.message };
    }
    finally {
      this._stats.recordPrepareTime(Date.now() - (prepareStart ?? Date.now()));
    }
  }

  private bindValues(args: object | undefined): customResult {
    try {
      if (args === undefined) return { isSuccessful: true };
      this._stmt.reset();
      this._stmt.bindParams(args);
      this._stmtArgs = args;
      return { isSuccessful: true };
    }
    catch (error: any) {
      return { isSuccessful: false, message: error.message };
    }
  }
}