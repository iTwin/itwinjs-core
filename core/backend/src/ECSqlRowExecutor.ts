/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { DbQueryRequest, DbQueryResponse, DbRequestExecutor, DbResponseKind, DbResponseStatus, DbValueFormat, QueryPropertyMetaData } from "@itwin/core-common";
import { IModelDb } from "./IModelDb";
import { ECSqlStatement } from "./ECSqlStatement";
import { DbResult } from "@itwin/core-bentley";
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
export class ECSqlRowExecutor implements DbRequestExecutor<DbQueryRequest, DbQueryResponse> {
  private _stmt: ECSqlStatement
  private _stmtArgs: object | undefined;
  private _rowCnt: number;
  public constructor(private readonly iModelDb: IModelDb) { this._stmt = new ECSqlStatement(); this._stmtArgs = undefined; this._rowCnt = 0; this.iModelDb.onBeforeClose.addOnce(() => { this._stmt.dispose(); }) }

  private isStatementPrepared(): boolean {
    return this._stmt.isPrepared;
  }

  private isStmtParamsSame(args: object | undefined): boolean {
    if (this._stmtArgs === undefined && args !== undefined) return false;
    if (this._stmtArgs !== undefined && args === undefined) return false;
    if (this._stmtArgs === undefined && args === undefined) return true;

    return JSON.stringify(this._stmtArgs) === JSON.stringify(args);
  }

  private async createErrorResponse(message: string): Promise<DbQueryResponse> {
    const errResponse = {
      status: DbResponseStatus.Error,
      stats: { cpuTime: 0, totalTime: 0, timeLimit: 0, memLimit: 0, memUsed: 0, prepareTime: 0 },
      kind: DbResponseKind.ECSql,
      error: message,
      rowCount: 0,
      data: [],
      meta: [],
    };
    return new Promise((resolve) => {
      resolve(errResponse);
    });
  }

  private createPartialResponse(responseData: any[], responseMetaData: QueryPropertyMetaData[]): Promise<DbQueryResponse> {
    const errResponse = {
      status: DbResponseStatus.Partial,
      stats: { cpuTime: 0, totalTime: 0, timeLimit: 0, memLimit: 0, memUsed: 0, prepareTime: 0 },
      kind: DbResponseKind.ECSql,
      rowCount: 1,
      data: responseData,
      meta: responseMetaData,
    };
    return new Promise((resolve) => {
      resolve(errResponse);
    });
  }

  private createDoneResponse(responseMetaData: QueryPropertyMetaData[]): Promise<DbQueryResponse> {
    const errResponse = {
      status: DbResponseStatus.Done,
      stats: { cpuTime: 0, totalTime: 0, timeLimit: 0, memLimit: 0, memUsed: 0, prepareTime: 0 },
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
    let isStmtJustPreparedOrRebinded = false;
    if (!this.isStatementPrepared()) {
      let errorIfAny = this.prepareStmt(request.query); // prepare
      if (!errorIfAny.isSuccessful) {
        return await this.createErrorResponse(errorIfAny.message ?? `Failed to prepare statement.${request.query}`);
      }
      errorIfAny = this.bindValues(request.args); // And bind values if any
      if (!errorIfAny.isSuccessful) {
        return await this.createErrorResponse(errorIfAny.message ?? `Failed to bind values.${request.query}`);
      }
      isStmtJustPreparedOrRebinded = true;
    }

    if (!this.isStmtParamsSame(request.args)) {
      const errorIfAny = this.bindValues(request.args); // rebind
      if (!errorIfAny.isSuccessful) {
        return await this.createErrorResponse(errorIfAny.message ?? `Failed to bind values.${request.query}`);
      }
      isStmtJustPreparedOrRebinded = true;
    }

    if (request.limit?.offset === undefined) return await this.createErrorResponse("Offset must be provided in the limit.");

    if (request.limit.offset < this._rowCnt) return await this.createErrorResponse("Offset less than already fetched rows. Something went wrong");

    while (this._rowCnt !== request.limit.offset) {
      const stepResult = this.step();
      if (!stepResult.isSuccessful) {
        return await this.createErrorResponse(stepResult.message ?? `Step failed.${request.query}`);
      }
    }

    const stepResult = this.step();
    if (!stepResult.isSuccessful) {
      return await this.createErrorResponse(stepResult.message ?? `Step failed.${request.query}`);
    }

    let metaDataResult: QueryPropertyMetaData[] = [];
    if (request.includeMetaData || isStmtJustPreparedOrRebinded) {
      const metaDataResp = this.getMetaData();
      if (!metaDataResp.isSuccessful) {
        return await this.createErrorResponse(metaDataResp.message ?? `Failed to get metadata.${request.query}`);
      }
      metaDataResult = metaDataResp.metaData;
    }

    if (stepResult.stepResult === DbResult.BE_SQLITE_DONE) return await this.createDoneResponse(metaDataResult);

    const rowDataResult = this.toRowData({ abbreviateBlobs: request.abbreviateBlobs, classIdsToClassNames: request.convertClassIdsToClassNames, useJsName: request.valueFormat === DbValueFormat.JsNames });
    if (!rowDataResult.isSuccessful) {
      return await this.createErrorResponse(rowDataResult.message ?? `Failed to get row data.${request.query}`);
    }

    // const response = await request.execute();
    return this.createPartialResponse(rowDataResult.rowData, metaDataResult);
  }

  private getMetaData(): custommMetaDataResult {
    try {
      const metaData = this._stmt.getMetadata().properties;
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
      if (stepResult === DbResult.BE_SQLITE_ROW || stepResult === DbResult.BE_SQLITE_DONE) {
        this._rowCnt += stepResult === DbResult.BE_SQLITE_ROW ? 1 : 0;
        return { stepResult, isSuccessful: true };
      }
      return { stepResult, isSuccessful: false, message: `Step failed with code ${stepResult}` };
    } catch (error: any) {
      return { stepResult: DbResult.BE_SQLITE_ERROR, isSuccessful: false, message: error.message };
    }
  }

  private prepareStmt(ecsql: string): customResult {
    try {
      this._stmt.prepare(this.iModelDb[_nativeDb], ecsql);
      return { isSuccessful: true };
    }
    catch (error: any) {
      return { isSuccessful: false, message: error.message };
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