/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module SQLiteDb
 */
import { DbChangeStage, DbOpcode, Id64String } from "@itwin/core-bentley";
import { IModelJsNative } from "@bentley/imodeljs-native";
import { ChangeMetaData, ChangedECInstance, IECChangeSource } from "./ChangesetECAdaptor";
import { ECDb } from "./ECDb";
import { IModelDb } from "./IModelDb";
import { IModelNative } from "./internal/NativePlatform";
import { _nativeDb } from "./internal/Symbols";
import { AnyDb, SqliteChangeOp, SqliteValueStage } from "./ChangesetTypes";

/**
 * Arguments common to all {@link ECChangesetReader} `open*` factory methods.
 * @beta
 */
export interface ECChangesetReaderArgs {
  /** The db used to resolve EC schema. Must be at or ahead of the changeset being read. */
  readonly db: AnyDb;
  /** When `true`, all operations are logically inverted (Insert↔Delete). */
  readonly invert?: true;
}

/**
 * Options controlling how a changed EC row is formatted by {@link ECChangesetReader.getValue}.
 * @beta
 */
export interface ECChangeRowAdaptorOptions {
  /** Abbreviate blob values to a placeholder instead of returning raw bytes. */
  abbreviateBlobs?: boolean;
  /** Convert ECClassId integers to fully-qualified class names (e.g. `"BisCore:Element"`). */
  classIdsToClassNames?: boolean;
  /** Use JavaScript-style camelCase property names instead of EC access strings. */
  useJsName?: boolean;
  /** Skip class-name conversion for aliased class-id columns. */
  doNotConvertClassIdsToClassNamesWhenAliased?: boolean;
}

/**
 * Reads EC-typed changeset data natively from a changeset file, changeset group,
 * in-memory transaction, or local un-pushed changes.
 *
 * Unlike {@link ChangesetECAdaptor} (which sits on top of {@link SqliteChangesetReader}
 * and performs EC mapping in TypeScript), this class delegates EC-schema resolution
 * and row transformation to the native layer via `IModelNative.platform.ECChangesetReader`.
 *
 * Each call to {@link step} populates {@link inserted} and/or {@link deleted} with
 * EC-typed instances that always carry a `$meta` property, making the reader directly
 * compatible with {@link PartialECChangeUnifier} via the {@link IECChangeSource} contract.
 *
 * @note The native reader still operates one SQLite table-row at a time.
 * Multi-table EC instances must be merged using {@link PartialECChangeUnifier}.
 * @beta
 */
export class ECChangesetReader implements Disposable, IECChangeSource {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly _nativeReader: any = new (IModelNative.platform as any).ECChangesetReader();
  // Internal options used by step() — keep ECClassId as raw Id so PartialECChangeUnifier can use it.
  private readonly _valueOptions: IModelJsNative.ECSqlRowAdaptorOptions = { classIdsToClassNames: false };
  private _changeIndex = 0;
  private _op?: SqliteChangeOp;

  /** The db used for EC schema resolution. */
  public readonly db: AnyDb;

  /**
   * Post-change (inserted or updated-new) EC instance, populated after each {@link step}.
   * Always carries `$meta`. `undefined` when the current row is a Delete.
   * @beta
   */
  public inserted?: ChangedECInstance;

  /**
   * Pre-change (deleted or updated-old) EC instance, populated after each {@link step}.
   * Always carries `$meta`. `undefined` when the current row is an Insert.
   * @beta
   */
  public deleted?: ChangedECInstance;

  // Private — callers use static factory methods.
  private constructor(db: AnyDb) {
    this.db = db;
  }

  // ---------------------------------------------------------------------------
  // Static factory methods
  // ---------------------------------------------------------------------------

  /**
   * Open a changeset file from disk.
   * @param args.fileName Absolute path to the changeset file.
   * @param args.db Database at or after the changeset's ending state, used for schema resolution.
   * @param args.invert When `true`, invert all operations (Insert↔Delete).
   * @beta
   */
  public static openFile(args: { readonly fileName: string } & ECChangesetReaderArgs): ECChangesetReader {
    const reader = new ECChangesetReader(args.db);
    reader._nativeReader.openFile(args.db[_nativeDb], args.fileName, args.invert ?? false);
    return reader;
  }

  /**
   * Concatenate multiple changeset files and read them as a single logical stream.
   * @param args.changesetFiles Ordered list of changeset file paths.
   * @param args.db Database with schema at or ahead of the last changeset.
   * @beta
   */
  public static openGroup(args: { readonly changesetFiles: string[] } & ECChangesetReaderArgs): ECChangesetReader {
    if (args.changesetFiles.length === 0)
      throw new Error("changesetFiles must contain at least one file.");
    const reader = new ECChangesetReader(args.db);
    reader._nativeReader.openGroup(args.db[_nativeDb], args.changesetFiles, args.invert ?? false);
    return reader;
  }

