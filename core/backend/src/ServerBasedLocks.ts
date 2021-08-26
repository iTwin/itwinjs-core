/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module iModels
 */

import { DbResult, Id64, Id64Arg, Id64String, IModelStatus, OpenMode } from "@bentley/bentleyjs-core";
import { IModel, IModelError } from "@bentley/imodeljs-common";
import { LockMap, LockState } from "./BackendHubAccess";
import { BriefcaseDb, LockControl } from "./IModelDb";
import { IModelHost } from "./IModelHost";
import { SQLiteDb } from "./SQLiteDb";

/**
 * Both the Model and Parent of an element are considered "owners" of their member elements. That means:
 * 1) they must hold at least a shared lock before an exclusive lock can be acquired for their members
 * 2) if they hold an exclusive lock, then all of their members are exclusively locked implicitly.
 */
export interface ElementOwners { modelId: Id64String, parentId: Id64String }

export class ServerBasedLocks implements LockControl {
  public get isServerBased() { return true; }
  private _db?: SQLiteDb;
  private _iModel?: BriefcaseDb;

  private get iModel() { return this._iModel!; } // eslint-disable-line @typescript-eslint/naming-convention
  private get lockDb() { return this._db!; } // eslint-disable-line @typescript-eslint/naming-convention

  public constructor(iModel: BriefcaseDb) {
    this._iModel = iModel;
    this._db = new SQLiteDb();

    const dbName = `${iModel.nativeDb.getTempFileBaseName()}-locks`;
    try {
      this._db.openDb(dbName, OpenMode.ReadWrite);
    } catch (_e) {
      this._db.createDb(dbName);
      this._db.executeSQL("CREATE TABLE locks(id INTEGER PRIMARY KEY NOT NULL,state INTEGER NOT NULL,acquired INTEGER)");
      this._db.saveChanges();
    }
  }

  public close() {
    if (this._db?.isOpen) {
      this._db.closeDb();
      this._db = undefined;
    }
  }

  private getOwners(id: Id64String): ElementOwners {
    return this.iModel.withPreparedSqliteStatement("SELECT ModelId,ParentId FROM bis_Element WHERE id=?", (stmt) => {
      stmt.bindId(1, id);
      const rc = stmt.step();
      if (DbResult.BE_SQLITE_ROW !== rc)
        throw new IModelError(rc, `element ${id} not found`);

      return { modelId: stmt.getValueId(0), parentId: stmt.getValueId(1) };
    });
  }

  private getLockState(id: Id64String): LockState | undefined {
    return !Id64.isValid(id) ? LockState.None : this.lockDb.withPreparedSqliteStatement("SELECT state FROM locks WHERE id=?", (stmt) => {
      stmt.bindId(1, id);
      return (DbResult.BE_SQLITE_ROW === stmt.step()) ? stmt.getValueInteger(0) : undefined;
    });
  }

  /** Clear the cache of locally held locks.
   * Note: does *not* release locks from server.
   */
  private clearAllLocks() {
    this.lockDb.executeSQL("DELETE FROM locks");
  }

  public async releaseAllLocks() {
    await IModelHost.hubAccess.releaseAllLocks(this.iModel); // throws if unsuccessful
    this.clearAllLocks();
  }

  private insertLock(id: Id64String, state: LockState, acquired: boolean) {
    this.lockDb.withPreparedSqliteStatement("INSERT INTO locks(id,state,acquired) VALUES (?,?,?)", (stmt) => {
      stmt.bindId(1, id);
      stmt.bindInteger(2, state);
      stmt.bindInteger(3, acquired ? 1 : 0);
      const rc = stmt.step();
      if (DbResult.BE_SQLITE_DONE !== rc)
        throw new IModelError(rc, "can't insert lock into database");
    });
  }

  /** Determine whether an the exclusive lock is already held by an element (or one of its owners) */
  public holdsExclusiveLock(id: Id64String): boolean {
    if (this.getLockState(id) === LockState.Exclusive)
      return true; // yes, we hold the lock.

    if (id === IModel.rootSubjectId) // the root has no owners
      return false;

    // an exclusive lock is implied if the element's owner is exclusively locked (recursively)
    const owners = this.getOwners(id);
    return this.holdsExclusiveLock(owners.modelId) || this.holdsExclusiveLock(owners.parentId);
  }

