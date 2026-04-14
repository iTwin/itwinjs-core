/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module iModels
 */

import { Id64Arg, Id64String } from "@itwin/core-bentley";
import { _close, _elementWasCreated, _implementationProhibited, _releaseAllLocks } from "./internal/Symbols";

/**
 * Interface for acquiring element locks to [coordinate simultaneous edits]($docs/learning/backend/ConcurrencyControl.md) from multiple briefcases.
 * @see [[IModelDb.locks]] to access the locks for an iModel.
 * @public
 */
export interface LockControl {
  /** @internal*/
  readonly [_implementationProhibited]: unknown;

  /**
   * true if this LockControl uses a server-based concurrency approach.
   */
  readonly isServerBased: boolean;

  /**
   * Close the local lock control database
   * @internal
   */
  [_close]: () => void;

  /**
   * Notification that a new element was just created. Called by [[Element.onInserted]]
   * @internal
   */
  [_elementWasCreated]: (id: Id64String) => void;

  /**
   * Throw if locks are required and the exclusive lock is not held on the supplied element.
   * Note: there is no need to check the shared locks on parents/models since an element cannot hold the exclusive lock without first obtaining them.
   * Called by functions like [[Element.onUpdate]], [[Element.onDelete]], etc.
   */
  checkExclusiveLock(id: Id64String, type: string, operation: string): void;

  /**
   * Throw if locks are required and a shared lock is not held on the supplied element.
   * Called by [[Element.onInsert]] to ensure shared lock is held on the new element's model and parent element.
   */
  checkSharedLock(id: Id64String, type: string, operation: string): void;

  /**
   * Determine whether the owning iModel currently holds the exclusive lock on the specified element.
   */
  holdsExclusiveLock(id: Id64String): boolean;

  /**
   * Determine whether the owning iModel currently holds a shared lock on the specified element.
   */
  holdsSharedLock(id: Id64String): boolean;

  /**
   * Acquire locks on one or more elements from the lock server, if required and not already held.
   * If any required lock is not available, this method throws an exception and *none* of the requested locks are acquired.
   * @note Acquiring the exclusive lock on an element requires also obtaining a shared lock on all its owner elements. This method will
   * attempt to acquire all necessary locks for both sets of input ids.
   * @note Calling this method after reversing or reinstating a Txn indicates the start of a brand new Txn with the current Txn ID,
   * making it invalid to call [[abandonLocksForReversedTxn]] or [[acquireLocksForReinstatingTxn]] for previously-reversed
   * Txns with the current ID or greater.
   */
  acquireLocks(arg: {
    /** if present, one or more elements to obtain shared lock */
    shared?: Id64Arg;
    /** if present, one or more elements to obtain exclusive lock */
    exclusive?: Id64Arg;
  }): Promise<void>;

  /** Release all locks currently held by this briefcase from the lock server after editing the associated elements.
   * This is typically done on your behalf by [[BriefcaseDb.pushChanges]].
   * If you are abandoning changes instead of pushing them, you should call [[abandonAllLocks]] instead.
   * You may want to do it manually when abandoning all of your briefcase's local changes.
   * You cannot release your locks if your briefcase contains local changes.
   * @throws Error if the briefcase has local changes, or if any other error occurs while releasing the locks.
   */
  releaseAllLocks(): Promise<void>;

  /**
   * Abandons all locks currently held by this briefcase when none of the associated elements have
   * been or will be modified. This is only valid to do when none of the elements protected by
   * the currently-held locks have been edited, or if all edits have been reversed or abandoned without
   * pushing them.
   * @beta
   *
   * The locks are released on the IModelHub, but the changeset associated with the locks is not updated,
   * reflecting the fact that the associated elements were not edited.
   */
  abandonAllLocks(): Promise<void>;

  /**
   * Release all locks currently held by this Briefcase from the lock server.
   * Not possible to release locks unless push or abandon all changes. Should only be called internally.
   * @internal
   */
  [_releaseAllLocks]: () => Promise<void>;