  /**
   * Read pending (not yet pushed) local changes from an open IModelDb.
   * @param args.db Must be an `IModelDb` (not `ECDb`).
   * @param args.includeInMemoryChanges Also include in-memory (not yet saved to disk) changes.
   * @beta
   */
  public static openLocalChanges(
    args: Omit<ECChangesetReaderArgs, "db"> & { db: IModelDb; includeInMemoryChanges?: true },
  ): ECChangesetReader {
    const reader = new ECChangesetReader(args.db);
    reader._nativeReader.openLocalChanges(args.db[_nativeDb], args.includeInMemoryChanges ?? false, args.invert ?? false);
    return reader;
  }

  /**
   * Read the in-memory (not yet saved to disk) changes of an open IModelDb.
   * @param args.db Must be an `IModelDb`.
   * @beta
   */
  public static openInMemoryChanges(
    args: Omit<ECChangesetReaderArgs, "db"> & { db: IModelDb },
  ): ECChangesetReader {
    const reader = new ECChangesetReader(args.db);
    reader._nativeReader.openInMemoryChanges(args.db[_nativeDb], args.invert ?? false);
    return reader;
  }

  /**
   * Read a single saved transaction by its id.
   * @param args.db Must be an `IModelDb` (`ECDb` does not support transactions).
   * @param args.txnId The id of the saved transaction to read.
   * @beta
   */
  public static openTxn(
    args: Omit<ECChangesetReaderArgs, "db"> & { db: IModelDb; txnId: Id64String },
  ): ECChangesetReader {
    const reader = new ECChangesetReader(args.db);
    reader._nativeReader.openTxn(args.db[_nativeDb], args.txnId, args.invert ?? false);
    return reader;
  }

  // ---------------------------------------------------------------------------
  // Iteration
  // ---------------------------------------------------------------------------

  /**
   * Advance to the next change and populate {@link inserted} and/or {@link deleted}.
   *
   * `$meta` is constructed in TypeScript from native accessors:
   * - `getOpCode()` → `$meta.op`
   * - `getTableName()` → `$meta.tables`
   * - {@link changeIndex} → `$meta.changeIndexes`
   *
   * {@link getValue} returns the plain EC data object for the requested stage.
   * When a stage has no content (e.g. Old on an Insert), `getValue` returns `{}`.
   * The wrapper relies on `op` — not the data content — to decide which of
   * `inserted` / `deleted` to populate.
   *
   * @returns `true` while positioned on a valid change; `false` when the stream is exhausted.
   * @beta
   */
  public step(): boolean {
    this.inserted = undefined;
    this.deleted = undefined;
    this._op = undefined;

    if (this._nativeReader.step()) {
      this._changeIndex++;

      const nativeOp = this._nativeReader.getOpCode();
      const op: SqliteChangeOp =
        nativeOp === DbOpcode.Insert ? "Inserted" :
          nativeOp === DbOpcode.Delete ? "Deleted" : "Updated";
      this._op = op;

      const $metaBase: Omit<ChangeMetaData, "stage"> = {
        op,
        tables: [this._nativeReader.getTableName()],
        changeIndexes: [this._changeIndex],
        classFullName: undefined,
      };

      if (op === "Inserted" || op === "Updated") {
        const data = this._nativeReader.getValue(DbChangeStage.New, this._valueOptions);
        this.inserted = { ...data, $meta: { ...$metaBase, stage: "New" } };
      }

      if (op === "Deleted" || op === "Updated") {
        const data = this._nativeReader.getValue(DbChangeStage.Old, this._valueOptions);
        this.deleted = { ...data, $meta: { ...$metaBase, stage: "Old" } };
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
  public get op(): SqliteChangeOp { return this._op!; }

  /**
   * Zero-based index of the current change, incremented on each successful {@link step}.
   * @beta
   */
  public get changeIndex(): number { return this._changeIndex; }

  // ---------------------------------------------------------------------------
  // Direct value access
  // ---------------------------------------------------------------------------

  /**
   * Call native `getValue` directly for the current change with custom formatting options.
   *
   * Useful when callers need options other than the defaults used internally by {@link step}
   * (e.g. `useJsName: true` or `classIdsToClassNames: true`).
   *
   * @param stage Which version of the value — `"Old"` (before change) or `"New"` (after change).
   * @param args  Formatting options.
   * @returns EC data object for the requested stage. Returns `{}` when the stage has no content
   *          (e.g. `"Old"` for an Insert or `"New"` for a Delete).
   * @beta
   */
  public getValue(stage: SqliteValueStage, args: ECChangeRowAdaptorOptions = {}): any {
    return this._nativeReader.getValue(
      stage === "New" ? DbChangeStage.New : DbChangeStage.Old,
      args as IModelJsNative.ECSqlRowAdaptorOptions,
    );
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
