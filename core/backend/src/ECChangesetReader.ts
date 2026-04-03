/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module SQLiteDb
 */
import { DbChangeStage, DbOpcode, DbResult, Guid, Id64String } from "@itwin/core-bentley";
import { Base64EncodedString } from "@itwin/core-common";
import { ECDb } from "./ECDb";
import { IModelDb } from "./IModelDb";
import { IModelNative } from "./internal/NativePlatform";
import { _nativeDb } from "./internal/Symbols";
import { SqliteStatement } from "./SqliteStatement";
import { AnyDb } from "./core-backend";
import { IModelJsNative } from "@bentley/imodeljs-native";

// ---------------------------------------------------------------------------
// Type aliases
// ---------------------------------------------------------------------------

/**
 * Operation that caused an EC change.
 * @beta
 */
export type ECNativeChangeOp = "Inserted" | "Updated" | "Deleted";

/**
 * Which snapshot of the changed EC row.
 * @beta
 */
export type ECNativeChangeStage = "Old" | "New";

// ---------------------------------------------------------------------------
// Public interfaces
// ---------------------------------------------------------------------------

/**
 * Metadata attached to every {@link ECNativeChangeInstance}.
 * @beta
 */
export interface ECNativeChangeMeta {
  /** SQLite tables that contributed columns to this change row. */
  tables: string[];
  /** Operation that produced this change. */
  op: ECNativeChangeOp;
  /** Whether this is the pre-change (`"Old"`) or post-change (`"New"`) snapshot. */
  stage: ECNativeChangeStage;
  /** Change-stream index positions (one per table contribution). */
  changeIndexes: number[];
  /**
   * Native instance key computed by the native layer.
   * Encodes ECInstanceId and root class; used as the merge key in
   * {@link ECNativePartialChangeUnifier}.
   */
  nativeKey: string;
  /** Reader mode that was active when this change row was captured. */
  mode: string;
  /** Set of EC property names fetched from the changeset for this row. */
  changesetFetchedProps: Set<string>;
  /** Row adaptor options that were active when this change row was captured. */
  rowOptions?: IModelJsNative.ECSqlRowAdaptorOptions;
}

/**
 * An EC instance produced by {@link ECChangesetReader} after each `step()`.
 * Contains the EC property bag plus mandatory `$meta` metadata.
 * @beta
 */
export interface ECNativeChangeInstance {
  /** Metadata describing the origin and identity of this change. */
  $meta: ECNativeChangeMeta;
  /** EC property bag (ECClassId, ECInstanceId, user-defined properties, ...). */
  [key: string]: any;
}

/**
 * Contract for any reader that produces EC-typed changed instances compatible with
 * {@link ECNativePartialChangeUnifier}.
 * @beta
 */
export interface ECNativeChangeSource {
  /** The SQLite opcode of the current change row. */
  readonly op: ECNativeChangeOp;
  /**
   * `true` when the current row belongs to an EC-mapped table.
   * `false` for internal SQLite tables (_LocalState, _ChangedInstanceIds, etc.).
   * When `false`, `inserted` and `deleted` are both `undefined`.
   */
  readonly isECTable: boolean;
  /**
   * The newly-inserted or post-update EC instance.
   * `undefined` when the current row is a Delete, or when `isECTable` is `false`.
   */
  readonly inserted?: ECNativeChangeInstance;
  /**
   * The deleted or pre-update EC instance.
   * `undefined` when the current row is an Insert, or when `isECTable` is `false`.
   */
  readonly deleted?: ECNativeChangeInstance;
}

// ---------------------------------------------------------------------------
// ECChangesetReader args / options
// ---------------------------------------------------------------------------

/**
 * Arguments common to all {@link ECChangesetReader} `open*` factory methods.
 * @beta
 */
export interface ECChangesetReaderArgs {
  /** The db used to resolve EC schema. Must be at or ahead of the changeset being read. */
  readonly db: AnyDb;
  /** When `true`, all operations are logically inverted (Insert↔Delete). */
  readonly invert?: true;
  /** Row adaptor options controlling how EC property values are formatted. */
  readonly rowOptions?: IModelJsNative.ECSqlRowAdaptorOptions;
  /** Controls which properties are included in the change output. Defaults to `All_Properties`. */
  readonly mode?: IModelJsNative.ECChangesetReader.Mode;
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
  private _isECTable = false;

  /** The db used for EC schema resolution. */
  public readonly db: AnyDb;

  /**
   * `true` when the current row belongs to an EC-mapped table.
   * Valid only after a successful call to {@link step}.
   * @beta
   */
  public get isECTable(): boolean { return this._isECTable; }

  /**
   * Post-change (inserted or updated-new) EC instance, populated after each {@link step}.
   * `undefined` when the current row is a Delete or a non-EC table row.
   * @beta
   */
  public inserted?: ECNativeChangeInstance;

