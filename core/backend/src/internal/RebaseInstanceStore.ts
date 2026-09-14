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
  /**
   * The unique key identifying the EC instance.
   */
  instanceKey: string;

  /**
   * The JS-cased names of the properties that were part of the actual changeset Update captured for
   * `change` (across however many tables it spans), or `undefined` for an Insert/Delete (whose raw rows
   * always carry every column already, so there's nothing to narrow down).
   */
  changedProperties?: string[];

  /**
   * The old (pre-local-change) snapshot of the EC instance. Undefined for an Insert.
   */
  old?: ChangeInstance;

  /**
   * The new (post-local-change) snapshot of the EC instance. Undefined for a Delete.
   */
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
    store._db.executeSQL(`CREATE TABLE ${tableName} ([instanceKey] TEXT PRIMARY KEY, [old] TEXT, [new] TEXT, [changedProperties] TEXT)`);
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
    const instanceKey = source.inserted?.$meta?.instanceKey ?? source.deleted?.$meta?.instanceKey;
    assert(instanceKey !== undefined, "$meta.instanceKey must be defined.");
    assert(source.inserted?.$meta?.instanceKey === undefined || source.deleted?.$meta?.instanceKey === undefined || source.inserted?.$meta?.instanceKey === source.deleted?.$meta?.instanceKey, "Instance keys must match if both inserted and deleted instances are defined.");

    const change = this.get(instanceKey) ?? { instanceKey };

    if (source.op === "Updated") {
      assert(source.inserted !== undefined, "Inserted instance must be defined for an update operation.");
      assert(source.deleted !== undefined, "Deleted instance must be defined for an update operation.");

      this.seedBaselineIfNeeded(source, change);
      assert(change.new !== undefined, "seedBaselineIfNeeded should set the `new` instance.");
      assert(change.old !== undefined, "seedBaselineIfNeeded should set the `old` instance.");
      change.new = RebaseInstanceStore.combine(change.new, source.inserted);
      change.old = RebaseInstanceStore.combine(change.old, source.deleted);

      const priorChanged = change.changedProperties ?? [];
      const changedNow = Object.keys(source.inserted).filter((prop) => prop !== "$meta");
      change.changedProperties = [...new Set([...priorChanged, ...changedNow])];
    } else if (source.op === "Inserted") {
      assert(source.inserted !== undefined, "Inserted instance must be defined for an insert operation.");
      assert(source.deleted === undefined, "Deleted instance must not be defined for an insert operation.");
      change.new = change.new ? RebaseInstanceStore.combine(change.new, source.inserted) : { ...source.inserted };
    } else if (source.op === "Deleted") {
      assert(source.deleted !== undefined, "Deleted instance must be defined for a delete operation.");
      assert(source.inserted === undefined, "Inserted instance must not be defined for a delete operation.");
      change.old = change.old ? RebaseInstanceStore.combine(change.old, source.deleted) : { ...source.deleted };
    }

    this.set(change);
  }

  public get(instanceKey: string): RebaseInstanceChange | undefined {
    return this._db.withPreparedSqliteStatement(
      `SELECT [old], [new], [changedProperties] FROM ${tableName} WHERE [instanceKey]=?`,
      (stmt: SqliteStatement) => {
        stmt.bindString(1, instanceKey);
        if (stmt.step() === DbResult.BE_SQLITE_ROW) {
          return {
            instanceKey: instanceKey,
            old: stmt.isValueNull(0) ? undefined : JSON.parse(stmt.getValueString(0), Base64EncodedString.reviver) as ChangeInstance,
            new: stmt.isValueNull(1) ? undefined : JSON.parse(stmt.getValueString(1), Base64EncodedString.reviver) as ChangeInstance,
            changedProperties: stmt.isValueNull(2) ? undefined : JSON.parse(stmt.getValueString(2)) as string[],
          };
        }
        return undefined;
      },
    );
  }

  public set(change: RebaseInstanceChange): void {
    this._db.withPreparedSqliteStatement(
      `INSERT INTO ${tableName} ([instanceKey], [old], [new], [changedProperties])
       VALUES (?, ?, ?, ?)
       ON CONFLICT ([instanceKey])
       DO UPDATE SET [old] = [excluded].[old], [new] = [excluded].[new], [changedProperties] = [excluded].[changedProperties]`,
      (stmt: SqliteStatement) => {
        stmt.bindString(1, change.instanceKey);
        stmt.maybeBindString(2, change.old ? JSON.stringify(change.old, Base64EncodedString.replacer) : undefined);
        stmt.maybeBindString(3, change.new ? JSON.stringify(change.new, Base64EncodedString.replacer) : undefined);
        stmt.maybeBindString(4, change.changedProperties ? JSON.stringify(change.changedProperties) : undefined);
        stmt.step();
      },
    );
  }

  /** Iterate over every captured instance's old/new snapshot pair. */
  public *all(): IterableIterator<RebaseInstanceChange> {
    using stmt = this._db.prepareSqliteStatement(`SELECT [instanceKey], [old], [new], [changedProperties] FROM ${tableName} ORDER BY [instanceKey]`);
    while (stmt.step() === DbResult.BE_SQLITE_ROW) {
      yield {
        instanceKey: stmt.getValueString(0),
        old: stmt.isValueNull(1) ? undefined : JSON.parse(stmt.getValueString(1), Base64EncodedString.reviver) as ChangeInstance,
        new: stmt.isValueNull(2) ? undefined : JSON.parse(stmt.getValueString(2), Base64EncodedString.reviver) as ChangeInstance,
        changedProperties: stmt.isValueNull(3) ? undefined : JSON.parse(stmt.getValueString(3)) as string[],
      };
    }
  }

  /**
   * Unlike inserts and deletes - which always carry every column - a changeset update only carries the
   * columns that actually changed. The first time we see a given instance, seed its old *and* new
   * snapshot with the instance's complete current row, so that merging in just the columns a changeset
   * update actually carries - from however many tables the instance spans - still leaves a complete
   * instance once every table's contribution has been merged in. Later tables' merges then only ever
   * overlay their own changed columns on top, so an already-corrected column is never clobbered by a
   * stale baseline value from a table that hasn't merged yet.
   */
  private seedBaselineIfNeeded(source: ChangeSource, change: RebaseInstanceChange): void {
    if (change.old !== undefined || change.new !== undefined)
      return;

    assert(undefined !== this._sourceDb, "appendChange requires a store created via createNew");
    assert(source.inserted !== undefined, "seedBaselineIfNeeded only applies to Updates, which should have an inserted instance");
    assert(source.deleted !== undefined, "seedBaselineIfNeeded only applies to Updates, which should have a deleted instance");

    const baseline = this._sourceDb[_nativeDb].readInstance({ id: source.inserted.id, classFullName: source.inserted.classFullName }, { useJsNames: true }) as ECSqlRow;
    change.old = { ...baseline, $meta: { ...source.deleted.$meta } };
    change.new = { ...baseline, $meta: { ...source.inserted.$meta } };
  }

  /**
   * Merge partial per-table properties for the same instance/stage into a single snapshot.
   * Mirrors `PartialChangeUnifier`'s private `combine`, but operates on one old/new snapshot rather
   * than a generic keyed cache.
   */
  private static combine(lhs: ChangeInstance, rhs: ChangeInstance): ChangeInstance {
    assert(lhs.$meta.instanceKey === rhs.$meta.instanceKey);

    const { $meta: _rhsMeta, ...rhsData } = rhs;
    Object.assign(lhs, rhsData);
    lhs.$meta.tables.push(...rhs.$meta.tables);
    lhs.$meta.changeIndexes.push(...rhs.$meta.changeIndexes);
    for (const propName of rhs.$meta.changeFetchedPropNames) {
      if (!lhs.$meta.changeFetchedPropNames.includes(propName))
        lhs.$meta.changeFetchedPropNames.push(propName);
    }
    return lhs;
  }
}
