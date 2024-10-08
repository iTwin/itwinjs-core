/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module SQLiteDb
 */
import { DbChangeStage, DbOpcode, DbResult, DbValueType, Id64String, IDisposable } from "@itwin/core-bentley";
import { ECDb } from "./ECDb";
import { IModelDb } from "./IModelDb";
import { IModelNative } from "./internal/NativePlatform";
import { _nativeDb } from "./internal/Symbols";

/** Changed value type
 * @beta
*/
type SqliteValue = Uint8Array | number | string | null | undefined;

/**  Array of changed values
 * @beta
*/
type SqliteValueArray = SqliteValue[];
/**
 * Format option when converting change from array to column/value object.
 * @beta
 */
export interface ChangeFormatArgs {
  /** include table name */
  includeTableName?: true;
  /** include op code */
  includeOpCode?: true;
  /** include null columns */
  includeNullColumns?: true;
  /** include value version */
  includeStage?: true;
  /** include primary key in update change */
  includePrimaryKeyInUpdateNew?: true;
}

/** Operation that cause the change
 * @beta
*/
export type SqliteChangeOp = "Inserted" | "Updated" | "Deleted";

/** Stage is version of value that needed to be read
 * @beta
*/
export type SqliteValueStage = "Old" | "New";

/** Db from which schema will be read. It should be from timeline to which changeset belong.
 * @beta
*/
export type AnyDb = IModelDb | ECDb;

/** Arg to open a changeset file from disk
 * @beta
*/
export interface SqliteChangesetReaderArgs {
  /** db from which schema will be read. It should be at or ahead of the latest changeset being opened.*/
  readonly db: AnyDb;
  /** invert the changeset operations */
  readonly invert?: true;
  /** do not check if column of change match db schema instead ignore addition columns */
  readonly disableSchemaCheck?: true;
}
/**
 * Represent sqlite change.
 * @beta
 */
export interface SqliteChange {
  /** name of table */
  $table?: string;
  /** SQLite operation that created this change */
  $op?: SqliteChangeOp;
  /** version of data in change. */
  $stage?: SqliteValueStage;
  /** columns in change */
  [key: string]: any;
}
/**
 * Read raw sqlite changeset from disk and enumerate changes.
 * It also optionally let you format change with schema from
 * a db provided.
 * @beta
 */
export class SqliteChangesetReader implements IDisposable {
  private readonly _nativeReader = new IModelNative.platform.ChangesetReader();
  private _schemaCache = new Map<string, string[]>();
  private _disableSchemaCheck = false;
  private _changeIndex = 0;
  protected constructor(
    /** db from where sql schema will be read */
    public readonly db: AnyDb,
  ) { }