  /**
   * Pre-change (deleted or updated-old) EC instance, populated after each {@link step}.
   * `undefined` when the current row is an Insert or a non-EC table row.
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
  public get op(): ECNativeChangeOp { return this._op!; }

  /**
   * Zero-based index of the current change, incremented on each successful {@link step}.
   * @beta
   */
  public get changeIndex(): number { return this._changeIndex; }

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

// ---------------------------------------------------------------------------
// ECNativeChangeUnifierCache — interface + factory
// ---------------------------------------------------------------------------

/**
 * Cache used by {@link ECNativePartialChangeUnifier} to accumulate and merge
 * partial EC change instances.
 * @beta
 */
export interface ECNativeChangeUnifierCache extends Disposable {
  /** Retrieve a cached instance by key, or `undefined` if absent. */
  get(key: string): ECNativeChangeInstance | undefined;
  /** Insert or replace a cached instance. */
  set(key: string, value: ECNativeChangeInstance): void;
  /** Iterate over all cached instances. */
  all(): IterableIterator<ECNativeChangeInstance>;
  /** Number of instances currently in the cache. */
  count(): number;
}

/** @beta */
export namespace ECNativeChangeUnifierCache {
  /**
   * Creates an in-memory cache backed by a `Map`.
   * Fast, but may exhaust memory for very large changesets.
   * @returns An {@link ECNativeChangeUnifierCache} backed by an in-memory `Map`.
   * @beta
   */
  export function createInMemoryCache(): ECNativeChangeUnifierCache {
    return new NativeInMemoryInstanceCache();
  }

  /**
   * Creates a SQLite-backed cache stored in a temporary table of the given database.
   * Slower than in-memory but handles large changesets without exhausting memory.
   * @param db Database that will host the temporary cache table.
   * @param bufferedReadInstanceSizeInBytes Read-batch size in bytes (default 10 MB).
   * @returns An {@link ECNativeChangeUnifierCache} backed by a SQLite temp table.
   * @beta
   */
  export function createSqliteBackedCache(
    db: AnyDb,
    bufferedReadInstanceSizeInBytes = 1024 * 1024 * 10,
  ): ECNativeChangeUnifierCache {
    return new NativeSqliteBackedInstanceCache(db, bufferedReadInstanceSizeInBytes);
  }
}

// ---------------------------------------------------------------------------
// Private: NativeInMemoryInstanceCache
// ---------------------------------------------------------------------------

class NativeInMemoryInstanceCache implements ECNativeChangeUnifierCache {
  private readonly _cache = new Map<string, ECNativeChangeInstance>();

  public get(key: string): ECNativeChangeInstance | undefined {
    return this._cache.get(key);
  }

  public set(key: string, value: ECNativeChangeInstance): void {
    // Remove undefined meta keys to keep serialised form compact.
    const meta = value.$meta as any;
    if (meta) {
      Object.keys(meta).forEach((k) => meta[k] === undefined && delete meta[k]);
    }
    this._cache.set(key, value);
  }

  public *all(): IterableIterator<ECNativeChangeInstance> {
    for (const key of Array.from(this._cache.keys()).sort()) {
      const instance = this._cache.get(key);
      if (instance)
        yield instance;
    }
  }

  public count(): number {
    return this._cache.size;
  }

  public [Symbol.dispose](): void {
    this._cache.clear();
  }
}

// ---------------------------------------------------------------------------
// Private: NativeSqliteBackedInstanceCache
// ---------------------------------------------------------------------------

class NativeSqliteBackedInstanceCache implements ECNativeChangeUnifierCache {
  private readonly _cacheTable = `[temp].[${Guid.createValue()}]`;
  public static readonly defaultBufferSize = 1024 * 1024 * 10; // 10 MB

  public constructor(
    private readonly _db: AnyDb,
    public readonly bufferedReadInstanceSizeInBytes: number = NativeSqliteBackedInstanceCache.defaultBufferSize,
  ) {
    if (bufferedReadInstanceSizeInBytes <= 0)
      throw new Error("bufferedReadInstanceSizeInBytes must be greater than 0");
    this.createTempTable();
  }

  private createTempTable(): void {
    this._db.withSqliteStatement(`CREATE TABLE ${this._cacheTable} ([key] text primary key, [value] text)`, (stmt: SqliteStatement) => {
      if (DbResult.BE_SQLITE_DONE !== stmt.step())
        throw new Error("unable to create temp cache table");
    });
  }

  private dropTempTable(): void {
    this._db.saveChanges();
    if (this._db instanceof ECDb)
      this._db.clearStatementCache();
    else
      this._db.clearCaches();
    this._db.withSqliteStatement(`DROP TABLE IF EXISTS ${this._cacheTable}`, (stmt: SqliteStatement) => {
      if (DbResult.BE_SQLITE_DONE !== stmt.step())
        throw new Error("unable to drop temp cache table");
    });
  }

  public get(key: string): ECNativeChangeInstance | undefined {
    return this._db.withPreparedSqliteStatement(
      `SELECT [value] FROM ${this._cacheTable} WHERE [key]=?`,
      (stmt: SqliteStatement) => {
        stmt.bindString(1, key);
        if (stmt.step() === DbResult.BE_SQLITE_ROW)
          return JSON.parse(stmt.getValueString(0), Base64EncodedString.reviver) as ECNativeChangeInstance;
        return undefined;
      },
    );
  }

