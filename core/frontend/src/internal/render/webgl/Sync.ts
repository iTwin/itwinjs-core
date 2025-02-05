/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module WebGL
 */

/** Represents the state of synchronization between a [[SyncTarget]] and a [[SyncObserver]]. Owned by a [[SyncTarget]].
 * When the [[SyncObserver]]'s state changes via [[desync]], all associated [[SyncToken]]s become out-of-sync.
 * Use [[sync]] to synchronize the [[SyncObserver]] with the [[SyncTarget]]'s state.
 * @internal
 */
export interface SyncToken {
  /** The target with which this token was most recently synchronized. */
  target: SyncTarget;
  /** The value of the target's synchronization key at the time of most recent synchronization. */
  syncKey: number;
}

/** Interface adopted by an object which wants to synchronize itself with the changing state of a [[SyncTarget]].
 * Use [[sync]] to synchronize.
 * @internal
 */
export interface SyncObserver {
  /** Token representing current synchronization state. Should always be initialized to `undefined`. [[sync]] will assign to it. */
  syncToken?: SyncToken;
}

/** Interface adopted by an object that can change and with which other objects implementing [[SyncObserver]] can synchronize.
 * Each time the state of the object changes in a way that affects [[SyncObserver]]s, [[desync]] should be used. This will generate a new synchronization key.
 * @internal
 */
export interface SyncTarget {
  /** A unique key that is regenerated each time the object's state changes via a call to [[desync]]. Can be initialized to any integer value - zero is a good choice. */
  syncKey: number;
}

/** Returns true if the target and observer are already synchronized.
 * @internal
 */
export function isSynchronized(target: SyncTarget, observer: SyncObserver): boolean {
  const token = observer.syncToken;
  return undefined !== token && token.target === target && token.syncKey === target.syncKey;
}

/** If the observer is already synchronized with the target, returns true.
 * Otherwise, synchronizes the observer's [[SyncToken]] with the target and returns false.
 * This is used, for example, to associate uniform variable state with shader programs such that the program can trivially detect if the state has changed since the last time
 * the variable's value was set.
 * @internal
 */
export function sync(target: SyncTarget, observer: SyncObserver): boolean {
  const syncKey = target.syncKey;
  const token = observer.syncToken;
  if (undefined === token) {
    observer.syncToken = { target, syncKey };
    return false;
  }

  if (token.syncKey === syncKey && token.target === target)
    return true;

  token.syncKey = syncKey;
  token.target = target;
  return false;
}

/** Mark the [[SyncTarget]] as having changed in a way that affects associated [[SyncObserver]]s.
 * The next time [[sync]] is used, all [[SyncToken]] objects associated with the target will be recognized as out of sync.
 * @internal
 */
export function desync(target: SyncTarget): void {
  // Let's make the relatively safe assumption that we will never roll over, and the even safer assumption that if we do, no outstanding SyncTokens holding a very small value will exist at that time.
  if (target.syncKey < Number.MAX_SAFE_INTEGER)
    ++target.syncKey;
  else
    target.syncKey = Number.MIN_SAFE_INTEGER;
}