  /**
   * Open changeset file from disk
   * @param args fileName of changeset reader and other options.
   * @returns SqliteChangesetReader instance
   */
  public static openFile(args: { readonly fileName: string } & SqliteChangesetReaderArgs): SqliteChangesetReader {
    const reader = new SqliteChangesetReader(args.db);
    reader._disableSchemaCheck = args.disableSchemaCheck ?? false;
    reader._nativeReader.openFile(args.fileName, args.invert ?? false);
    return reader;
  }
  /**
   * Group changeset file into single changeset and open that changeset.
   * @param args - The arguments for opening the changeset group. Requires an open db.
   * @returns The SqliteChangesetReader instance.
   */
  public static openGroup(args: { readonly changesetFiles: string[] } & SqliteChangesetReaderArgs): SqliteChangesetReader {
    if (args.changesetFiles.length === 0) {
      throw new Error("changesetFiles must contain at least one file.");
    }
    const reader = new SqliteChangesetReader(args.db);
    reader._disableSchemaCheck = args.disableSchemaCheck ?? false;
    reader._nativeReader.openGroup(args.changesetFiles, args.db[_nativeDb], args.invert ?? false);
    return reader;
  }
  /**
   * Writes the changeset to a file.
   * @note can be use with openGroup() or openLocalChanges() to persist changeset.
   * @param args - The arguments for writing to the file.
   * @param args.fileName - The name of the file to write to.
   * @param args.containsSchemaChanges - Indicates whether the changeset contains schema changes.
   * @param args.overwriteFile - Indicates whether to override the file if it already exists. Default is false.
   */
  public writeToFile(args: { fileName: string, containsSchemaChanges: boolean, overwriteFile?: boolean }): void {
    this._nativeReader.writeToFile(args.fileName, args.containsSchemaChanges, args.overwriteFile ?? false);
  }
  /**
   * Open local changes in iModel.
   * @param args iModel and other options.
   * @param args.db must be of type IModelDb
   * @returns SqliteChangesetReader instance
   */
  public static openLocalChanges(args: Omit<SqliteChangesetReaderArgs, "db"> & { db: IModelDb, includeInMemoryChanges?: true }): SqliteChangesetReader {
    const reader = new SqliteChangesetReader(args.db);
    reader._disableSchemaCheck = args.disableSchemaCheck ?? false;
    reader._nativeReader.openLocalChanges(args.db[_nativeDb], args.includeInMemoryChanges ?? false, args.invert ?? false);
    return reader;
  }
  /** check if schema check is disabled or not */
  public get disableSchemaCheck(): boolean { return this._disableSchemaCheck; }
  /** Move to next change in changeset
   * @returns true if there is current change false if reader is end of changeset.
   * @beta
  */
  public step(): boolean {
    if (this._nativeReader.step()) {
      this._changeIndex++;
      return true;
    }
    return false;
  }
  /** Check if reader current on a row
   * @beta
  */
  public get hasRow(): boolean {
    return this._nativeReader.hasRow();
  }
  /** Check if its current change is indirect
   * @beta
  */
  public get isIndirect(): boolean {
    return this._nativeReader.isIndirectChange();
  }
  /** Get count of columns in current change
   * @beta
  */
  public get columnCount(): number {
    return this._nativeReader.getColumnCount();
  }
  /** Get operation that caused the change
   * @beta
  */
  public get op(): SqliteChangeOp {
    if (this._nativeReader.getOpCode() === DbOpcode.Insert)
      return "Inserted";

    if (this._nativeReader.getOpCode() === DbOpcode.Delete)
      return "Deleted";

    return "Updated";
  }
  /** Get primary key value array
   * @beta
  */
  public get primaryKeyValues(): SqliteValueArray {
    return this._nativeReader.getPrimaryKeys();
  }
  /** Get primary key columns.
   * @note To this to work db arg must be set when opening changeset file.
   * @beta
   */
  public getPrimaryKeyColumnNames(): string[] {
    const cols = this.getColumnNames(this.tableName);
    if (!this._disableSchemaCheck && cols.length !== this.columnCount)
      throw new Error(`changeset table ${this.tableName} columns count does not match db declared table. ${this.columnCount} <> ${cols.length}`);

    return this._nativeReader.getPrimaryKeyColumnIndexes().map((i) => cols[i]);
  }
  /** Get current change table.
   * @beta
  */
  public get tableName(): string {
    return this._nativeReader.getTableName();
  }
  /**
   * Get changed binary value for a column
   * @param columnIndex index of column in current change
   * @param stage old or new value for change.
   * @returns value for changed column
   * @beta
   */
  public getChangeValueType(columnIndex: number, stage: SqliteValueStage): DbValueType | undefined {
    return this._nativeReader.getColumnValueType(columnIndex, stage === "New" ? DbChangeStage.New : DbChangeStage.Old) as DbValueType;
  }

  /**
   * Get changed binary value for a column
   * @param columnIndex index of column in current change
   * @param stage old or new value for change.
   * @returns value for changed column
   * @beta
   */
  public getChangeValueBinary(columnIndex: number, stage: SqliteValueStage): Uint8Array | null | undefined {
    return this._nativeReader.getColumnValueBinary(columnIndex, stage === "New" ? DbChangeStage.New : DbChangeStage.Old);
  }

  /**
   * Get changed double value for a column
   * @param columnIndex index of column in current change
   * @param stage old or new value for change.
   * @returns value for changed column
   * @beta
   */
  public getChangeValueDouble(columnIndex: number, stage: SqliteValueStage): number | null | undefined {
    return this._nativeReader.getColumnValueDouble(columnIndex, stage === "New" ? DbChangeStage.New : DbChangeStage.Old);
  }

