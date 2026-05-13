/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ECDb
 */
import { DbChangeStage, DbOpcode, Id64String, IModelStatus } from "@itwin/core-bentley";
import { IModelError } from "@itwin/core-common";
import { IModelDb } from "./IModelDb";
import { IModelNative } from "./internal/NativePlatform";
import { _nativeDb } from "./internal/Symbols";
import { IModelJsNative } from "@bentley/imodeljs-native";
import { ChangeInstance, ChangesetReaderArgs, ChangeSource, PropertyFilter, RowFormatOptions } from "./ChangesetReaderTypes";
import { AnyDb, SqliteChangeOp } from "./SqliteChangesetReader";


// ---------------------------------------------------------------------------
// ChangesetReader
// ---------------------------------------------------------------------------

/**
 * Reads EC-typed changeset data natively from a changeset file, changeset group,
 * in-memory transaction, or local un-pushed changes.
 *
 * Implements [ChangeSource]($backend) so rows can be fed directly into
 * [PartialChangeUnifier]($backend) to merge partial (per-table) instances into
 * complete EC instances.
 *
 * When the current row is a non-EC internal SQLite table, [[isECTable]] is `false`
 * and both [[inserted]] and [[deleted]] remain `undefined`.
 *
 * @note The native reader operates one SQLite table-row at a time. Multi-table EC
 * instances must be merged using [PartialChangeUnifier]($backend).
 * @beta
 */
export class ChangesetReader implements Disposable, ChangeSource {
  private readonly _nativeReader: IModelJsNative.ChangesetReader = new IModelNative.platform.ChangesetReader();
  // Internal options — keep ECClassId as raw Id so the unifier can use it as-is.
  private _rowOptions?: RowFormatOptions;
  private _propFilter: PropertyFilter = PropertyFilter.All;
  private _changeIndex = 0;
  private _op?: SqliteChangeOp;
  private _isECTable?: boolean;
  private _tableName?: string;
  private _isIndirectChange?: boolean;

  /** The db used for EC schema resolution. */
  public readonly db: AnyDb;

  /**
   * `true` when the current row belongs to an EC-mapped table.
   * Valid only after a successful call to [[step]].
   * @beta
   */
  public get isECTable(): boolean {
    if (this._isECTable === undefined)
      throw new IModelError(IModelStatus.BadRequest, "ChangesetReader.isECTable is only valid after step() has positioned the reader on a current valid change.");
    return this._isECTable;
  }

  /**
   * Name of the SQLite table for the current change row.
   * Valid only after a successful call to [[step]].
   * @beta
   */
  public get tableName(): string {
    if (this._tableName === undefined)
      throw new IModelError(IModelStatus.BadRequest, "ChangesetReader.tableName is only valid after step() has positioned the reader on a current valid change.");
    return this._tableName;
  }

  /**
   * `true` when the current change was applied indirectly
   * Valid only after a successful call to [[step]].
   * @beta
   */
  public get isIndirectChange(): boolean {
    if (this._isIndirectChange === undefined)
      throw new IModelError(IModelStatus.BadRequest, "ChangesetReader.isIndirectChange is only valid after step() has positioned the reader on a current valid change.");
    return this._isIndirectChange;
  }

  /**
   * Post-change (inserted or updated-new) EC instance, populated after each [[step]] call.
   * `undefined` when the current row is a Delete or a non-EC table row or [[step]] returned false.
   * @beta
   */
  public inserted?: ChangeInstance;

  /**
   * Pre-change (deleted or updated-old) EC instance, populated after each [[step]] call.
   * `undefined` when the current row is an Insert or a non-EC table row or [[step]] returned false.
   * @beta
   */
  public deleted?: ChangeInstance;

  // Private — callers use static factory methods.
  private constructor(db: AnyDb) {
    this.db = db;
  }

  /** Map public RowFormatOptions to the native adaptor options.
   * @internal */
  private toNativeRowOptions(opts: RowFormatOptions): IModelJsNative.ECSqlRowAdaptorOptions {
    return {
      abbreviateBlobs: opts.abbreviateBlobs,
      classIdsToClassNames: opts.classIdsToClassNames,
      useJsName: opts.useJsName,
    };
  }

  // ---------------------------------------------------------------------------
  // Static factory methods
  // ---------------------------------------------------------------------------

  /**
   * Open a changeset file from disk.
   * @param args.fileName Absolute path to the changeset file.
   * @param args.db Database at or after the changeset's ending state, used for schema resolution.
   * @param args.invert When `true`, invert all operations (Insert↔Delete).
   * @param args.valueOptions Row adaptor options controlling how EC property values are formatted.
   * @param args.propFilter Controls which properties are included. Defaults to `All`.
   * @beta
   */
  public static openFile(args: { readonly fileName: string } & ChangesetReaderArgs): ChangesetReader {
    const reader = new ChangesetReader(args.db);
    reader._rowOptions = args.rowOptions;
    const propFilter = args.propFilter ?? PropertyFilter.All;
    reader._propFilter = propFilter;
    try {
      reader._nativeReader.openFile(args.db[_nativeDb], args.fileName, args.invert ?? false, reader._propFilter);
    }
    catch (e) {
      reader.close();
      throw e;
    }
    return reader;
  }

