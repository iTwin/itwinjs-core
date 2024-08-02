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
   */
  acquireLocks(arg: {
    /** if present, one or more elements to obtain shared lock */
    shared?: Id64Arg;
    /** if present, one or more elements to obtain exclusive lock */
    exclusive?: Id64Arg;
  }): Promise<void>;

  /** Release all locks currently held by this briefcase from the locker server.
   * This is typically done on your behalf by [[BriefcaseDb.pushChanges]].
   * You may want to do it manually when abandoning all of your briefcase's local changes.
   * You cannot release your locks if your briefcase contains local changes.
   * @throws Error if the briefcase has local changes, or if any other error occurs while releasing the locks.
   */
  releaseAllLocks(): Promise<void>;

  /**
   * Release all locks currently held by this Briefcase from the lock server.
   * Not possible to release locks unless push or abandon all changes. Should only be called internally.
   * @internal
   */
  [_releaseAllLocks]: () => Promise<void>;
}
