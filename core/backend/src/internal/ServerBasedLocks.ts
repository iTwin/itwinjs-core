/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module iModels
 */

import { DbResult, Id64, Id64Arg, Id64String, IModelStatus, OpenMode } from "@itwin/core-bentley";
import { IModel, IModelError, LockState } from "@itwin/core-common";
import { LockMap } from "../BackendHubAccess";
import { BriefcaseDb } from "../IModelDb";
import { LockControl } from "../LockControl";
import { IModelHost } from "../IModelHost";
import { SQLiteDb } from "../SQLiteDb";
import { _close, _elementWasCreated, _hubAccess, _implementationProhibited, _nativeDb, _releaseAllLocks } from "./Symbols";

/**
 * Both the Model and Parent of an element are considered "owners" of their member elements. That means:
 * 1) they must hold at least a shared lock before an exclusive lock can be acquired for their members
 * 2) if they hold an exclusive lock, then all of their members are exclusively locked implicitly.
 */
interface ElementOwners {
  readonly modelId: Id64String;
  readonly parentId: Id64String | undefined;
}

// eslint-disable-next-line no-restricted-syntax
const enum LockOrigin {
  Acquired = 0,
  NewElement = 1,
  Discovered = 2,
}

interface OwnerLockResult {
  hasExclusiveLock: boolean;
  txnId: Id64String | undefined;
}

export class ServerBasedLocks implements LockControl {
  public readonly [_implementationProhibited] = undefined;

  public get isServerBased() { return true; }
  protected readonly lockDb = new SQLiteDb();
  protected readonly briefcase: BriefcaseDb;

  public constructor(iModel: BriefcaseDb) {
    this.briefcase = iModel;
    const dbName = `${iModel[_nativeDb].getTempFileBaseName()}-locks`;
    try {
      this.lockDb.openDb(dbName, OpenMode.ReadWrite);
    } catch {
      this.lockDb.createDb(dbName);
      this.lockDb.executeSQL("CREATE TABLE locks(id INTEGER PRIMARY KEY NOT NULL,state INTEGER NOT NULL,origin INTEGER, txnId INTEGER)");
      this.lockDb.saveChanges();
    }
  }

  public [_close]() {
    if (this.lockDb.isOpen)
      this.lockDb.closeDb();
  }

  private getOwners(id: Id64String): ElementOwners {
    return this.briefcase.withPreparedSqliteStatement("SELECT ModelId,ParentId FROM bis_Element WHERE id=?", (stmt) => {
      stmt.bindId(1, id);
      const rc = stmt.step();
      if (DbResult.BE_SQLITE_ROW !== rc)
        throw new IModelError(rc, `element ${id} not found`);

      return { modelId: stmt.getValueId(0), parentId: stmt.getValueId(1) };
    });
  }

  private getLockState(id?: Id64String): LockState | undefined {
    return (id === undefined || !Id64.isValid(id)) ? undefined : this.lockDb.withPreparedSqliteStatement("SELECT state FROM locks WHERE id=?", (stmt) => {
      stmt.bindId(1, id);
      return (DbResult.BE_SQLITE_ROW === stmt.step()) ? stmt.getValueInteger(0) : undefined;
    });
  }

  private getLockStateAndTxn(id?: Id64String): { state: LockState, txnId: Id64String | undefined } | undefined {
    return (id === undefined || !Id64.isValid(id)) ? undefined : this.lockDb.withPreparedSqliteStatement("SELECT state,txnId FROM locks WHERE id=?", (stmt) => {
      stmt.bindId(1, id);
      if (DbResult.BE_SQLITE_ROW === stmt.step())
        return { state: stmt.getValueInteger(0), txnId: stmt.getValueId(1) };
      else
        return undefined;
    });
  }

  /** Clear the cache of locally held locks.
   * Note: does *not* release locks from server.
   */
  private clearAllLocks() {
    this.lockDb.executeSQL("DELETE FROM locks");
    this.lockDb.saveChanges();
  }

  /** only for tests */
  public getLockCount(state: LockState): number {
    return this.lockDb.withSqliteStatement("SELECT count(*) FROM locks WHERE state=?", (stmt) => {
      stmt.bindInteger(1, state);
      stmt.step();
      return stmt.getValueInteger(0);
    });
  }

