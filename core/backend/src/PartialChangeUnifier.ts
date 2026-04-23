/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ECDb
 */
import { DbResult, Guid, OpenMode } from "@itwin/core-bentley";
import { Base64EncodedString } from "@itwin/core-common";
import { SqliteStatement } from "./SqliteStatement";
import { ChangeInstance, ChangeSource } from "./ChangesetReaderTypes";
import { _nativeDb } from "./internal/Symbols";
import { SQLiteDb } from "./SQLiteDb";

// ---------------------------------------------------------------------------
// ChangeCache — interface + factory
// ---------------------------------------------------------------------------

/**
 * Cache used by [[PartialChangeUnifier]] to accumulate and merge
 * partial EC change instances.
 * @beta
 */
export interface ChangeCache extends Disposable {
  /** Retrieve a cached instance by key, or `undefined` if absent. */
  get(key: string): ChangeInstance | undefined;
  /** Insert or replace a cached instance. */
  set(key: string, value: ChangeInstance): void;
  /** Iterate over all cached instances. */
  all(): IterableIterator<ChangeInstance>;
  /** Number of instances currently in the cache. */
  count(): number;
}

/** @beta */
export namespace ChangeUnifierCache {
  /**
   * Creates an in-memory cache backed by a `Map`.
   * Fast, but may exhaust memory for very large changesets.
   * @returns An [[ChangeCache]] backed by an in-memory `Map`.
   * @beta
   */
  export function createInMemoryCache(): ChangeCache {
    return new InMemoryCache();
  }

  /**
   * Creates a SQLite-backed cache stored in a temporary SQlite database.
   * Slower than in-memory but useful in handling large changesets.
   * Temporary SQlite database is first created in memory and
   * parts of a temporary database might be flushed to disk if the database becomes large or
   * if SQLite comes under memory pressure.
   * @param bufferedReadInstanceSizeInBytes Read-batch size in bytes (default 10 MB).
   * @returns An [[ChangeCache]] backed by a SQLite temp table.
   * @beta
   */
  export function createSqliteBackedCache(
    bufferedReadInstanceSizeInBytes = 1024 * 1024 * 10,
  ): ChangeCache {
    return new SqliteBackedCache(bufferedReadInstanceSizeInBytes);
  }
}

// ---------------------------------------------------------------------------
// Private: InMemoryCache
// ---------------------------------------------------------------------------

class InMemoryCache implements ChangeCache {
  private readonly _cache = new Map<string, ChangeInstance>();

  public get(key: string): ChangeInstance | undefined {
    return this._cache.get(key);
  }

  public set(key: string, value: ChangeInstance): void {
    // Remove undefined meta keys to keep serialised form compact.
    const meta = value.$meta as any;
    if (meta) {
      Object.keys(meta).forEach((k) => meta[k] === undefined && delete meta[k]);
    }
    this._cache.set(key, value);
  }

  public *all(): IterableIterator<ChangeInstance> {
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

class SqliteBackedCache implements ChangeCache {
  private readonly _cacheTable = `[${Guid.createValue()}]`;
  public static readonly defaultBufferSize = 1024 * 1024 * 10; // 10 MB
  private _db: SQLiteDb;
  public constructor(
    public readonly bufferedReadInstanceSizeInBytes: number = SqliteBackedCache.defaultBufferSize,
  ) {
    this._db = new SQLiteDb();
    this._db.openDb("", { skipFileCheck: true, rawSQLite: true, openMode: OpenMode.ReadWrite }); // creating temp sqlite db https://sqlite.org/inmemorydb.html#:~:text=Temporary%20Databases,under%20the%20default%20SQLite%20configuration.
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

  public get(key: string): ChangeInstance | undefined {
    return this._db.withPreparedSqliteStatement(
      `SELECT [value] FROM ${this._cacheTable} WHERE [key]=?`,
      (stmt: SqliteStatement) => {
        stmt.reset();
        stmt.clearBindings();
        stmt.bindString(1, key);
        if (stmt.step() === DbResult.BE_SQLITE_ROW)
          return JSON.parse(stmt.getValueString(0), Base64EncodedString.reviver) as ChangeInstance;
        return undefined;
      },
    );
  }

  public set(key: string, value: ChangeInstance): void {
    const shallowCopy = Object.assign({}, value);
    this._db.withPreparedSqliteStatement(
      `INSERT INTO ${this._cacheTable} ([key], [value]) VALUES (?, ?) ON CONFLICT ([key]) DO UPDATE SET [value] = [excluded].[value]`,
      (stmt: SqliteStatement) => {
        stmt.reset();
        stmt.clearBindings();
        stmt.bindString(1, key);
        stmt.bindString(2, JSON.stringify(shallowCopy, Base64EncodedString.replacer));
        stmt.step();
      },
    );
  }

  public *all(): IterableIterator<ChangeInstance> {
    const sql = `
      SELECT JSON_GROUP_ARRAY(JSON([value]))
      FROM (
        SELECT [value],
               SUM(LENGTH([value])) OVER (ORDER BY [key] ROWS UNBOUNDED PRECEDING) / ${this.bufferedReadInstanceSizeInBytes} AS [bucket]
        FROM ${this._cacheTable}
      )
      GROUP BY [bucket]`;

    const stmt = this._db.prepareSqliteStatement(sql);
    try {
      while (stmt.step() === DbResult.BE_SQLITE_ROW) {
        const bucket = JSON.parse(stmt.getValueString(0), Base64EncodedString.reviver) as ChangeInstance[];
        for (const instance of bucket)
          yield instance;
      }
    } finally {
      stmt[Symbol.dispose]();
    }
  }

  public count(): number {
    return this._db.withPreparedSqliteStatement(
      `SELECT COUNT(*) FROM ${this._cacheTable}`,
      (stmt: SqliteStatement) => {
        stmt.reset();
        if (stmt.step() === DbResult.BE_SQLITE_ROW)
          return stmt.getValue(0).getInteger();
        return 0;
      },
    );
  }

  public [Symbol.dispose](): void {
    this._db.closeDb();
  }
}

// ---------------------------------------------------------------------------
// PartialChangeUnifier
// ---------------------------------------------------------------------------

/**
 * Combines partial EC change instances (one per SQLite table row) into complete
 * instances that span all tables mapping to a single EC entity.
 *
 * The merge key is derived from the `instanceKey` and `stage` stored in `$meta.instanceKey` and `$meta.stage`.
 *
 * **Usage:**
 * ```ts
 * using reader = ChangesetReader.openFile({ fileName, db });
 * using unifier = new PartialChangeUnifier();
 * while (reader.step()) {
 *   unifier.appendFrom(reader);
 * }
 * for (const instance of unifier.instances) { ... }
 * ```
 * @beta
 */
export class PartialChangeUnifier implements Disposable {
  public constructor(
    private readonly _cache: ChangeCache = new InMemoryCache(),
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
   * @param source Any [ChangeSource]($backend) positioned on a valid row.
   * @beta
   */
  public appendFrom(source: ChangeSource): void {
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
  public get instances(): IterableIterator<ChangeInstance> {
    return this._cache.all();
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private buildKey(instance: ChangeInstance): string {
    const { instanceKey, stage } = instance.$meta;
    return `${instanceKey}-${stage}`.toLowerCase();
  }

  private combine(rhs: ChangeInstance): void {
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
      lhs.$meta.changeFetchedPropNames = [...new Set([...lhs.$meta.changeFetchedPropNames, ...rhs.$meta.changeFetchedPropNames])];
      this._cache.set(key, lhs);
    } else {
      this._cache.set(key, rhs);
    }
  }
}
