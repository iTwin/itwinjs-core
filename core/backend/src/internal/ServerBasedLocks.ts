/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module iModels
 */

import { DbResult, Id64, Id64Arg, Id64String, IModelStatus, OpenMode } from "@itwin/core-bentley";
import { IModel, IModelError, LockState, ServerBasedLocksError } from "@itwin/core-common";
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

export class ServerBasedLocks implements LockControl {
  public readonly [_implementationProhibited] = undefined;

  public get isServerBased() { return true; }
  protected readonly lockDb = new SQLiteDb();
  protected readonly briefcase: BriefcaseDb;
  private _removeOnCommitListener: () => void;
  private readonly _unsavedChangesTxnId = "0x7FFFFFFFFFFFFFFF"; // a placeholder txn id for locks acquired in the current unsaved Txn

  public constructor(iModel: BriefcaseDb) {
    this.briefcase = iModel;
    const dbName = `${iModel[_nativeDb].getTempFileBaseName()}-locks`;

    try {
      this.lockDb.openDb(dbName, OpenMode.ReadWrite);
    } catch {
      this.lockDb.createDb(dbName);
    }

    // Tracks the locks that are actively held.
    this.lockDb.executeSQL("CREATE TABLE IF NOT EXISTS locks(id INTEGER PRIMARY KEY NOT NULL,state INTEGER NOT NULL,origin INTEGER)");
    // Tracks the locks that are required by each Txn. They may or may not currently be held.
    this.lockDb.executeSQL(`
      CREATE TABLE IF NOT EXISTS txn_locks(
        txnId INTEGER NOT NULL,
        elementId INTEGER NOT NULL,
        state INTEGER NOT NULL,
        origin INTEGER NOT NULL,
        abandoned BOOLEAN NOT NULL,
        PRIMARY KEY (txnId, elementId))`);
    this.lockDb.saveChanges();

    this._removeOnCommitListener = this.briefcase.txns.onCommit.addListener(() => {
      const committedTxnId = this.briefcase.txns.queryPreviousTxnId(this.briefcase.txns.getCurrentTxnId())

      // With this commit, any reversed txns with the committed txn's ID or greater are no longer reinstatable,
      // so clear out the record of their locks. If the locks are still held, sorry, it's too late!
      this.clearTxnLockRecords(committedTxnId);

      // All of the "current" changes are now part of a real txn, so update the txn id accordingly.
      this.lockDb.withPreparedSqliteStatement("UPDATE txn_locks SET txnId=? WHERE txnId=?", (stmt) => {
        stmt.bindId(1, committedTxnId);
        stmt.bindId(2, this._unsavedChangesTxnId);
        const rc = stmt.step();
        if (DbResult.BE_SQLITE_DONE !== rc)
          ServerBasedLocksError.throwError("lock-database-problem", `can't update locks database with txn ID of unsaved changes txn upon saving (error code ${rc})`);
      });

      this.lockDb.saveChanges();
    });
  }

  public [_close]() {
    this._removeOnCommitListener();

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

  /** Clear the cache of locally held locks.
   * Note: does *not* release locks from server.
   */
  private clearAllLocks() {
    this.lockDb.executeSQL("DELETE FROM locks");
    this.lockDb.executeSQL("DELETE FROM txn_locks");
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
      ServerBasedLocksError.throwError("has-unsaved-changes", "Locks cannot be released while the briefcase contains local changes");
    }

    return this[_releaseAllLocks]();
  }

  public async abandonAllLocks(): Promise<void> {
    if (this.briefcase.txns.hasLocalChanges) {
      ServerBasedLocksError.throwError("has-unsaved-changes", "Locks cannot be abandoned while the briefcase contains local changes");
    }

    if (IModelHost[_hubAccess].abandonAllLocks === undefined) {
      // If the IModelHub doesn't support an explicit abandon, call release with a blank changeset to indicate
      // that locks should be released without updating the changeset associated with the locks.
      await IModelHost[_hubAccess].releaseAllLocks({
        iModelId: this.briefcase.iModelId,
        briefcaseId: this.briefcase.briefcaseId,
        changeset: { id: "", index: 0 }
      });
    } else {
      await IModelHost[_hubAccess].abandonAllLocks(this.briefcase);
    }

    this.clearAllLocks();
  }