  public set(key: string, value: ECNativeChangeInstance): void {
    const shallowCopy = Object.assign({}, value);
    this._db.withPreparedSqliteStatement(
      `INSERT INTO ${this._cacheTable} ([key], [value]) VALUES (?, ?) ON CONFLICT ([key]) DO UPDATE SET [value] = [excluded].[value]`,
      (stmt: SqliteStatement) => {
        stmt.bindString(1, key);
        stmt.bindString(2, JSON.stringify(shallowCopy, Base64EncodedString.replacer));
        stmt.step();
      },
    );
  }

  public *all(): IterableIterator<ECNativeChangeInstance> {
    const sql = `
      SELECT JSON_GROUP_ARRAY(JSON([value]))
      FROM (
        SELECT [value],
               SUM(LENGTH([value])) OVER (ORDER BY [key] ROWS UNBOUNDED PRECEDING) / ${this.bufferedReadInstanceSizeInBytes} AS [bucket]
        FROM ${this._cacheTable}
      )
      GROUP BY [bucket]`;

    const stmt = this._db.prepareSqliteStatement(sql);
    while (stmt.step() === DbResult.BE_SQLITE_ROW) {
      const bucket = JSON.parse(stmt.getValueString(0), Base64EncodedString.reviver) as ECNativeChangeInstance[];
      for (const instance of bucket)
        yield instance;
    }
    stmt[Symbol.dispose]();
  }

  public count(): number {
    return this._db.withPreparedSqliteStatement(
      `SELECT COUNT(*) FROM ${this._cacheTable}`,
      (stmt: SqliteStatement) => {
        if (stmt.step() === DbResult.BE_SQLITE_ROW)
          return stmt.getValue(0).getInteger();
        return 0;
      },
    );
  }

  public [Symbol.dispose](): void {
    if (this._db.isOpen)
      this.dropTempTable();
  }
}

// ---------------------------------------------------------------------------
// ECNativePartialChangeUnifier
// ---------------------------------------------------------------------------

/**
 * Combines partial EC change instances (one per SQLite table row) into complete
 * instances that span all tables mapping to a single EC entity.
 *
 * The merge key is derived from the native `key` stored in `$meta.nativeKey`, which
 * is computed by the C++ layer and already encodes the EC instance identity (ECInstanceId
 * + root class). No additional SQL queries are required for key construction.
 *
 * **Usage:**
 * ```ts
 * using reader = ECChangesetReader.openFile({ fileName, db });
 * using unifier = new ECNativePartialChangeUnifier();
 * while (reader.step()) {
 *   unifier.appendFrom(reader);
 * }
 * for (const instance of unifier.instances) { ... }
 * ```
 * @beta
 */
export class ECNativePartialChangeUnifier implements Disposable {
  public constructor(
    private readonly _cache: ECNativeChangeUnifierCache = new NativeInMemoryInstanceCache(),
  ) { }

  /** Releases the underlying cache. */
  public [Symbol.dispose](): void {
    this._cache[Symbol.dispose]();
  }

  /** Number of complete (merged) instances currently accumulated. */
  public get instanceCount(): number {
    return this._cache.count();
  }

  /**
   * Append partial changes from the current reader row and merge them into the cache.
   *
   * Non-EC table rows (`source.isECTable === false`) are silently skipped.
   *
   * @param source Any {@link ECNativeChangeSource} positioned on a valid row.
   * @beta
   */
  public appendFrom(source: ECNativeChangeSource): void {
    // Non-EC table rows: isECTable is false, inserted and deleted are both undefined — skip.
    if (!source.isECTable)
      return;

    if (source.op === "Updated") {
      if (source.inserted)
        this.combine(source.inserted);
      if (source.deleted)
        this.combine(source.deleted);
    } else if (source.op === "Inserted" && source.inserted) {
      this.combine(source.inserted);
    } else if (source.op === "Deleted" && source.deleted) {
      this.combine(source.deleted);
    }
  }

  /**
   * Iterator over all fully-merged EC change instances.
   * @beta
   */
  public get instances(): IterableIterator<ECNativeChangeInstance> {
    return this._cache.all();
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private buildKey(instance: ECNativeChangeInstance): string {
    const { nativeKey, stage } = instance.$meta;
    return `${nativeKey}-${stage}`.toLowerCase();
  }

  private combine(rhs: ECNativeChangeInstance): void {
    const key = this.buildKey(rhs);
    const lhs = this._cache.get(key);
    if (lhs) {
      // Merge data fields — rhs wins for any overlapping columns.
      const { $meta: _rhsMeta, ...rhsData } = rhs as any;
      Object.assign(lhs, rhsData);
      // Accumulate per-table metadata lists.
      lhs.$meta.tables = [...lhs.$meta.tables, ...rhs.$meta.tables];
      lhs.$meta.changeIndexes = [...lhs.$meta.changeIndexes, ...rhs.$meta.changeIndexes];
      lhs.$meta.changesetFetchedProps = new Set([...lhs.$meta.changesetFetchedProps, ...rhs.$meta.changesetFetchedProps]);
      this._cache.set(key, lhs);
    } else {
      this._cache.set(key, rhs);
    }
  }
}