  /**
   * Abandons the locks that were acquired during a given Txn and all later Txns, all of which must already
   * have been reversed.
   * @beta
   *
   * @param txnId The ID of the first Txn whose locks should be abandoned. This must either be a Txn that has
   * already been reversed, or the [[TxnManager.getCurrentTxnId]]. In either case, the current Txn must not
   * have any unsaved changes.
   * @returns A promise that resolves to true if any locks were successfully abandoned. False if there were no locks to abandon,
   * which may be the case if the Txns did not acquire any locks or if they were already abandoned. The Promise rejects
   * with an ITwinError if the Txn has not been reversed, the current Txn has unsaved changes, or if any other error occurs
   * while releasing the locks.
   * @note This method also implicitly calls [[abandonLocksForCurrentUnsavedTxn]]. Locks acquired in the current,
   * unsaved Txn will be abandoned when calling this method. However, they can not be re-acquired using
   * [[acquireLocksForReinstatingTxn]]. This is because there is no way to recover these unsaved changes after abandoning
   * them, so it is rarely useful to re-acquire the locks associated with irrecoverable changes.
   */
  abandonLocksForReversedTxn(txnId: Id64String): Promise<boolean>;

  /**
   * Abandons the locks that were acquired during the current, unsaved Txn. Any changes in the unsaved Txn must be abandoned
   * before calling this method.
   * @beta
   *
   * @returns A promise that resolves to true if any locks were successfully abandoned. False if there were no locks to abandon,
   * which may be the case if the current Txn did not acquire any locks or if they were already abandoned. The Promise rejects
   * with an ITwinError if the current Txn has unsaved changes, or if any other error occurs while releasing the locks.
   */
  abandonLocksForCurrentUnsavedTxn(): Promise<boolean>;

  /**
   * Re-acquire the locks that were previously acquired during a given Txn and all previous Txns. These locks are
   * expected to have previously been released with {@link LockControl.abandonLocksForReversedTxn}. This is used
   * just before reinstating a previously-reversed Txn to ensure that the necessary locks are held for the
   * reinstated changes.
   * @beta
   *
   * It is possible that the locks may no longer be available, in which case the returned Promise will reject
   * with an exception.
   *
   * @param txnId The ID of the last Txn whose locks should be re-acquired.
   * @returns A promise that resolves to true if any locks were successfully acquired. False if there were no locks to acquire,
   * which may be the case if the Txn in question did not acquire any locks or if they were already re-acquired. The Promise
   * rejects with an ITwinError if the Txn does not exist, the current Txn has unsaved changes, the locks cannot be acquired,
   * or if any other error occurs while acquiring the locks.
   */
  acquireLocksForReinstatingTxn(txnId: Id64String): Promise<boolean>;

  /**
   * Checks whether the locks originally acquired for a specified reversed Txn, and all earlier Txns, were either not abandoned
   * or have already been re-acquired.
   * @beta
   *
   * If this method returns true, it is safe to reinstate the given Txn with [[TxnManager.reinstateTxn]]. If it returns false,
   * the necessary locks must be acquired first, either by calling [[TxnManager.reinstateTxnAsync]] or by explicitly calling
   * [[acquireLocksForReinstatingTxn]] first.
   *
   * @param txnId The ID of the Txn to check.
   * @returns True if the necessary locks are currently held, false otherwise.
   */
  holdsNecessaryLocksForReinstatingTxn(txnId: Id64String): boolean;

  /**
   * Clears the records of locks acquired for a given Txn and all later Txns from the local lock database. Call this after
   * a Txn becomes unreachable. This allows an ID to potentially be reused for a different Txn in the future.
   * @beta
   *
   * After invoking this method, {@link LockControl.abandonLocksForReversedTxn} and {@link LockControl.acquireLocksForReinstatingTxn} will no
   * longer be able to operate on this Txn or any later Txns.
   *
   * @param txnId The ID of the first Txn whose lock records should be cleared.
   */
  clearTxnLockRecords(txnId: Id64String): void;
}
