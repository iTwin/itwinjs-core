/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module iModels
 */

import { DbChangeStage, DbConflictCause, DbOpcode, DbValueType, Id64String } from "@itwin/core-bentley";
import { SqliteChangeOp, SqliteChangesetReader, SqliteValueStage } from "../SqliteChangesetReader";
import { IModelDb } from "../IModelDb";

export interface DbChangesetConflictArgs {
  cause: DbConflictCause;
  opcode: DbOpcode;
  indirect: boolean;
  tableName: string;
  columnCount: number;
  getForeignKeyConflicts: () => number;
  dump: () => void;
  setLastError: (message: string) => void;
  getPrimaryKeyColumns: () => number[];
  getValueType: (columnIndex: number, stage: DbChangeStage) => DbValueType | null | undefined;
  getValueBinary: (columnIndex: number, stage: DbChangeStage) => Uint8Array | null | undefined;
  getValueId: (columnIndex: number, stage: DbChangeStage) => Id64String | null | undefined;
  getValueText: (columnIndex: number, stage: DbChangeStage) => string | null | undefined;
  getValueInteger: (columnIndex: number, stage: DbChangeStage) => number | null | undefined;
  getValueDouble: (columnIndex: number, stage: DbChangeStage) => number | null | undefined;
  isValueNull: (columnIndex: number, stage: DbChangeStage) => boolean | undefined;
  getColumnNames(): string[];
}

export interface DbMergeChangesetConflictArgs extends DbChangesetConflictArgs {
  changesetFile?: string;
}

export interface TxnArgs {
  id: Id64String;
  type: "Data" | "Schema";
  descr: string;
}

export interface DbRebaseChangesetConflictArgs extends DbChangesetConflictArgs {
  txn: TxnArgs;
}

export type SqliteConflictCause = "Conflict" | "Data" | "Constraint" | "ForeignKey" | "NotFound";

export class RebaseChangesetConflictArgs {
  constructor(private _dbConflictArg: DbRebaseChangesetConflictArgs, private _iModel: IModelDb){}
  public get cause() : SqliteConflictCause {
    switch (this._dbConflictArg.cause) {
      case DbConflictCause.Conflict: return "Conflict";
      case DbConflictCause.Data: return "Data";
      case DbConflictCause.Constraint: return "Constraint";
      case DbConflictCause.ForeignKey: return "ForeignKey";
      case DbConflictCause.NotFound: return "NotFound";
    }
    throw new Error("Invalid value for cause");
  }
  public get opcode(): SqliteChangeOp | undefined {
    switch (this._dbConflictArg.opcode) {
      case DbOpcode.Insert: return "Inserted";
      case DbOpcode.Update: return "Updated";
      case DbOpcode.Delete: return "Deleted";
    }
  }
  public openTxn(): SqliteChangesetReader {
    return SqliteChangesetReader.openTxn({txnId: this._dbConflictArg.txn.id, db: this._iModel});
  }
  public get indirect(): boolean {
    return this._dbConflictArg.indirect;
  }
  public get tableName(): string {
    return this._dbConflictArg.tableName;
  }
  public get columnCount(): number {
    return this._dbConflictArg.columnCount;
  }
  public getForeignKeyConflicts(): number {
    return this._dbConflictArg.getForeignKeyConflicts();
  }
  public setLastError(message: string): void {
    this._dbConflictArg.setLastError(message);
  }
  public getPrimaryKeyColumns(): number[] {
    return this._dbConflictArg.getPrimaryKeyColumns();
  }
  public getValueType(columnIndex: number, stage: SqliteValueStage): DbValueType | null | undefined {
    return this._dbConflictArg.getValueType(columnIndex, stage=== "New" ? DbChangeStage.New : DbChangeStage.Old);
  }
  public getValueBinary(columnIndex: number, stage: SqliteValueStage): Uint8Array | null | undefined {
    return this._dbConflictArg.getValueBinary(columnIndex, stage=== "New" ? DbChangeStage.New : DbChangeStage.Old);
  }
  public getValueId(columnIndex: number, stage: SqliteValueStage): Id64String | null | undefined {
    return this._dbConflictArg.getValueId(columnIndex, stage=== "New" ? DbChangeStage.New : DbChangeStage.Old);
  }
  public getValueText(columnIndex: number, stage: SqliteValueStage): string | null | undefined {
    return this._dbConflictArg.getValueText(columnIndex, stage=== "New" ? DbChangeStage.New : DbChangeStage.Old);
  }
  public getValueInteger(columnIndex: number, stage: SqliteValueStage): number | null | undefined {
    return this._dbConflictArg.getValueInteger(columnIndex, stage=== "New" ? DbChangeStage.New : DbChangeStage.Old);
  }
  public getValueDouble(columnIndex: number, stage: SqliteValueStage): number | null | undefined {
    return this._dbConflictArg.getValueDouble(columnIndex, stage=== "New" ? DbChangeStage.New : DbChangeStage.Old);
  }
  public isValueNull(columnIndex: number, stage: SqliteValueStage): boolean | undefined {
    return this._dbConflictArg.isValueNull(columnIndex, stage=== "New" ? DbChangeStage.New : DbChangeStage.Old);
  }
  public getColumnNames(): string[] {
    return this._dbConflictArg.getColumnNames();
  }
  public getPrimaryKeyValues() {
    const pkv: (Uint8Array | number | string | null | undefined)[] = [];
    if (this.opcode === undefined)
      return pkv;

    const stage = this._dbConflictArg.opcode === DbOpcode.Insert ? DbChangeStage.New : DbChangeStage.Old;
    for (const pk of this._dbConflictArg.getPrimaryKeyColumns()) {
      const type = this._dbConflictArg.getValueType(pk, stage);
      if (type === DbValueType.IntegerVal)
        pkv.push(this._dbConflictArg.getValueId(pk, stage));
      else if (type === DbValueType.TextVal)
        pkv.push(this._dbConflictArg.getValueText(pk, stage));
      else if (type === DbValueType.FloatVal)
        pkv.push(this._dbConflictArg.getValueDouble(pk, stage));
      else if (type === DbValueType.BlobVal)
        pkv.push(this._dbConflictArg.getValueBinary(pk, stage));
      else
        pkv.push(null);
    }
    return pkv;
  };
  public get txn() {
    return this._dbConflictArg.txn;
  }
}

