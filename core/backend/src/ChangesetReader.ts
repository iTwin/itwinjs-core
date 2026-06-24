/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ECDb
 */
import { DbOpcode, Id64String, IModelStatus } from "@itwin/core-bentley";
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
  private static readonly defaultSpillThresholdInBytes = 50 * 1024 * 1024; // 50 MiB
  private readonly _nativeReader: IModelJsNative.ChangesetReader = new IModelNative.platform.ChangesetReader();
  // Internal options — keep ECClassId as raw Id so the unifier can use it as-is.
  private _rowOptions?: RowFormatOptions;
  private _setBatchSize?: number;
  private _propFilter: PropertyFilter = PropertyFilter.All;
  private _changeIndex = 0;
  /** Rows fetched in the most recent native batch call. */
  private _cache: IModelJsNative.ChangesetRowData[] = [];
  /**
   * Index of the current row in `_cache`.
   * Equals `_cache.length` (i.e. out-of-bounds) when no row is active:
   * initial state, after exhaustion, or after close().
   */
  private _cacheIndex = 0;
  /** The db used for EC schema resolution. */
  public readonly db: AnyDb;

  /** Returns the active cached row, throwing if no row is current.
   * @internal */
  private get _currentRow(): IModelJsNative.ChangesetRowData {
    if (this._cacheIndex >= this._cache.length)
      throw new IModelError(IModelStatus.BadRequest, "ChangesetReader: no current row — call step() first.");
    return this._cache[this._cacheIndex];
  }

  /** Returns the batch size to use for native step() calls based on the active property filter.
   * @internal */
  private get _batchSize(): number {
    if (this._setBatchSize !== undefined) return this._setBatchSize;
    if (this._propFilter === PropertyFilter.InstanceKey) return 100;
    else {
      if (this._rowOptions?.abbreviateBlobs === false) return 5;
      return 20;
    }
  }

  /**
   * `true` when the current row belongs to an EC-mapped table.
   * Valid only after a successful call to [[step]].
   * @throws [[IModelError]] if called before a successful [[step]] call.
   * @beta
   */
  public get isECTable(): boolean { return this._currentRow.metadata.isECTable; }

  /**
   * Name of the SQLite table for the current change row.
   * Valid only after a successful call to [[step]].
   * @throws [[IModelError]] if called before a successful [[step]] call.
   * @beta
   */
  public get tableName(): string { return this._currentRow.metadata.tableName; }

  /**
   * `true` when the current change was applied indirectly
   * Valid only after a successful call to [[step]].
   * @throws [[IModelError]] if called before a successful [[step]] call.
   * @beta
   */
  public get isIndirectChange(): boolean { return this._currentRow.metadata.isIndirectChange; }

  /**
   * Post-change (inserted or updated-new) EC instance, computed lazily after each [[step]] call.
   * `undefined` when the current row is a Delete or a non-EC table row or [[step]] returned false.
   * @beta
   */
  public get inserted(): ChangeInstance | undefined {
    const row = this._cacheIndex < this._cache.length ? this._cache[this._cacheIndex] : undefined;
    if (!row || !row.metadata.isECTable || !row.newValues)
      return undefined;
    const op = this.op;
    return {
      ...row.newValues.data,
      $meta: {
        op,
        tables: [row.metadata.tableName],
        changeIndexes: [this._changeIndex],
        stage: "New",
        instanceKey: row.newValues.key,
        propFilter: this._propFilter,
        changeFetchedPropNames: row.newValues.changeFetchedPropNames,
        rowOptions: this._rowOptions,
        isIndirectChange: row.metadata.isIndirectChange,
      },
    };
  }

  /**
   * Pre-change (deleted or updated-old) EC instance, computed lazily after each [[step]] call.
   * `undefined` when the current row is an Insert or a non-EC table row or [[step]] returned false.
   * @beta
   */
  public get deleted(): ChangeInstance | undefined {
    const row = this._cacheIndex < this._cache.length ? this._cache[this._cacheIndex] : undefined;
    if (!row || !row.metadata.isECTable || !row.oldValues)
      return undefined;
    const op = this.op;
    return {
      ...row.oldValues.data,
      $meta: {
        op,
        tables: [row.metadata.tableName],
        changeIndexes: [this._changeIndex],
        stage: "Old",
        instanceKey: row.oldValues.key,
        propFilter: this._propFilter,
        changeFetchedPropNames: row.oldValues.changeFetchedPropNames,
        rowOptions: this._rowOptions,
        isIndirectChange: row.metadata.isIndirectChange,
      },
    };
  }

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
   * @param args.invert When `true`, invert all operations (Insert↔Delete, New↔Old).
   * @param args.rowOptions Row adaptor options controlling how EC property values are formatted.
   * @param args.propFilter Controls which properties are included. Defaults to `All`.
   * @throws if the native layer fails to open the file.
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
      reader.handleCloseErrorWhileOpening(e);
      throw e;
    }
    return reader;
  }

  /**
   * Concatenate multiple changeset files and read them as a single logical stream.
   * @param args.changesetFiles Ordered list of changeset file paths.
   * @param args.db Database with schema at or ahead of the last changeset.
   * @param args.invert When `true`, invert all operations (Insert↔Delete, New↔Old).
   * @param args.rowOptions Row adaptor options controlling how EC property values are formatted.
   * @param args.propFilter Controls which properties are included. Defaults to `All`.
   * @param args.spillThresholdInBytes When the total size of the changeset data in the change group exceeds this threshold (in bytes),
   * the reader writes the data to a temporary file on disk and streams it from there instead of buffering everything in memory.
   * This keeps peak memory usage bounded, making the API suitable for processing large changeset groups under low-memory conditions.
   * Defaults to 50 MiB.
   * @throws if `changesetFiles` is empty, or if the native layer fails to open
   * the group.
   * @beta
   */
  public static openGroup(args: { readonly changesetFiles: string[], spillThresholdInBytes?: number } & ChangesetReaderArgs): ChangesetReader {
    if (args.changesetFiles.length === 0)
      throw new IModelError(IModelStatus.BadArg, "changesetFiles must contain at least one file.");
    const reader = new ChangesetReader(args.db);
    reader._rowOptions = args.rowOptions;
    const propFilter = args.propFilter ?? PropertyFilter.All;
    reader._propFilter = propFilter;
    try {
      reader._nativeReader.openGroup(args.db[_nativeDb], args.changesetFiles, args.invert ?? false, reader._propFilter, args.spillThresholdInBytes ?? this.defaultSpillThresholdInBytes);
    }
    catch (e) {
      reader.handleCloseErrorWhileOpening(e);
      throw e;
    }
    return reader;
  }

  /**
   * Read pending (not yet pushed) local changes from an open IModelDb.
   * @param args.db Must be an [IModelDb]($backend) (not [ECDb]($backend)).
   * @param args.includeInMemoryChanges Also include in-memory (not yet saved to disk) changes.
   * @param args.invert When `true`, invert all operations (Insert↔Delete, New↔Old).
   * @param args.rowOptions Row adaptor options controlling how EC property values are formatted.
   * @param args.propFilter Controls which properties are included. Defaults to `All`.
   * @param args.spillThresholdInBytes When the total size of all local un-pushed saved changes exceeds this threshold (in bytes),
   * the reader writes the data to a temporary file on disk and streams it from there instead of buffering everything in memory.
   * This keeps peak memory usage bounded, making the API suitable for iModels with large local change backlogs under low-memory conditions.
   * Defaults to 50 MiB.
   * @throws if the native layer
   * fails to open the local changes.
   * @beta
   */
  public static openLocalChanges(
    args: Omit<ChangesetReaderArgs, "db"> & { db: IModelDb; includeInMemoryChanges?: boolean, spillThresholdInBytes?: number },
  ): ChangesetReader {
    const reader = new ChangesetReader(args.db);
    reader._rowOptions = args.rowOptions;
    const propFilter = args.propFilter ?? PropertyFilter.All;
    reader._propFilter = propFilter;
    try {
      reader._nativeReader.openLocalChanges(args.db[_nativeDb], args.includeInMemoryChanges ?? false, args.invert ?? false, reader._propFilter, args.spillThresholdInBytes ?? this.defaultSpillThresholdInBytes);
    } catch (e) {
      reader.handleCloseErrorWhileOpening(e);
      throw e;
    }
    return reader;
  }

  /**
   * Read the in-memory (not yet saved to disk) changes of an open IModelDb.
   * @param args.db Must be an [IModelDb]($backend).
   * @param args.invert When `true`, invert all operations (Insert↔Delete, New↔Old).
   * @param args.rowOptions Row adaptor options controlling how EC property values are formatted.
   * @param args.propFilter Controls which properties are included. Defaults to `All`.
   * @param args.spillThresholdInBytes When the total size of the in-memory (unsaved) change data exceeds this threshold (in bytes),
   * the reader writes the data to a temporary file on disk and streams it from there instead of buffering everything in memory.
   * This keeps peak memory usage bounded, making the API suitable for large in-memory transactions under low-memory conditions.
   * Defaults to 50 MiB.
   * @throws if the native layer encounters an error while opening the in-memory changes.
   * @beta
   */
  public static openInMemoryChanges(
    args: Omit<ChangesetReaderArgs, "db"> & { db: IModelDb, spillThresholdInBytes?: number },
  ): ChangesetReader {
    const reader = new ChangesetReader(args.db);
    reader._rowOptions = args.rowOptions;
    const propFilter = args.propFilter ?? PropertyFilter.All;
    reader._propFilter = propFilter;
    try {
      reader._nativeReader.openInMemoryChanges(args.db[_nativeDb], args.invert ?? false, reader._propFilter, args.spillThresholdInBytes ?? this.defaultSpillThresholdInBytes);
    } catch (e) {
      reader.handleCloseErrorWhileOpening(e);
      throw e;
    }
    return reader;
  }

  /**
   * Read a single saved transaction by its id.
   * @param args.db Must be an [IModelDb]($backend) ([ECDb]($backend) does not support transactions).
   * @param args.txnId The id of the saved transaction to read.
   * @param args.invert When `true`, invert all operations (Insert↔Delete, New↔Old).
   * @param args.rowOptions Row adaptor options controlling how EC property values are formatted.
   * @param args.propFilter Controls which properties are included. Defaults to `All`.
   * @param args.spillThresholdInBytes When the total size of the transaction's change data exceeds this threshold (in bytes),
   * the reader writes the data to a temporary file on disk and streams it from there instead of buffering everything in memory.
   * This keeps peak memory usage bounded, making the API suitable for large transactions under low-memory conditions.
   * Defaults to 50 MiB.
   * @throws if `txnId` is not found, or
   * the native layer fails to open the transaction data.
   * @beta
   */
  public static openTxn(
    args: Omit<ChangesetReaderArgs, "db"> & { db: IModelDb; txnId: Id64String, spillThresholdInBytes?: number },
  ): ChangesetReader {
    const reader = new ChangesetReader(args.db);
    reader._rowOptions = args.rowOptions;
    const propFilter = args.propFilter ?? PropertyFilter.All;
    reader._propFilter = propFilter;
    try {
      reader._nativeReader.openTxn(args.db[_nativeDb], args.txnId, args.invert ?? false, reader._propFilter, args.spillThresholdInBytes ?? this.defaultSpillThresholdInBytes);
    } catch (e) {
      reader.handleCloseErrorWhileOpening(e);
      throw e;
    }
    return reader;
  }

  /** Throws if [[step]] has already been called, preventing filter/mode changes mid-iteration.
   * @internal */
  private throwIfAlreadyStepped(): void {
    if (this._changeIndex > 0)
      throw new IModelError(IModelStatus.BadRequest, "ChangesetReader: filters and strict mode and batch size must be configured before the first call to step().");
  }

  /** Handle errors that occur while auto closing the reader if there is also an error while opening the reader */
  private handleCloseErrorWhileOpening(e: unknown): void {
    try {
      this.close();
    } catch (closeError) {
      throw new IModelError(IModelStatus.BadArg, `Failed to open ChangesetReader with error ${e instanceof Error ? e.message : String(e)}.
      Additionally, that triggered an automatic closure of the reader
      releasing native resources which also failed with failure ${closeError instanceof Error ? closeError.message : String(closeError)}.
      Check native error logs for more details.`);
    }
  }

  /**
   * Set the number of rows to fetch and cache while stepping.
   * This is an advanced option that can be used to tune performance for large changesets.
   * If the property filter is set to `InstanceKey`, the default is 100.
   * If property filter is set to `All` or `BisCoreElement`, the default is 20 if [[abbreviateBlobs]] is not set to false, otherwise the default is 5.
   * @param batchSize Number of rows to fetch and cache while stepping. Must be a positive integer.
   * @throws [[IModelError]] if [[step]] has already been called successfully, or if `batchSize` is not a positive integer.
   * @beta
   */
  public setBatchSize(batchSize: number): void {
    this.throwIfAlreadyStepped();
    if (!Number.isInteger(batchSize) || batchSize <= 0)
      throw new IModelError(IModelStatus.BadArg, "ChangesetReader: batchSize must be a positive integer.");
    this._setBatchSize = batchSize;
  }

  // ---------------------------------------------------------------------------
  // Filtering
  // ---------------------------------------------------------------------------

  /**
   * Restrict iteration to changes from the named SQLite tables.
   * That means the rows for changes from other tables will be skipped entirely and won't be visible through the reader.
   * @param tableNames SQLite table names to include.
   * Note: Table names must be provided in the correct case for proper filtering.
   * @throws if [[step]] has already been called and the reader successfully stepped at least once(i.e. returned true for a step() call) or if the native layer encounters an error while setting the filter.
   * @beta
   */
  public setTableNameFilters(tableNames: Set<string>): void {
    this.throwIfAlreadyStepped();
    this._nativeReader.setTableNameFilters(Array.from(tableNames));
  }

  /**
   * Restrict iteration to changes with the given operation types.
   * That means the rows for changes with other operation types will be skipped entirely and won't be visible through the reader.
   * @param ops Operations to include.
   * @throws if [[step]] has already been called and the reader successfully stepped at least once(i.e. returned true for a step() call) or if the native layer encounters an error while setting the filter.
   * @beta
   */
  public setOpCodeFilters(ops: Set<SqliteChangeOp>): void {
    this.throwIfAlreadyStepped();
    this._nativeReader.setOpCodeFilters(Array.from(ops));
  }

  /**
   * Restrict iteration to changes for the given EC class names.
   * That means the rows for changes from other EC classes will be skipped entirely and won't be visible through the reader.
   * @param classNames EC class names to include. The classNames should be in the full name format(i.e. "SchemaName:ClassName").
   * Note: Schema names and class names must be provided in the correct case for proper filtering. Derived classes are not automatically included, so they must be specified explicitly if needed.
   * @throws if [[step]] has already been called and the reader successfully stepped at least once(i.e. returned true for a step() call) or if the native layer encounters an error while setting the filter.
   * @beta
   */
  public setClassNameFilters(classNames: Set<string>): void {
    this.throwIfAlreadyStepped();
    this._nativeReader.setClassNameFilters(Array.from(classNames));
  }

  /**
   * Remove the table-name filters
   * @throws if [[step]] has already been called and the reader successfully stepped at least once(i.e. returned true for a step() call) or if the native layer encounters an error.
   * @beta
   */
  public clearTableNameFilters(): void {
    this.throwIfAlreadyStepped();
    this._nativeReader.clearTableNameFilters();
  }

  /**
   * Remove the op-code filters
   * @throws if [[step]] has already been called and the reader successfully stepped at least once(i.e. returned true for a step() call) or if the native layer encounters an error.
   * @beta
   */
  public clearOpCodeFilters(): void {
    this.throwIfAlreadyStepped();
    this._nativeReader.clearOpCodeFilters();
  }

  /**
   * Remove the class-name filters
   * @throws if [[step]] has already been called and the reader successfully stepped at least once(i.e. returned true for a step() call) or if the native layer encounters an error.
   * @beta
   */
  public clearClassNameFilters(): void {
    this.throwIfAlreadyStepped();
    this._nativeReader.clearClassNameFilters();
  }

  // ---------------------------------------------------------------------------
  // Strict mode
  // ---------------------------------------------------------------------------

  /**
   * Enable strict mode on the reader.
   *
   * Strict mode affects how the reader handles a **column-count mismatch** between a change
   * record and the corresponding live database table. Such a mismatch can occur when columns
   * have been added to a table after the changeset was created.
   *
   * When strict mode is **enabled**: if the number of columns recorded in a change row differs
   * from the number of columns currently present in the live table, the reader throws an error
   * instead of processing that row.
   *
   * Use strict mode when you need to be certain that every change row is interpreted against
   * exactly the schema that was in effect when the changeset was written.
   *
   * @see [[disableStrictMode]] — the default (lenient) behaviour.
   * @throws if [[step]] has already been called and the reader successfully stepped at least once(i.e. returned true for a step() call) or if the native layer encounters an error.
   * @beta
   */
  public enableStrictMode(): void {
    this.throwIfAlreadyStepped();
    this._nativeReader.enableStrictMode();
  }

  /**
   * Disable strict mode on the reader (this is the default).
   *
   * When strict mode is **disabled**: if the number of columns recorded in a change row differs
   * from the number of columns currently present in the live table, the reader takes the
   * **minimum** of the two column counts and proceeds normally with that subset. This is safe
   * because SQLite only ever appends new columns at the end of a table and never removes them —
   * so older change records simply lack the trailing columns that were added later, and those
   * missing columns are silently ignored.
   *
   * @see [[enableStrictMode]] — throw on column-count mismatches instead.
   * @throws if [[step]] has already been called and the reader successfully stepped at least once(i.e. returned true for a step() call) or if the native layer encounters an error.
   * @beta
   */
  public disableStrictMode(): void {
    this.throwIfAlreadyStepped();
    this._nativeReader.disableStrictMode();
  }

  // ---------------------------------------------------------------------------
  // Iteration
  // ---------------------------------------------------------------------------

  /**
   * Advance to the next change and populate `inserted` and/or `deleted`.
   * @returns `true` while positioned on a valid change; `false` when the stream is exhausted.
   * @throws if the native layer encounters an error while reading or decoding
   * the next change.
   * @beta
   */
  public step(): boolean {
    if (this._cacheIndex + 1 < this._cache.length) {
      // Still have rows in cache — advance the pointer
      this._cacheIndex++;
    } else {
      // Cache empty or fully consumed — fetch next batch from native
      const nativeRowOpts = this._rowOptions ? this.toNativeRowOptions(this._rowOptions) : {};
      this._cache = this._nativeReader.step(this._batchSize, nativeRowOpts);
      this._cacheIndex = 0;
      if (this._cache.length === 0) return false;
    }
    this._changeIndex++;
    return true;
  }

  /**
   * SQLite opcode of the current change.
   * Valid only after a successful call to [[step]].
   * @throws [[IModelError]] if called before a successful [[step]] call.
   * @beta
   */
  public get op(): SqliteChangeOp {
    const opCode = this._currentRow.metadata.opCode;
    return opCode === DbOpcode.Insert ? "Inserted"
      : opCode === DbOpcode.Update ? "Updated"
        : "Deleted";
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  /**
   * Close the reader and release all native resources.
   *
   * @throws if the native layer encounters an error during cleanup. Native resources
   * are not fully released when this throws — check the native error
   * logs for details.
   * @beta
   */
  public close(): void {
    this._changeIndex = 0;
    this._cache = [];
    this._cacheIndex = 0;
    this._nativeReader.close();
  }

  /**
   * Implements the `Disposable` contract — delegates to [[close]].
   *
   * @throws if the native layer fails to release its resources (re-thrown from [[close]]).
   * @beta
   */
  public [Symbol.dispose](): void {
    this.close();
  }
}