  /**
   * Concatenate multiple changeset files and read them as a single logical stream.
   * @param args.changesetFiles Ordered list of changeset file paths.
   * @param args.db Database with schema at or ahead of the last changeset.
   * @param args.valueOptions Row adaptor options controlling how EC property values are formatted.
   * @param args.propFilter Controls which properties are included. Defaults to `All`.
   * @beta
   */
  public static openGroup(args: { readonly changesetFiles: string[] } & ChangesetReaderArgs): ChangesetReader {
    if (args.changesetFiles.length === 0)
      throw new Error("changesetFiles must contain at least one file.");
    const reader = new ChangesetReader(args.db);
    reader._rowOptions = args.rowOptions;
    const propFilter = args.propFilter ?? PropertyFilter.All;
    reader._propFilter = propFilter;
    try {
      reader._nativeReader.openGroup(args.db[_nativeDb], args.changesetFiles, args.invert ?? false, reader._propFilter);
    }
    catch (e) {
      reader.close();
      throw e;
    }
    return reader;
  }

  /**
   * Read pending (not yet pushed) local changes from an open IModelDb.
   * @param args.db Must be an [IModelDb]($backend) (not [ECDb]($backend)).
   * @param args.includeInMemoryChanges Also include in-memory (not yet saved to disk) changes.
   * @param args.valueOptions Row adaptor options controlling how EC property values are formatted.
   * @param args.propFilter Controls which properties are included. Defaults to `All`.
   * @beta
   */
  public static openLocalChanges(
    args: Omit<ChangesetReaderArgs, "db"> & { db: IModelDb; includeInMemoryChanges?: boolean },
  ): ChangesetReader {
    const reader = new ChangesetReader(args.db);
    reader._rowOptions = args.rowOptions;
    const propFilter = args.propFilter ?? PropertyFilter.All;
    reader._propFilter = propFilter;
    try {
      reader._nativeReader.openLocalChanges(args.db[_nativeDb], args.includeInMemoryChanges ?? false, args.invert ?? false, reader._propFilter);
    } catch (e) {
      reader.close();
      throw e;
    }
    return reader;
  }

  /**
   * Read the in-memory (not yet saved to disk) changes of an open IModelDb.
   * @param args.db Must be an [IModelDb]($backend).
   * @param args.valueOptions Row adaptor options controlling how EC property values are formatted.
   * @param args.propFilter Controls which properties are included. Defaults to `All`.
   * @beta
   */
  public static openInMemoryChanges(
    args: Omit<ChangesetReaderArgs, "db"> & { db: IModelDb },
  ): ChangesetReader {
    const reader = new ChangesetReader(args.db);
    reader._rowOptions = args.rowOptions;
    const propFilter = args.propFilter ?? PropertyFilter.All;
    reader._propFilter = propFilter;
    try {
      reader._nativeReader.openInMemoryChanges(args.db[_nativeDb], args.invert ?? false, reader._propFilter);
    } catch (e) {
      reader.close();
      throw e;
    }
    return reader;
  }

  /**
   * Read a single saved transaction by its id.
   * @param args.db Must be an [IModelDb]($backend) ([ECDb]($backend) does not support transactions).
   * @param args.txnId The id of the saved transaction to read.
   * @param args.valueOptions Row adaptor options controlling how EC property values are formatted.
   * @param args.propFilter Controls which properties are included. Defaults to `All`.
   * @beta
   */
  public static openTxn(
    args: Omit<ChangesetReaderArgs, "db"> & { db: IModelDb; txnId: Id64String },
  ): ChangesetReader {
    const reader = new ChangesetReader(args.db);
    reader._rowOptions = args.rowOptions ?? {};
    const propFilter = args.propFilter ?? PropertyFilter.All;
    reader._propFilter = propFilter;
    try {
      reader._nativeReader.openTxn(args.db[_nativeDb], args.txnId, args.invert ?? false, reader._propFilter);
    } catch (e) {
      reader.close();
      throw e;
    }
    return reader;
  }

  // ---------------------------------------------------------------------------
  // Filtering
  // ---------------------------------------------------------------------------

  /**
   * Restrict iteration to changes from the named SQLite tables.
   * That means the rows for changes from other tables will be skipped entirely and won't be visible through the reader.
   * @param tableNames SQLite table names to include.
   * Note: Table names must be provided in the correct case for proper filtering.
   * @beta
   */
  public setTableNameFilters(tableNames: Set<string>): void {
    this._nativeReader.setTableNameFilters(Array.from(tableNames));
  }

