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
import { ECChangesetReaderArgs, ECNativeChangeInstance, ECNativeChangeOp, ECNativeChangeSource } from "./ECChangesetReaderTypes";
import { AnyDb } from "./SqliteChangesetReader";


// ---------------------------------------------------------------------------
// ECChangesetReader
// ---------------------------------------------------------------------------

/**
 * Reads EC-typed changeset data natively from a changeset file, changeset group,
 * in-memory transaction, or local un-pushed changes.
 *
 * Implements {@link ECNativeChangeSource} so rows can be fed directly into
 * {@link ECNativePartialChangeUnifier} to merge partial (per-table) instances into
 * complete EC instances.
 *
 * When the current row is a non-EC internal SQLite table, {@link isECTable} is `false`
 * and both {@link inserted} and {@link deleted} remain `undefined`.
 *
 * @note The native reader operates one SQLite table-row at a time. Multi-table EC
 * instances must be merged using {@link ECNativePartialChangeUnifier}.
 * @beta
 */
export class ECChangesetReader implements Disposable, ECNativeChangeSource {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly _nativeReader: IModelJsNative.ECChangesetReader = new IModelNative.platform.ECChangesetReader();
  // Internal options — keep ECClassId as raw Id so the unifier can use it as-is.
  private _rowOptions?: IModelJsNative.ECSqlRowAdaptorOptions;
  private _mode: IModelJsNative.ECChangesetReader.Mode = IModelJsNative.ECChangesetReader.Mode.All_Properties;
  private _changeIndex = 0;
  private _op?: ECNativeChangeOp;
  private _isECTable?: boolean;

  /** The db used for EC schema resolution. */
  public readonly db: AnyDb;

  /**
   * `true` when the current row belongs to an EC-mapped table.
   * Valid only after a successful call to {@link step}.
   * @beta
   */
  public get isECTable(): boolean {
    if (this._isECTable === undefined)
      throw new IModelError(IModelStatus.BadRequest, "ECChangesetReader.isECTable is only valid after step() has positioned the reader on a current valid change.");
    return this._isECTable;
  }

  /**
   * Post-change (inserted or updated-new) EC instance, populated after each {@link step}.
   * `undefined` when the current row is a Delete or a non-EC table row or step() returned false.
   * @beta
   */
  public inserted?: ECNativeChangeInstance;

  /**
   * Pre-change (deleted or updated-old) EC instance, populated after each {@link step}.
   * `undefined` when the current row is an Insert or a non-EC table row or step() returned false.
   * @beta
   */
  public deleted?: ECNativeChangeInstance;

  // Private — callers use static factory methods.
  private constructor(db: AnyDb) {
    this.db = db;
  }