  public async [_releaseAllLocks](): Promise<void> {
    await IModelHost[_hubAccess].releaseAllLocks(this.briefcase); // throws if unsuccessful
    this.clearAllLocks();
  }

  public async releaseAllLocks(): Promise<void> {
    if (this.briefcase.txns.hasLocalChanges) {
      throw new Error("Locks cannot be released while the briefcase contains local changes");
    }

    return this[_releaseAllLocks]();
  }

  private insertLock(id: Id64String, state: LockState, origin: LockOrigin, txnId: Id64String | undefined): true {
    // TODO: handle conflicts properly.
    // Conflicts should only happen when upgrading a lock from Shared to Exclusive. We're not handling this upgrading process correctly at all just yet!
    this.lockDb.withPreparedSqliteStatement("INSERT INTO locks(id,state,origin,txnId) VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET state=excluded.state,origin=excluded.origin", (stmt) => {
      //this.lockDb.withPreparedSqliteStatement("INSERT INTO locks(id,state,origin) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET state=excluded.state,origin=excluded.origin", (stmt) => {
      stmt.bindId(1, id);
      stmt.bindInteger(2, state);
      stmt.bindInteger(3, origin);
      if (txnId !== undefined)
        stmt.bindId(4, txnId);
      else
        stmt.bindNull(4);
      const rc = stmt.step();
      if (DbResult.BE_SQLITE_DONE !== rc)
        throw new IModelError(rc, "can't insert lock into database");
    });
    return true;
  }

  private findAndCacheOwnerHoldingExclusiveLock(id: Id64String): OwnerLockResult {
    if (id === undefined || id === IModel.rootSubjectId)
      return { hasExclusiveLock: false, txnId: undefined }; // has no owners

    const { modelId, parentId } = this.getOwners(id);

    const modelStateAndTxn = this.getLockStateAndTxn(modelId);
    if (modelStateAndTxn?.state === LockState.Exclusive)
      return { hasExclusiveLock: true, txnId: modelStateAndTxn.txnId };

    const parentStateAndTxn = this.getLockStateAndTxn(parentId);
    if (parentStateAndTxn?.state === LockState.Exclusive)
      return { hasExclusiveLock: true, txnId: parentStateAndTxn.txnId };

    // see if this model is exclusively locked by one of its owners. If so, save that fact on modelId so future tests won't have to descend.
    const modelOwnerHoldingExclusiveLockTxnId = this.findAndCacheOwnerHoldingExclusiveLock(modelId);
    if (modelOwnerHoldingExclusiveLockTxnId.hasExclusiveLock) {
      this.insertLock(modelId, LockState.Exclusive, LockOrigin.Discovered, modelOwnerHoldingExclusiveLockTxnId.txnId);
      return modelOwnerHoldingExclusiveLockTxnId;
    }

    // see if the parent is exclusively locked by one of its owners. If so, save that fact on parentId so future tests won't have to descend.
    if (parentId !== undefined) {
      const parentOwnerHoldingExclusiveLockTxnId = this.findAndCacheOwnerHoldingExclusiveLock(parentId);
      if (parentOwnerHoldingExclusiveLockTxnId.hasExclusiveLock) {
        this.insertLock(parentId, LockState.Exclusive, LockOrigin.Discovered, parentOwnerHoldingExclusiveLockTxnId.txnId);
        return parentOwnerHoldingExclusiveLockTxnId;
      }
    }

    return { hasExclusiveLock: false, txnId: undefined };
  }

  /** Determine whether an the exclusive lock is already held by an element (or one of its owners) */
  public holdsExclusiveLock(id: Id64String): boolean {
    // see if we hold the exclusive lock. or if one of the element's owners is exclusively locked (recursively)
    return this.getLockState(id) === LockState.Exclusive || this.findAndCacheOwnerHoldingExclusiveLock(id).hasExclusiveLock;
  }

  public holdsSharedLock(id: Id64String): boolean {
    const state = this.getLockState(id);
    // see if we hold shared or exclusive lock, or if an owner has exclusive lock. If so we implicitly have shared lock, but owner holding shared lock doesn't help.
    return (state === LockState.Shared || state === LockState.Exclusive) || this.findAndCacheOwnerHoldingExclusiveLock(id).hasExclusiveLock;
  }

