/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ECDb
 */
import { DbResult, OpenMode } from "@itwin/core-bentley";
import { Base64EncodedString } from "@itwin/core-common";
import { ChangeInstance, ChangeSource } from "../ChangesetReaderTypes";
import { SQLiteDb } from "../SQLiteDb";
import { SqliteStatement } from "../SqliteStatement";

/** The old (pre-local-change) and new (post-local-change) snapshots of a single EC instance, as
 * captured by [[RebaseInstanceStore]].
 * @internal
 */
export interface RebaseInstanceChange {
  instanceKey: string;
  old?: ChangeInstance;
  new?: ChangeInstance;
}

const tableName = "[InstanceChanges]";

/**
 * Durable, on-disk store of the EC instances changed by a single Txn, captured while that Txn is
 * reversed in preparation for an interactive rebase (see [[TxnManager]] `_captureInstanceChanges`)
 * and later replayed as instance patches instead of a raw SQLite changeset.
 *
 * Unlike [[PartialChangeUnifier]] - which merges partial per-table rows into complete instances
 * keyed by instanceKey *and* stage, requiring old/new snapshots to be paired up after the fact -
 * this store keys rows by instanceKey alone and holds the old and new snapshots in separate
 * columns of the same row, so no further coalescing is needed once capture is complete.
 * @internal
 */
export class RebaseInstanceStore implements Disposable {
  private readonly _db = new SQLiteDb();
  private readonly _writable: boolean;

  private constructor(writable: boolean) {
    this._writable = writable;
  }

  /** Creates a new, empty store at `path`, overwriting any existing file. Used while capturing a Txn's changes. */
  public static createNew(path: string): RebaseInstanceStore {
    const store = new RebaseInstanceStore(true);
    store._db.createDb(path, undefined, { skipFileCheck: true, rawSQLite: true });
    store._db.executeSQL(`CREATE TABLE ${tableName} ([instanceKey] TEXT PRIMARY KEY, [old] TEXT, [new] TEXT)`);
    return store;
  }

  /** Opens an existing store at `path` for reading. Used to replay a Txn's previously-captured changes. */
  public static openExisting(path: string): RebaseInstanceStore {
    const store = new RebaseInstanceStore(false);
    store._db.openDb(path, OpenMode.Readonly);
    return store;
  }

  /** Persists writes (when created via [[createNew]]) before closing; readonly stores are simply closed. */
  public [Symbol.dispose](): void {
    this._db.closeDb(this._writable);
  }

  /** Merges a single row from a [ChangesetReader]($backend) - possibly one of several tables mapped
   * to the same EC instance - into that instance's old and/or new snapshot.
   */
  public appendChange(source: ChangeSource): void {
    if (source.op === "Updated") {
      if (source.inserted)
        this.merge("new", source.inserted);
      if (source.deleted)
        this.merge("old", source.deleted);
    } else if (source.op === "Inserted" && source.inserted) {
      this.merge("new", source.inserted);
    } else if (source.op === "Deleted" && source.deleted) {
      this.merge("old", source.deleted);
    }
  }

  /** Look up the old/new snapshot pair for a single instance, or `undefined` if it was not captured. */
  public get(instanceKey: string): RebaseInstanceChange | undefined {
    const key = instanceKey.toLowerCase();
    const old = this.readColumn("old", key);
    const newInstance = this.readColumn("new", key);
    return (old || newInstance) ? { instanceKey: key, old, new: newInstance } : undefined;
  }

  /** Iterate over every captured instance's old/new snapshot pair. */
  public *all(): IterableIterator<RebaseInstanceChange> {
    using stmt = this._db.prepareSqliteStatement(`SELECT [instanceKey], [old], [new] FROM ${tableName} ORDER BY [instanceKey]`);
    while (stmt.step() === DbResult.BE_SQLITE_ROW) {
      yield {
        instanceKey: stmt.getValueString(0),
        old: stmt.isValueNull(1) ? undefined : JSON.parse(stmt.getValueString(1), Base64EncodedString.reviver) as ChangeInstance,
        new: stmt.isValueNull(2) ? undefined : JSON.parse(stmt.getValueString(2), Base64EncodedString.reviver) as ChangeInstance,
      };
    }
  }

  /** Number of distinct instances captured. */
  public count(): number {
    return this._db.withPreparedSqliteStatement(`SELECT COUNT(*) FROM ${tableName}`, (stmt: SqliteStatement) => {
      return stmt.step() === DbResult.BE_SQLITE_ROW ? stmt.getValue(0).getInteger() : 0;
    });
  }

  private merge(column: "old" | "new", instance: ChangeInstance): void {
    const key = instance.$meta.instanceKey.toLowerCase();
    const existing = this.readColumn(column, key);
    this.write(column, key, existing ? RebaseInstanceStore.combine(existing, instance) : instance);
  }

  private readColumn(column: "old" | "new", key: string): ChangeInstance | undefined {
    return this._db.withPreparedSqliteStatement(
      `SELECT [${column}] FROM ${tableName} WHERE [instanceKey]=?`,
      (stmt: SqliteStatement) => {
        stmt.bindString(1, key);
        if (stmt.step() === DbResult.BE_SQLITE_ROW && !stmt.isValueNull(0))
          return JSON.parse(stmt.getValueString(0), Base64EncodedString.reviver) as ChangeInstance;
        return undefined;
      },
    );
  }

  private write(column: "old" | "new", key: string, instance: ChangeInstance): void {
    const json = JSON.stringify(instance, Base64EncodedString.replacer);
    this._db.withPreparedSqliteStatement(
      `INSERT INTO ${tableName} ([instanceKey], [${column}]) VALUES (?, ?) ON CONFLICT ([instanceKey]) DO UPDATE SET [${column}] = [excluded].[${column}]`,
      (stmt: SqliteStatement) => {
        stmt.bindString(1, key);
        stmt.bindString(2, json);
        stmt.step();
      },
    );
  }

  /** Merge partial per-table properties for the same instance/stage into a single snapshot.
   * Mirrors `PartialChangeUnifier`'s private `combine`, but operates on one old/new snapshot rather
   * than a generic keyed cache.
   */
  private static combine(lhs: ChangeInstance, rhs: ChangeInstance): ChangeInstance {
    const { $meta: _rhsMeta, ...rhsData } = rhs;
    Object.assign(lhs, rhsData);
    lhs.$meta.tables = [...lhs.$meta.tables, ...rhs.$meta.tables];
    lhs.$meta.changeIndexes = [...lhs.$meta.changeIndexes, ...rhs.$meta.changeIndexes];
    lhs.$meta.changeFetchedPropNames = [...new Set([...lhs.$meta.changeFetchedPropNames, ...rhs.$meta.changeFetchedPropNames])];
    return lhs;
  }
}