  /**
   * Restrict iteration to changes with the given operation types.
   * That means the rows for changes with other operation types will be skipped entirely and won't be visible through the reader.
   * @param ops Operations to include.
   * @beta
   */
  public setOpCodeFilters(ops: Set<SqliteChangeOp>): void {
    this._nativeReader.setOpCodeFilters(Array.from(ops));
  }

  /**
   * Restrict iteration to changes for the given EC class names.
   * That means the rows for changes from other EC classes will be skipped entirely and won't be visible through the reader.
   * @param classNames EC class names to include. The classNames should be in the full name format(i.e. "SchemaName:ClassName").
   * Note: Schema names and class names must be provided in the correct case for proper filtering. Derived classes are not automatically included, so they must be specified explicitly if needed.
   * @beta
   */
  public setClassNameFilters(classNames: Set<string>): void {
    this._nativeReader.setClassNameFilters(Array.from(classNames));
  }

  /**
   * Remove the table-name filters
   * @beta
   */
  public clearTableNameFilters(): void {
    this._nativeReader.clearTableNameFilters();
  }

  /**
   * Remove the op-code filters
   * @beta
   */
  public clearOpCodeFilters(): void {
    this._nativeReader.clearOpCodeFilters();
  }

  /**
   * Remove the class-name filters
   * @beta
   */
  public clearClassNameFilters(): void {
    this._nativeReader.clearClassNameFilters();
  }

  // ---------------------------------------------------------------------------
  // Iteration
  // ---------------------------------------------------------------------------

  /**
   * Advance to the next change and populate `inserted` and/or `deleted`.
   * @returns `true` while positioned on a valid change; `false` when the stream is exhausted.
   * @beta
   */
  public step(): boolean {
    this.inserted = undefined;
    this.deleted = undefined;
    this._op = undefined;
    this._isECTable = undefined;
    this._tableName = undefined;
    this._isIndirectChange = undefined;

    if (this._nativeReader.step()) {
      this._changeIndex++;
      const meta = this._nativeReader.getChangeMetadata();
      const nativeOp = meta.opCode;
      const op: SqliteChangeOp = nativeOp === DbOpcode.Insert ? "Inserted" : nativeOp === DbOpcode.Update ? "Updated" : "Deleted";
      this._op = op;

      this._tableName = meta.tableName;
      this._isIndirectChange = meta.isIndirectChange;
      this._isECTable = meta.isECTable;

      const nativeRowOpts = this._rowOptions ? this.toNativeRowOptions(this._rowOptions) : {};

      if (op === "Inserted" || op === "Updated") {
        const rowValue = this._nativeReader.getValue(DbChangeStage.New, nativeRowOpts);
        if (rowValue !== undefined) {
          this.inserted = {
            ...rowValue.data,
            $meta: {
              op,
              tables: [this._tableName],
              changeIndexes: [this._changeIndex],
              stage: "New",
              instanceKey: rowValue.key,
              propFilter: this._propFilter,
              changeFetchedPropNames: rowValue.changeFetchedPropNames,
              rowOptions: this._rowOptions,
              isIndirectChange: this._isIndirectChange,
            },
          };
        }
      }

      if (op === "Deleted" || op === "Updated") {
        const rowValue = this._nativeReader.getValue(DbChangeStage.Old, nativeRowOpts);
        if (rowValue !== undefined) {
          this.deleted = {
            ...rowValue.data,
            $meta: {
              op,
              tables: [this._tableName],
              changeIndexes: [this._changeIndex],
              stage: "Old",
              instanceKey: rowValue.key,
              propFilter: this._propFilter,
              changeFetchedPropNames: rowValue.changeFetchedPropNames,
              rowOptions: this._rowOptions,
              isIndirectChange: this._isIndirectChange,
            },
          };
        }
      }

      return true;
    }

    return false;
  }

  /**
   * SQLite opcode of the current change.
   * Valid only after a successful call to [[step]].
   * @beta
   */
  public get op(): SqliteChangeOp {
    if (this._op === undefined)
      throw new IModelError(IModelStatus.BadRequest, "ChangesetReader.op is only valid after step() has positioned the reader on a current valid change.");
    return this._op;
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  /**
   * Close the reader and release all native resources.
   * @beta
   */
  public close(): void {
    this._changeIndex = 0;
    this._op = undefined;
    this._isECTable = undefined;
    this._tableName = undefined;
    this._isIndirectChange = undefined;
    this.inserted = undefined;
    this.deleted = undefined;
    this._nativeReader.close();
  }

  /**
   * Implements the `Disposable` contract — calls [[close]].
   * @beta
   */
  public [Symbol.dispose](): void {
    this.close();
  }
}


