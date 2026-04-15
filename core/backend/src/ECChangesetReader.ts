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
import { ECChangesetMode, ECChangesetReaderArgs, ECChangesetRowAdapterOptions, ECNativeChangeInstance, ECNativeChangeOp, ECNativeChangeSource } from "./ECChangesetReaderTypes";
import { AnyDb } from "./SqliteChangesetReader";


// ---------------------------------------------------------------------------
// ECChangesetReader
// ---------------------------------------------------------------------------

/**
 * Reads EC-typed changeset data natively from a changeset file, changeset group,
 * in-memory transaction, or local un-pushed changes.
 *
 * Implements [ECNativeChangeSource]($backend) so rows can be fed directly into
 * [ECNativePartialChangeUnifier]($backend) to merge partial (per-table) instances into
 * complete EC instances.
 *
 * When the current row is a non-EC internal SQLite table, [[isECTable]] is `false`
 * and both [[inserted]] and [[deleted]] remain `undefined`.
 *
 * @note The native reader operates one SQLite table-row at a time. Multi-table EC
 * instances must be merged using [ECNativePartialChangeUnifier]($backend).
 * @beta
 */
export class ECChangesetReader implements Disposable, ECNativeChangeSource {
  private readonly _nativeReader: IModelJsNative.ECChangesetReader = new IModelNative.platform.ECChangesetReader();
  // Internal options — keep ECClassId as raw Id so the unifier can use it as-is.
  private _rowOptions?: ECChangesetRowAdapterOptions;
  private _mode: ECChangesetMode = ECChangesetMode.All_Properties;
  private _changeIndex = 0;
  private _op?: ECNativeChangeOp;
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
      throw new IModelError(IModelStatus.BadRequest, "ECChangesetReader.isECTable is only valid after step() has positioned the reader on a current valid change.");
    return this._isECTable;
  }

  /**
   * Name of the SQLite table for the current change row.
   * Valid only after a successful call to [[step]].
   * @beta
   */
  public get tableName(): string {
    if (this._tableName === undefined)
      throw new IModelError(IModelStatus.BadRequest, "ECChangesetReader.tableName is only valid after step() has positioned the reader on a current valid change.");
    return this._tableName;
  }

  /**
   * `true` when the current change was applied indirectly
   * Valid only after a successful call to [[step]].
   * @beta
   */
  public get isIndirectChange(): boolean {
    if (this._isIndirectChange === undefined)
      throw new IModelError(IModelStatus.BadRequest, "ECChangesetReader.isIndirectChange is only valid after step() has positioned the reader on a current valid change.");
    return this._isIndirectChange;
  }

  /**
   * Post-change (inserted or updated-new) EC instance, populated after each [[step]] call.
   * `undefined` when the current row is a Delete or a non-EC table row or [[step]] returned false.
   * @beta
   */
  public inserted?: ECNativeChangeInstance;

  /**
   * Pre-change (deleted or updated-old) EC instance, populated after each [[step]] call.
   * `undefined` when the current row is an Insert or a non-EC table row or [[step]] returned false.
   * @beta
   */
  public deleted?: ECNativeChangeInstance;

  // Private — callers use static factory methods.
  private constructor(db: AnyDb) {
    this.db = db;
  }

  /** Map public ECChangesetRowAdapterOptions to the native adaptor options.
   * @internal */
  private toNativeRowOptions(opts: ECChangesetRowAdapterOptions): IModelJsNative.ECSqlRowAdaptorOptions {
    return {
      abbreviateBlobs: opts.abbreviateBlobs,
      classIdsToClassNames: opts.classIdsToClassNames,
      useJsName: opts.useJsName,
    };
  }

  /** Convert a ECChangesetMode enum value to its string name.
   * @internal
   */
  private modeToString(): string {
    switch (this._mode) {
      case ECChangesetMode.All_Properties: return "All_Properties";
      case ECChangesetMode.Bis_Element_Properties: return "Bis_Element_Properties";
      case ECChangesetMode.Instance_Key: return "Instance_Key";
      default: throw new IModelError(IModelStatus.BadArg, `Invalid ECChangesetMode value: ${this._mode}`);
    }
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
   * @param args.mode Controls which properties are included. Defaults to `All_Properties`.
   * @beta
   */
  public static openFile(args: { readonly fileName: string } & ECChangesetReaderArgs): ECChangesetReader {
    const reader = new ECChangesetReader(args.db);
    reader._rowOptions = args.rowOptions;
    const mode = args.mode ?? ECChangesetMode.All_Properties;
    reader._mode = mode;
    try {
      reader._nativeReader.openFile(args.db[_nativeDb], args.fileName, args.invert ?? false, reader._mode);
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
   * @param args.mode Controls which properties are included. Defaults to `All_Properties`.
   * @beta
   */
  public static openGroup(args: { readonly changesetFiles: string[] } & ECChangesetReaderArgs): ECChangesetReader {
    if (args.changesetFiles.length === 0)
      throw new Error("changesetFiles must contain at least one file.");
    const reader = new ECChangesetReader(args.db);
    reader._rowOptions = args.rowOptions;
    const mode = args.mode ?? ECChangesetMode.All_Properties;
    reader._mode = mode;
    try {
      reader._nativeReader.openGroup(args.db[_nativeDb], args.changesetFiles, args.invert ?? false, reader._mode);
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
   * @param args.mode Controls which properties are included. Defaults to `All_Properties`.
   * @beta
   */
  public static openLocalChanges(
    args: Omit<ECChangesetReaderArgs, "db"> & { db: IModelDb; includeInMemoryChanges?: boolean },
  ): ECChangesetReader {
    const reader = new ECChangesetReader(args.db);
    reader._rowOptions = args.rowOptions;
    const mode = args.mode ?? ECChangesetMode.All_Properties;
    reader._mode = mode;
    try {
      reader._nativeReader.openLocalChanges(args.db[_nativeDb], args.includeInMemoryChanges ?? false, args.invert ?? false, reader._mode);
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
   * @param args.mode Controls which properties are included. Defaults to `All_Properties`.
   * @beta
   */
  public static openInMemoryChanges(
    args: Omit<ECChangesetReaderArgs, "db"> & { db: IModelDb },
  ): ECChangesetReader {
    const reader = new ECChangesetReader(args.db);
    reader._rowOptions = args.rowOptions;
    const mode = args.mode ?? ECChangesetMode.All_Properties;
    reader._mode = mode;
    try {
      reader._nativeReader.openInMemoryChanges(args.db[_nativeDb], args.invert ?? false, reader._mode);
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
   * @param args.mode Controls which properties are included. Defaults to `All_Properties`.
   * @beta
   */
  public static openTxn(
    args: Omit<ECChangesetReaderArgs, "db"> & { db: IModelDb; txnId: Id64String },
  ): ECChangesetReader {
    const reader = new ECChangesetReader(args.db);
    reader._rowOptions = args.rowOptions ?? {};
    const mode = args.mode ?? ECChangesetMode.All_Properties;
    reader._mode = mode;
    try {
      reader._nativeReader.openTxn(args.db[_nativeDb], args.txnId, args.invert ?? false, reader._mode);
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
  public setOpCodeFilters(ops: Set<ECNativeChangeOp>): void {
    this._nativeReader.setOpCodeFilters(Array.from(ops));
  }

  /**
   * Restrict iteration to changes for the given EC class ids.
   * That means the rows for changes from other EC classes will be skipped entirely and won't be visible through the reader.
   * @param classIds ECClassId values (as hex Id64 strings) to include.
   * @beta
   */
  public setClassIdFilters(classIds: Set<Id64String>): void {
    this._nativeReader.setClassIdFilters(Array.from(classIds));
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
   * Remove the class-id filters
   * @beta
   */
  public clearClassIdFilters(): void {
    this._nativeReader.clearClassIdFilters();
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
      const op: ECNativeChangeOp =
        nativeOp === DbOpcode.Insert ? "Inserted" :
          nativeOp === DbOpcode.Delete ? "Deleted" : "Updated";
      this._op = op;

      this._tableName = meta.tableName
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
              nativeKey: rowValue.key,
              mode: this.modeToString(),
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
              nativeKey: rowValue.key,
              mode: this.modeToString(),
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
  public get op(): ECNativeChangeOp {
    if (this._op === undefined)
      throw new IModelError(IModelStatus.BadRequest, "ECChangesetReader.op is only valid after step() has positioned the reader on a current valid change.");
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


