/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module iModels
 */

import { DbChangeStage, DbConflictCause, DbOpcode, DbValueType, Id64String } from "@itwin/core-bentley";

export interface ChangesetConflictArgs {
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
}

export interface MergeChangesetConflictArgs extends ChangesetConflictArgs {
  changesetFile?: string;
}

export interface TxnArgs {
  id: Id64String;
  type: "Data" | "Schema";
  descr: string;
}

export interface RebaseChangesetConflictArgs extends ChangesetConflictArgs {
  txn: TxnArgs;
}