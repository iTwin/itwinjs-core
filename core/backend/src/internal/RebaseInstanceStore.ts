/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ECDb
 */
import { assert, DbResult, OpenMode } from "@itwin/core-bentley";
import { Base64EncodedString } from "@itwin/core-common";
import { ChangeInstance, ChangeMeta, ChangeSource } from "../ChangesetReaderTypes";
import type { ECSqlRow } from "../Entity";
import { SQLiteDb } from "../SQLiteDb";
import type { AnyDb } from "../SqliteChangesetReader";
import { SqliteStatement } from "../SqliteStatement";
import { _nativeDb } from "./Symbols";

/** The old (pre-local-change) and new (post-local-change) snapshots of a single EC instance, as
 * captured by [[RebaseInstanceStore]].
 * @internal
 */
export interface RebaseInstanceChange {
  instanceKey: string;
  old?: ChangeInstance;
  new?: ChangeInstance;
}

/** Extends {@link ChangeMeta} with the JS-cased property names actually present in the raw changeset
 * row(s) merged into this snapshot - i.e. the columns our local Txn's Update actually touched, as
 * opposed to the full row that [[RebaseInstanceStore]]'s `seedBaselineIfNeeded` fills in for merging
 * convenience. Absent for Insert/Delete, whose raw rows always carry every column already.
 */
interface RebaseChangeMeta extends ChangeMeta {
  changedProperties?: string[];
}

/** The JS-cased names of the properties that were part of the actual changeset Update captured for
 * `change` (across however many tables it spans), or `undefined` for an Insert/Delete (whose raw rows
 * always carry every column already, so there's nothing to narrow down).
 * @internal
 */
export function getChangedProperties(change: RebaseInstanceChange): string[] | undefined {
  return (change.new?.$meta as RebaseChangeMeta | undefined)?.changedProperties
    ?? (change.old?.$meta as RebaseChangeMeta | undefined)?.changedProperties;
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
  /** The db that changes are being captured from. Only set (and needed) on stores created via [[createNew]],
   * to seed an update's instance snapshots with their unchanged properties (see [[merge]]). */
  private readonly _sourceDb?: AnyDb;

  private constructor(writable: boolean, sourceDb?: AnyDb) {
    this._writable = writable;
    this._sourceDb = sourceDb;
  }

  /** Creates a new, empty store at `path`, overwriting any existing file. Used while capturing a Txn's changes.
   * `db` is the db those changes are being captured from.
   */
  public static createNew(path: string, db: AnyDb): RebaseInstanceStore {
    const store = new RebaseInstanceStore(true, db);
    store._db.createDb(path, undefined, { skipFileCheck: true, rawSQLite: true });
    store._db.executeSQL(`CREATE TABLE ${tableName} ([instanceKey] TEXT PRIMARY KEY, [old] TEXT, [new] TEXT)`);
    return store;
  }

  /** Opens an existing store at `path` for reading. Used to replay a Txn's previously-captured changes. */
  public static openExisting(path: string): RebaseInstanceStore {
    const store = new RebaseInstanceStore(false);
    store._db.openDb(path, { openMode: OpenMode.Readonly, skipFileCheck: true, rawSQLite: true });
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
        old: stmt.isValueNull(1) ? undefined : JSON.parse(stmt.getValueString(1), RebaseInstanceStore.reviveJson) as ChangeInstance,
        new: stmt.isValueNull(2) ? undefined : JSON.parse(stmt.getValueString(2), RebaseInstanceStore.reviveJson) as ChangeInstance,
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
    const isUpdate = instance.$meta.op === "Updated";
    if (isUpdate)
      this.seedBaselineIfNeeded(instance, key);

    const existing = this.readColumn(column, key);
    const merged = existing ? RebaseInstanceStore.combine(existing, instance) : instance;
    if (isUpdate) {
      // `instance`'s own keys are exactly the columns this raw changeset row actually carried, unlike
      // the baseline-seeded properties that seedBaselineIfNeeded fills the rest of `merged` in with.
      const priorTouched = (existing?.$meta as RebaseChangeMeta | undefined)?.changedProperties ?? [];
      const touchedNow = Object.keys(instance).filter((prop) => prop !== "$meta");
      (merged.$meta as RebaseChangeMeta).changedProperties = [...new Set([...priorTouched, ...touchedNow])];
    }
    this.write(column, key, merged);
  }

  /** Unlike inserts and deletes - which always carry every column - a changeset update only carries the
   * columns that actually changed. The first time we see a given instance, seed its old *and* new
   * snapshot with the instance's complete current row, so that merging in just the columns a changeset
   * update actually carries - from however many tables the instance spans - still leaves a complete
   * instance once every table's contribution has been merged in. Later tables' merges then only ever
   * overlay their own changed columns on top, so an already-corrected column is never clobbered by a
   * stale baseline value from a table that hasn't merged yet.
   */
  private seedBaselineIfNeeded(instance: ChangeInstance, key: string): void {
    if (this.readColumn("old", key) !== undefined || this.readColumn("new", key) !== undefined)
      return;

    assert(undefined !== this._sourceDb, "appendChange requires a store created via createNew");
    const baseline = this._sourceDb[_nativeDb].readInstance({ id: instance.id, classFullName: instance.classFullName }, { useJsNames: true }) as ECSqlRow;
    this.write("old", key, { ...baseline, $meta: { ...instance.$meta, stage: "Old", tables: [], changeIndexes: [], changeFetchedPropNames: [] } });
    this.write("new", key, { ...baseline, $meta: { ...instance.$meta, stage: "New", tables: [], changeIndexes: [], changeFetchedPropNames: [] } });
  }

  private readColumn(column: "old" | "new", key: string): ChangeInstance | undefined {
    return this._db.withPreparedSqliteStatement(
      `SELECT [${column}] FROM ${tableName} WHERE [instanceKey]=?`,
      (stmt: SqliteStatement) => {
        stmt.bindString(1, key);
        if (stmt.step() === DbResult.BE_SQLITE_ROW && !stmt.isValueNull(0))
          return JSON.parse(stmt.getValueString(0), RebaseInstanceStore.reviveJson) as ChangeInstance;
        return undefined;
      },
    );
  }

  private write(column: "old" | "new", key: string, instance: ChangeInstance): void {
    const json = JSON.stringify(instance, RebaseInstanceStore.replaceJson);
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

  private static replaceJson(name: string, value: any) {
    // The native layer unhelpfully represents nulls as `undefined`. So turn them back into nulls for the JSON.
    //if (value === undefined) return null;
    return Base64EncodedString.replacer(name, value);
  }

  private static reviveJson(name: string, value: any) {
    // Turn nulls back into undefineds to match the native layer.
    //if (value === null) return undefined;
    return Base64EncodedString.reviver(name, value);
  }
}