  /** Convert a {@link IModelJsNative.ECChangesetReader.Mode} enum value to its string name. */
  private modeToString(mode: IModelJsNative.ECChangesetReader.Mode): string {
    switch (mode) {
      case IModelJsNative.ECChangesetReader.Mode.All_Properties: return "All_Properties";
      case IModelJsNative.ECChangesetReader.Mode.Bis_Element_Properties: return "Bis_Element_Properties";
      case IModelJsNative.ECChangesetReader.Mode.Instance_Key: return "Instance_Key";
      default: return String(mode);
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
    reader._mode = args.mode ?? IModelJsNative.ECChangesetReader.Mode.All_Properties;
    reader._nativeReader.openFile(args.db[_nativeDb], args.fileName, args.invert ?? false, reader._mode);
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
    reader._mode = args.mode ?? IModelJsNative.ECChangesetReader.Mode.All_Properties;
    reader._nativeReader.openGroup(args.db[_nativeDb], args.changesetFiles, args.invert ?? false, reader._mode);
    return reader;
  }

  /**
   * Read pending (not yet pushed) local changes from an open IModelDb.
   * @param args.db Must be an `IModelDb` (not `ECDb`).
   * @param args.includeInMemoryChanges Also include in-memory (not yet saved to disk) changes.
   * @param args.valueOptions Row adaptor options controlling how EC property values are formatted.
   * @param args.mode Controls which properties are included. Defaults to `All_Properties`.
   * @beta
   */
  public static openLocalChanges(
    args: Omit<ECChangesetReaderArgs, "db"> & { db: IModelDb; includeInMemoryChanges?: true },
  ): ECChangesetReader {
    const reader = new ECChangesetReader(args.db);
    reader._rowOptions = args.rowOptions;
    reader._mode = args.mode ?? IModelJsNative.ECChangesetReader.Mode.All_Properties;
    reader._nativeReader.openLocalChanges(args.db[_nativeDb], args.includeInMemoryChanges ?? false, args.invert ?? false, reader._mode);
    return reader;
  }

  /**
   * Read the in-memory (not yet saved to disk) changes of an open IModelDb.
   * @param args.db Must be an `IModelDb`.
   * @param args.valueOptions Row adaptor options controlling how EC property values are formatted.
   * @param args.mode Controls which properties are included. Defaults to `All_Properties`.
   * @beta
   */
  public static openInMemoryChanges(
    args: Omit<ECChangesetReaderArgs, "db"> & { db: IModelDb },
  ): ECChangesetReader {
    const reader = new ECChangesetReader(args.db);
    reader._rowOptions = args.rowOptions;
    reader._mode = args.mode ?? IModelJsNative.ECChangesetReader.Mode.All_Properties;
    reader._nativeReader.openInMemoryChanges(args.db[_nativeDb], args.invert ?? false, reader._mode);
    return reader;
  }

  /**
   * Read a single saved transaction by its id.
   * @param args.db Must be an `IModelDb` (`ECDb` does not support transactions).
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
    reader._mode = args.mode ?? IModelJsNative.ECChangesetReader.Mode.All_Properties;
    reader._nativeReader.openTxn(args.db[_nativeDb], args.txnId, args.invert ?? false, reader._mode);
    return reader;
  }

  // ---------------------------------------------------------------------------
  // Iteration
  // ---------------------------------------------------------------------------

  /**
   * Advance to the next change and populate {@link inserted} and/or {@link deleted}.
   *
   * After each call, check {@link isECTable}:
   * - `true`  → the row is EC-mapped; `inserted`/`deleted` are populated per the opcode.
   * - `false` → the row is an internal SQLite table; both `inserted` and `deleted` are `undefined`.
   *
   * @returns `true` while positioned on a valid change; `false` when the stream is exhausted.
   * @beta
   */
  public step(): boolean {
    this.inserted = undefined;
    this.deleted = undefined;
    this._op = undefined;
    this._isECTable = false;

    if (this._nativeReader.step()) {
      this._changeIndex++;

      const nativeOp = this._nativeReader.getOpcode();
      const op: ECNativeChangeOp =
        nativeOp === DbOpcode.Insert ? "Inserted" :
          nativeOp === DbOpcode.Delete ? "Deleted" : "Updated";
      this._op = op;

      const tableName: string = this._nativeReader.getTableName();
      const changesetFetchedProps = new Set<string>(this._nativeReader.getChangesetFetchedPropertyNames());

      if (op === "Inserted" || op === "Updated") {
        const rowValue = this._nativeReader.getValue(DbChangeStage.New, this._rowOptions ?? {});
        if (rowValue.isECTable && rowValue.data !== undefined && rowValue.key !== undefined) {
          this._isECTable = true;
          this.inserted = {
            ...rowValue.data,
            $meta: {
              op,
              tables: [tableName],
              changeIndexes: [this._changeIndex],
              stage: "New",
              nativeKey: rowValue.key,
              mode: this.modeToString(this._mode),
              changesetFetchedProps,
              rowOptions: this._rowOptions,
            },
          };
        }
      }

      if (op === "Deleted" || op === "Updated") {
        const rowValue = this._nativeReader.getValue(DbChangeStage.Old, this._rowOptions ?? {});
        if (rowValue.isECTable && rowValue.data !== undefined && rowValue.key !== undefined) {
          this._isECTable = true;
          this.deleted = {
            ...rowValue.data,
            $meta: {
              op,
              tables: [tableName],
              changeIndexes: [this._changeIndex],
              stage: "Old",
              nativeKey: rowValue.key,
              mode: this.modeToString(this._mode),
              changesetFetchedProps,
              rowOptions: this._rowOptions,
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
   * Valid only after a successful call to {@link step}.
   * @beta
   */
  public get op(): ECNativeChangeOp {
    if (this._op === undefined)
      throw new IModelError(IModelStatus.BadRequest, "ECChangesetReader.op is only valid after step() has positioned the reader on a current valid change.");
    return this._op;
  }

  /**
   * index of the current change, incremented on each successful {@link step}.
   * Starts at 1 for the first change( when the step() call actually returned true).
   * @beta
   */
  public get changeIndex(): number {
    if (this._changeIndex === 0)
      throw new IModelError(IModelStatus.BadRequest, "ECChangesetReader.changeIndex is only valid after step() has positioned the reader on a current valid change.");
    return this._changeIndex;
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
    this._isECTable = false;
    this.inserted = undefined;
    this.deleted = undefined;
    this._nativeReader.close();
  }

  /**
   * Implements the `Disposable` contract — calls {@link close}.
   * @beta
   */
  public [Symbol.dispose](): void {
    this.close();
  }
}


