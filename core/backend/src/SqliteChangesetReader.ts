/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { IModelJsNative } from "@bentley/imodeljs-native";
import { DbOpcode, DbResult, IDisposable } from "@itwin/core-bentley";
import { ECDb } from "./ECDb";
import { IModelDb } from "./IModelDb";
import { IModelHost } from "./IModelHost";

/** Changed value type */
type ChangedValue = Uint8Array | number | string | null | undefined;

/**  Array of changed values*/
type ChangedValueArray = ChangedValue[];
export interface ChangeFormatArgs {
  includeTableName?: true;
  includeOpCode?: true;
  includeNullColumns?: true;
  includeStage?: true;
  includePrimaryKeyInUpdateNew?: true;
}

/** Operation that cause the change */
export type ChangeOp = "Inserted" | "Updated" | "Deleted";

/** Stage is version of value that needed to be read */
export type Stage = "Old" | "New";

/** Db from which schema will be read. It should be from timeline to which changeset belong. */
export type AnyDb = IModelDb | ECDb;

/** Arg to open a changeset file from disk */
export interface SqliteChangesetReaderArgs {
  readonly changesetFileName: string; /** name of the changeset file */
  readonly db?: AnyDb; /** db from which schema will be read. It should be close to changeset.*/
  readonly invert?: true; /** invert the changeset operations */
  readonly disableSchemaCheck?: true; /** do not check if column of change match db schema instead ignore addition columns */
}

export interface ChangedObject {
  $table?: string;
  $op?: ChangeOp;
  $stage?: Stage;
  [key: string]: any;
}
/**
 * Read raw sqlite changeset from disk and enumerate changes.
 * It also optionally let you format change with schema from
 * a db provided.
 */
export class SqliteChangesetReader implements IDisposable {
  private readonly _nativeReader = new IModelHost.platform.ChangesetReader();
  private _schemaCache = new Map<string, string[]>();
  private _disableSchemaCheck = false;
  protected constructor(public readonly db?: AnyDb) { }

  public static openFile(args: SqliteChangesetReaderArgs) {
    const reader = new SqliteChangesetReader(args.db);
    reader._disableSchemaCheck = args.disableSchemaCheck ?? false;
    reader._nativeReader.open(args.changesetFileName, args.invert ?? false);
    return reader;
  }
  public get disableSchemaCheck() { return this._disableSchemaCheck; }
  /** Move to next change in changeset */
  public step(): boolean {
    return this._nativeReader.step();
  }
  /** Check if reader current on a row */
  public get hasRow(): boolean {
    return this._nativeReader.hasRow();
  }
  /** Check if its current change is indirect */
  public get isIndirect(): boolean {
    return this._nativeReader.isIndirectChange();
  }
  /** Get count of columns in current change */
  public get columnCount(): number {
    return this._nativeReader.getColumnCount();
  }
  /** Get operation that caused the change */
  public get op(): ChangeOp {
    if (this._nativeReader.getOpCode() === DbOpcode.Insert)
      return "Inserted";

    if (this._nativeReader.getOpCode() === DbOpcode.Delete)
      return "Deleted";

    return "Updated";
  }
  /** Get primary key value array */
  public get primaryKeyValues(): ChangedValueArray {
    return this._nativeReader.getPrimaryKeys();
  }
  /** Get primary key columns.
   * @note To this to work db arg must be set when opening changeset file.
   * */
  public getPrimaryKeyColumnNames(): string[] {
    const pks = [];
    const cols = this.getColumnNames(this.tableName);
    if (!this._disableSchemaCheck && cols.length !== this.columnCount)
      throw new Error(`changeset table ${this.tableName} columns count does not match db declared table. ${this.columnCount} <> ${cols.length}`);

    for (let i = 0; i < this.columnCount; ++i)
      if (this._nativeReader.isPrimaryKeyColumn(i))
        pks.push(cols[i]);

    return pks;
  }
  /** Get current change table. */
  public get tableName(): string {
    return this._nativeReader.getTableName();
  }
  /**
   * Get changed value for a column
   * @param columnIndex index of column in current change
   * @param stage old or new value for change.
   * @returns value for changed column
   */
  public getChangeValue(columnIndex: number, stage: Stage): ChangedValue {
    return this._nativeReader.getColumnValue(columnIndex, stage === "New" ? IModelJsNative.DbChangeStage.New : IModelJsNative.DbChangeStage.Old);
  }
  /**
   * Get all changed value in current change as array
   * @param stage old or new values for current change.
   * @returns array of values.
   */
  public getChangeValuesArray(stage: Stage): ChangedValueArray | undefined {
    return this._nativeReader.getRow(stage === "New" ? IModelJsNative.DbChangeStage.New : IModelJsNative.DbChangeStage.Old);
  }
  /**
   * Get change as object and format its content.
   * @param stage old or new value for current change.
   * @param args change format options
   * @returns return object or undefined
   */
  public getChangeValuesObject(stage: Stage, args: ChangeFormatArgs = {}): ChangedObject | undefined {
    const cols = this.getColumnNames(this.tableName);
    const row = this.getChangeValuesArray(stage);
    if (!row)
      return undefined;
    process.env;
    const minLen = Math.min(cols.length, row.length);

    if (!this._disableSchemaCheck && cols.length !== this.columnCount)
      throw new Error(`changeset table ${this.tableName} columns count does not match db declared table. ${this.columnCount} <> ${cols.length}`);

    const out: ChangedObject = {};
    if (args.includeTableName) {
      out.$table = this.tableName;
    }
    if (args.includeOpCode) {
      out.$op = this.op;
    }
    if (args.includeStage) {
      out.$stage = stage;
    }

    if (args.includePrimaryKeyInUpdateNew && this.op === "Updated" && stage === "New") {
      const pkNames = this.getPrimaryKeyColumnNames();
      const pkValues = this.primaryKeyValues;
      pkNames.forEach((v, i) => {
        out[v] = pkValues[i];
      });
    }
    const isNullOrUndefined = (val: ChangedValue) => val === null || typeof val === "undefined";

    for (let i = 0; i < minLen; ++i) {
      const columnValue = row[i];
      const columnName = cols[i];
      if (!args.includeNullColumns && isNullOrUndefined(columnValue))
        continue;

      out[columnName] = columnValue;
    }
    return out;
  }
  /**
   * Get list of column for a table. This function also caches the result.
   * @note To this to work db arg must be set when opening changeset file.
   * @param tableName name of the table for which columns are requested.
   * @returns columns of table.
   */
  public getColumnNames(tableName: string): string[] {
    const columns = this._schemaCache.get(tableName);
    if (columns)
      return columns;

    if (!this.db)
      throw new Error("getColumns() require db context to be provided.");

    return this.db.withPreparedSqliteStatement("SELECT [name] FROM PRAGMA_TABLE_INFO(?) ORDER BY [cid]", (stmt) => {
      stmt.bindString(1, tableName);
      const tblCols: string[] = [];
      while (stmt.step() === DbResult.BE_SQLITE_ROW) {
        tblCols.push(stmt.getValueString(0));
      }
      this._schemaCache.set(tableName, tblCols);
      return tblCols;
    });
  }
  /**
   * Close changeset
   */
  public close() {
    this._nativeReader.close();
  }
  /**
   * Dispose this object
   */
  public dispose(): void {
    this.close();
  }
}