  private insertLock(id: Id64String, state: LockState, origin: LockOrigin): true {
    this.lockDb.withPreparedSqliteStatement("INSERT INTO locks(id,state,origin) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET state=excluded.state,origin=excluded.origin", (stmt) => {
      stmt.bindId(1, id);
      stmt.bindInteger(2, state);
      stmt.bindInteger(3, origin);
      const rc = stmt.step();
      if (DbResult.BE_SQLITE_DONE !== rc)
        throw new IModelError(rc, "can't insert lock into database");
    });

    return true;
  }

  private insertTxnLockRecord(id: Id64String, state: LockState, origin: LockOrigin): void {
    // Locks are always acquired in the current txn, which isn't a real txn until it's committed.
    // So use a placeholder txn id for now, and we'll update to the real txn id on commit.
    // This is important to distinguish new locks acquired in the current txn from locks acquired in previous reversed txns, which will only
    // be cleared (no longer reinstateable) on commit.
    this.lockDb.withPreparedSqliteStatement(`
      INSERT INTO txn_locks(txnId,elementId,state,origin,abandoned)
      VALUES (?,?,?,?,FALSE)
      ON CONFLICT(txnId,elementId)
        DO UPDATE SET
          state=excluded.state,
          origin=excluded.origin,
          abandoned=excluded.abandoned`, (stmt) => {
      stmt.bindId(1, this._unsavedChangesTxnId);
      stmt.bindId(2, id);
      stmt.bindInteger(3, state);
      stmt.bindInteger(4, origin);
      const rc = stmt.step();
      if (DbResult.BE_SQLITE_DONE !== rc)
        ServerBasedLocksError.throwError("lock-database-problem", `can't insert txn lock record into database (error code ${rc})`);
    });
  }

  private ownerHoldsExclusiveLock(id: Id64String | undefined): boolean {
    if (id === undefined || id === IModel.rootSubjectId)
      return false; // has no owners

    const { modelId, parentId } = this.getOwners(id);
    if (this.getLockState(modelId) === LockState.Exclusive || this.getLockState(parentId) === LockState.Exclusive)
      return true;

    // see if this model is exclusively locked by one of its owners. If so, save that fact on modelId so future tests won't have to descend.
    if (this.ownerHoldsExclusiveLock(modelId))
      return this.insertLock(modelId, LockState.Exclusive, LockOrigin.Discovered);

    // see if the parent is exclusively locked by one of its owners. If so, save that fact on parentId so future tests won't have to descend.
    return this.ownerHoldsExclusiveLock(parentId) ? this.insertLock(parentId!, LockState.Exclusive, LockOrigin.Discovered) : false; // eslint-disable-line @typescript-eslint/no-non-null-assertion
  }

  /** Determine whether an the exclusive lock is already held by an element (or one of its owners) */
  public holdsExclusiveLock(id: Id64String): boolean {
    // see if we hold the exclusive lock. or if one of the element's owners is exclusively locked (recursively)
    return this.getLockState(id) === LockState.Exclusive || this.ownerHoldsExclusiveLock(id);
  }