  public holdsSharedLock(id: Id64String): boolean {
    const state = this.getLockState(id);
    if (state === LockState.Shared || state === LockState.Exclusive)
      return true; // we already hold either the shared or exclusive lock for this element

    if (id === IModel.rootSubjectId) // the root has no owners
      return false;

    // see if an owner has exclusive lock. If so we implicitly have shared lock, but owner holding shared lock doesn't help.
    const owners = this.getOwners(id);
    return this.holdsExclusiveLock(owners.modelId) || this.holdsExclusiveLock(owners.parentId);
  }

  /** if the shared lock on the element supplied is not already held, add it to the set of shared locks required. Then, check owners. */
  private addSharedLock(id: Id64String, locks: Set<Id64String>) {
    // if the id is not valid, or of the lock is already in the set, or if we already hold a shared lock, we're done
    // Note: if we hold a shared lock, it is guaranteed that we also hold all required shared locks on owners.
    if (!Id64.isValid(id) || locks.has(id) || this.holdsSharedLock(id))
      return;

    locks.add(id); // add to set of needed shared locks
    this.addOwnerSharedLocks(id, locks); // check parent models and groups
  }

  /** add owners (recursively) of an element to a list of required shared locks, if not already held. */
  private addOwnerSharedLocks(id: Id64String, locks: Set<Id64String>) {
    const el = this.getOwners(id);
    this.addSharedLock(el.parentId, locks); // if this element is in a group
    this.addSharedLock(el.modelId, locks); // check its model
  }

  /** attempt to acquire all necessary locks for a set of elements */
  private async acquireAllLocks(locks: LockMap) {
    if (locks.size === 0) // no locks are required.
      return;

    const sharedLocks = new Set<Id64String>();
    for (const lock of locks)
      this.addOwnerSharedLocks(lock[0], sharedLocks);

    for (const shared of sharedLocks) {
      if (!locks.has(shared)) // we may already be asking for exclusive lock
        locks.set(shared, LockState.Shared);
    }

    await IModelHost.hubAccess.acquireLocks(this.iModel, locks); // throws if unsuccessful
    for (const lock of locks)
      this.insertLock(lock[0], lock[1], true);
    this.lockDb.saveChanges();
  }

  /**
   * Acquire the exclusive lock on one or more elements. This also attempts to acquire a shared lock on all of the element's owners, recursively.
   * If *any* lock cannot be obtained, no locks are acquired.
   */
  public async acquireExclusiveLock(ids: Id64Arg): Promise<void> {
    const locks = new Map<Id64String, LockState>();
    for (const id of Id64.iterable(ids)) {
      if (!this.holdsExclusiveLock(id))
        locks.set(id, LockState.Exclusive);
    }
    return this.acquireAllLocks(locks);
  }

  /**
   * Acquire a shared lock on one or more elements. This also attempts to acquire a shared lock on all of the element's owners, recursively.
   * If *any* lock cannot be obtained, no locks are acquired.
   */
  public async acquireSharedLocks(ids: Id64Arg): Promise<void> {
    const locks = new Map<Id64String, LockState>();
    for (const id of Id64.iterable(ids)) {
      if (!this.holdsSharedLock(id))
        locks.set(id, LockState.Shared);
    }
    return this.acquireAllLocks(locks);
  }

  /** When an element is newly created in a session, we hold the lock on it implicitly. Save that fact. */
  public elementWasCreated(id: Id64String) {
    this.insertLock(id, LockState.Exclusive, false);
    this.lockDb.saveChanges();
  }
  /** locks are not necessary during change propagation. */
  private get _locksAreRequired() { return !this.iModel.txns.isIndirectChanges; }

  /** throw if locks are currently required and the exclusive lock is not held on the supplied element */
  public checkExclusiveLock(id: Id64String) {
    if (this._locksAreRequired && !this.holdsExclusiveLock(id))
      throw new IModelError(IModelStatus.LockNotHeld, `exclusive lock on element ${id} not held`);
  }
  /** throw if locks are currently required and a shared lock is not held on the supplied element */
  public checkSharedLock(id: Id64String) {
    if (this._locksAreRequired && !this.holdsSharedLock(id))
      throw new IModelError(IModelStatus.LockNotHeld, `shared lock on element ${id} not held`);
  }

}

