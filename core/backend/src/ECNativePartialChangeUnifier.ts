/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ECDb
 */
import { DbResult, Guid } from "@itwin/core-bentley";
import { Base64EncodedString } from "@itwin/core-common";
import { ECDb } from "./ECDb";
import { SqliteStatement } from "./SqliteStatement";
import { ECNativeChangeInstance, ECNativeChangeSource } from "./ECChangesetReaderTypes";
import { AnyDb } from "./SqliteChangesetReader";

// ---------------------------------------------------------------------------
// ECNativeChangeUnifierCache — interface + factory
// ---------------------------------------------------------------------------

/**
 * Cache used by {@link ECNativePartialChangeUnifier} to accumulate and merge
 * partial EC change instances.
 * @beta
 */
export interface ECChangeCache extends Disposable {
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
   * @returns An {@link ECChangeCache} backed by an in-memory `Map`.
   * @beta
   */
  export function createInMemoryCache(): ECChangeCache {
    return new NativeInMemoryInstanceCache();
  }

  /**
   * Creates a SQLite-backed cache stored in a temporary table of the given database.
   * Slower than in-memory but handles large changesets without exhausting memory.
   * @param db Database that will host the temporary cache table.
   * @param bufferedReadInstanceSizeInBytes Read-batch size in bytes (default 10 MB).
   * @returns An {@link ECChangeCache} backed by a SQLite temp table.
   * @beta
   */
  export function createSqliteBackedCache(
    db: AnyDb,
    bufferedReadInstanceSizeInBytes = 1024 * 1024 * 10,
  ): ECChangeCache {
    return new NativeSqliteBackedInstanceCache(db, bufferedReadInstanceSizeInBytes);
  }
}

// ---------------------------------------------------------------------------
// Private: NativeInMemoryInstanceCache
// ---------------------------------------------------------------------------

class NativeInMemoryInstanceCache implements ECChangeCache {
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

class NativeSqliteBackedInstanceCache implements ECChangeCache {
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
    private readonly _cache: ECChangeCache = new NativeInMemoryInstanceCache(),
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
   * @param source Any {@link ECNativeChangeSource} positioned on a valid row.
   * @beta
   */
  public appendFrom(source: ECNativeChangeSource): void {
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
      // ECInstanceId will be part of changeset fetchedProps for every table, so we should not include multiple of those in the final list
      lhs.$meta.changesetFetchedProps = [...new Set([...lhs.$meta.changesetFetchedProps, ...rhs.$meta.changesetFetchedProps])];
      this._cache.set(key, lhs);
    } else {
      this._cache.set(key, rhs);
    }
  }
}