  public holdsSharedLock(id: Id64String): boolean {
    const state = this.getLockState(id);
    // see if we hold shared or exclusive lock, or if an owner has exclusive lock. If so we implicitly have shared lock, but owner holding shared lock doesn't help.
    return (state === LockState.Shared || state === LockState.Exclusive) || this.ownerHoldsExclusiveLock(id);
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
    for (const lock of locks) {
      this.insertLock(lock[0], lock[1], LockOrigin.Acquired);
      this.insertTxnLockRecord(lock[0], lock[1], LockOrigin.Acquired);
    }
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

  private async abandonLocks(locks: LockMap): Promise<void> {
    if (IModelHost[_hubAccess].abandonLocks === undefined) {
      // If the IModelHub doesn't support an explicit abandon, call acquireLocks with a blank changeset to indicate
      // that locks should be released without updating the changeset associated with the locks.
      await IModelHost[_hubAccess].acquireLocks({
        iModelId: this.briefcase.iModelId,
        briefcaseId: this.briefcase.briefcaseId,
        changeset: { id: "", index: 0 }
      }, locks);
    } else {
      await IModelHost[_hubAccess].abandonLocks(this.briefcase, locks);
    }
  }

  public async abandonLocksForCurrentUnsavedTxn(): Promise<boolean> {
    return this.abandonLocksForReversedTxn(this._unsavedChangesTxnId);
  }

  public async abandonLocksForReversedTxn(txnId: Id64String): Promise<boolean> {
    if (this.briefcase.txns.hasUnsavedChanges)
      ServerBasedLocksError.throwError("has-unsaved-changes", `cannot abandon locks for txn ${txnId} because the current txn has unsaved changes`);

    const txnProps = this.briefcase.txns.getTxnProps(txnId);
    if (txnProps === undefined) {
      // The current txn commonly won't exist on the TxnManager yet. It's often just a placeholder for not-yet-saved changes.
      // (Sometimes it will exist and refer to a reversed Txn).
      // The unsavedChangesTxnId won't exist on the TxnManager either, of course.
      // But all other txn ids must be known to the TxnManager or it is an error.
      if (txnId !== this.briefcase.txns.getCurrentTxnId() && txnId !== this._unsavedChangesTxnId)
        ServerBasedLocksError.throwError("txn-id-not-found", `cannot abandon locks for txn ${txnId} because it does not exist`);
    } else {
      // If the txn id is known to the TxnManager, then we require that it has already been reversed.
      if (!txnProps.reversed)
        ServerBasedLocksError.throwError("txn-not-reversed", `cannot abandon locks for txn ${txnId} because it has not been reversed`);
    }

    let locksReleased = false;

    // Abandon locks for unsaved (and now abandoned) changes.
    if (txnId !== this._unsavedChangesTxnId) {
      locksReleased = await this.abandonLocksForCurrentUnsavedTxn();
    }

    // At this point, we know:
    // 1. There are no unsaved changes, and the associated locks have been abandoned.
    // 2. The given txn ID has been reversed, which means any later txns are sure to have been reversed, too.

    // So we simply have to find all non-abandoned locks associated with the given txn or later, abandon them (or restore
    // them to their previous state), and mark them as abandoned in txn_locks.

    // Find all locks associated with the given txnId or later.
    // For each elementId, find the previous state of the lock before this Txn (if any), or None otherwise.
    // This is the state that we will restore the element's lock to. The reason we do this is to account for
    // lock upgrades. If an earlier Txn acquired a Shared lock on this element, and this Txn acquired an
    // Exclusive lock, we should restore the Shared lock.
    const allTxnLocks = new Map<Id64String, LockState>();
    const locksToRelease = new Map<Id64String, LockState>();
    this.lockDb.withPreparedSqliteStatement(
      `
        SELECT
          current.elementId,
          current.origin,
          IFNULL(
            (SELECT previous.state
              FROM txn_locks previous
              WHERE previous.elementId = current.elementId
                AND previous.txnId < ?2
                AND previous.abandoned=FALSE
              ORDER BY previous.txnId DESC
              LIMIT 1
            ),
            ?1
          ) AS previousState
        FROM txn_locks current
        WHERE current.txnId>=?2
          AND current.abandoned=FALSE
        ORDER BY current.txnId DESC
      `,
      (stmt) => {
        stmt.bindInteger(1, LockState.None);
        stmt.bindId(2, txnId);

        while (DbResult.BE_SQLITE_ROW === stmt.step()) {
          const elementId = stmt.getValueId(0);
          const origin = stmt.getValueInteger(1);
          const previousState = stmt.getValueInteger(2);
          allTxnLocks.set(elementId, previousState);
          if (origin !== LockOrigin.NewElement)
            locksToRelease.set(elementId, previousState);
        }
      });

    // Release the locks on the server.
    if (locksToRelease.size > 0)
      await this.abandonLocks(locksToRelease);

    // Mark the txn locks as abandoned.
    if (txnId === this._unsavedChangesTxnId) {
      // After abandoning locks held for the "unsaved" txn, we clear them completely because they are not reinstateable.
      this.lockDb.withPreparedSqliteStatement("DELETE FROM txn_locks WHERE txnId=?", (stmt) => {
        stmt.bindId(1, this._unsavedChangesTxnId);
        const rc = stmt.step();
        if (DbResult.BE_SQLITE_DONE !== rc)
          ServerBasedLocksError.throwError("lock-database-problem", `can't delete txn locks for unsaved changes in database (error code ${rc})`);
      });
    } else {
      this.lockDb.withPreparedSqliteStatement("UPDATE txn_locks SET abandoned=TRUE WHERE txnId>=?", (stmt) => {
        stmt.bindId(1, txnId);
        const rc = stmt.step();
        if (DbResult.BE_SQLITE_DONE !== rc)
          ServerBasedLocksError.throwError("lock-database-problem", `can't mark txn locks as abandoned in database (error code ${rc})`);
      });
    }

    // Restore each lock to its previous state (if any) in the local cache. Usually this means deleting it.
    for (const [elementId, previousState] of allTxnLocks) {
      if (previousState === LockState.None) {
        this.lockDb.withPreparedSqliteStatement("DELETE FROM locks WHERE id=?", (stmt) => {
          stmt.bindId(1, elementId);
          const rc = stmt.step();
          if (DbResult.BE_SQLITE_DONE !== rc)
            ServerBasedLocksError.throwError("lock-database-problem", `can't delete lock from database (error code ${rc})`);
        });
      } else {
        this.lockDb.withPreparedSqliteStatement("UPDATE locks SET state=? WHERE id=?", (stmt) => {
          stmt.bindInteger(1, previousState);
          stmt.bindId(2, elementId);
          const rc = stmt.step();
          if (DbResult.BE_SQLITE_DONE !== rc)
            ServerBasedLocksError.throwError("lock-database-problem", `can't update lock in database (error code ${rc})`);
        });
      }
    }

    // Ideally we'd only invalidate "Discovered" locks that are related to this Txn's Shared and
    // Exclusive locks. But that is a lot of added complexity for little benefit.
    // Clearing them all will have no impact on correctness and a minimal impact on performance.
    this.clearDiscoveredLocks();

    this.lockDb.saveChanges();

    return locksReleased || allTxnLocks.size > 0;
  }

  private getAbandonedLocksForTxn(txnId: Id64String): {
    newElementLocks: Map<Id64String, LockState>,
    locksToAcquire: Map<Id64String, LockState>
  } {
    const newElementLocks = new Map<Id64String, LockState>();
    const locksToAcquire = new Map<Id64String, LockState>();
    this.lockDb.withPreparedSqliteStatement(
      "SELECT elementId, state, origin FROM txn_locks WHERE txnId<=? AND abandoned=TRUE",
      (stmt) => {
        stmt.bindId(1, txnId);

        while (DbResult.BE_SQLITE_ROW === stmt.step()) {
          const elementId = stmt.getValueId(0);
          const state = stmt.getValueInteger(1);
          const origin = stmt.getValueInteger(2);
          if (origin === LockOrigin.NewElement)
            newElementLocks.set(elementId, state);
          else
            locksToAcquire.set(elementId, state);
        }
      });

    return { newElementLocks, locksToAcquire };
  }

  public async acquireLocksForReinstatingTxn(txnId: Id64String): Promise<boolean> {
    if (this.briefcase.txns.hasUnsavedChanges)
      ServerBasedLocksError.throwError("has-unsaved-changes", `cannot acquire locks for reinstating txn ${txnId} because the current txn has unsaved changes`);

    // If the Txn is known to the TxnManager, we can proceed. We don't need to check if it is currently
    // reversed, because if it isn't, then abandonLocksForReversedTxn couldn't have been called, and so the
    // locks are still held. Proceeding with this method will be a no-op, but it will be harmless.
    // However, if the Txn Id is unknown, it may have been canceled or refer to the current Txn
    // whose unsaved changes were just abandoned. Or it's just plain-old invalid. In any case, we can't
    // re-acquire the associated locks.
    const txnProps = this.briefcase.txns.getTxnProps(txnId);
    if (txnProps === undefined) {
      ServerBasedLocksError.throwError("txn-id-not-found", `cannot acquire locks for txn ${txnId} because it does not exist or has not been saved`);
    }

    // Find all locks associated with the given txnId.
    const { newElementLocks, locksToAcquire } = this.getAbandonedLocksForTxn(txnId);

    // Attempt to acquire the locks on the server. This may fail if the locks are no longer available!
    if (locksToAcquire.size > 0)
      await IModelHost[_hubAccess].acquireLocks(this.briefcase, locksToAcquire); // throws if unsuccessful

    // Mark the txn locks as no longer abandoned.
    this.lockDb.withPreparedSqliteStatement("UPDATE txn_locks SET abandoned=FALSE WHERE txnId<=?", (stmt) => {
      stmt.bindId(1, txnId);
      const rc = stmt.step();
      if (DbResult.BE_SQLITE_DONE !== rc)
        ServerBasedLocksError.throwError("lock-database-problem", `can't mark txn locks as no longer abandoned in database (error code ${rc})`);
    });

    // Insert the newly-acquired locks in the local cache. Note that we don't need to insert entries in the txn_locks table,
    // because these locks are already associated with the Txn.
    for (const [elementId, state] of locksToAcquire) {
      this.insertLock(elementId, state, LockOrigin.Acquired);
    }
    for (const [elementId, state] of newElementLocks) {
      this.insertLock(elementId, state, LockOrigin.NewElement);
    }

    // Ideally we'd only invalidate "Discovered" locks that are related to this Txn's Shared and
    // Exclusive locks. But that is a lot of added complexity for little benefit.
    // Clearing them all will have no impact on correctness and a minimal impact on performance.
    this.clearDiscoveredLocks();

    this.lockDb.saveChanges();

    return locksToAcquire.size > 0 || newElementLocks.size > 0;
  }

  public holdsNecessaryLocksForReinstatingTxn(txnId: Id64String): boolean {
    const locks = this.getAbandonedLocksForTxn(txnId);
    return locks.locksToAcquire.size === 0 && locks.newElementLocks.size === 0;
  }

  public clearTxnLockRecords(txnId: Id64String) {
    this.lockDb.withPreparedSqliteStatement("DELETE FROM txn_locks WHERE txnId!=? AND txnId>=?", (stmt) => {
      stmt.bindId(1, this._unsavedChangesTxnId);
      stmt.bindId(2, txnId);
      const rc = stmt.step();
      if (DbResult.BE_SQLITE_DONE !== rc)
        ServerBasedLocksError.throwError("lock-database-problem", `can't delete txn lock records from database (error code ${rc})`);
    });

    this.lockDb.saveChanges();
  }

  /** When an element is newly created in a session, we hold the lock on it implicitly. Save that fact. */
  public [_elementWasCreated](id: Id64String) {
    this.insertLock(id, LockState.Exclusive, LockOrigin.NewElement);
    this.insertTxnLockRecord(id, LockState.Exclusive, LockOrigin.NewElement);
    this.lockDb.saveChanges();
  }

  private clearDiscoveredLocks() {
    this.lockDb.withPreparedSqliteStatement("DELETE FROM locks WHERE origin=?", (stmt) => {
      stmt.bindInteger(1, LockOrigin.Discovered);
      const rc = stmt.step();
      if (DbResult.BE_SQLITE_DONE !== rc)
        ServerBasedLocksError.throwError("lock-database-problem", `can't delete discovered locks from database (error code ${rc})`);
    });
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