  /** if the shared lock on the element supplied is not already held, add it to the set of shared locks required. Then, check owners. */
  private addSharedLock(id: Id64String | undefined, locks: Set<Id64String>) {
    // if the id is not valid, or of the lock is already in the set, or if we already hold a shared lock, we're done
    // Note: if we hold a shared lock, it is guaranteed that we also hold all required shared locks on owners.
    if (id === undefined || !Id64.isValid(id) || locks.has(id) || this.holdsSharedLock(id))
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

    await IModelHost[_hubAccess].acquireLocks(this.briefcase, locks); // throws if unsuccessful
    for (const lock of locks)
      this.insertLock(lock[0], lock[1], LockOrigin.Acquired, this.briefcase.txns.getCurrentTxnId());
    this.lockDb.saveChanges();
  }

  public async acquireLocks(arg: { shared?: Id64Arg, exclusive?: Id64Arg }): Promise<void> {
    const locks = new Map<Id64String, LockState>();
    if (arg.shared) {
      for (const id of Id64.iterable(arg.shared)) {
        if (!this.holdsSharedLock(id))
          locks.set(id, LockState.Shared);
      }
    }
    if (arg.exclusive) {
      for (const id of Id64.iterable(arg.exclusive)) {
        if (!this.holdsExclusiveLock(id))
          locks.set(id, LockState.Exclusive);
      }
    }
    return this.acquireAllLocks(locks);
  }

  public async releaseLocksForReversedTxn(txnId: Id64String) {
    // Find all locks associated with the Txn.
    const locksToRelease = new Map<Id64String, LockState>();
    this.lockDb.withPreparedSqliteStatement("SELECT id FROM locks WHERE txnId=? AND origin=?", (stmt) => {
      stmt.bindId(1, txnId);
      stmt.bindInteger(2, LockOrigin.Acquired);

      for (const row of stmt) {
        locksToRelease.set(row.id.toString(), LockState.None);
      }
    });

    // Call acquireLocks with LockState.None for each.
    await IModelHost[_hubAccess].acquireLocks(this.briefcase, locksToRelease); // throws if unsuccessful

    // Clear the locks from the database.
    // Note that "Discovered" locks inherit the txnId of their owner (see findAndCacheOwnerHoldingExclusiveLock).
    // When that Txn is reversed and its locks released, we invalidate all the Discovered locks associated with
    // the Txn. If another (non-reversed) Txn has a lock that applies to the element, that fact will be
    // rediscovered later.
    this.lockDb.withPreparedSqliteStatement("DELETE FROM locks WHERE txnId=?", (stmt) => {
      stmt.bindId(1, txnId);
      const rc = stmt.step();
      if (DbResult.BE_SQLITE_DONE !== rc)
        throw new IModelError(rc, "can't delete locks from database");
    });
  }

  /** When an element is newly created in a session, we hold the lock on it implicitly. Save that fact. */
  public [_elementWasCreated](id: Id64String) {
    this.insertLock(id, LockState.Exclusive, LockOrigin.NewElement, this.briefcase.txns.getCurrentTxnId());
    this.lockDb.saveChanges();
  }

  /** locks are not necessary during change propagation. */
  private get _locksAreRequired() { return !this.briefcase.txns.isIndirectChanges; }

  /** throw if locks are currently required and the exclusive lock is not held on the supplied element */
  public checkExclusiveLock(id: Id64String, type: string, operation: string) {
    if (this._locksAreRequired && !this.holdsExclusiveLock(id))
      throw new IModelError(IModelStatus.LockNotHeld, `exclusive lock not held on ${type} for ${operation} (id=${id})`);
  }

  /** throw if locks are currently required and a shared lock is not held on the supplied element */
  public checkSharedLock(id: Id64String, type: string, operation: string) {
    if (this._locksAreRequired && !this.holdsSharedLock(id))
      throw new IModelError(IModelStatus.LockNotHeld, `shared lock not held on ${type} for ${operation} (id=${id})`);
  }

}

export function createServerBasedLocks(iModel: BriefcaseDb): LockControl {
  return new ServerBasedLocks(iModel);
}