  /**
   * Get changed Id value for a column
   * @param columnIndex index of column in current change
   * @param stage old or new value for change.
   * @returns value for changed column
   * @beta
   */
  public getChangeValueId(columnIndex: number, stage: SqliteValueStage): Id64String | null | undefined {
    return this._nativeReader.getColumnValueId(columnIndex, stage === "New" ? DbChangeStage.New : DbChangeStage.Old);
  }

  /**
   * Get changed integer value for a column
   * @param columnIndex index of column in current change
   * @param stage old or new value for change.
   * @returns value for changed column
   * @beta
   */
  public getChangeValueInteger(columnIndex: number, stage: SqliteValueStage): number | null | undefined {
    return this._nativeReader.getColumnValueInteger(columnIndex, stage === "New" ? DbChangeStage.New : DbChangeStage.Old);
  }

  /**
   * Get changed text value for a column
   * @param columnIndex index of column in current change
   * @param stage old or new value for change.
   * @returns value for changed column
   * @beta
   */
  public getChangeValueText(columnIndex: number, stage: SqliteValueStage): string | null | undefined {
    return this._nativeReader.getColumnValueText(columnIndex, stage === "New" ? DbChangeStage.New : DbChangeStage.Old);
  }

  /**
   * Check if change value is null
   * @param columnIndex index of column in current change
   * @param stage old or new value for change.
   * @returns true if value is null
   * @beta
   */
  public isColumnValueNull(columnIndex: number, stage: SqliteValueStage): boolean | undefined {
    return this._nativeReader.isColumnValueNull(columnIndex, stage === "New" ? DbChangeStage.New : DbChangeStage.Old);
  }

  /**
   * Get change value type
   * @param columnIndex index of column in current change
   * @param stage old or new value for change.
   * @returns change value type
   * @beta
   */
  public getColumnValueType(columnIndex: number, stage: SqliteValueStage): DbValueType | undefined {
    return this._nativeReader.getColumnValueType(columnIndex, stage === "New" ? DbChangeStage.New : DbChangeStage.Old) as DbValueType | undefined;
  }

  /**
   * Get changed value for a column
   * @param columnIndex index of column in current change
   * @param stage old or new value for change.
   * @returns value for changed column
   * @beta
   */
  public getChangeValue(columnIndex: number, stage: SqliteValueStage): SqliteValue {
    return this._nativeReader.getColumnValue(columnIndex, stage === "New" ? DbChangeStage.New : DbChangeStage.Old);
  }
  /**
   * Get all changed value in current change as array
   * @param stage old or new values for current change.
   * @returns array of values.
   * @beta
   */
  public getChangeValuesArray(stage: SqliteValueStage): SqliteValueArray | undefined {
    return this._nativeReader.getRow(stage === "New" ? DbChangeStage.New : DbChangeStage.Old);
  }
  /**
   * Get change as object and format its content.
   * @param stage old or new value for current change.
   * @param args change format options
   * @returns return object or undefined
   * @beta
   */
  public getChangeValuesObject(stage: SqliteValueStage, args: ChangeFormatArgs = {}): SqliteChange | undefined {
    const cols = this.getColumnNames(this.tableName);
    const row = this.getChangeValuesArray(stage);
    if (!row)
      return undefined;
    process.env;
    const minLen = Math.min(cols.length, row.length);

    if (!this._disableSchemaCheck && cols.length !== this.columnCount)
      throw new Error(`changeset table ${this.tableName} columns count does not match db declared table. ${this.columnCount} <> ${cols.length}`);

    const out: SqliteChange = {};
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
    const isNullOrUndefined = (val: SqliteValue) => typeof val === "undefined";

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
   * @beta
   */
  public getColumnNames(tableName: string): string[] {
    const columns = this._schemaCache.get(tableName);
    if (columns)
      return columns;

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
  /** index of current change
   * @beta
   */
  public get changeIndex() { return this._changeIndex; }
  /**
   * Close changeset
   * @beta
   */
  public close() {
    this._changeIndex = 0;
    this._nativeReader.close();
  }
  /**
   * Dispose this object
   * @beta
   */
  public dispose(): void {
    this.close();
  }
}
